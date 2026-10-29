import { defineConfig, devices } from '@playwright/test';

const PORT = 4210;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: '**/mobile.e2e.ts' },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: '**/mobile.e2e.ts' },
  ],
  webServer: {
    command: `npx ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
