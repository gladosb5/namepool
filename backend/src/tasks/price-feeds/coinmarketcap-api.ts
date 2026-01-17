import { queryWithHeaders } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

type LatestQuoteResponse = {
  data?: Record<string, {
    quote?: Record<string, { price?: number }>
  }>
};

type HistoricalQuoteResponse = {
  data?: Record<string, {
    quotes?: Array<{
      timestamp?: string;
      quote?: Record<string, { price?: number }>;
    }>;
  }>;
};

class CoinMarketCapApi implements PriceFeed {
  public name: string = 'CoinMarketCap';
  public currencies: string[] = ['USD', 'EUR', 'GBP', 'CAD', 'CHF', 'AUD', 'JPY'];

  public url: string = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=NMC&convert={CURRENCIES}';
  public urlHist: string = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?symbol=NMC&convert={CURRENCY}&interval={INTERVAL}&time_start={TIME_START}&time_end={TIME_END}';

  private readonly apiKey: string;
  private cachedAtMs = 0;
  private cached: Record<string, number> = {};
  private readonly cacheTtlMs = 30_000;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private roundFiat(price: number): number {
    // Keep enough precision for low-priced assets while staying stable across feeds.
    return Math.round(price * 1_000_000) / 1_000_000;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Accept': 'application/json',
      'X-CMC_PRO_API_KEY': this.apiKey,
    };
  }

  private extractSymbolKey(resp: LatestQuoteResponse | HistoricalQuoteResponse): string | undefined {
    const data = resp?.data;
    if (!data || typeof data !== 'object') {
      return undefined;
    }
    // CoinMarketCap returns a map keyed by the requested symbol (or id).
    // We request a single symbol, so the first key is the one we want.
    return Object.keys(data)[0];
  }

  private async $refreshCache(): Promise<void> {
    const now = Date.now();
    if (now - this.cachedAtMs < this.cacheTtlMs && Object.keys(this.cached).length > 0) {
      return;
    }

    const response = await queryWithHeaders(
      this.url.replace('{CURRENCIES}', this.currencies.join(',')),
      this.getHeaders(),
      true
    ) as LatestQuoteResponse | undefined;

    const symbolKey = response ? this.extractSymbolKey(response) : undefined;
    const quote = symbolKey ? response?.data?.[symbolKey]?.quote : undefined;
    if (!quote) {
      this.cached = {};
      this.cachedAtMs = now;
      return;
    }

    const next: Record<string, number> = {};
    for (const currency of this.currencies) {
      const value = quote?.[currency]?.price;
      if (typeof value === 'number' && Number.isFinite(value)) {
        next[currency] = this.roundFiat(value);
      }
    }

    this.cached = next;
    this.cachedAtMs = now;
  }

  public async $fetchPrice(currency: string): Promise<number> {
    if (!this.currencies.includes(currency)) {
      return -1;
    }
    await this.$refreshCache();
    const value = this.cached[currency];
    return typeof value === 'number' && Number.isFinite(value) ? value : -1;
  }

  public async $fetchRecentPrice(currencies: string[], type: 'hour' | 'day'): Promise<PriceHistory> {
    const priceHistory: PriceHistory = {};

    const nowSeconds = Math.floor(Date.now() / 1000);
    const timeEnd = nowSeconds;
    const interval = type === 'hour' ? '1h' : '1d';
    const timeStart = type === 'hour'
      ? nowSeconds - (30 * 24 * 60 * 60)
      : Math.floor(new Date('2011-01-01T00:00:00Z').getTime() / 1000);

    for (const currency of currencies) {
      if (this.currencies.includes(currency) === false) {
        continue;
      }

      const response = await queryWithHeaders(
        this.urlHist
          .replace('{CURRENCY}', currency)
          .replace('{INTERVAL}', interval)
          .replace('{TIME_START}', String(timeStart))
          .replace('{TIME_END}', String(timeEnd)),
        this.getHeaders(),
        false
      ) as HistoricalQuoteResponse | undefined;

      const symbolKey = response ? this.extractSymbolKey(response) : undefined;
      const quotes = symbolKey ? response?.data?.[symbolKey]?.quotes : undefined;
      if (!Array.isArray(quotes)) {
        continue;
      }

      for (const q of quotes) {
        const ts = q?.timestamp ? Math.floor(new Date(q.timestamp).getTime() / 1000) : undefined;
        const value = q?.quote?.[currency]?.price;
        if (!ts || typeof value !== 'number' || !Number.isFinite(value)) {
          continue;
        }
        if (priceHistory[ts] === undefined) {
          priceHistory[ts] = priceUpdater.getEmptyPricesObj();
        }
        priceHistory[ts][currency] = this.roundFiat(value);
      }
    }

    return priceHistory;
  }
}

export default CoinMarketCapApi;

