import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    /** 本地默认显示浏览器；CI 或设置 HEADLESS=1 时使用无头 */
    headless: process.env.CI === 'true' || process.env.HEADLESS === '1',
    baseURL: process.env.BASE_URL,
    ignoreHTTPSErrors: true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    locale: 'zh-CN',
    viewport: { width: 1280, height: 800 },
  },
});
