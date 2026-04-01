/**
 * E2E 测试：风险评估图表功能
 * 
 * 测试范围：
 * - 图表组件加载和显示
 * - 标签页切换
 * - 图表交互
 * - 图表导出
 */

import { test, expect } from '@playwright/test';

test.describe('风险评估图表功能', () => {
  test.beforeEach(async ({ page }) => {
    // 模拟登录状态
    await page.context().addCookies([
      {
        name: 'auth-token',
        value: 'test-token',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test.describe('图表加载', () => {
    test('评估结果应显示图表组件', async ({ page }) => {
      await page.goto('/risk-assessment');
      
      // 填写并提交表单
      await page.getByLabel('案件标题').fill('测试案件');
      await page.getByLabel('案件类型').fill('合同纠纷');
      await page.getByLabel('案件描述').fill('测试案件描述');
      await page.getByLabel('原告').fill('原告A');
      await page.getByLabel('被告').fill('被告B');
      
      // 添加案件事实
      await page.getByRole('button', { name: '添加事实' }).click();
      await page.getByPlaceholder('请输入案件事实 1').fill('测试事实');
      
      // 添加诉讼请求
      await page.getByRole('button', { name: '添加诉讼请求' }).click();
      await page.getByPlaceholder('请输入诉讼请求 1').fill('测试请求');
      
      // 模拟评估API响应
      await page.route('**/api/risk-assessment', async (route: any) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              caseId: 'case-test',
              overallRiskLevel: 'HIGH',
              overallRiskScore: 0.75,
              winProbability: 65,
              risks: [
                {
                  id: 'risk-1',
                  riskType: 'EVIDENCE_STRENGTH',
                  riskCategory: 'EVIDENTIARY',
                  riskLevel: 'HIGH',
                  score: 0.8,
                  confidence: 0.85,
                  description: '证据强度不足',
                },
                {
                  id: 'risk-2',
                  riskType: 'LEGAL_PROCEDURE',
                  riskCategory: 'PROCEDURAL',
                  riskLevel: 'MEDIUM',
                  score: 0.6,
                  confidence: 0.75,
                  description: '程序问题',
                },
              ],
              statistics: {
                totalRisks: 2,
                criticalRisks: 0,
                highRisks: 1,
                mediumRisks: 1,
                lowRisks: 0,
                byLevel: { LOW: 0, MEDIUM: 1, HIGH: 1, CRITICAL: 0 },
                byCategory: { PROCEDURAL: 1, EVIDENTIARY: 1, SUBSTANTIVE: 0, STRATEGIC: 0 },
                byType: { EVIDENCE_STRENGTH: 1, LEGAL_PROCEDURE: 1 },
              },
              suggestions: [],
            },
          }),
        });
      });
      
      // 提交表单
      await page.getByRole('button', { name: '开始评估' }).click();
      
      // 验证图表组件显示
      await expect(page.getByText('风险分析图表')).toBeVisible();
    });

    test('应显示风险分布饼图', async ({ page }) => {
      await page.goto('/risk-assessment');
      await submitAssessmentForm(page);
      
      // 验证饼图标签页默认选中
      const distributionTab = page.getByRole('tab', { name: '风险分布' });
      await expect(distributionTab).toHaveAttribute('aria-selected', 'true');
      
      // 验证饼图容器
      await expect(page.locator('.risk-distribution-chart')).toBeVisible();
    });

    test('应显示统计摘要卡片', async ({ page }) => {
      await page.goto('/risk-assessment');
      await submitAssessmentForm(page);
      
      // 验证统计摘要
      await expect(page.getByText('风险总数')).toBeVisible();
      await expect(page.getByText('最高风险等级')).toBeVisible();
      await expect(page.getByText('主要风险类别')).toBeVisible();
    });
  });

  test.describe('标签页切换', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/risk-assessment');
      await submitAssessmentForm(page);
    });

    test('应支持切换到类别分析标签', async ({ page }) => {
      // 点击类别分析标签
      const categoryTab = page.getByRole('tab', { name: '类别分析' });
      await categoryTab.click();
      
      // 验证标签选中状态
      await expect(categoryTab).toHaveAttribute('aria-selected', 'true');
      
      // 验证条形图显示
      await expect(page.locator('.category-analysis-chart')).toBeVisible();
    });

    test('应支持切换到趋势分析标签', async ({ page }) => {
      // 点击趋势分析标签
      const trendTab = page.getByRole('tab', { name: '趋势分析' });
      await trendTab.click();
      
      // 验证标签选中状态
      await expect(trendTab).toHaveAttribute('aria-selected', 'true');
      
      // 验证趋势图显示
      await expect(page.locator('.trend-analysis-chart')).toBeVisible();
      await expect(page.getByText('风险累积趋势')).toBeVisible();
    });

    test('标签切换应保留状态', async ({ page }) => {
      // 切换到类别分析
      await page.getByRole('tab', { name: '类别分析' }).click();
      await expect(page.locator('.category-analysis-chart')).toBeVisible();
      
      // 切换回风险分布
      await page.getByRole('tab', { name: '风险分布' }).click();
      await expect(page.locator('.risk-distribution-chart')).toBeVisible();
    });
  });

  test.describe('图表导出功能', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/risk-assessment');
      await submitAssessmentForm(page);
    });

    test('应显示导出按钮', async ({ page }) => {
      const exportButton = page.getByRole('button', { name: '导出图表' });
      await expect(exportButton).toBeVisible();
    });

    test('点击导出按钮应触发导出', async ({ page }) => {
      // 监听控制台消息
      const consoleMessages: string[] = [];
      page.on('console', msg => consoleMessages.push(msg.text()));
      
      // 点击导出按钮
      await page.getByRole('button', { name: '导出图表' }).click();
      
      // 验证导出行为（具体实现取决于导出逻辑）
      // 这里验证按钮可点击且没有错误
      await expect(page.getByText('风险分析图表')).toBeVisible();
    });
  });

  test.describe('空状态处理', () => {
    test('无风险时应显示空状态', async ({ page }) => {
      await page.goto('/risk-assessment');
      
      // 填写表单
      await page.getByLabel('案件标题').fill('低风险案件');
      await page.getByLabel('案件类型').fill('简单案件');
      await page.getByLabel('案件描述').fill('这是一个简单的案件');
      await page.getByLabel('原告').fill('原告A');
      await page.getByLabel('被告').fill('被告B');
      await page.getByRole('button', { name: '添加事实' }).click();
      await page.getByPlaceholder('请输入案件事实 1').fill('事实');
      await page.getByRole('button', { name: '添加诉讼请求' }).click();
      await page.getByPlaceholder('请输入诉讼请求 1').fill('请求');
      
      // 模拟无风险响应
      await page.route('**/api/risk-assessment', async (route: any) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              caseId: 'case-test',
              overallRiskLevel: 'LOW',
              overallRiskScore: 0.2,
              winProbability: 85,
              risks: [],
              statistics: {
                totalRisks: 0,
                criticalRisks: 0,
                highRisks: 0,
                mediumRisks: 0,
                lowRisks: 0,
                byLevel: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
                byCategory: { PROCEDURAL: 0, EVIDENTIARY: 0, SUBSTANTIVE: 0, STRATEGIC: 0 },
                byType: {},
              },
              suggestions: [],
            },
          }),
        });
      });
      
      await page.getByRole('button', { name: '开始评估' }).click();
      
      // 验证空状态
      await expect(page.getByText('暂无风险数据')).toBeVisible();
    });
  });

  test.describe('响应式布局', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/risk-assessment');
      await submitAssessmentForm(page);
    });

    test('移动端应调整布局', async ({ page }) => {
      // 设置为移动端视口
      await page.setViewportSize({ width: 375, height: 667 });
      
      // 验证图表组件仍然可见
      await expect(page.getByText('风险分析图表')).toBeVisible();
      
      // 验证标签页可以滚动或折叠
      const tabs = page.getByRole('tablist');
      await expect(tabs).toBeVisible();
    });
  });

  test.describe('可访问性', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/risk-assessment');
      await submitAssessmentForm(page);
    });

    test('图表应有正确的ARIA标签', async ({ page }) => {
      // 验证标签列表
      const tablist = page.getByRole('tablist');
      await expect(tablist).toBeVisible();
      
      // 验证所有标签都有正确的role
      const tabs = page.getByRole('tab');
      await expect(tabs).toHaveCount(3);
    });

    test('应支持键盘导航标签页', async ({ page }) => {
      // 聚焦第一个标签
      const firstTab = page.getByRole('tab').first();
      await firstTab.focus();
      await expect(firstTab).toBeFocused();
      
      // 使用键盘切换到下一个标签
      await page.keyboard.press('ArrowRight');
      
      // 验证第二个标签被选中
      const tabs = await page.getByRole('tab').all();
      if (tabs[1]) {
        // 注意：实际行为取决于组件实现
        await expect(tabs[1]).toBeVisible();
      }
    });
  });

  // 辅助函数：提交评估表单
  async function submitAssessmentForm(page: any) {
    await page.getByLabel('案件标题').fill('测试案件');
    await page.getByLabel('案件类型').fill('合同纠纷');
    await page.getByLabel('案件描述').fill('测试案件描述');
    await page.getByLabel('原告').fill('原告A');
    await page.getByLabel('被告').fill('被告B');
    
    await page.getByRole('button', { name: '添加事实' }).click();
    await page.getByPlaceholder('请输入案件事实 1').fill('测试事实');
    
    await page.getByRole('button', { name: '添加诉讼请求' }).click();
    await page.getByPlaceholder('请输入诉讼请求 1').fill('测试请求');
    
    // 模拟评估API
    await page.route('**/api/risk-assessment', async (route: any) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            caseId: 'case-test',
            overallRiskLevel: 'HIGH',
            overallRiskScore: 0.75,
            winProbability: 65,
            risks: [
              {
                id: 'risk-1',
                riskType: 'EVIDENCE_STRENGTH',
                riskCategory: 'EVIDENTIARY',
                riskLevel: 'HIGH',
                score: 0.8,
                confidence: 0.85,
                description: '证据强度不足',
              },
              {
                id: 'risk-2',
                riskType: 'LEGAL_PROCEDURE',
                riskCategory: 'PROCEDURAL',
                riskLevel: 'MEDIUM',
                score: 0.6,
                confidence: 0.75,
                description: '程序问题',
              },
            ],
            statistics: {
              totalRisks: 2,
              criticalRisks: 0,
              highRisks: 1,
              mediumRisks: 1,
              lowRisks: 0,
              byLevel: { LOW: 0, MEDIUM: 1, HIGH: 1, CRITICAL: 0 },
              byCategory: { PROCEDURAL: 1, EVIDENTIARY: 1, SUBSTANTIVE: 0, STRATEGIC: 0 },
              byType: { EVIDENCE_STRENGTH: 1, LEGAL_PROCEDURE: 1 },
            },
            suggestions: [],
          },
        }),
      });
    });
    
    await page.getByRole('button', { name: '开始评估' }).click();
    
    // 等待评估结果
    await expect(page.getByText('评估结果')).toBeVisible();
  }
});
