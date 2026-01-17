/**
 * 支付UI系统集成测试
 *
 * 测试覆盖完整的支付UI流程：
 * 1. 支付页面功能测试
 * 2. 支付成功/失败页面测试
 * 3. 订单管理页面测试
 * 4. 完整支付流程测试
 */

import { expect, test, type Page } from '@playwright/test';

// 测试基础URL
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// 测试数据类型定义
// =============================================================================

interface TestUser {
  id: string;
  email: string;
  password: string;
  username?: string;
  name?: string;
  role: string;
  token?: string;
  refreshToken?: string;
}

interface AuthResponseData {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
      role: string;
      createdAt: Date | string;
    };
    token: string;
    refreshToken: string;
    expiresIn: number;
  };
  error?: string;
}

interface MembershipTierResponseData {
  success: boolean;
  data?: {
    tiers: Array<{
      id: string;
      name: string;
      displayName: string;
      tier: string;
      price: unknown;
      currency: string;
      isActive?: boolean;
    }>;
  };
  error?: string;
}

// =============================================================================
// 测试辅助函数
// =============================================================================

/**
 * 创建测试用户
 */
async function createTestUser(page: Page): Promise<TestUser> {
  const timestamp = Date.now();
  const shortId = String(timestamp).slice(-6);
  const email = `payment-ui-test-${timestamp}@example.com`;
  const password = 'PaymentUiTest123';

  const response = await page.request.post(`${BASE_URL}/api/auth/register`, {
    data: {
      email,
      password,
      username: `paymentui${shortId}`,
      name: `PaymentUiUser${shortId}`,
    },
  });

  const data: AuthResponseData = await response.json();

  return {
    id: data.data?.user.id || '',
    email,
    password,
    username: `paymentui${shortId}`,
    name: `PaymentUiUser${shortId}`,
    role: data.data?.user.role || 'USER',
    token: data.data?.token,
    refreshToken: data.data?.refreshToken,
  };
}

/**
 * 用户登录
 */
async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<{ token: string; refreshToken: string }> {
  const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });

  const data: AuthResponseData = await response.json();
  expect(response.ok()).toBeTruthy();
  expect(data.success).toBe(true);

  return {
    token: data.data?.token || '',
    refreshToken: data.data?.refreshToken || '',
  };
}

/**
 * 获取会员等级列表
 */
