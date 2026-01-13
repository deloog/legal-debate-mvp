/// <reference types="@testing-library/jest-dom" />

/**
 * 全局Jest类型声明
 * 修复toBeInTheDocument等自定义匹配器的类型问题
 */

declare global {
  namespace jest {
    interface Matchers<R = void> {
      toBeInTheDocument(): R;
      toHaveTextContent(content: string | RegExp): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toHaveClass(...classNames: string[]): R;
      toHaveAttribute(attr: string, value?: string): R;
      toContainElement(element: HTMLElement | null): R;
      toHaveStyle(style: Record<string, unknown>): R;
      toBeChecked(): R;
      toBeEmpty(): R;
      toBeEnabled(): R;
      toBeEmptyDOMElement(): R;
      toContainHTML(html: string): R;
      toHaveFocus(): R;
      toHaveFormValue(values: Record<string, unknown>): R;
      toHaveProperty(path: string | string[], value?: unknown): R;
    }
  }
}

export {};
