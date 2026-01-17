import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: 'ry4br7',
  videosFolder: 'cypress/videos',
  screenshotsFolder: 'cypress/screenshots',
  fixturesFolder: 'cypress/fixtures',
  video: false,
  retries: {
    runMode: 3,
    openMode: 0,
  },
  chromeWebSecurity: false,
  e2e: {
    setupNodeEvents(on: any, config: any) {
      const fs = require('fs');
      const PRIMARY_CONFIG_FILE = 'namepool-frontend-config.json';
      const LEGACY_CONFIG_FILE = 'mempool-frontend-config.json';
      const configFile = fs.existsSync(PRIMARY_CONFIG_FILE) ? PRIMARY_CONFIG_FILE : LEGACY_CONFIG_FILE;
      if (fs.existsSync(configFile)) {
        const contents = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        config.env.BASE_MODULE = contents.BASE_MODULE ? contents.BASE_MODULE : 'namepool';
      } else {
        config.env.BASE_MODULE = 'namepool';
      }
      return config;
    },
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
  },
});
