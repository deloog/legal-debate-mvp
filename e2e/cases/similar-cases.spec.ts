/**
 * E2E 测试：相似案例推荐功能
 * 
 * 测试范围：
 * - 相似案例面板加载和显示
 * - 案例卡片交互
 * - 筛选功能
 * - 详情展开
 */

import { test, expect } from '@playwright/test';

test.describe('相似案例推荐功能', () => {
  const TEST_CASE_ID = 'test-case-123';

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

  test.describe('页面加载', () => {
    test('应显示相似案例标签页', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      
      // 验证相似案例标签存在
      const similarCasesTab = page.getByRole('tab', { name: /相似案例/ });
      await expect(similarCasesTab).toBeVisible();
    });

    test('点击标签页应加载相似案例面板', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      
      // 点击相似案例标签
      const similarCasesTab = page.getByRole('tab', { name: /相似案例/ });
      await similarCasesTab.click();
      
      // 验证面板加载
      await expect(page.getByText('相似案例推荐')).toBeVisible();
      await expect(page.getByText(/找到 \d+ 个相似案例/)).toBeVisible();
    });

    test('应显示加载状态', async ({ page }) => {
      // 延迟API响应
      await page.route(`**/api/cases/${TEST_CASE_ID}/similar**`, async (route: any) => {
        await new Promise(r => setTimeout(r, 500));
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              caseId: TEST_CASE_ID,
              matches: [],
              totalMatches: 0,
              searchTime: 100,
            },
          }),
        });
      });

      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 验证加载状态
      await expect(page.getByText('正在检索相似案例...')).toBeVisible();
    });
  });

  test.describe('案例卡片交互', () => {
    test.beforeEach(async ({ page }) => {
      // 模拟相似案例API响应
      await page.route(`**/api/cases/${TEST_CASE_ID}/similar**`, async (route: any) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              caseId: TEST_CASE_ID,
              matches: [
                {
                  caseExample: {
                    id: 'example-1',
                    title: '测试相似案例一',
                    caseNumber: '(2024)京01民初001号',
                    court: '北京市第一中级人民法院',
                    type: 'CIVIL',
                    cause: '合同纠纷',
                    facts: '测试案情事实...',
                    judgment: '判决被告支付货款...',
                    result: 'WIN',
                    judgmentDate: '2024-01-15T00:00:00Z',
                  },
                  similarity: 0.92,
                  matchingFactors: ['案由相同', '争议金额相近'],
                },
              ],
              totalMatches: 1,
              searchTime: 150,
              metadata: {
                algorithm: 'cosine',
                vectorDimension: 1536,
                casesSearched: 1000,
              },
            },
          }),
        });
      });
    });

    test('应显示案例卡片信息', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 验证案例信息
      await expect(page.getByText('测试相似案例一')).toBeVisible();
      await expect(page.getByText('(2024)京01民初001号')).toBeVisible();
      await expect(page.getByText('北京市第一中级人民法院')).toBeVisible();
      await expect(page.getByText('92%')).toBeVisible();
    });

    test('应显示匹配因素', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 验证匹配因素标签
      await expect(page.getByText('案由相同')).toBeVisible();
      await expect(page.getByText('争议金额相近')).toBeVisible();
    });

    test('点击详情按钮应展开案例详情', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 点击详情按钮
      const detailButton = page.getByRole('button', { name: /详情/ }).first();
      await detailButton.click();
      
      // 验证详情展开
      await expect(page.getByText('案情摘要')).toBeVisible();
      await expect(page.getByText('测试案情事实...')).toBeVisible();
      await expect(page.getByText('判决结果')).toBeVisible();
    });

    test('点击收起按钮应折叠案例详情', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 展开详情
      await page.getByRole('button', { name: /详情/ }).first().click();
      await expect(page.getByText('案情摘要')).toBeVisible();
      
      // 点击收起
      await page.getByRole('button', { name: /收起/ }).first().click();
      
      // 验证详情已折叠
      await expect(page.getByText('案情摘要')).not.toBeVisible();
    });
  });

  test.describe('筛选功能', () => {
    test('应支持相似度阈值筛选', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 选择阈值
      const thresholdSelect = page.getByLabel('相似度阈值');
      await thresholdSelect.selectOption('0.8');
      
      // 验证筛选参数已发送
      const responsePromise = page.waitForResponse(
        response => response.url().includes('threshold=0.8')
      );
      await responsePromise;
    });

    test('应支持结果数量筛选', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 选择结果数量
      const topKSelect = page.getByLabel('结果数量');
      await topKSelect.selectOption('5');
      
      // 验证筛选参数已发送
      const responsePromise = page.waitForResponse(
        response => response.url().includes('topK=5')
      );
      await responsePromise;
    });

    test('点击刷新按钮应重新加载数据', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 等待初始加载完成
      await expect(page.getByText(/找到 \d+ 个相似案例/)).toBeVisible();
      
      // 点击刷新
      const refreshButton = page.getByRole('button', { name: /重新检索/ });
      
      // 等待新的请求
      const responsePromise = page.waitForResponse(
        response => response.url().includes(`/api/cases/${TEST_CASE_ID}/similar`)
      );
      await refreshButton.click();
      await responsePromise;
    });
  });

  test.describe('错误处理', () => {
    test('API错误时应显示错误信息', async ({ page }) => {
      // 模拟API错误
      await page.route(`**/api/cases/${TEST_CASE_ID}/similar**`, async (route: any) => {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({
            success: false,
            error: { message: '服务器内部错误' },
          }),
        });
      });

      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 验证错误信息
      await expect(page.getByText('服务器内部错误')).toBeVisible();
    });

    test('无相似案例时应显示空状态', async ({ page }) => {
      // 模拟空结果
      await page.route(`**/api/cases/${TEST_CASE_ID}/similar**`, async (route: any) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              caseId: TEST_CASE_ID,
              matches: [],
              totalMatches: 0,
              searchTime: 100,
            },
          }),
        });
      });

      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 验证空状态
      await expect(page.getByText('未找到相似案例')).toBeVisible();
      await expect(page.getByText('尝试调整相似度阈值或添加更多案情描述')).toBeVisible();
    });
  });

  test.describe('分页功能', () => {
    // 生成12个相似案例数据用于分页测试
    const generateManyMatches = (count: number) => {
      return Array.from({ length: count }, (_, i) => ({
        caseExample: {
          id: `example-${i + 1}`,
          title: `分页测试案例 ${i + 1}`,
          caseNumber: `(2024)京${String(i + 1).padStart(2, '0')}民初${String(i + 1).padStart(3, '0')}号`,
          court: '北京市第一中级人民法院',
          type: 'CIVIL',
          cause: '合同纠纷',
          facts: `案例 ${i + 1} 的案情事实描述...`,
          judgment: '判决结果...',
          result: i % 2 === 0 ? 'WIN' : 'PARTIAL',
          judgmentDate: '2024-01-15T00:00:00Z',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: null,
        },
        similarity: 0.95 - i * 0.02,
        matchingFactors: ['案由相同', '争议金额相近'],
      }));
    };

    test.beforeEach(async ({ page }) => {
      await page.route(`**/api/cases/${TEST_CASE_ID}/similar**`, async (route: any) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              caseId: TEST_CASE_ID,
              matches: generateManyMatches(12),
              totalMatches: 12,
              searchTime: 1000,
              metadata: {
                algorithm: 'cosine',
                vectorDimension: 1536,
                casesSearched: 1000,
              },
            },
          }),
        });
      });
    });

    test('应显示分页控件', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();

      await expect(page.getByText(/第 1 \/ 3 页/)).toBeVisible();
      await expect(page.getByText(/共 12 条/)).toBeVisible();
    });

    test('点击下一页应显示下一页数据', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();

      // 验证第一页数据
      await expect(page.getByText('分页测试案例 1')).toBeVisible();

      // 点击下一页
      await page.getByRole('button', { name: /下一页/ }).click();

      // 验证第二页数据
      await expect(page.getByText(/第 2 \/ 3 页/)).toBeVisible();
      await expect(page.getByText('分页测试案例 6')).toBeVisible();
    });

    test('点击上一页应返回上一页数据', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();

      // 先到第二页
      await page.getByRole('button', { name: /下一页/ }).click();
      await expect(page.getByText(/第 2 \/ 3 页/)).toBeVisible();

      // 点击上一页
      await page.getByRole('button', { name: /上一页/ }).click();

      // 验证回到第一页
      await expect(page.getByText(/第 1 \/ 3 页/)).toBeVisible();
      await expect(page.getByText('分页测试案例 1')).toBeVisible();
    });

    test('第一页应禁用上一页按钮', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();

      const prevButton = page.getByRole('button', { name: /上一页/ });
      await expect(prevButton).toBeDisabled();
    });

    test('最后一页应禁用下一页按钮', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();

      // 点击到最后一页
      await page.getByRole('button', { name: /下一页/ }).click();
      await page.getByRole('button', { name: /下一页/ }).click();

      await expect(page.getByText(/第 3 \/ 3 页/)).toBeVisible();

      const nextButton = page.getByRole('button', { name: /下一页/ });
      await expect(nextButton).toBeDisabled();
    });

    test('筛选条件变化时应重置到第一页', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();

      // 先到第二页
      await page.getByRole('button', { name: /下一页/ }).click();
      await expect(page.getByText(/第 2 \/ 3 页/)).toBeVisible();

      // 修改筛选条件
      await page.getByLabel('相似度阈值').selectOption('0.8');

      // 验证回到第一页
      await expect(page.getByText(/第 1 \/ 3 页/)).toBeVisible();
    });
  });

  test.describe('可访问性', () => {
    test.beforeEach(async ({ page }) => {
      await page.route(`**/api/cases/${TEST_CASE_ID}/similar**`, async (route: any) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              caseId: TEST_CASE_ID,
              matches: [
                {
                  caseExample: {
                    id: 'example-1',
                    title: '测试相似案例',
                    caseNumber: '(2024)京01民初001号',
                    court: '北京市第一中级人民法院',
                    type: 'CIVIL',
                    cause: '合同纠纷',
                    facts: '测试案情...',
                    judgment: '判决...',
                    result: 'WIN',
                    judgmentDate: '2024-01-15T00:00:00Z',
                  },
                  similarity: 0.85,
                  matchingFactors: ['案由相同'],
                },
              ],
              totalMatches: 1,
              searchTime: 100,
            },
          }),
        });
      });
    });

    test('应支持键盘导航', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 验证筛选器可通过键盘访问
      const thresholdSelect = page.getByLabel('相似度阈值');
      await thresholdSelect.focus();
      await expect(thresholdSelect).toBeFocused();
    });

    test('应有正确的ARIA标签', async ({ page }) => {
      await page.goto(`/cases/${TEST_CASE_ID}`);
      await page.getByRole('tab', { name: /相似案例/ }).click();
      
      // 验证按钮有正确的aria-label
      const refreshButton = page.getByRole('button', { name: /重新检索/ });
      await expect(refreshButton).toHaveAttribute('aria-label', '重新检索');
    });
  });
});
