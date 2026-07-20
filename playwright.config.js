import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // WebRTC interactions can be stateful, safest to run 1 worker for Sender/Receiver pairs
  reporter: 'html',
  use: {
    baseURL: `http://127.0.0.1:${process.env.PORT || 3000}`,
    trace: 'on-first-retry',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream'
      ]
    }
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],

  webServer: {
    command: `PORT=${process.env.PORT || 3000} npm run start`,
    url: `http://127.0.0.1:${process.env.PORT || 3000}`,
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
