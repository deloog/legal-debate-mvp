/**
 * 合同完整流程E2E测试
 */

import { test, expect } from '@playwright/test';

test.describe('合同完整流程', () => {
  test.beforeEach(async ({ page }) => {
    // 登录系统
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');
  });

  test('应该完成从创建到签署的完整流程', async ({ page }) => {
    // 1. 访问合同列表页
    await page.goto('http://localhost:3000/contracts');
    await expect(page.locator('h1')).toContainText('委托合同');

    // 2. 创建新合同
    await page.click('text=创建合同');
    await page.waitForURL('**/contracts/new');

    // 填写合同信息
    await page.selectOption('select[name="clientType"]', '个人');
    await page.fill('input[name="clientName"]', '张三');
    await page.fill('input[name="clientPhone"]', '13800138000');
    await page.selectOption('select[name="caseType"]', '劳动争议');
    await page.fill('textarea[name="caseSummary"]', '劳动合同纠纷案件');
    await page.fill('input[name="totalFee"]', '10000');

    // 提交表单
    await page.click('button[type="submit"]');
    await page.waitForURL('**/contracts/*');

    // 3. 验证合同创建成功
    await expect(page.locator('text=张三')).toBeVisible();
    await expect(page.locator('text=¥10,000')).toBeVisible();

    // 4. 发起审批
    await page.click('text=发起审批');
    await page.selectOption('select[name="templateId"]', { index: 0 });
    await page.click('button:has-text("确认")');

    // 等待审批创建成功
    await expect(page.locator('text=审批已发起')).toBeVisible();

    // 5. 审批通过
    await page.goto('http://localhost:3000/approvals/pending');
    await page.click('text=张三');
    await page.click('button:has-text("通过")');
    await page.fill('textarea[name="comment"]', '同意通过');
    await page.click('button:has-text("确认")');

    // 6. 发送邮件
    const contractUrl = page.url();
    await page.goto(contractUrl);
    await page.click('text=发送邮件');
    await page.fill('input[name="recipientEmail"]', 'client@example.com');
    await page.fill('input[name="recipientName"]', '张三');
    await page.click('button:has-text("发送")');

    // 等待邮件发送成功
    await expect(page.locator('text=邮件发送成功')).toBeVisible();

    // 7. 委托人签名
    await page.goto(`${contractUrl}/sign`);
    await page.click('text=立即签署');

    // 在签名板上签名（模拟）
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 50, y: 50 } });

    await page.click('button:has-text("确认签名")');

    // 8. 律师签名
    await page.click('text=律师签名');
    await page.click('text=立即签署');
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.click('button:has-text("确认签名")');

    // 9. 验证签署完成
    await expect(page.locator('text=双方签署完成')).toBeVisible();

    // 10. 下载PDF
    await page.goto(contractUrl);
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=下载PDF');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('应该支持合同编辑和版本管理', async ({ page }) => {
    // 1. 创建合同
    await page.goto('http://localhost:3000/contracts/new');
    await page.fill('input[name="clientName"]', '李四');
    await page.fill('input[name="totalFee"]', '20000');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/contracts/*');

    const contractUrl = page.url();
    const __contractId = contractUrl.split('/').pop();

    // 2. 编辑合同
    await page.click('text=编辑');
    await page.fill('input[name="totalFee"]', '25000');
    await page.click('button:has-text("保存")');

    // 等待保存成功
    await expect(page.locator('text=保存成功')).toBeVisible();

    // 3. 查看版本历史
    await page.click('text=版本历史');
    await expect(page.locator('text=版本 1')).toBeVisible();
    await expect(page.locator('text=版本 2')).toBeVisible();

    // 4. 版本对比
    await page.click('text=对比版本');
    await expect(page.locator('text=20000')).toBeVisible();
    await expect(page.locator('text=25000')).toBeVisible();

    // 5. 版本回滚
    await page.click('text=回滚到版本 1');
    await page.click('button:has-text("确认回滚")');

    // 验证回滚成功
    await expect(page.locator('text=¥20,000')).toBeVisible();
  });

  test('应该支持审批流程', async ({ page }) => {
    // 1. 创建合同
    await page.goto('http://localhost:3000/contracts/new');
    await page.fill('input[name="clientName"]', '王五');
    await page.fill('input[name="totalFee"]', '30000');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/contracts/*');

    // 2. 发起审批
    await page.click('text=发起审批');
    await page.click('button:has-text("确认")');

    // 3. 查看审批流程
    await page.click('text=查看审批');
    await expect(page.locator('text=第1步')).toBeVisible();
    await expect(page.locator('text=待审批')).toBeVisible();

    // 4. 提交审批意见
    await page.click('button:has-text("通过")');
    await page.fill('textarea[name="comment"]', '合同条款清晰，同意通过');
    await page.click('button:has-text("确认")');

    // 验证审批成功
    await expect(page.locator('text=审批意见已提交')).toBeVisible();
  });
});
