/**
 * Jest类型声明文件
 * 为测试文件提供必要的类型扩展
 */

import '@testing-library/jest-dom';

// 扩展Jest类型以支持自定义匹配器
declare namespace jest {
  interface Matchers<R, T = any> {
    toBeInTheDocument(): R;
    toHaveValue(value: unknown): R;
    toBeDisabled(): R;
    toHaveTextContent(text: string | RegExp): R;
  }
}

// 扩展Window类型
declare global {
  namespace NodeJS {
    interface Global {
      fetch: jest.Mock;
      confirm: jest.Mock;
    }
  }
}

export {};