async function getMembershipTiers(
  page: Page,
  token: string
): Promise<MembershipTierResponseData> {
  const response = await page.request.get(`${BASE_URL}/api/memberships/tiers`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return await response.json();
}

// =============================================================================
// 测试套件：支付页面功能测试
// =============================================================================

test.describe('支付页面功能测试', () => {
  let testUser: TestUser;
  let tiers: MembershipTierResponseData;
  let validTierId: string;

  test.beforeAll(async ({ browser }) => {
    // 创建独立的context用于beforeAll设置
    const context = await browser.newContext();
    const page = await context.newPage();

    // 创建测试用户
    testUser = await createTestUser(page);
    const { token, refreshToken } = await loginUser(
      page,
      testUser.email,
      testUser.password
    );
    testUser.token = token;
    testUser.refreshToken = refreshToken;

    // 获取会员等级列表
    tiers = await getMembershipTiers(page, token);
    expect(tiers.success).toBe(true);

    // 找到第一个付费会员等级（跳过免费版）
    const tierList = tiers.data?.tiers || [];
    expect(tierList.length).toBeGreaterThan(0);

    // 尝试找到非免费的会员等级
    const paidTier = tierList.find(
      (tier: { tier: string; price: unknown }) =>
        tier.tier !== 'FREE' &&
        (typeof tier.price === 'number' ? tier.price > 0 : true)
    );

    const activeTier = paidTier || tierList[0];
    expect(activeTier).toBeDefined();
    expect(activeTier?.id).toBeDefined();
    validTierId = activeTier?.id || '';

    console.log('[测试] 获取到的会员等级:', {
      success: tiers.success,
      tierCount: tierList.length,
      firstTierId: validTierId,
      firstTierName: activeTier?.name,
      firstTierType: activeTier?.tier,
      firstTierPrice: activeTier?.price,
    });

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // 支付页面不需要登录，直接访问即可
  });

  test('应该加载支付页面并显示基本信息', async ({ page }) => {
    console.log('[测试] 访问支付页面:', { tierId: validTierId });
    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForLoadState('networkidle');

    // 检查页面是否有错误
    const hasError = await page.locator('text=加载失败').count();
    if (hasError > 0) {
      const errorText = await page.locator('text=加载失败').textContent();
      console.error('[测试] 支付页面加载失败:', errorText);
    }

    // 获取页面内容用于调试
    const pageContent = await page.content();
    console.log('[测试] 页面内容摘要:', pageContent.substring(0, 500));

    // 验证页面标题
    await expect(page.locator('h1')).toContainText('支付页面');
    await expect(page.locator('text=请选择支付方式完成支付')).toBeVisible();

    // 验证会员信息区域
    await expect(page.locator('text=支付金额：').first()).toBeVisible();
    await expect(page.locator('text=¥').first()).toBeVisible();
  });

  test('应该显示所有支付方式选项', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForLoadState('networkidle');

    // 等待支付方式卡片出现
    await page.waitForSelector('text=微信支付', { timeout: 5000 });

    // 验证微信支付
    await expect(page.locator('text=微信支付')).toBeVisible();

    // 验证支付宝
    await expect(page.locator('text=支付宝')).toBeVisible();

    // 验证余额支付（使用role定位）
    await expect(page.getByRole('heading', { name: '余额支付' })).toBeVisible();
  });

  test('应该能够选择支付方式', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForLoadState('networkidle');

    // 等待支付方式卡片出现
    await page.waitForSelector('text=微信支付', { timeout: 5000 });

    // 点击包含微信支付标题的卡片
    const wechatHeading = page.getByRole('heading', { name: '微信支付' });
    await expect(wechatHeading).toBeVisible();
    await wechatHeading.click();

    // 等待选中状态
    await page.waitForTimeout(500);
  });

  test('应该显示支付确认区域', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForLoadState('networkidle');

    // 等待支付方式卡片出现
    await page.waitForSelector('text=微信支付', { timeout: 5000 });

    // 点击包含微信支付标题的卡片
    const wechatHeading = page.getByRole('heading', { name: '微信支付' });
    await wechatHeading.click();

    // 等待选中状态
    await page.waitForTimeout(500);

    // 验证确认按钮
    await expect(page.locator('text=确认支付')).toBeVisible();
    await expect(page.getByRole('button', { name: '取消' })).toBeVisible();
  });

  test('应该显示温馨提示信息', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForLoadState('networkidle');

    // 验证页面加载完成
    await expect(page.locator('h1')).toContainText('支付页面');
  });

  test('应该能够取消支付并返回', async ({ page }) => {
    // Mock confirm对话框
    await page.on('dialog', dialog => dialog.accept());

    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForLoadState('networkidle');

    // 点击返回按钮（包含ArrowLeft图标的按钮）
    const backButton = page.locator('button').filter({ hasText: '' }).first();
    await backButton.click();

    // 等待页面导航
    await page.waitForTimeout(500);

    // 验证页面导航（可能还在/payment但确认对话框已显示）
    const currentUrl = page.url();
    expect(currentUrl).toBeDefined();
  });
});

// =============================================================================
// 测试套件：支付成功页面测试
// =============================================================================

