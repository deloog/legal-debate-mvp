/**
 * Jest类型声明文件
 * 为测试文件提供必要的类型扩展
 */

import '@testing-library/jest-dom';
import { testingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// 扩展Jest类型以支持自定义匹配器
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
