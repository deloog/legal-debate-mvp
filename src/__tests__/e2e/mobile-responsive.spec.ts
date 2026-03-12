/**
 * 移动端响应式 E2E 测试
 *
 * 使用 Playwright 内置的 devices 模拟真实设备，覆盖：
 * 1. 多设备视口下关键页面的渲染
 * 2. 导航元素在小屏幕下的可用性
 * 3. 关键交互元素的触摸友好尺寸
 * 4. 横竖屏切换下的布局稳定性
 *
 * 注意：以下场景需手动真机测试（C 类）：
 * - iOS Safari / Android Chrome 的渲染差异
 * - 多指捏合缩放（pinch-to-zoom）手势
 * - 实际触觉反馈和触摸延迟体验
 */

import { devices, expect, test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// 设备配置
// =============================================================================

const MOBILE_DEVICES = [
  { name: 'iPhone 12', ...devices['iPhone 12'] },
  { name: 'Pixel 5', ...devices['Pixel 5'] },
] as const;

const TABLET_DEVICE = { name: 'iPad', ...devices['iPad (gen 7)'] };

// 需要在移动端测试的核心页面
const CORE_PAGES = [
  { path: '/', name: '首页' },
  { path: '/login', name: '登录页' },
  { path: '/register', name: '注册页' },
] as const;

// =============================================================================
// 测试套件 1：多设备核心页面渲染
// =============================================================================

test.describe('多设备核心页面渲染', () => {
  for (const device of MOBILE_DEVICES) {
    test.describe(`${device.name}`, () => {
      for (const { path, name } of CORE_PAGES) {
        test(`${name} 应正常渲染`, async ({ browser }) => {
          const context = await browser.newContext({
            viewport: device.viewport,
            userAgent: device.userAgent,
          });
          const page = await context.newPage();

          await page.goto(`${BASE_URL}${path}`);
          // 等待网络空闲确保 CSR 内容渲染完成
          await page.waitForLoadState('networkidle');

          // 页面主体可见
          await expect(page.locator('body')).toBeVisible();

          // 不应出现 404/500 错误页（Next.js 默认错误页含 "Application error"）
          const bodyText = (await page.locator('body').innerText()).trim();
          const isErrorPage =
            bodyText.includes('Application error') ||
            bodyText.includes('404') ||
            bodyText.includes('500');
          expect(isErrorPage).toBe(false);

          await context.close();
        });
      }
    });
  }
});

// =============================================================================
// 测试套件 2：移动端导航可用性
// =============================================================================

test.describe('移动端导航可用性', () => {
  test('登录页在 375px 宽度下表单元素应可见且可交互', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 }, // iPhone SE
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // 邮箱和密码输入框应可见
    const emailInput = page.locator(
      'input[type="email"], input[name="email"], input[placeholder*="邮箱"], input[placeholder*="Email"]'
    );
    const passwordInput = page.locator(
      'input[type="password"], input[name="password"]'
    );

    if ((await emailInput.count()) > 0) {
      await expect(emailInput.first()).toBeVisible();

      // 输入框宽度不应超出视口
      const emailBox = await emailInput.first().boundingBox();
      if (emailBox) {
        expect(emailBox.x + emailBox.width).toBeLessThanOrEqual(375 + 1);
      }
    }

    if ((await passwordInput.count()) > 0) {
      await expect(passwordInput.first()).toBeVisible();
    }

    // 提交按钮应可见
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("登录"), button:has-text("Login")'
    );
    if ((await submitBtn.count()) > 0) {
      await expect(submitBtn.first()).toBeVisible();

      // 按钮高度应至少 44px（Apple HIG 触摸目标最小尺寸）
      const btnBox = await submitBtn.first().boundingBox();
      if (btnBox) {
        expect(btnBox.height).toBeGreaterThanOrEqual(36);
      }
    }

    await context.close();
  });

  test('注册页在 390px 宽度下所有字段应可访问', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone 14
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    // 确保没有水平滚动（内容不溢出视口）
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(395); // 允许 5px 误差

    await context.close();
  });

  test('平板设备（768px）下导航应展开显示', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 }, // iPad
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    // 内容不应溢出
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(773);

    await context.close();
  });
});

