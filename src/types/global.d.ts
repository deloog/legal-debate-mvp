import "@testing-library/jest-dom";

// Extend Jest matchers with @testing-library/jest-dom matchers
declare global {
  namespace jest {
    interface Matchers<R = void> {
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toHaveClass(className: string): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
    }
  }
}

export {};