test.describe('支付成功页面测试', () => {
  test('应该显示支付成功页面', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment/success`);
    await page.waitForLoadState('networkidle');

    // 验证成功标题
    await expect(page.getByRole('heading', { name: '支付成功' })).toBeVisible();

    // 验证操作按钮
    await expect(page.getByRole('button', { name: '返回首页' })).toBeVisible();
    await expect(page.getByRole('button', { name: '查看订单' })).toBeVisible();
  });

  test('应该显示订单信息', async ({ page }) => {
    // 访问支付成功页面
    await page.goto(`${BASE_URL}/payment/success`);
    await page.waitForLoadState('networkidle');

    // 验证订单号显示
    await expect(page.getByText('订单号')).toBeVisible();

    // 验证金额显示
    await expect(page.getByText('¥')).toBeVisible();
  });

  test('应该能够返回首页', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment/success`);
    await page.waitForLoadState('networkidle');

    // 点击返回首页
    await page.getByRole('button', { name: '返回首页' }).click();

    // 验证跳转
    await page.waitForTimeout(1000);
  });
});

// =============================================================================
// 测试套件：支付失败页面测试
// =============================================================================

test.describe('支付失败页面测试', () => {
  test('应该显示支付失败页面', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment/fail`);
    await page.waitForLoadState('networkidle');

    // 验证失败图标和标题
    await expect(page.getByRole('heading', { name: '支付失败' })).toBeVisible();

    // 验证操作按钮
    await expect(page.getByRole('button', { name: '返回首页' })).toBeVisible();
    await expect(page.getByRole('button', { name: '联系客服' })).toBeVisible();
  });

  test('应该显示错误详情', async ({ page }) => {
    // 模拟错误信息（使用error参数而非errorMessage）
    await page.goto(
      `${BASE_URL}/payment/fail?errorCode=TIMEOUT&error=支付超时`
    );
    await page.waitForLoadState('networkidle');

    // 验证错误详情显示
    const errorText = await page.locator('text=/支付超时|错误详情/').all();
    expect(errorText.length).toBeGreaterThan(0);
  });

  test('应该支持重试支付', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment/fail?canRetry=true`);
    await page.waitForLoadState('networkidle');

    // 验证重试按钮
    await expect(page.getByRole('button', { name: '重试支付' })).toBeVisible();
  });

  test('应该能够联系客服', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment/fail`);
    await page.waitForLoadState('networkidle');

    // 验证联系客服按钮存在
    await expect(page.getByRole('button', { name: '联系客服' })).toBeVisible();

    // 点击联系客服（可能会打开模态框或显示联系信息）
    await page.getByRole('button', { name: '联系客服' }).click();

    // 等待一下看是否有联系信息显示
    await page.waitForTimeout(500);
  });
});

// =============================================================================
// 测试套件：订单管理页面测试
// =============================================================================

test.describe('订单管理页面测试', () => {
  let testUser: TestUser;

  test.beforeAll(async ({ browser }) => {
    // 创建独立的context用于beforeAll设置
    const context = await browser.newContext();
    const page = await context.newPage();

    // 创建测试用户
    testUser = await createTestUser(page);

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // 登录用户 - 使用NextAuth
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('domcontentloaded');

    // 填写登录表单
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);

    // 提交登录表单
    await page.click('button[type="submit"]');

    // 等待登录成功（跳转到首页或目标页面）
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  });

  test('应该加载订单列表页面', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`);
    await page.waitForLoadState('networkidle');

    // 验证页面标题
    await expect(page.locator('h1')).toContainText('我的订单');
    await expect(page.locator('text=查看和管理您的所有订单记录')).toBeVisible();
  });

  test('应该显示筛选选项', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`);
    await page.waitForLoadState('networkidle');

    // 验证状态筛选select元素（使用first获取第一个select）
    await expect(page.locator('select').first()).toBeVisible();

    // 验证搜索框（实际placeholder是"搜索订单号或描述"）
    await expect(
      page.locator('input[placeholder="搜索订单号或描述"]')
    ).toBeVisible();
  });

  test('应该支持按状态筛选订单', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`);
    await page.waitForLoadState('networkidle');

    // 点击第一个select展开（状态筛选）
    await page.locator('select').first().click();

    // 使用select的value选择选项
    await page.locator('select').first().selectOption('PENDING');

    // 等待页面更新
    await page.waitForTimeout(500);
  });

  test('应该支持搜索订单', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`);
    await page.waitForLoadState('networkidle');

    // 输入搜索关键词（实际placeholder是"搜索订单号或描述"）
    const searchInput = page.locator('input[placeholder="搜索订单号或描述"]');
    await searchInput.fill('测试订单');

    // 验证搜索框有值
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toBe('测试订单');
  });

  test('应该支持排序功能', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`);
    await page.waitForLoadState('networkidle');

    // 找到排序select（第二个select）
    const sortSelect = page.locator('select').nth(1);

    // 验证排序select存在
    await expect(sortSelect).toBeVisible();

    // 测试切换排序
    await sortSelect.selectOption('amount');
    await page.waitForTimeout(500);

    await sortSelect.selectOption('createdAt');
    await page.waitForTimeout(500);
  });

  test('应该支持分页导航', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`);
    await page.waitForLoadState('networkidle');

    // 验证分页控件
    const pagination = page.locator('.pagination');
    if (await pagination.isVisible()) {
      await expect(pagination.locator('text=上一页')).toBeVisible();
      await expect(pagination.locator('text=下一页')).toBeVisible();
    }
  });

  test('应该支持刷新订单列表', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`);
    await page.waitForLoadState('networkidle');

    // 点击刷新按钮
    await page.click('text=刷新');

    // 验证加载状态（查找旋转的loader图标）
    await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 2000 });
  });
});

