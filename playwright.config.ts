import { defineConfig, devices } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenvConfig({ path: resolve(__dirname, '.env') });
dotenvConfig({ path: resolve(__dirname, '.env.development') });

// CI 环境 DATABASE_URL 由 workflow 注入；本地使用 .env 的 DATABASE_URL
// global-setup 与 dev server 需使用同一个数据库，不单独覆盖

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
  /* Retry on CI only - 1 retry is enough; 2 retries triples runtime */
  retries: process.env.CI ? 1 : 0,
  /* CI 使用 2 个 worker 加速（各测试用独立用户数据，无 DB 竞争）；本地单 worker */
  workers: process.env.CI ? 2 : 1,
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

    /* 规避 Next.js 16 Turbopack dev 模式 bug：
     * 带 Authorization header 的请求访问动态嵌套路由（如 [id]/review）时
     * 缺少 Accept 头会导致 Turbopack 将其误判为页面导航并返回 404。
     * 添加 Accept: application/json 让 Turbopack 正确路由至 API handler。
     * （生产模式 next start 不受此 bug 影响） */
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  // CI 环境：next.config.ts 使用 output:standalone，必须用 node .next/standalone/server.js
  //          同时设 NODE_ENV=test 跳过生产环境 API key 校验
  // 本地：复用已运行的 dev server（使用 npm run dev）
  webServer: {
    command: process.env.CI
      ? 'NODE_ENV=test node .next/standalone/server.js'
      : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300 * 1000,
    // 将必要的环境变量注入到 dev/prod server 子进程
    // standalone server 不自动读 .env.local，需要在此显式传入
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379/1',
      JWT_SECRET:
        process.env.JWT_SECRET ?? 'test-jwt-secret-key-for-e2e-testing',
      NEXTAUTH_SECRET:
        process.env.NEXTAUTH_SECRET ??
        'test-nextauth-secret-key-for-e2e-testing',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      // mock 值：E2E 测试使用 USE_MOCK_AI=true，不会发起真实 AI 请求
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? 'mock-deepseek-key',
      ZHIPU_API_KEY: process.env.ZHIPU_API_KEY ?? 'mock-zhipu-key',
      PAYMENT_MOCK_MODE: 'true',
      USE_MOCK_AI: 'true',
      EMAIL_MOCK_MODE: 'true',
      // standalone server 中 NODE_ENV 被编译固化为 production，用此开关跳过环境变量校验
      SKIP_ENV_VALIDATION: 'true',
    },
  },

  /* Test timeout - increased for AI service calls and Mock mode */
  timeout: 120 * 1000,
  expect: {
    timeout: 30 * 1000,
  },
});
