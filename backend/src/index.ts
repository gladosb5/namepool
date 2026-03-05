import express from 'express';
import { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import namecoinApi from './api/namecoin/namecoin-api-factory';
import cluster from 'cluster';
import DB from './database';
import config from './config';
import blocks from './api/blocks';
import memPool from './api/mempool';
import diskCache from './api/disk-cache';
import statistics from './api/statistics/statistics';
import websocketHandler from './api/websocket-handler';
import logger from './logger';
import backendInfo from './api/backend-info';
import loadingIndicators from './api/loading-indicators';
import mempool from './api/mempool';
import elementsParser from './api/liquid/elements-parser';
import databaseMigration from './api/database-migration';
import syncAssets from './sync-assets';
import icons from './api/liquid/icons';
import { Common } from './api/common';
import poolsUpdater from './tasks/pools-updater';
import indexer from './indexer';
import nodesRoutes from './api/explorer/nodes.routes';
import channelsRoutes from './api/explorer/channels.routes';
import generalLightningRoutes from './api/explorer/general.routes';
import lightningStatsUpdater from './tasks/lightning/stats-updater.service';
import networkSyncService from './tasks/lightning/network-sync.service';
import statisticsRoutes from './api/statistics/statistics.routes';
import pricesRoutes from './api/prices/prices.routes';
import miningRoutes from './api/mining/mining-routes';
import liquidRoutes from './api/liquid/liquid.routes';
import namecoinRoutes from './api/namecoin/namecoin.routes';
import servicesRoutes from './api/services/services-routes';
import fundingTxFetcher from './tasks/lightning/sync-tasks/funding-tx-fetcher';
import forensicsService from './tasks/lightning/forensics.service';
import priceUpdater from './tasks/price-updater';
import chainTips from './api/chain-tips';
import { AxiosError } from 'axios';
import v8 from 'v8';
import { formatBytes, getBytesUnit } from './utils/format';
import redisCache from './api/redis-cache';
import accelerationApi from './api/services/acceleration';
import namecoinCoreRoutes from './api/namecoin/namecoin-core.routes';
import namecoinSecondClient from './api/namecoin/namecoin-second-client';
import accelerationRoutes from './api/acceleration/acceleration.routes';
import aboutRoutes from './api/about.routes';
import mempoolBlocks from './api/mempool-blocks';
import walletApi from './api/services/wallets';
import stratumApi from './api/services/stratum';

function isHeadersSentError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ERR_HTTP_HEADERS_SENT'
    || error.message.includes('Cannot set headers after they are sent');
}

class Server {
  private wss: WebSocket.Server | undefined;
  private wssUnixSocket: WebSocket.Server | undefined;
  private server: http.Server | undefined;
  private serverUnixSocket: http.Server | undefined;
  private app: Application;
  private currentBackendRetryInterval = 1;
  private backendRetryCount = 0;

  private maxHeapSize: number = 0;
  private heapLogInterval: number = 60;
  private warnedHeapCritical: boolean = false;
  private lastHeapLogTime: number | null = null;

  constructor() {
    this.app = express();

    if (!config.MEMPOOL.SPAWN_CLUSTER_PROCS) {
      this.startServer();
      return;
    }

    if (cluster.isPrimary) {
      logger.notice(`Mempool Server (Master) is running on port ${config.MEMPOOL.HTTP_PORT} (${backendInfo.getShortCommitHash()})`);

      const numCPUs = config.MEMPOOL.SPAWN_CLUSTER_PROCS;
      for (let i = 0; i < numCPUs; i++) {
        const env = { workerId: i };
        const worker = cluster.fork(env);
        worker.process['env'] = env;
      }

      cluster.on('exit', (worker, code, signal) => {
        const workerId = worker.process['env'].workerId;
        logger.warn(`Mempool Worker PID #${worker.process.pid} workerId: ${workerId} died. Restarting in 10 seconds... ${signal || code}`);
        setTimeout(() => {
          const env = { workerId: workerId };
          const newWorker = cluster.fork(env);
          newWorker.process['env'] = env;
        }, 10000);
      });
    } else {
      this.startServer(true);
    }
  }

