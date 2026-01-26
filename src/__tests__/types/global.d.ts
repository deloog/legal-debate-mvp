/**
 * 全局类型声明文件
 * 确保 @testing-library/jest-dom 的类型被正确加载
 */

import '@testing-library/jest-dom';

// 扩展全局 Jest 匹配器类型
declare global {
  namespace jest {
    interface Matchers<R = void, T = any> {
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toHaveClass(...classNames: string[]): R;
      toHaveStyle(style: Partial<CSSStyleDeclaration>): R;
      toHaveAttribute(attr: string, value?: unknown): R;
      toHaveTextContent(
        content: string | RegExp,
        options?: { normalizeWhitespace: boolean }
      ): R;
      toHaveFocus(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeEmpty(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(html: string | RegExp): R;
      toHaveValue(value?: string | string[] | number | null): R;
      toDisplayValue(value: unknown): R;
      toBeRequired(): R;
      toBeInvalid(): R;
      toBeValid(): R;
      toBeChecked(): R;
    }
  }
}

export {};
