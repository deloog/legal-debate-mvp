/** @type {import("jest").Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom', // React页面测试需要jsdom环境
  setupFiles: ['<rootDir>/jest.polyfill.js'],
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/lib/debate/stream/(.*)$': '<rootDir>/src/lib/debate/stream/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.next/'],
  testMatch: [
    '<rootDir>/src/__tests__/app/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/src/__tests__/components/payment/**/*.{test,spec}.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/src/__tests__/e2e/',
  ],
  collectCoverageFrom: [
    'src/app/**/*.{ts,tsx}',
    'src/components/payment/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.{test,spec}.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/index.{ts,tsx}',
  ],
  coverageDirectory: 'coverage-app',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],
  coverageProvider: 'v8',
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
    '^.+\\.(js|jsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowJs: true,
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
          },
        },
        diagnostics: {
          warnOnly: true,
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'd.ts'],
  transformIgnorePatterns: ['node_modules/(?!(uuid|@prisma|@swc/core)/)'],
  maxWorkers: 1,
  maxConcurrency: 1,
  testTimeout: 30000,
  verbose: true,
};