  async startServer(worker = false): Promise<void> {
    logger.notice(`Starting Mempool Server${worker ? ' (worker)' : ''}... (${backendInfo.getShortCommitHash()})`);

    // Register cleanup listeners for exit events
    ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'].forEach(event => {
      process.on(event, () => { this.forceExit(event); });
    });
    process.on('exit', () => {
      logger.debug(`'exit' event triggered`);
      this.exitCleanup();
    });
    process.on('uncaughtException', (error) => {
      if (isHeadersSentError(error)) {
        logger.warn(`Ignoring uncaught non-fatal response error: ${error.message}`, 'Server');
        return;
      }
      console.error(`uncaughtException:`, error);
      this.forceExit('uncaughtException', 1);
    });
    process.on('unhandledRejection', (reason, promise) => {
      if (isHeadersSentError(reason)) {
        const message = reason instanceof Error ? reason.message : String(reason);
        logger.warn(`Ignoring unhandled non-fatal response error: ${message}`, 'Server');
        return;
      }
      console.error(`unhandledRejection:`, reason, promise);
      this.forceExit('unhandledRejection', 1);
    });

    if (config.MEMPOOL.BACKEND === 'esplora') {
      namecoinApi.startHealthChecks();
    }

    if (config.DATABASE.ENABLED) {
      DB.getPidLock();

      await DB.checkDbConnection();
      try {
        if (process.env.npm_config_reindex_blocks === 'true') { // Re-index requests
          await databaseMigration.$blocksReindexingTruncate();
        }
        await databaseMigration.$initializeOrMigrateDatabase();
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Error');
      }
    }

    this.app
      .use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Accept,Authorization,Cache-Control,Content-Type,DNT,If-Modified-Since,Keep-Alive,Origin,User-Agent,X-Requested-With');
        res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count,X-Mempool-Auth');
        next();
      })
      .use(express.urlencoded({ extended: true, limit: '10mb' }))
      .use(express.text({ type: ['text/plain', 'application/base64'], limit: '10mb' }))
      .use(express.json({ limit: '10mb' }))
      ;

    if (config.DATABASE.ENABLED && config.FIAT_PRICE.ENABLED) {
      await priceUpdater.$initializeLatestPriceWithDb();
    }

    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    if (config.MEMPOOL.UNIX_SOCKET_PATH) {
      this.serverUnixSocket = http.createServer(this.app);
      this.wssUnixSocket = new WebSocket.Server({ server: this.serverUnixSocket });
    }

    this.setUpWebsocketHandling();

    await poolsUpdater.updatePoolsJson(); // Needs to be done before loading the disk cache because we sometimes wipe it
    if (config.DATABASE.ENABLED === true && config.MEMPOOL.ENABLED && ['mainnet', 'testnet', 'signet', 'testnet4'].includes(config.MEMPOOL.NETWORK) && !poolsUpdater.currentSha) {
      logger.err(`Failed to retreive pools-v2.json sha, cannot run block indexing. Please make sure you've set valid urls in your mempool-config.json::MEMPOOL::POOLS_JSON_URL and mempool-config.json::MEMPOOL::POOLS_JSON_TREE_UR, aborting now`);
      return process.exit(1);
    }

    await syncAssets.syncAssets$();
    if (config.DATABASE.ENABLED) {
      await mempoolBlocks.updatePools$();
    }
    if (config.MEMPOOL.ENABLED) {
      if (config.MEMPOOL.CACHE_ENABLED) {
        await diskCache.$loadMempoolCache();
      } else if (config.REDIS.ENABLED) {
        await redisCache.$loadCache();
      }
    }

    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED && cluster.isPrimary) {
      statistics.startStatistics();
    }

    if (Common.isLiquid()) {
      const refreshIcons = () => {
        try {
          icons.loadIcons();
        } catch (e) {
          logger.err('Cannot load liquid icons. Ignoring. Reason: ' + (e instanceof Error ? e.message : e));
        }
      };
      // Run once on startup.
      refreshIcons();
      // Matches crontab refresh interval for asset db.
      setInterval(refreshIcons, 3600_000);
    }

    if (config.FIAT_PRICE.ENABLED) {
      priceUpdater.$run();
    }
    await chainTips.updateOrphanedBlocks();

    this.setUpHttpApiRoutes();
    this.setUpFrontendRoutes();

    if (config.MEMPOOL.ENABLED) {
      this.runMainUpdateLoop();
    }

    setInterval(() => { this.healthCheck(); }, 2500);

    if (config.LIGHTNING.ENABLED) {
      this.$runLightningBackend();
    }

    this.server.listen(config.MEMPOOL.HTTP_PORT, () => {
      if (worker) {
        logger.info(`Mempool Server worker #${process.pid} started`);
      } else {
        logger.notice(`Mempool Server is running on port ${config.MEMPOOL.HTTP_PORT}`);
      }
    });

    if (this.serverUnixSocket) {
      this.serverUnixSocket.listen(config.MEMPOOL.UNIX_SOCKET_PATH, () => {
        if (worker) {
          logger.info(`Mempool Server worker #${process.pid} started`);
        } else {
          logger.notice(`Mempool Server is listening on ${config.MEMPOOL.UNIX_SOCKET_PATH}`);
        }
      });
    }

    poolsUpdater.$startService();
  }

  async runMainUpdateLoop(): Promise<void> {
    const start = Date.now();
    try {
      try {
        await memPool.$updateMemPoolInfo();
      } catch (e) {
        const msg = `updateMempoolInfo: ${(e instanceof Error ? e.message : e)}`;
        if (config.MEMPOOL.USE_SECOND_NODE_FOR_MINFEE) {
          logger.warn(msg);
        } else {
          logger.debug(msg);
        }
      }
      const newMempool = await namecoinApi.$getRawMempool();
      const minFeeMempool = memPool.limitGBT ? await namecoinSecondClient.getRawMemPool() : null;
      const minFeeTip = memPool.limitGBT ? await namecoinSecondClient.getBlockCount() : -1;
      const latestAccelerations = await accelerationApi.$updateAccelerations();
      const numHandledBlocks = await blocks.$updateBlocks();
      const pollRate = config.MEMPOOL.POLL_RATE_MS * (indexer.indexerIsRunning() ? 10 : 1);
      if (numHandledBlocks === 0) {
        await memPool.$updateMempool(newMempool, latestAccelerations, minFeeMempool, minFeeTip, pollRate);
      }
      indexer.$run();
      if (config.WALLETS.ENABLED) {
        // might take a while, so run in the background
        walletApi.$syncWallets();
      }
      if (config.FIAT_PRICE.ENABLED) {
        priceUpdater.$run();
      }

      // rerun immediately if we skipped the mempool update, otherwise wait POLL_RATE_MS
      const elapsed = Date.now() - start;
      const remainingTime = Math.max(0, pollRate - elapsed);
      setTimeout(this.runMainUpdateLoop.bind(this), numHandledBlocks > 0 ? 0 : remainingTime);
      this.backendRetryCount = 0;
    } catch (e: any) {
      this.backendRetryCount++;
      let loggerMsg = `Exception in runMainUpdateLoop() (count: ${this.backendRetryCount}). Retrying in ${this.currentBackendRetryInterval} sec.`;
      loggerMsg += ` Reason: ${(e instanceof Error ? e.message : e)}.`;
      if (e?.stack) {
        loggerMsg += ` Stack trace: ${e.stack}`;
      }
      // When we get a first Exception, only `logger.debug` it and retry after 5 seconds
      // From the second Exception, `logger.warn` the Exception and increase the retry delay
      if (this.backendRetryCount >= 5) {
        logger.warn(loggerMsg);
        mempool.setOutOfSync();
      } else {
        logger.debug(loggerMsg);
      }
      if (e instanceof AxiosError) {
        logger.debug(`AxiosError: ${e?.message}`);
      }
      setTimeout(this.runMainUpdateLoop.bind(this), 1000 * this.currentBackendRetryInterval);
    } finally {
      diskCache.unlock();
    }
  }

  async $runLightningBackend(): Promise<void> {
    try {
      await fundingTxFetcher.$init();
      await networkSyncService.$startService();
      await lightningStatsUpdater.$startService();
      await forensicsService.$startService();
    } catch(e) {
      logger.err(`Exception in $runLightningBackend. Restarting in 1 minute. Reason: ${(e instanceof Error ? e.message : e)}`);
      await Common.sleep$(1000 * 60);
      this.$runLightningBackend();
    };
  }

  setUpWebsocketHandling(): void {
    if (this.wss) {
      websocketHandler.addWebsocketServer(this.wss);
    }
    if (this.wssUnixSocket) {
      websocketHandler.addWebsocketServer(this.wssUnixSocket);
    }

    if (Common.isLiquid() && config.DATABASE.ENABLED) {
      blocks.setNewBlockCallback(async () => {
        try {
          await elementsParser.$parse();
          await elementsParser.$updateFederationUtxos();
        } catch (e) {
          logger.warn('Elements parsing error: ' + (e instanceof Error ? e.message : e));
        }
      });
    }
    websocketHandler.setupConnectionHandling();
    if (config.MEMPOOL.ENABLED) {
      statistics.setNewStatisticsEntryCallback(websocketHandler.handleNewStatistic.bind(websocketHandler));
      memPool.setAsyncMempoolChangedCallback(websocketHandler.$handleMempoolChange.bind(websocketHandler));
      blocks.setNewAsyncBlockCallback(websocketHandler.handleNewBlock.bind(websocketHandler));
    }
    if (config.FIAT_PRICE.ENABLED) {
      priceUpdater.setRatesChangedCallback(websocketHandler.handleNewConversionRates.bind(websocketHandler));
    }
    loadingIndicators.setProgressChangedCallback(websocketHandler.handleLoadingChanged.bind(websocketHandler));

    accelerationApi.connectWebsocket();
    if (config.STRATUM.ENABLED) {
      stratumApi.connectWebsocket();
    }
  }

  setUpHttpApiRoutes(): void {
    namecoinRoutes.initRoutes(this.app);
    if (config.MEMPOOL.OFFICIAL) {
      namecoinCoreRoutes.initRoutes(this.app);
    }
    pricesRoutes.initRoutes(this.app);
    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED && config.MEMPOOL.ENABLED) {
      statisticsRoutes.initRoutes(this.app);
    }
    if (Common.indexingEnabled() && config.MEMPOOL.ENABLED) {
      miningRoutes.initRoutes(this.app);
    }
    if (Common.isLiquid()) {
      liquidRoutes.initRoutes(this.app);
    }
    if (config.LIGHTNING.ENABLED) {
      generalLightningRoutes.initRoutes(this.app);
      nodesRoutes.initRoutes(this.app);
      channelsRoutes.initRoutes(this.app);
    }
    if (config.MEMPOOL_SERVICES.ACCELERATIONS) {
      accelerationRoutes.initRoutes(this.app);
    }
    if (config.WALLETS.ENABLED) {
      servicesRoutes.initRoutes(this.app);
    }
    if (!config.MEMPOOL.OFFICIAL) {
      aboutRoutes.initRoutes(this.app);
    }
  }

  setUpFrontendRoutes(): void {
    const browserDistRoot = path.resolve(__dirname, '../../frontend/dist/mempool/browser');
    if (!fs.existsSync(browserDistRoot) || !fs.statSync(browserDistRoot).isDirectory()) {
      this.app.get('/', (req, res) => {
        res
          .status(200)
          .type('text/plain')
          .send('Namepool backend is running, but frontend assets were not found. Build the frontend or put it behind nginx to serve the UI.');
      });
      return;
    }

    const availableLocales = new Set(
      fs.readdirSync(browserDistRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((dir) => fs.existsSync(path.join(browserDistRoot, dir, 'index.html')))
    );

    const pickDefaultLocale = (): string | null => {
      if (availableLocales.has('en-US')) {
        return 'en-US';
      }
      const first = Array.from(availableLocales.values())[0];
      return first ?? null;
    };

    const defaultLocale = pickDefaultLocale();
    if (!defaultLocale) {
      return;
    }

    const resourcesDir = path.join(browserDistRoot, 'resources');
    if (fs.existsSync(resourcesDir) && fs.statSync(resourcesDir).isDirectory()) {
      this.app.use('/resources', express.static(resourcesDir, { maxAge: '1h', immutable: false }));
    }

    const defaultLocaleDir = path.join(browserDistRoot, defaultLocale);
    this.app.use(express.static(defaultLocaleDir, { maxAge: '1y', immutable: true, index: false }));

    for (const locale of availableLocales) {
      if (locale === defaultLocale || locale === 'resources') {
        continue;
      }
      const localeDir = path.join(browserDistRoot, locale);
      this.app.use(`/${locale}`, express.static(localeDir, { maxAge: '1y', immutable: true, index: false }));
    }

    const apiPrefix = config.MEMPOOL.API_URL_PREFIX || '/api/';
    const isApiRoute = (reqPath: string): boolean => {
      if (reqPath.startsWith(apiPrefix)) {
        return true;
      }
      return reqPath.startsWith('/api/');
    };

    const isAssetRequest = (reqPath: string): boolean => {
      if (reqPath.startsWith('/resources/')) {
        return true;
      }
      const lastSegment = reqPath.split('/').pop() ?? '';
      return lastSegment.includes('.');
    };

    const sendLocaleIndex = (res: Response, locale: string): void => {
      res.sendFile(path.join(browserDistRoot, locale, 'index.html'));
    };

    this.app.get('/', (req, res, next) => {
      if (isApiRoute(req.path)) {
        return next();
      }
      return sendLocaleIndex(res, defaultLocale);
    });

    this.app.get('/:locale', (req, res, next) => {
      const locale = req.params.locale;
      if (!availableLocales.has(locale)) {
        return next();
      }
      return res.redirect(302, `/${locale}/`);
    });

    this.app.get('/:locale/', (req, res, next) => {
      const locale = req.params.locale;
      if (!availableLocales.has(locale)) {
        return next();
      }
      return sendLocaleIndex(res, locale);
    });

    this.app.get('*', (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }
      if (isApiRoute(req.path) || isAssetRequest(req.path)) {
        return next();
      }

      const acceptsHtml = (req.headers.accept ?? '').includes('text/html');
      if (!acceptsHtml) {
        return next();
      }

      const pathParts = req.path.split('/').filter(Boolean);
      const firstSegment = pathParts[0];
      const locale = firstSegment && availableLocales.has(firstSegment) ? firstSegment : defaultLocale;
      return sendLocaleIndex(res, locale);
    });

    logger.notice(`Serving frontend from ${browserDistRoot}`);
  }

  healthCheck(): void {
    const now = Date.now();
    const stats = v8.getHeapStatistics();
    this.maxHeapSize = Math.max(stats.used_heap_size, this.maxHeapSize);
    const warnThreshold = 0.8 * stats.heap_size_limit;

    const byteUnits = getBytesUnit(Math.max(this.maxHeapSize, stats.heap_size_limit));

    if (!this.warnedHeapCritical && this.maxHeapSize > warnThreshold) {
      this.warnedHeapCritical = true;
      logger.warn(`Used ${(this.maxHeapSize / stats.heap_size_limit * 100).toFixed(2)}% of heap limit (${formatBytes(this.maxHeapSize, byteUnits, true)} / ${formatBytes(stats.heap_size_limit, byteUnits)})!`);
    }
    if (this.lastHeapLogTime === null || (now - this.lastHeapLogTime) > (this.heapLogInterval * 1000)) {
      logger.debug(`Memory usage: ${formatBytes(this.maxHeapSize, byteUnits)} / ${formatBytes(stats.heap_size_limit, byteUnits)}`);
      this.warnedHeapCritical = false;
      this.maxHeapSize = 0;
      this.lastHeapLogTime = now;
    }
  }

  forceExit(exitEvent, code?: number): void {
    logger.debug(`triggering exit for signal: ${exitEvent}`);
    if (code != null) {
      // override the default exit code
      process.exitCode = code;
    }
    process.exit();
  }

  exitCleanup(): void {
    if (config.DATABASE.ENABLED) {
      DB.releasePidLock();
    }
    this.server?.close();
    this.serverUnixSocket?.close();
    this.wss?.close();
    if (this.wssUnixSocket) {
      this.wssUnixSocket.close();
    }
  }
}

((): Server => new Server())();
