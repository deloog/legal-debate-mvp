/** @type {import("jest").Config} */
module.exports = {
  // 全局配置
  preset: 'ts-jest',
  verbose: true,
  maxWorkers: 1,
  maxConcurrency: 1,
  testTimeout: 30000,

  // 使用projects配置分离不同环境的测试
  projects: [
    // Project 1: 组件测试（jsdom环境）
    {
      displayName: 'components',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/__tests__/components/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/ui/**/*.{test,spec}.{ts,tsx}',
      ],
      testPathIgnorePatterns: [
        '<rootDir>/.next/',
        '<rootDir>/node_modules/',
        '<rootDir>/coverage/',
        '<rootDir>/src/__tests__/e2e/',
        '<rootDir>/src/__tests__/bad-cases/',
        '<rootDir>/src/__tests__/accuracy/',
        '<rootDir>/src/__tests__/integration/',
      ],
      setupFiles: ['<rootDir>/jest.polyfill.js'],
      setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/lib/debate/stream/(.*)$': '<rootDir>/src/lib/debate/stream/$1',
      },
      modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.next/'],
      collectCoverageFrom: [
        'src/components/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.{test,spec}.{ts,tsx}',
        '!src/**/__tests__/**',
        '!src/**/*.stories.{ts,tsx}',
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
    },

    // Project 2: App页面测试（jsdom环境）
    {
      displayName: 'app',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/__tests__/app/**/*.{test,spec}.{ts,tsx}',
      ],
      testPathIgnorePatterns: [
        '<rootDir>/.next/',
        '<rootDir>/node_modules/',
        '<rootDir>/coverage/',
        '<rootDir>/src/__tests__/e2e/',
        '<rootDir>/src/__tests__/bad-cases/',
        '<rootDir>/src/__tests__/accuracy/',
        '<rootDir>/src/__tests__/integration/',
      ],
      setupFiles: ['<rootDir>/jest.polyfill.js'],
      setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/lib/debate/stream/(.*)$': '<rootDir>/src/lib/debate/stream/$1',
      },
      modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.next/'],
      collectCoverageFrom: [
        'src/app/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.{test,spec}.{ts,tsx}',
        '!src/**/__tests__/**',
        '!src/**/index.{ts,tsx}',
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
    },

    // Project 3: API测试（node环境）
    {
      displayName: 'api',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/__tests__/api/**/*.{test,spec}.{ts,tsx}',
      ],
      testPathIgnorePatterns: [
        '<rootDir>/.next/',
        '<rootDir>/node_modules/',
        '<rootDir>/coverage/',
        '<rootDir>/src/__tests__/e2e/',
        '<rootDir>/src/__tests__/bad-cases/',
        '<rootDir>/src/__tests__/accuracy/',
        '<rootDir>/src/__tests__/integration/',
      ],
      setupFiles: ['<rootDir>/src/__tests__/api/setup.js', '<rootDir>/jest.polyfill.js'],
      setupFilesAfterEnv: ['whatwg-fetch', '<rootDir>/src/test-utils/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/lib/debate/stream/(.*)$': '<rootDir>/src/lib/debate/stream/$1',
      },
      modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.next/'],
      collectCoverageFrom: [
        'src/app/api/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.{test,spec}.{ts,tsx}',
        '!src/**/__tests__/**',
        '!src/**/index.{ts,tsx}',
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
      coverageDirectory: 'coverage-api',
      coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],
    },

    // Project 4: 其他单元测试（node环境）
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/__tests__/debate/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/lib/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/middleware/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/prisma/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/unit/**/*.{test,spec}.{ts,tsx}',
      ],
      testPathIgnorePatterns: [
        '<rootDir>/.next/',
        '<rootDir>/node_modules/',
        '<rootDir>/coverage/',
        '<rootDir>/src/__tests__/e2e/',
        '<rootDir>/src/__tests__/bad-cases/',
        '<rootDir>/src/__tests__/accuracy/',
        '<rootDir>/src/__tests__/integration/',
      ],
      setupFiles: ['<rootDir>/jest.polyfill.js'],
      setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/lib/debate/stream/(.*)$': '<rootDir>/src/lib/debate/stream/$1',
      },
      modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.next/'],
      collectCoverageFrom: [
        'src/lib/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.{test,spec}.{ts,tsx}',
        '!src/**/__tests__/**',
        '!src/**/index.{ts,tsx}',
        '!src/test-utils/**',
        '!src/**/*.stories.{ts,tsx}',
        'src/lib/agent/**/*.{ts,tsx}',
        '!src/lib/agent/**/__tests__/**',
        'src/lib/debate/**/*.{ts,tsx}',
        '!src/lib/debate/**/__tests__/**',
        'scripts/**/*.{ts,js}',
        '!scripts/**/*.d.ts',
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
      coverageDirectory: 'coverage',
      coverageReporters: [
        'text',
        'text-summary',
        'lcov',
        'html',
        'json',
        'json-summary',
      ],
      coverageProvider: 'v8',
    },
  ],

  // 覆盖率配置
  coverageThreshold: {
    // 全局最低要求
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    // API层 - 关键业务逻辑，要求较高
    './src/app/api/': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    // 缓存层 - 基础设施，要求中等
    './src/lib/cache/': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
    // 数据库层 - 基础设施，要求中等
    './src/lib/db/': {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
    // AI服务层 - 外部依赖，允许较低
    './src/lib/ai/': {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
    // 辩论功能层 - 核心业务，要求较高
    './src/lib/debate/': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
    // Planning Agent - 核心业务，要求较高
    './src/lib/agent/planning-agent/': {
      statements: 85,
      branches: 75,
      functions: 85,
      lines: 85,
    },
    // 法条检索层 - 核心业务，要求较高
    './src/lib/law-article/': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    // 监控层 - 基础设施，要求中等
    './src/lib/monitoring/': {
      statements: 75,
      branches: 70,
      functions: 75,
      lines: 75,
    },
    // 脚本文件 - 实用工具，要求高
    './scripts/': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
  },

  // 覆盖率路径忽略模式
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/coverage/',
    '/dist/',
    '\\.test\\.(ts|tsx)$',
    '\\.spec\\.(ts|tsx)$',
  ],
};
