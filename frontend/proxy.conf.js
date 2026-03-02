const fs = require('fs');

let PROXY_CONFIG;
let configContent;

const PRIMARY_CONFIG_FILE_NAME = 'namepool-frontend-config.json';
const LEGACY_CONFIG_FILE_NAME = 'mempool-frontend-config.json';
const CONFIG_FILE_NAME = fs.existsSync(PRIMARY_CONFIG_FILE_NAME) ? PRIMARY_CONFIG_FILE_NAME : LEGACY_CONFIG_FILE_NAME;

try {
    const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
    configContent = JSON.parse(rawConfig);
    console.log(`${CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
    console.log(e);
    if (e.code !== 'ENOENT') {
      throw new Error(e);
  } else {
      console.log(`${PRIMARY_CONFIG_FILE_NAME} file not found, using default config`);
      configContent = {};
  }
}

PROXY_CONFIG = [
    {
        context: ['*',
        '/api/**', '!/api/v1/ws',
        '!/liquid', '!/liquid/**', '!/liquid/',
        '!/liquidtestnet', '!/liquidtestnet/**', '!/liquidtestnet/',
        '/testnet/api/**', '/signet/api/**', '/testnet4/api/**'
        ],
        target: "https://namepool.bit",
        ws: true,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['/api/v1/ws'],
        target: "https://namepool.bit",
        ws: true,
        secure: false,
        changeOrigin: true,
    },
    {
        context: ['/api/liquid**', '/liquid/api/**'],
        target: "https://liquid.network",
        pathRewrite: {
            "^/api/liquid/": "/liquid/api"
        },
        ws: true,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['/api/liquidtestnet**', '/liquidtestnet/api/**'],
        target: "https://liquid.network",
        ws: true,
        secure: false,
        changeOrigin: true
    },
    {
      context: ['/resources/mining-pools/**'],
      target: "https://namepool.bit",
      secure: false,
      changeOrigin: true
  }
];

if (configContent && configContent.BASE_MODULE == "liquid") {
    PROXY_CONFIG.push({
        context: [
            '/resources/assets.json', '/resources/assets.minimal.json',
            '/resources/assets-testnet.json', '/resources/assets-testnet.minimal.json'],
        target: "https://liquid.network",
        secure: false,
        changeOrigin: true,
    });
} else {
    PROXY_CONFIG.push({
        context: ['/resources/assets.json', '/resources/assets.minimal.json', '/resources/worldmap.json'],
        target: "https://namepool.bit",
        secure: false,
        changeOrigin: true,
    });
}

module.exports = PROXY_CONFIG;
