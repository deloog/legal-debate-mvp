/** @type {import("jest").Config} */
module.exports = {
  displayName: 'integration',
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  maxWorkers: 1,
  maxConcurrency: 1,
  testTimeout: 60000, // 集成测试需要更长的超时时间

  // 只匹配集成测试文件
  testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.ts'],

  // 不忽略集成测试目录
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/src/__tests__/e2e/',
    '<rootDir>/src/__tests__/bad-cases/',
    '<rootDir>/src/__tests__/accuracy/',
  ],

  setupFiles: ['<rootDir>/jest.polyfill.js'],
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/lib/debate/stream/(.*)$': '<rootDir>/src/lib/debate/stream/$1',
  },

  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.next/'],

  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
          },
          strict: false,
          noImplicitAny: false,
          skipLibCheck: true,
        },
        diagnostics: {
          warnOnly: true,
        },
      },
    ],
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'd.ts'],
  transformIgnorePatterns: ['node_modules/(?!(uuid|@prisma|@swc/core)/)'],

  coverageDirectory: 'coverage-integration',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'src/lib/agent/**/*.ts',
    'src/lib/ai/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.{test,spec}.{ts,tsx}',
    '!src/**/__tests__/**',
  ],
};