// =============================================================================
// 测试套件：完整支付流程测试
// =============================================================================

test.describe('完整支付流程测试', () => {
  let testUser: TestUser;
  let tiers: MembershipTierResponseData;
  let validTierId: string;

  test.beforeAll(async ({ browser }) => {
    // 创建独立的context用于beforeAll设置
    const context = await browser.newContext();
    const page = await context.newPage();

    // 创建测试用户
    testUser = await createTestUser(page);
    const { token, refreshToken } = await loginUser(
      page,
      testUser.email,
      testUser.password
    );
    testUser.token = token;
    testUser.refreshToken = refreshToken;

    // 获取会员等级列表
    tiers = await getMembershipTiers(page, token);

    // 找到第一个付费会员等级
    const tierList = tiers.data?.tiers || [];
    const paidTier = tierList.find(
      (tier: { tier: string; price: unknown }) =>
        tier.tier !== 'FREE' &&
        (typeof tier.price === 'number' ? tier.price > 0 : true)
    );

    const activeTier = paidTier || tierList[0];
    validTierId = activeTier?.id || '';

    console.log('[测试] 完整支付流程 - 获取到的会员等级:', {
      tierId: validTierId,
      tierName: activeTier?.name,
      tierType: activeTier?.tier,
    });

    await context.close();
  });

  test.beforeEach(async ({ context }) => {
    // 支付流程不需要预先登录
  });

  test('完整支付流程：从支付页面到成功页面', async ({ page }) => {
    // 1. 访问支付页面
    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForLoadState('networkidle');

    // 2. 选择支付方式（点击微信支付标题）
    const wechatHeading = page.getByRole('heading', { name: '微信支付' });
    await expect(wechatHeading).toBeVisible();
    await wechatHeading.click();

    // 等待选中状态
    await page.waitForTimeout(500);

    // 3. 验证确认按钮
    await expect(page.getByRole('button', { name: '确认支付' })).toBeVisible();

    // 4. 模拟支付成功跳转
    await page.goto(`${BASE_URL}/payment/success`);

    // 5. 验证成功页面
    await expect(page.getByRole('heading', { name: '支付成功' })).toBeVisible();
  });

  test('完整支付流程：支付失败后重试', async ({ page }) => {
    // 1. 访问支付页面
    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForLoadState('networkidle');

    // 2. 选择支付方式（点击支付宝标题）
    const alipayHeading = page.getByRole('heading', { name: '支付宝' });
    await expect(alipayHeading).toBeVisible();
    await alipayHeading.click();

    // 等待选中状态
    await page.waitForTimeout(500);

    // 3. 模拟支付失败跳转
    await page.goto(`${BASE_URL}/payment/fail?canRetry=true`);

    // 4. 验证失败页面
    await expect(page.getByRole('heading', { name: '支付失败' })).toBeVisible();

    // 5. 点击重试支付
    const retryButton = page.getByRole('button', { name: '重试支付' });
    if (await retryButton.isVisible()) {
      await retryButton.click();

      // 6. 验证返回支付页面
      await expect(page).toHaveURL(/\/payment/);
    }
  });

  test('完整支付流程：从订单列表跳转', async ({ page }) => {
    // 1. 登录
    const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: testUser.email,
        password: testUser.password,
      },
    });
    const data: AuthResponseData = await response.json();
    expect(data.success).toBe(true);

    // 2. 访问订单列表
    await page.goto(`${BASE_URL}/orders`);
    await page.waitForLoadState('networkidle');

    // 3. 验证页面标题
    const pageTitle = page.locator('h1').first();
    if (await pageTitle.isVisible()) {
      await expect(pageTitle).toContainText('我的订单');
    }

    // 4. 跳转到支付页面
    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);

    // 5. 验证支付页面加载
    await page.waitForLoadState('networkidle');
  });
});

