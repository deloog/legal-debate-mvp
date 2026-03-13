import { defineConfig, devices } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenvConfig({ path: resolve(__dirname, '.env') });
dotenvConfig({ path: resolve(__dirname, '.env.development') });

// 本地 E2E 优先使用 TEST_DATABASE_URL，避免污染 dev 数据库
// CI 环境 DATABASE_URL 已由 workflow 注入，不受影响
if (process.env.TEST_DATABASE_URL && !process.env.CI) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  globalSetup: resolve(__dirname, 'src/__tests__/e2e/global-setup.ts'),
  globalTeardown: resolve(__dirname, 'src/__tests__/e2e/global-teardown.ts'),
  testDir: resolve(__dirname, 'src/__tests__/e2e'),
  testIgnore: [
    '../src/__tests__/**/*.test.ts',
    '../src/__tests__/**/*.test.tsx',
    '../src/__tests__/unit/**',
    '../src/__tests__/verification-agent.test.ts',
    '../src/__tests__/**/*.test.*',
  ],
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* CI 单 worker 避免资源竞争，本地使用默认值（CPU 核数的一半）并行提速 */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    // 将正确的 DATABASE_URL 注入到 dev server 子进程
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? '',
    },
  },

  /* Test timeout - increased for AI service calls and Mock mode */
  timeout: 120 * 1000,
  expect: {
    timeout: 30 * 1000,
  },
});
