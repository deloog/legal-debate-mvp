/**
 * E2E测试辅助函数测试
 * 测试E2ETestHelpers类的所有功能
 */

import { test, expect, type Page } from '@playwright/test';
import { E2ETestHelpers } from './test-helpers';

test.describe('E2ETestHelpers', () => {
  let page: Page;

  test.beforeEach(async ({ page: newPage }) => {
    page = newPage;
    await page.goto('about:blank');
  });

  test.afterEach(async () => {
    // Page will be cleaned up by Playwright
  });

  test.describe('waitForAPIResponse方法', () => {
    test('应该等待API响应并返回结果', async () => {
      // 添加一个API路由用于测试
      await page.route('**/api/test-endpoint', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { test: 'data' } }),
        })
      );

      // 发起请求并等待响应
      const response = await Promise.all([
        E2ETestHelpers.waitForAPIResponse(page, '**/api/test-endpoint', 5000),
        page.evaluate(async () => {
          // 使用绝对URL
          return fetch('http://localhost:3000/api/test-endpoint').then(r =>
            r.json()
          );
        }),
      ]);

      expect(response[0]).toBeDefined();
      const responseData = response[0] as {
        success: boolean;
        data: Record<string, unknown>;
      };
      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeDefined();
    });

    test('应该在超时时抛出错误', async () => {
      // 不设置任何路由，请求会超时
      await expect(
        E2ETestHelpers.waitForAPIResponse(
          page,
          '**/api/never-respond',
          100,
          true
        )
      ).rejects.toThrow();
    });

    test('应该支持URL模式匹配', async () => {
      await page.route('**/api/users/**', route =>
        route.fulfill({
          status: 200,
          body: JSON.stringify({ users: [] }),
        })
      );

      const result = await Promise.all([
        E2ETestHelpers.waitForAPIResponse(page, '**/api/users/**', 5000),
        page.evaluate(async () => {
          return fetch('http://localhost:3000/api/users/123').then(r =>
            r.json()
          );
        }),
      ]);

      expect(result[0]).toBeDefined();
    });
  });

  test.describe('waitForElementVisible方法', () => {
    test('应该等待元素变为可见', async () => {
      await page.setContent(`
        <div id="test-element" style="display: none;">
          Test Content
        </div>
      `);

      // 延迟显示元素
      setTimeout(() => {
        page.evaluate(() => {
          (document.getElementById(
            'test-element'
          ) as HTMLElement)!.style.display = 'block';
        });
      }, 500);

      const element = await E2ETestHelpers.waitForElementVisible(
        page,
        '#test-element',
        2000
      );

      expect(element).toBeDefined();
      expect(await element.isVisible()).toBe(true);
    });

    test('应该在超时时抛出错误', async () => {
      await page.setContent(`
        <div id="never-visible" style="display: none;">
          Never Visible
        </div>
      `);

      await expect(
        E2ETestHelpers.waitForElementVisible(page, '#never-visible', 100)
      ).rejects.toThrow();
    });

    test('应该处理已存在的可见元素', async () => {
      await page.setContent(`
        <div id="already-visible" style="display: block;">
          Already Visible
        </div>
      `);

      const element = await E2ETestHelpers.waitForElementVisible(
        page,
        '#already-visible',
        2000
      );

      expect(element).toBeDefined();
    });
  });

  test.describe('safeClick方法', () => {
    test('应该安全地点击元素', async () => {
      await page.setContent(`
        <button id="test-button" style="display: block; margin: 500px 0;">
          Click Me
        </button>
        <div id="clicked-indicator"></div>
        <script>
          document.getElementById('test-button').addEventListener('click', () => {
            document.getElementById('clicked-indicator').textContent = 'clicked';
          });
        </script>
      `);

      await E2ETestHelpers.safeClick(page, '#test-button', 5000);

      const indicator = await page.textContent('#clicked-indicator');
      expect(indicator).toBe('clicked');
    });

    test('应该等待元素可见后点击', async () => {
      await page.setContent(`
        <button id="delayed-button" style="display: none;">
          Delayed Button
        </button>
        <div id="clicked-result"></div>
        <script>
          document.getElementById('delayed-button').addEventListener('click', () => {
            document.getElementById('clicked-result').textContent = 'success';
          });
          setTimeout(() => {
            document.getElementById('delayed-button').style.display = 'block';
          }, 300);
        </script>
      `);

      await E2ETestHelpers.safeClick(page, '#delayed-button', 2000);

      const result = await page.textContent('#clicked-result');
      expect(result).toBe('success');
    });

    test('应该在超时时抛出错误', async () => {
      await page.setContent(`
        <div>Page Content</div>
      `);

      await expect(
        E2ETestHelpers.safeClick(page, '#non-existent-button', 100)
      ).rejects.toThrow();
    });
  });

  test.describe('retryOperation方法', () => {
    test('应该在成功时返回结果', async () => {
      let attemptCount = 0;

      const result = await E2ETestHelpers.retryOperation(
        async () => {
          attemptCount++;
          return 'success';
        },
        3,
        100
      );

      expect(result).toBe('success');
      expect(attemptCount).toBe(1);
    });

    test('应该在失败时重试', async () => {
      let attemptCount = 0;

      const result = await E2ETestHelpers.retryOperation(
        async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Not yet');
          }
          return 'success';
        },
        5,
        50
      );

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    test('应该在达到最大重试次数后抛出错误', async () => {
      await expect(
        E2ETestHelpers.retryOperation(
          async () => {
            throw new Error('Always fails');
          },
          3,
          50
        )
      ).rejects.toThrow('Always fails');
    });

    test('应该支持自定义错误处理', async () => {
      let attempts = 0;

      const result = await E2ETestHelpers.retryOperation(
        async () => {
          attempts++;
          if (attempts < 2) {
            const error = new Error('Retryable') as Error & {
              code?: string;
            };
            error.code = 'RETRYABLE';
            throw error;
          }
          return 'done';
        },
        3,
        50,
        (error: unknown) => {
          return (error as Error & { code?: string })?.code === 'RETRYABLE';
        }
      );

      expect(result).toBe('done');
    });
  });

  test.describe('waitForPageLoad方法', () => {
    test('应该等待页面加载完成', async () => {
      await E2ETestHelpers.waitForPageLoad(page, 5000);

      expect(page.url()).toContain('about:blank');
    });

    test('应该处理页面导航', async () => {
      await page.goto('about:blank');
      await E2ETestHelpers.waitForPageLoad(page, 5000);

      expect(page).toBeDefined();
    });
  });

  test.describe('typeTextSafely方法', () => {
    test('应该安全地输入文本', async () => {
      await page.setContent(`
        <input type="text" id="test-input" />
      `);

      await E2ETestHelpers.typeTextSafely(
        page,
        '#test-input',
        'Hello World',
        5000
      );

      const value = await page.inputValue('#test-input');
      expect(value).toBe('Hello World');
    });

    test('应该清空现有文本后输入', async () => {
      await page.setContent(`
        <input type="text" id="test-input" value="old text" />
      `);

      await E2ETestHelpers.typeTextSafely(
        page,
        '#test-input',
        'new text',
        5000
      );

      const value = await page.inputValue('#test-input');
      expect(value).toBe('new text');
    });

    test('应该在超时时抛出错误', async () => {
      await page.setContent(`<div>No input</div>`);

      await expect(
        E2ETestHelpers.typeTextSafely(page, '#non-existent', 'test', 100)
      ).rejects.toThrow();
    });
  });

  test.describe('integration测试', () => {
    test('完整流程：等待API → 等待元素 → 点击', async () => {
      // Mock API
      await page.route('**/api/load-data', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ loaded: true }),
        })
      );

      // 设置页面
      await page.setContent(`
        <div id="app">
          <button id="load-btn" style="display: block;">Load</button>
          <div id="result" style="display: none;">Loaded!</div>
        </div>
        <script>
          document.getElementById('load-btn').addEventListener('click', async () => {
            const response = await fetch('http://localhost:3000/api/load-data').then(r => r.json());
            if (response.loaded) {
              document.getElementById('result').style.display = 'block';
            }
          });
        </script>
      `);

      // 完整流程
      await E2ETestHelpers.safeClick(page, '#load-btn', 5000);
      await E2ETestHelpers.waitForAPIResponse(page, '**/api/load-data', 5000);
      await E2ETestHelpers.waitForElementVisible(page, '#result', 5000);

      const result = await page.textContent('#result');
      expect(result).toBe('Loaded!');
    });
  });
});
