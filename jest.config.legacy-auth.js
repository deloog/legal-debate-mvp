/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  verbose: true,
  maxWorkers: 1,
  maxConcurrency: 1,
  testTimeout: 30000,
  testEnvironment: 'node',
  globalSetup: '<rootDir>/jest.global-setup.js',
  globalTeardown: '<rootDir>/jest.global-teardown.js',
  setupFiles: [
    '<rootDir>/src/__tests__/api/setup.js',
    '<rootDir>/jest.polyfill.js',
  ],
  setupFilesAfterEnv: ['whatwg-fetch', '<rootDir>/src/test-utils/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/lib/debate/stream/(.*)$': '<rootDir>/src/lib/debate/stream/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.next/'],
  testMatch: [
    '<rootDir>/src/__tests__/api/debates-list-auth-smoke.test.ts',
    '<rootDir>/src/__tests__/api/debates-id-auth-permission-smoke.test.ts',
    '<rootDir>/src/__tests__/api/admin/export/cases.test.ts',
    '<rootDir>/src/__tests__/api/document-templates.api.test.ts',
    '<rootDir>/src/__tests__/payment/payment-api.test.ts',
  ],
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
};