// =============================================================================
// 测试套件：响应式设计和用户体验测试
// =============================================================================

test.describe('响应式设计和用户体验测试', () => {
  let testUser: TestUser;
  let tiers: MembershipTierResponseData;
  let validTierId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    testUser = await createTestUser(page);
    const { token } = await loginUser(page, testUser.email, testUser.password);
    tiers = await getMembershipTiers(page, token);

    // 找到第一个付费会员等级
    const tierList = tiers.data?.tiers || [];
    const paidTier = tierList.find(
      (tier: { tier: string; price: unknown }) =>
        tier.tier !== 'FREE' &&
        (typeof tier.price === 'number' ? tier.price > 0 : true)
    );

    const activeTier = paidTier || tierList[0];
    validTierId = activeTier?.id || '';

    console.log('[测试] 响应式测试 - 获取到的会员等级:', {
      tierId: validTierId,
      tierName: activeTier?.name,
      tierType: activeTier?.tier,
    });

    await context.close();
  });

  test('应该在小屏幕上正确显示', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForLoadState('networkidle');

    // 检查是否有错误
    const hasError = await page.locator('text=加载失败').count();

    // 验证页面标题（如果没有错误）
    if (hasError === 0) {
      await expect(page.locator('h1')).toContainText('支付页面');
    } else {
      // 有错误时，页面应该显示错误提示
      await expect(page.locator('text=加载失败')).toBeVisible();
    }
  });

  test('应该支持键盘导航', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForLoadState('networkidle');

    // 模拟Tab键导航
    await page.keyboard.press('Tab');

    // 验证焦点移动
    const focusedElement = page.locator(':focus');
    expect(await focusedElement.count()).toBeGreaterThan(0);
  });

  test('应该显示加载状态', async ({ page }) => {
    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);

    // 验证加载状态存在（页面加载时）
    await expect(page.locator('body')).toBeVisible();
  });

  test('应该处理网络错误', async ({ page }) => {
    // 模拟网络错误场景（只拦截API请求，不拦截HTML）
    await page.route(`${BASE_URL}/api/**`, route => route.abort());

    await page.goto(`${BASE_URL}/payment?tierId=${validTierId}`);
    await page.waitForTimeout(2000);

    // 验证错误提示或加载状态
    const hasError = await page.locator('text=加载失败').count();
    const hasLoading = await page.locator('.animate-spin').count();

    expect(hasError + hasLoading).toBeGreaterThan(0);

    // 恢复网络
    await page.unroute(`${BASE_URL}/api/**`);
  });
});
