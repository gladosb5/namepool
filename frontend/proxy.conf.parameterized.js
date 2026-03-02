const PROXY_CONFIG = require('./proxy.conf');

const addApiKeyHeader = (proxyReq) => {
  const apiKey = process.env.NAMEPOOL_CI_API_KEY || process.env.MEMPOOL_CI_API_KEY;
  if (apiKey) {
    proxyReq.setHeader('X-Mempool-Auth', apiKey);
  }
};

PROXY_CONFIG.forEach((entry) => {
  const namepoolHostname = process.env.NAMEPOOL_HOSTNAME
    ? process.env.NAMEPOOL_HOSTNAME
    : (process.env.MEMPOOL_HOSTNAME ? process.env.MEMPOOL_HOSTNAME : 'namepool.bit');

  const liquidHostname = process.env.LIQUID_HOSTNAME
    ? process.env.LIQUID_HOSTNAME
    : 'liquid.network';

  entry.target = entry.target.replace('namepool.bit', namepoolHostname);
  entry.target = entry.target.replace('liquid.network', liquidHostname);

  if (entry.onProxyReq) {
    const originalProxyReq = entry.onProxyReq;
    entry.onProxyReq = (proxyReq, req, res) => {
      originalProxyReq(proxyReq, req, res);
      addApiKeyHeader(proxyReq);
    };
  } else {
    entry.onProxyReq = addApiKeyHeader;
  }
});

module.exports = PROXY_CONFIG;
