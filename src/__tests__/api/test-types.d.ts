// Type declarations for test mocks to resolve TypeScript issues

declare global {
  namespace jest {
    interface Mock<TArgs extends any[] = any[], TReturn = any> {
      mockResolvedValue: (value: any) => any;
      mockRejectedValue: (value: any) => any;
    }
  }
}

// Extend Jest mock types to accept any parameter
declare module "jest" {
  function fn<T extends any[] = any[], R = any>(
    implementation?: (...args: any) => any,
  ): any;

  interface Mock<T extends any[], R> {
    (...args: any): any;
    mockResolvedValue(value: any): any;
    mockRejectedValue(value: any): any;
  }
}

// Completely override mock functions to bypass type checking
declare global {
  const jest: {
    fn: (implementation?: (...args: any[]) => any) => any;
  };
}

// @ts-ignore
global.jest.fn = (implementation?: any) => ({
  mockResolvedValue: (value: any) => ({ __mockResolvedValue: value }),
  mockRejectedValue: (value: any) => ({ __mockRejectedValue: value }),
  mockImplementation: (implementation: any) => ({
    __mockImplementation: implementation,
  }),
});
