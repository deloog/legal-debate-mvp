// Re-export all test utilities
export * from './setup';
export * from './render';
export * from './factories';
export * from './database';

// Common test utilities
export const waitFor = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

export const createMockResponse = <T>(data: T) =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as Response;

export const createMockErrorResponse = (status: number, message: string) =>
  ({
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: message }),
    text: async () => JSON.stringify({ error: message }),
  }) as Response;

// Test helpers for async operations
export const flushPromises = () =>
  new Promise(resolve => setImmediate(resolve));

// Mock localStorage
export const createMockLocalStorage = () => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
};

// Mock session storage
export const createMockSessionStorage = () => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
};
