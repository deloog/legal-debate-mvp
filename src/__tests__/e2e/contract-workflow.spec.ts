/**
 * 合同完整流程E2E测试
 */

import { test, expect, type Page } from '@playwright/test';
import { E2E_LAWYER_EMAIL, E2E_LAWYER_PASSWORD } from './global-setup';

// 通过登录页面完成认证
async function loginWithJwt(page: Page) {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="email"]', E2E_LAWYER_EMAIL);
  await page.fill('input[name="password"]', E2E_LAWYER_PASSWORD);
  await page.click('button[type="submit"]');
  // 等待跳转离开登录页（到首页、仪表盘或合同列表）
  // waitUntil: 'commit' 避免 Turbopack 编译首页时 load 事件超时
  await page.waitForURL(url => !url.pathname.startsWith('/login'), {
    timeout: 60000,
    waitUntil: 'commit',
  });
}

test.describe('合同完整流程', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithJwt(page);
  });

  test('应该完成从创建到签署的完整流程', async ({ page }) => {
    test.setTimeout(900000);

    // 1. 访问合同列表页
    await page.goto('http://localhost:3000/contracts');
    await expect(page.locator('h1')).toContainText('委托合同');

    // 2. 创建新合同
    await page.click('text=创建合同');
    await page.waitForURL('**/contracts/new', {
      timeout: 120000,
      waitUntil: 'commit',
    });
    // 等待表单渲染（含 Turbopack 编译），不用 networkidle（dev 模式 HMR 会阻止其 fire）
    await page.waitForSelector('select[name="clientType"]', {
      timeout: 120000,
    });

    // 填写合同信息
    await page.selectOption('select[name="clientType"]', '个人');
    await page.fill('input[name="clientName"]', '张三');
    await page.fill('input[name="clientPhone"]', '13800138000');
    await page.selectOption('select[name="caseType"]', '劳动争议');
    await page.fill('textarea[name="caseSummary"]', '劳动合同纠纷案件');
    await page.fill('input[name="totalFee"]', '10000');

    // 提交表单
    await page.click('button[type="submit"]');
    await page.waitForURL(
      url =>
        url.pathname.startsWith('/contracts/') &&
        !url.pathname.endsWith('/new'),
      { timeout: 120000, waitUntil: 'commit' }
    );
    // 等待合同详情页完全渲染（包括编译和数据加载）
    await page.waitForSelector('text=委托方信息', { timeout: 120000 });

    // 3. 验证合同创建成功
    await expect(page.locator('text=张三')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=¥10,000').first()).toBeVisible({
      timeout: 30000,
    });

    // 保存合同URL
    const contractUrl = page.url();

    // 4. 发起审批
    await page.click('text=发起审批');
    await page.waitForSelector('select[name="templateId"]');
    await page.click('button:has-text("确认")');

    // 等待审批创建成功
    await expect(page.locator('text=审批已发起')).toBeVisible({
      timeout: 30000,
    });

    // 5. 查看审批（在审批列表中通过）
    await page.goto('http://localhost:3000/approvals/pending');
    // 等待审批列表加载（不使用networkidle，在dev模式下会永远等待）
    await page.waitForLoadState('domcontentloaded');
    // 直接等待目标元素出现
    const clientLink = page.locator(`text=张三`).first();
    await clientLink.waitFor({ timeout: 60000 });
    await clientLink.click();
    await page.waitForURL('**/approval', {
      timeout: 120000,
      waitUntil: 'commit',
    });
    // 等待审批数据加载完成
    await page.waitForSelector('button:has-text("通过")', { timeout: 120000 });

    // 点击通过按钮
    const passButton = page.locator('button:has-text("通过")').first();
    await passButton.click();
    await page.fill('textarea[name="comment"]', '同意通过');
    await page.click('button:has-text("确认")');

    // 6. 回到合同页发送邮件
    await page.goto(contractUrl);
    await page.waitForSelector('text=委托方信息', { timeout: 60000 });
    await page.click('text=发送邮件');
    await page.fill('input[name="recipientEmail"]', 'client@example.com');
    await page.fill('input[name="recipientName"]', '张三');
    // 精确匹配模态框内的"发送"按钮（避免匹配到页面上的"发送邮件"按钮）
    await page.getByRole('button', { name: '发送', exact: true }).click();

    // 等待邮件发送成功
    await expect(page.locator('text=邮件发送成功')).toBeVisible({
      timeout: 15000,
    });

    // 7. 委托人签名
    await page.goto(`${contractUrl}/sign`);
    // 等待签名页面加载
    await page.waitForSelector('text=签署状态', { timeout: 60000 });
    // 点击委托人的立即签署
    await page.locator('button:has-text("立即签署")').first().click();
    // 等待签名板canvas出现
    const canvas = page.locator('canvas');
    await canvas.waitFor({ timeout: 30000 });
    await canvas.click({ position: { x: 50, y: 50 } });
    await canvas.click({ position: { x: 100, y: 80 } });
    await page.click('button:has-text("确认签名")');
    // 等待签名成功并等待页面刷新（loadContract完成，委托人签名图片出现，立即签署按钮消失）
    await page.waitForSelector('text=签名成功', { timeout: 30000 });
    await page.waitForSelector('img[alt="委托人签名"]', { timeout: 30000 });

    // 8. 律师签名（此时委托人立即签署已消失，只剩律师的立即签署）
    await page.locator('button:has-text("立即签署")').first().click();
    await canvas.waitFor({ timeout: 30000 });
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.click('button:has-text("确认签名")');

    // 9. 验证签署完成
    await expect(page.locator('text=双方签署完成')).toBeVisible({
      timeout: 30000,
    });

    // 10. 验证下载PDF按钮存在
    await page.goto(contractUrl);
    await expect(page.locator('text=下载PDF')).toBeVisible();
  });

  test('应该支持合同编辑和版本管理', async ({ page }) => {
    test.setTimeout(240000);

    // 1. 创建合同
    await page.goto('http://localhost:3000/contracts/new');
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="clientName"]', '李四');
    await page.selectOption('select[name="caseType"]', '合同纠纷');
    await page.fill('input[name="totalFee"]', '20000');
    await page.click('button[type="submit"]');
    await page.waitForURL(
      url =>
        url.pathname.startsWith('/contracts/') &&
        !url.pathname.endsWith('/new'),
      { timeout: 60000 }
    );
    // 等待合同详情页完全渲染
    await page.waitForSelector('text=委托方信息', { timeout: 60000 });

    const contractUrl = page.url();

    // 验证金额显示
    await expect(page.locator('text=¥20,000').first()).toBeVisible({
      timeout: 30000,
    });

    // 2. 编辑合同
    await page.click('text=编辑');
    // 等待URL变化（commit）后再等表单渲染，避免Turbopack编译时间不可控
    await page.waitForURL('**/edit', { timeout: 120000, waitUntil: 'commit' });
    // 等待编辑页面表单渲染完成（包含Turbopack编译时间）
    await page.waitForSelector('input[name="totalFee"]', { timeout: 120000 });

    // 清空并重新填写总费用
    await page.fill('input[name="totalFee"]', '25000');
    await page.click('button:has-text("保存")');

    // 等待保存成功
    await expect(page.locator('text=保存成功')).toBeVisible({ timeout: 15000 });

    // 3. 回到详情页查看版本历史
    await page.goto(contractUrl);
    await page.waitForSelector('text=委托方信息', { timeout: 60000 });
    await page.click('text=版本历史');

    // 等待版本历史加载
    await page.waitForSelector('text=版本', { timeout: 30000 });

    // 验证版本存在（至少有版本 1）
    await expect(page.locator('text=版本 1')).toBeVisible({ timeout: 15000 });
  });

  test('应该支持审批流程', async ({ page }) => {
    test.setTimeout(300000);

    // 1. 创建合同
    await page.goto('http://localhost:3000/contracts/new');
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="clientName"]', '王五');
    await page.selectOption('select[name="caseType"]', '合同纠纷');
    await page.fill('input[name="totalFee"]', '30000');
    await page.click('button[type="submit"]');
    await page.waitForURL(
      url =>
        url.pathname.startsWith('/contracts/') &&
        !url.pathname.endsWith('/new'),
      { timeout: 60000 }
    );
    // 等待合同详情页完全渲染
    await page.waitForSelector('text=委托方信息', { timeout: 60000 });

    // 2. 发起审批
    await page.click('text=发起审批');
    await page.waitForSelector('button:has-text("确认")');
    await page.click('button:has-text("确认")');

    // 等待审批发起成功
    await expect(page.locator('text=审批已发起')).toBeVisible({
      timeout: 30000,
    });

    // 3. 查看审批详情
    await page.click('text=查看审批');
    await page.waitForURL('**/approval', { timeout: 120000 });
    // 等待审批流程渲染（包含API编译和数据加载时间）
    await page.waitForSelector('text=审批流程', { timeout: 120000 });

    await expect(page.locator('text=第1步')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=待审批')).toBeVisible({ timeout: 30000 });

    // 4. 提交审批意见
    const passButton = page.locator('button:has-text("通过")').first();
    await passButton.click();
    await page.fill('textarea[name="comment"]', '合同条款清晰，同意通过');
    await page.click('button:has-text("确认")');

    // 验证审批成功
    await expect(page.locator('text=审批意见已提交')).toBeVisible({
      timeout: 30000,
    });
  });
});
