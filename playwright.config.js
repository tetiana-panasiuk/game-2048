import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8123' },
  webServer: {
    command: 'npx http-server . -p 8123 -c-1 -s',
    url: 'http://localhost:8123',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } }, // WebKit, 390x664 visible
    { name: 'iphone-se', use: { ...devices['iPhone SE'] } }, // WebKit, 320x568
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
