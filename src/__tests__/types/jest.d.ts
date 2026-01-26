/**
 * 测试类型声明文件
 * 扩展 Jest 类型以支持 @testing-library/jest-dom 匹配器
 */

import '@testing-library/jest-dom';

// 确保 jest-dom 类型被正确扩展
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
