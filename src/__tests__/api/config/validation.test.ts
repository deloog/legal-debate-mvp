/**
 * validation 模块单元测试
 */

import { ConfigValidator } from '../../../config/validation';
import type { AppConfig } from '../../../types/config';
import { Environment, LogLevel } from '../../../types/config';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  const getValidConfig = (): Partial<AppConfig> => ({
    database: {
      url: 'postgresql://user:pass@localhost:5432/db',
      poolMin: 10,
      poolMax: 50,
      idleTimeout: 30000,
      connectTimeout: 10000,
    },
    auth: {
      jwtSecret: 'a'.repeat(32),
      jwtExpiresIn: '7d',
      bcryptSaltRounds: 12,
    },
    membership: {
      prices: { free: 0, basic: 9900, professional: 29900, enterprise: 99900 },
      discounts: { quarterly: 1.0, yearly: 0.83 },
      orderExpireHours: 2,
      retryPaymentCount: 3,
    },
    nextjs: {
      authUrl: 'https://example.com',
      secret: 'secret',
      apiUrl: 'https://api.example.com',
      appUrl: 'https://app.example.com',
      appName: 'Test App',
      appDescription: 'Test Description',
    },
    payment: {
      wechat: {
        appId: '',
        mchId: '',
        apiKey: '',
        apiV3Key: '',
        serialNo: '',
        certPath: '',
        notifyUrl: '',
        sandbox: false,
      },
      alipay: {
        appId: '',
        privateKey: '',
        publicKey: '',
        notifyUrl: '',
        sandbox: false,
      },
      timeout: 7200000,
      retryCount: 3,
      successCallbackAttempts: 5,
    },
    environment: Environment.PRODUCTION,
    redis: {
      url: 'redis://localhost:6379',
      maxRetries: 3,
      connectTimeout: 10000,
      idleTimeout: 30000,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      persistenceMode: 'off',
      aofFsyncEverySec: 1,
    },
    cache: {
      defaultTTL: 3600,
      sessionTTL: 1800,
      configTTL: 86400,
      keyPrefix: 'test:',
      maxSize: 1000,
      updateAgeOnGet: false,
    },
    ai: {
      useRealAI: false,
      zhipu: {
        apiKey: '',
        baseUrl: '',
        model: 'test',
        maxTokens: 1000000,
        rateLimit: 100,
      },
      deepseek: {
        apiKey: '',
        baseUrl: '',
        model: 'test',
        maxTokens: 1000000,
        rateLimit: 100,
      },
      openai: {
        apiKey: '',
        baseUrl: '',
        model: 'test',
        maxTokens: 1000000,
        rateLimit: 100,
      },
      anthropic: {
        apiKey: '',
        baseUrl: '',
        model: 'test',
        maxTokens: 1000000,
        rateLimit: 100,
      },
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
    },
    lawstar: {
      regulation: {
        baseUrl: '',
        appId: '',
        appSecret: '',
        rateLimit: 1000,
      },
      vector: {
        baseUrl: '',
        appId: '',
        appSecret: '',
        rateLimit: 1000,
      },
    },
    security: {
      cors: {
        allowedOrigins: ['https://example.com'],
        allowedMethods: ['GET', 'POST'],
        allowedHeaders: ['Authorization'],
        credentials: true,
        maxAge: 86400,
      },
      rateLimit: {
        windowMs: 60000,
        maxRequests: 100,
        skipSuccessfulRequests: false,
      },
      headers: {
        contentSecurityPolicy: '',
        hstsMaxAge: 31536000,
        xFrameOptions: 'DENY',
        xContentTypeOptions: 'nosniff',
      },
    },
    log: {
      level: LogLevel.ERROR,
      fileMaxSize: '20m',
      fileMaxFiles: '14d',
      datePattern: 'YYYY-MM-DD',
      format: 'json',
      path: './logs',
    },
    monitoring: {
      prometheus: {
        enabled: false,
        port: 9090,
        metricsPath: '/metrics',
      },
      grafana: {
        adminPassword: '',
        adminUser: 'admin',
        url: '',
      },
      alertmanager: {
        enabled: false,
        url: '',
      },
      email: {
        enabled: false,
        to: '',
        from: '',
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPassword: '',
      },
    },
    performance: {
      api: {
        timeout: 30000,
        maxConcurrentRequests: 100,
      },
      database: {
        queryTimeout: 30000,
        maxExecutionTime: 5000,
      },
    },
    backup: {
      enabled: false,
      schedule: '0 2 * * *',
      retentionDays: 30,
      path: './backups',
    },
    socialLogin: undefined,
    storage: {
      type: 'local',
      uploadPath: './uploads',
      maxSize: 10485760,
      allowedTypes: ['image/jpeg'],
      oss: undefined,
    },
    smtp: {
      enabled: false,
      host: '',
      port: 587,
      secure: false,
      user: '',
      password: '',
      from: '',
      replyTo: '',
    },
    misc: {
      version: '1.0.0',
      environment: Environment.PRODUCTION,
      maintenanceMode: false,
      maintenanceMessage: '',
      timezone: 'Asia/Shanghai',
    },
  });

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('validate', () => {
    it('should pass with valid config', () => {
      const config = getValidConfig();
      const result = validator.validate(config as AppConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with empty database URL', () => {
      const config = getValidConfig();
      if (config.database) {
        config.database.url = '';
      }
      const result = validator.validate(config as AppConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should add warning for max pool size over 100', () => {
      const config = getValidConfig();
      if (config.database) {
        config.database.poolMax = 150;
      }
      const result = validator.validate(config as AppConfig);
      expect(result.warnings.length).toBeGreaterThan(0);
      const poolSizeWarning = result.warnings.find(
        w => w.field === 'database.poolMax'
      );
      expect(poolSizeWarning).toBeDefined();
    });

    it('should fail with short JWT secret', () => {
      const config = getValidConfig();
      if (config.auth) {
        config.auth.jwtSecret = 'short';
      }
      const result = validator.validate(config as AppConfig);
      expect(result.isValid).toBe(false);
      const jwtError = result.errors.find(e => e.field === 'auth.jwtSecret');
      expect(jwtError).toBeDefined();
    });
  });

  describe('getSummary', () => {
    it('should return success message when validation passes', () => {
      const config = getValidConfig();
      const result = validator.validate(config as AppConfig);
      const summary = validator.getSummary(result);
      expect(summary).toContain('✅ 配置验证通过');
    });

    it('should return error message when validation fails', () => {
      const config = getValidConfig();
      if (config.database) {
        config.database.url = '';
      }
      const result = validator.validate(config as AppConfig);
      const summary = validator.getSummary(result);
      expect(summary).toContain('❌ 配置验证失败');
    });

    it('should include errors in summary', () => {
      const config = getValidConfig();
      if (config.database) {
        config.database.url = '';
      }
      const result = validator.validate(config as AppConfig);
      const summary = validator.getSummary(result);
      expect(summary).toContain('错误');
    });

    it('should include warnings in summary when present', () => {
      const config = getValidConfig();
      if (config.database) {
        config.database.poolMax = 150;
      }
      const result = validator.validate(config as AppConfig);
      const summary = validator.getSummary(result);
      expect(summary).toContain('警告');
    });
  });
});
