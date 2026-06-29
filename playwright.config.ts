import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: 'http://<ip>:5180',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'npm run dev -- --host <ip> --port 5180',
    url: 'http://<ip>:5180',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_API_URL: 'http://<ip>:3001',
      VITE_PEERJS_HOST: '<ip>',
      VITE_PEERJS_PORT: '5180',
      VITE_PEERJS_PATH: '/peerjs',
      VITE_PEERJS_SECURE: 'false',
      VITE_E2E: 'true'
    }
  }
});
