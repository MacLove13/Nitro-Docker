import { defineConfig, devices } from '@playwright/test';

/**
 * Base URL for the Nitro React client.
 * Defaults to http://localhost:1080 (host port) but can be overridden via
 * the BASE_URL environment variable (e.g. http://nitro:5154 inside Docker).
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:1080';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  retries: 2,
  reporter: [
    ['html', { outputFolder: './test-results', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'on',
    trace: 'retain-on-failure',
    navigationTimeout: 60_000,
  },
  outputDir: './test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

