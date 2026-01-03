/** @type {import("jest").Config} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/jest.polyfill.js"],
  setupFilesAfterEnv: ["<rootDir>/src/test-utils/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/lib/debate/stream/(.*)$": "<rootDir>/src/lib/debate/stream/$1",
  },
  // 添加模块路径忽略模式，避免模块解析冲突
  modulePathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/.next/"],
  testMatch: [
    "<rootDir>/src/__tests__/**/*.{test,spec}.{ts,tsx}",
    "<rootDir>/src/**/*.{test,spec}.{ts,tsx}",
    "!<rootDir>/src/__tests__/index.{ts,tsx}",
  ],
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/coverage/",
    "<rootDir>/src/__tests__/e2e/",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/test-utils/**",
    "!src/**/*.stories.{ts,tsx}",
    "!src/**/__tests__/**",
    "!src/**/*.{test,spec}.{ts,tsx}",
    "!src/**/index.{ts,tsx}",
    "src/lib/debate/**/*.{ts,tsx}",
    "!src/lib/debate/**/__tests__/**",
  ],
  // 新增：覆盖率路径忽略模式
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "/coverage/",
    "/dist/",
    "\\.test\\.(ts|tsx)$",
    "\\.spec\\.(ts|tsx)$",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json"],
  coverageThreshold: {
    // 全局最低要求
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    // API层 - 关键业务逻辑，要求较高
    "./src/app/api/": {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    // 缓存层 - 基础设施，要求中等
    "./src/lib/cache/": {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
    // 数据库层 - 基础设施，要求中等
    "./src/lib/db/": {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
    // AI服务层 - 外部依赖，允许较低
    "./src/lib/ai/": {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
    // 辩论功能层 - 核心业务，要求较高
    "./src/lib/debate/": {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
    // 法条检索层 - 核心业务，要求较高
    "./src/lib/law-article/": {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    // 监控层 - 基础设施，要求中等
    "./src/lib/monitoring/": {
      statements: 75,
      branches: 70,
      functions: 75,
      lines: 75,
    },
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          baseUrl: ".",
          paths: {
            "@/*": ["./src/*"],
          },
        },
        diagnostics: {
          warnOnly: true,
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "d.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(uuid)/)",
  ],
  // 禁用并行测试以避免数据竞争
  maxWorkers: 1,
  maxConcurrency: 1,
  testTimeout: 30000,
  verbose: true,
};
