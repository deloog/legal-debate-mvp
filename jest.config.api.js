/** @type {import("jest").Config} **/
import baseConfig from './jest.config.js';

// 创建一个新的配置对象，不直接展开 baseConfig
const config = {
  // 继承基础配置的大部分设置
  preset: baseConfig.preset,
  setupFiles: ['<rootDir>/src/__tests__/api/setup.js'],
  setupFilesAfterEnv: ['whatwg-fetch', '<rootDir>/src/test-utils/setup.ts'],
  moduleNameMapper: baseConfig.moduleNameMapper,
  modulePathIgnorePatterns: baseConfig.modulePathIgnorePatterns,
  transform: baseConfig.transform,
  transformIgnorePatterns: baseConfig.transformIgnorePatterns,
  moduleFileExtensions: baseConfig.moduleFileExtensions,
  verbose: baseConfig.verbose,

  // 测试环境：使用 jsdom 支持 React 组件测试
  testEnvironment: 'jest-environment-jsdom',

  // 测试匹配模式
  testMatch: [
    '<rootDir>/src/__tests__/api/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/src/__tests__/components/**/*.{test,spec}.{ts,tsx}',
  ],

  // 忽略的测试路径
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
  ],

  // 启用测试覆盖率收集
  collectCoverage: true,

  // 定义要收集覆盖率的文件范围
  collectCoverageFrom: [
    'src/app/api/**/*.{ts,tsx}',
    'src/components/membership/**/*.{ts,tsx}',
    'src/components/payment/**/*.{ts,tsx}',
    'src/components/ui/**/*.{ts,tsx}',
    'src/app/membership/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
  ],

  // 覆盖率路径忽略模式
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/coverage/',
    '/dist/',
  ],

  // 覆盖率报告目录
  coverageDirectory: 'coverage/web',

  // 覆盖率报告格式
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // 并行配置
  maxWorkers: 4,
  maxConcurrency: 4,

  // 超时时间
  testTimeout: 30000,
};

export default config;
