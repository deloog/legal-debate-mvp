/**
 * Jest DOM 类型扩展
 * 为 @testing-library/jest-dom 提供类型支持
 */

import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R, T = any> {
      toBeInTheDocument(): R;
      toHaveValue(value: unknown): R;
      toBeDisabled(): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveAttribute(attr: string, value?: unknown): R;
      toHaveClass(...classNames: string[]): R;
      toBeVisible(): R;
      toBeEmpty(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(html: string): R;
      toBeInTheDocument(): R;
    }
  }

  namespace NodeJS {
    interface Global {
      fetch: jest.Mock<Promise<Response>>;
      confirm: jest.Mock;
    }
  }
}

export {};
