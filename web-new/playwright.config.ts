import { defineConfig, devices } from '@playwright/test';

// demo ビルド(MSW 焼き込み)を lighttpd-sim(実機と同じ gzip-only 配信)で
// 提供し、カメラ実機なしで UI フローと配信形態の両方を検証する。
// 事前に `npm run demo:build` が必要(npm run e2e が実行する)。
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  workers: 2,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    locale: 'ja-JP',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node e2e/lighttpd-sim.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
