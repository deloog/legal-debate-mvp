/** @type {import("jest").Config} **/
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/src/__tests__/api/setup.js'],
  setupFilesAfterEnv: ['whatwg-fetch', '<rootDir>/src/test-utils/setup.ts'],
  testMatch: ['<rootDir>/src/__tests__/api/**/*.{test,spec}.{ts,tsx}'],
  // 启用API测试覆盖率收集
  collectCoverage: true,

  // 定义要收集覆盖率的API文件范围
  collectCoverageFrom: [
    // 核心API库文件
    'src/app/api/lib/**/*.{ts,tsx}',
    // API端点文件
    'src/app/api/v1/**/*.{ts,tsx}',
    // 根API文件
    'src/app/api/health/**/*.{ts,tsx}',
    'src/app/api/version/**/*.{ts,tsx}',
    // 排除类型定义文件
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],

  // 指定覆盖率报告目录（与主配置分开）
  coverageDirectory: 'coverage/api',

  // 覆盖率报告格式
  coverageReporters: ['text', 'lcov', 'html'],

  // 设置合理的API覆盖率阈值（初始目标）
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    'src/app/api/lib/': {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // 对于API测试，我们可以使用并行
  maxWorkers: 4,
  maxConcurrency: 4,
};
