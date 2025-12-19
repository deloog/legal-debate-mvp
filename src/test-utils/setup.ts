import '@testing-library/jest-dom';
import React, { ReactElement } from 'react';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock Next.js dynamic import
jest.mock('next/dynamic', () => () => {
  return function DynamicComponent(
    props: Record<string, unknown>
  ): ReactElement {
    return React.createElement('div', {
      'data-testid': 'dynamic-component',
      ...props,
    });
  };
});

// Suppress console warnings in tests
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('act() is deprecated')
    ) {
      return;
    }
    originalWarn(...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});

// Global test cleanup
afterEach(() => {
  jest.clearAllMocks();
});
