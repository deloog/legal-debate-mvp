/**
 * E2E测试辅助函数
 * 提供稳定、可靠的E2E测试辅助函数
 */

import type { Page, Locator } from '@playwright/test';

/**
 * E2E测试辅助类
 */
export class E2ETestHelpers {
  /**
   * 等待API响应
   * @param page 页面对象
   * @param urlPattern URL模式（支持通配符）
   * @param timeout 超时时间（毫秒）
   * @param failOnTimeout 超时时是否抛出错误
   * @returns API响应数据
   */
  static async waitForAPIResponse(
    page: Page,
    urlPattern: string,
    timeout: number = 30000,
    failOnTimeout: boolean = true
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (failOnTimeout) {
          reject(new Error(`等待API响应超时: ${urlPattern}`));
        } else {
          resolve(undefined);
        }
      }, timeout);

      page.on('response', async response => {
        const url = response.url();
        const pattern = new RegExp(
          urlPattern.replace(/\*/g, '.*').replace(/\?/g, '.?')
        );

        if (pattern.test(url)) {
          clearTimeout(timeoutId);
          try {
            const contentType = response.headers()['content-type'];
            let data: unknown;

            if (contentType && contentType.includes('application/json')) {
              data = await response.json();
            } else {
              data = await response.text();
            }

            resolve(data);
          } catch {
            resolve(undefined);
          }
        }
      });
    });
  }

  /**
   * 等待元素可见
   * @param page 页面对象
   * @param selector CSS选择器
   * @param timeout 超时时间（毫秒）
   * @returns 元素定位器
   */
  static async waitForElementVisible(
    page: Page,
    selector: string,
    timeout: number = 10000
  ): Promise<Locator> {
    const locator = page.locator(selector);
    await locator.waitFor({
      state: 'visible',
      timeout,
    });
    return locator;
  }

  /**
   * 安全地点击元素（滚动+等待+点击）
   * @param page 页面对象
   * @param selector CSS选择器
   * @param timeout 超时时间（毫秒）
   */
  static async safeClick(
    page: Page,
    selector: string,
    timeout: number = 10000
  ): Promise<void> {
    const locator = page.locator(selector);

    // 等待元素可见
    await locator.waitFor({
      state: 'visible',
      timeout,
    });

    // 滚动到元素
    await locator.scrollIntoViewIfNeeded();

    // 确保元素可点击
    await locator.waitFor({
      state: 'attached',
    });

    // 点击元素
    await locator.click({
      timeout: Math.min(timeout, 5000),
    });
  }

  /**
   * 重试操作
   * @param operation 要执行的操作
   * @param maxRetries 最大重试次数
   * @param delay 重试延迟（毫秒）
   * @param shouldRetry 判断是否需要重试的函数
   * @returns 操作结果
   */
  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    shouldRetry?: (error: unknown) => boolean
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // 检查是否应该重试
        if (shouldRetry && !shouldRetry(error)) {
          throw error;
        }

        // 如果不是最后一次尝试，则延迟后重试
        if (attempt < maxRetries) {
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 等待页面加载完成
   * @param page 页面对象
   * @param timeout 超时时间（毫秒）
   */
  static async waitForPageLoad(
    page: Page,
    timeout: number = 30000
  ): Promise<void> {
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout }),
      page.waitForLoadState('domcontentloaded', { timeout }),
    ]);
  }

  /**
   * 安全地输入文本
   * @param page 页面对象
   * @param selector CSS选择器
   * @param text 要输入的文本
   * @param timeout 超时时间（毫秒）
   */
  static async typeTextSafely(
    page: Page,
    selector: string,
    text: string,
    timeout: number = 10000
  ): Promise<void> {
    const locator = page.locator(selector);

    // 等待元素可见
    await locator.waitFor({
      state: 'visible',
      timeout,
    });

    // 清空现有值
    await locator.clear();

    // 输入文本
    await locator.fill(text);
  }

  /**
   * 等待元素出现
   * @param page 页面对象
   * @param selector CSS选择器
   * @param timeout 超时时间（毫秒）
   * @returns 元素定位器
   */
  static async waitForElement(
    page: Page,
    selector: string,
    timeout: number = 10000
  ): Promise<Locator> {
    const locator = page.locator(selector);
    await locator.waitFor({
      state: 'attached',
      timeout,
    });
    return locator;
  }

  /**
   * 等待元素消失
   * @param page 页面对象
   * @param selector CSS选择器
   * @param timeout 超时时间（毫秒）
   */
  static async waitForElementToDisappear(
    page: Page,
    selector: string,
    timeout: number = 10000
  ): Promise<void> {
    const locator = page.locator(selector);
    await locator.waitFor({
      state: 'hidden',
      timeout,
    });
  }

  /**
   * 检查元素是否存在
   * @param page 页面对象
   * @param selector CSS选择器
   * @returns 元素是否存在
   */
  static async elementExists(page: Page, selector: string): Promise<boolean> {
    const locator = page.locator(selector);
    const count = await locator.count();
    return count > 0;
  }

  /**
   * 检查元素是否可见
   * @param page 页面对象
   * @param selector CSS选择器
   * @returns 元素是否可见
   */
  static async elementIsVisible(
    page: Page,
    selector: string
  ): Promise<boolean> {
    const locator = page.locator(selector);
    try {
      return await locator.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * 获取元素文本
   * @param page 页面对象
   * @param selector CSS选择器
   * @returns 元素文本内容
   */
  static async getElementText(page: Page, selector: string): Promise<string> {
    const locator = page.locator(selector);
    const text = await locator.textContent();
    return text || '';
  }

  /**
   * 等待指定时间
   * @param ms 等待时间（毫秒）
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 安全地导航到URL
   * @param page 页面对象
   * @param url 目标URL
   * @param timeout 超时时间（毫秒）
   */
  static async safeNavigate(
    page: Page,
    url: string,
    timeout: number = 30000
  ): Promise<void> {
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout }),
      page.goto(url),
    ]);
  }

  /**
   * 等待并点击多个元素中的一个
   * @param page 页面对象
   * @param selectors CSS选择器数组
   * @param timeout 超时时间（毫秒）
   * @returns 点击的元素选择器
   */
  static async waitForAndClickAny(
    page: Page,
    selectors: string[],
    timeout: number = 10000
  ): Promise<string> {
    const startTime = Date.now();
    const interval = 100;

    while (Date.now() - startTime < timeout) {
      for (const selector of selectors) {
        if (await this.elementIsVisible(page, selector)) {
          await this.safeClick(page, selector, timeout);
          return selector;
        }
      }
      await this.sleep(interval);
    }

    throw new Error(
      `在${timeout}ms内没有找到可点击的元素: ${selectors.join(', ')}`
    );
  }

  /**
   * 滚动到页面底部
   * @param page 页面对象
   */
  static async scrollToBottom(page: Page): Promise<void> {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
  }

  /**
   * 滚动到页面顶部
   * @param page 页面对象
   */
  static async scrollToTop(page: Page): Promise<void> {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
  }

  /**
   * 检查元素是否包含指定文本
   * @param page 页面对象
   * @param selector CSS选择器
   * @param text 要查找的文本
   * @returns 是否包含文本
   */
  static async elementContainsText(
    page: Page,
    selector: string,
    text: string
  ): Promise<boolean> {
    const elementText = await this.getElementText(page, selector);
    return elementText.includes(text);
  }
}