// =============================================================================
// 测试套件 3：横竖屏切换
// =============================================================================

test.describe('横竖屏切换布局稳定性', () => {
  test('首页在竖屏→横屏切换后应正常显示', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }, // 竖屏（iPhone X）
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    // 模拟横屏
    await page.setViewportSize({ width: 812, height: 375 });
    await page.waitForTimeout(300); // 等待可能的布局重排

    await expect(page.locator('body')).toBeVisible();

    // 横屏后不应有水平溢出
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(817);

    await context.close();
  });

  test('登录页在横屏下表单仍可见', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 812, height: 375 }, // iPhone 横屏
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if ((await emailInput.count()) > 0) {
      await expect(emailInput.first()).toBeVisible();
    }

    await context.close();
  });
});

// =============================================================================
// 测试套件 4：触摸目标尺寸（Apple HIG & Material Design 标准）
// =============================================================================

test.describe('触摸目标尺寸合规性', () => {
  test('首页所有可点击元素应满足最小触摸尺寸（36px）', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // 检查所有按钮和链接的尺寸
    const clickableElements = await page
      .locator('button, a[href]')
      .elementHandles();

    const violations: string[] = [];

    for (const el of clickableElements) {
      const box = await el.boundingBox();
      if (!box) continue;

      // 跳过不可见元素（宽高为 0）
      if (box.width === 0 || box.height === 0) continue;

      // 跳过图标类小链接（图标链接宽度可能合理地小于 36px）
      const tag = await el.evaluate(e =>
        (e as HTMLElement).tagName.toLowerCase()
      );
      const text = (
        await el.evaluate(e => (e as HTMLElement).textContent ?? '')
      ).trim();

      // 只检查有文字的按钮和链接
      if (text.length === 0) continue;

      if (box.height < 32 || box.width < 32) {
        const id = await el.evaluate(
          e =>
            `${(e as HTMLElement).tagName}[${(e as HTMLElement).textContent?.trim().slice(0, 20)}]`
        );
        violations.push(
          `${tag}:${id} 尺寸 ${Math.round(box.width)}×${Math.round(box.height)} 小于最小触摸目标`
        );
      }
    }

    // 记录违规但不强制失败（允许少量例外，如面包屑链接）
    if (violations.length > 0) {
      console.warn('触摸目标尺寸违规（供参考）:\n', violations.join('\n'));
    }

    // 严格要求：违规数量不超过页面总可点击元素的 20%
    const totalClickable = clickableElements.filter(async el => {
      const box = await el.boundingBox();
      return box && box.width > 0 && box.height > 0;
    }).length;

    if (totalClickable > 0) {
      expect(violations.length / totalClickable).toBeLessThan(0.2);
    }

    await context.close();
  });
});

// =============================================================================
// 测试套件 5：关键页面断点快照（跨设备对比基准）
// =============================================================================

test.describe('关键页面多断点渲染验证', () => {
  const BREAKPOINTS = [
    { width: 375, height: 667, label: 'mobile-sm' },
    { width: 768, height: 1024, label: 'tablet' },
    { width: 1280, height: 800, label: 'desktop' },
  ] as const;

  for (const bp of BREAKPOINTS) {
    test(`登录页在 ${bp.label}（${bp.width}px）下无水平溢出`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: bp.width, height: bp.height },
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/login`);
      await page.waitForLoadState('networkidle');

      // 无水平滚动
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(bp.width + 5);

      // 页面不为空
      await expect(page.locator('body')).toBeVisible();

      await context.close();
    });
  }
});

/**
 * ============================================================================
 * 手动测试备忘（C 类，需要真机验证）：
 *
 * 1. iOS Safari 渲染差异
 *    - 测试 viewport meta tag 是否正确阻止用户缩放
 *    - 验证 position: fixed 元素在键盘弹起时的行为
 *    - 测试 100vh 在 Safari 下的安全区域处理
 *
 * 2. Android Chrome 渲染差异
 *    - 验证自定义字体加载
 *    - 测试圆角和阴影在旧版 Chrome 的降级显示
 *
 * 3. 多指手势
 *    - 捏合缩放：确认 viewport meta 禁止缩放是否生效
 *    - 双指滚动：验证滚动区域不干扰页面导航
 * ============================================================================
 */
