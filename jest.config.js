/** @type {import("jest").Config} */
module.exports = {
  // 全局配置
  preset: 'ts-jest',
  verbose: true,
  // 使用50% CPU核心，避免连接池耗尽
  maxWorkers: '50%',
  // 限制并发测试数
  maxConcurrency: 2,
  // 默认超时时间
  testTimeout: 30000,
  // 资源限制
  testEnvironmentOptions: {
    // 限制V8堆内存
    customExportConditions: ['node'],
  },
  // 全局设置文件
  globalSetup: '<rootDir>/jest.global-setup.js',
  // 全局清理文件
  globalTeardown: '<rootDir>/jest.global-teardown.js',

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
      setupFiles: ['<rootDir>/jest.polyfill.js', '<rootDir>/jest-setup.d.ts'],
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
              types: ['jest', '@testing-library/jest-dom'],
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
      testMatch: ['<rootDir>/src/__tests__/app/**/*.{test,spec}.{ts,tsx}'],
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
      testMatch: ['<rootDir>/src/__tests__/api/**/*.{test,spec}.{ts,tsx}'],
      testPathIgnorePatterns: [
        '<rootDir>/.next/',
        '<rootDir>/node_modules/',
        '<rootDir>/coverage/',
        '<rootDir>/src/__tests__/e2e/',
        '<rootDir>/src/__tests__/bad-cases/',
        '<rootDir>/src/__tests__/accuracy/',
        '<rootDir>/src/__tests__/integration/',
      ],
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

    // Project 4: 部署脚本测试（node环境）
    {
      displayName: 'deploy',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/scripts/deploy/__tests__/**/*.{test,spec}.{ts,tsx}',
      ],
      testPathIgnorePatterns: [
        '<rootDir>/.next/',
        '<rootDir>/node_modules/',
        '<rootDir>/coverage/',
      ],
      setupFiles: ['<rootDir>/jest.polyfill.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.next/'],
      collectCoverageFrom: [
        'scripts/deploy/**/*.{ts,js}',
        '!scripts/**/*.d.ts',
        '!scripts/**/__tests__/**',
      ],
      transform: {
        '^.+\\.(ts|tsx)$': [
          'ts-jest',
          {
            tsconfig: {
              esModuleInterop: true,
              baseUrl: '.',
              strict: false,
              noImplicitAny: false,
              skipLibCheck: true,
              types: ['jest', '@testing-library/jest-dom'],
            },
            diagnostics: {
              warnOnly: true,
            },
          },
        ],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'd.ts'],
      transformIgnorePatterns: ['node_modules/(?!(uuid|@prisma|@swc/core)/)'],
      coverageDirectory: 'coverage-deploy',
      coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],
    },

    // Project 5: 其他单元测试（node环境）
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/__tests__/debate/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/lib/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/ai/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/middleware/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/prisma/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/types/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/unit/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/memory/**/*.{test,spec}.{ts,tsx}',
        '<rootDir>/src/__tests__/config/**/*.{test,spec}.{ts,tsx}',
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
        // 核心业务逻辑 - 高优先级
        'src/lib/debate/**/*.{ts,tsx}',
        '!src/lib/debate/**/__tests__/**',
        '!src/lib/debate/**/*.test.ts',

        'src/lib/law-article/**/*.{ts,tsx}',
        '!src/lib/law-article/**/__tests__/**',
        '!src/lib/law-article/**/*.test.ts',

        'src/lib/agent/**/*.{ts,tsx}',
        '!src/lib/agent/**/__tests__/**',
        '!src/lib/agent/**/*.test.ts',

        'src/lib/ai/**/*.{ts,tsx}',
        '!src/lib/ai/**/__tests__/**',
        '!src/lib/ai/**/*.test.ts',

        // 基础设施层
        'src/lib/cache/**/*.{ts,tsx}',
        'src/lib/db/**/*.{ts,tsx}',
        'src/lib/error/**/*.{ts,tsx}',

        // 其他业务模块
        'src/lib/**/*.{ts,tsx}',

        // 排除规则
        '!src/**/*.d.ts',
        '!src/**/*.{test,spec}.{ts,tsx}',
        '!src/**/__tests__/**',
        '!src/test-utils/**',
        '!src/**/*.stories.{ts,tsx}',

        // 脚本
        'scripts/**/*.{ts,js}',
        '!scripts/**/*.d.ts',
        '!scripts/**/__tests__/**',
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
    },
  ],

  // 覆盖率配置 - 渐进式目标
  coverageThreshold: {
    // 全局最低要求（基于当前测试覆盖情况）
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
    // 核心业务逻辑 - 较高要求
    './src/lib/debate/': {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
    './src/lib/law-article/': {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
    './src/lib/agent/': {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50,
    },
    // AI服务 - 允许较低（外部依赖）
    './src/lib/ai/': {
      statements: 40,
      branches: 30,
      functions: 40,
      lines: 40,
    },
    // 基础设施层 - 中等要求
    './src/lib/cache/': {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50,
    },
    './src/lib/db/': {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50,
    },
    './src/lib/error/': {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50,
    },
    './src/lib/monitoring/': {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50,
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
