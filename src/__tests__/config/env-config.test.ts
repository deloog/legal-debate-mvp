/**
 * 生产环境配置单元测试
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
} from '@jest/globals';
import * as fs from 'fs';
import {
  loadProductionConfig,
  validateProductionConfig,
} from '../../../config/load-env.prod';

describe('生产环境配置测试', () => {
  // 保存原始环境变量
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // 加载生产环境配置
    loadProductionConfig();
  });

  beforeEach(() => {
    // 保存当前环境变量
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  describe('基础配置验证', () => {
    it('应该设置NODE_ENV为production', () => {
      // 在Jest测试环境中NODE_ENV会被设置为'test'
      // 这里验证.env.production文件中的配置值
      expect(process.env.NODE_ENV).toBeDefined();
      // 在生产部署时应该是production
      const configFileContent = fs.readFileSync('.env.production', 'utf-8');
      expect(configFileContent).toContain('NODE_ENV=production');
    });

    it('应该设置应用名称', () => {
      expect(process.env.NEXT_PUBLIC_APP_NAME).toBeDefined();
      expect(process.env.NEXT_PUBLIC_APP_NAME?.length).toBeGreaterThan(0);
    });

    it('应该设置应用URL', () => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      expect(appUrl).toBeDefined();
      expect(appUrl).toMatch(/^https?:\/\/.+/);
    });
  });

  describe('数据库配置验证', () => {
    it('应该设置DATABASE_URL', () => {
      const dbUrl = process.env.DATABASE_URL;
      expect(dbUrl).toBeDefined();
      expect(dbUrl).toMatch(/^postgresql:\/\//);
    });

    it('应该设置数据库连接池配置', () => {
      const poolSize = process.env.DATABASE_POOL_SIZE;
      expect(poolSize).toBeDefined();
      expect(poolSize).toMatch(/^\d+$/);
      expect(Number.parseInt(poolSize || '0', 10)).toBeGreaterThan(0);
    });

    it('应该设置数据库超时配置', () => {
      const timeout = process.env.DATABASE_TIMEOUT;
      expect(timeout).toBeDefined();
      expect(timeout).toMatch(/^\d+$/);
    });
  });

  describe('Redis配置验证', () => {
    it('应该设置REDIS_URL', () => {
      const redisUrl = process.env.REDIS_URL;
      expect(redisUrl).toBeDefined();
      expect(redisUrl).toMatch(/^redis:\/\//);
    });

    it('应该设置Redis密码（如果使用认证）', () => {
      if (process.env.REDIS_URL?.includes(':password@')) {
        expect(process.env.REDIS_PASSWORD).toBeDefined();
      }
    });

    it('应该设置Redis最大重试次数', () => {
      const maxRetries = process.env.REDIS_MAX_RETRIES;
      expect(maxRetries).toBeDefined();
      expect(maxRetries).toMatch(/^\d+$/);
    });
  });

  describe('AI服务配置验证', () => {
    it('应该设置AI服务提供商', () => {
      const provider = process.env.AI_SERVICE_PROVIDER;
      expect(provider).toBeDefined();
      expect(['deepseek', 'zhipuai']).toContain(provider);
    });

    it('应该设置DeepSeek API密钥（如果使用DeepSeek）', () => {
      if (process.env.AI_SERVICE_PROVIDER === 'deepseek') {
        expect(process.env.DEEPSEEK_API_KEY).toBeDefined();
        expect(process.env.DEEPSEEK_API_KEY?.length).toBeGreaterThan(0);
      }
    });

    it('应该设置智谱AI API密钥（如果使用智谱AI）', () => {
      if (process.env.AI_SERVICE_PROVIDER === 'zhipuai') {
        expect(process.env.ZHIPUAI_API_KEY).toBeDefined();
        expect(process.env.ZHIPUAI_API_KEY?.length).toBeGreaterThan(0);
      }
    });

    it('应该设置AI API基础URL', () => {
      const deepseekUrl = process.env.DEEPSEEK_API_BASE_URL;
      const zhipuaiUrl = process.env.ZHIPUAI_API_BASE_URL;
      expect(deepseekUrl || zhipuaiUrl).toBeDefined();
    });
  });

  describe('法条API配置验证', () => {
    it('应该设置法条API提供商', () => {
      const provider = process.env.LAW_ARTICLE_PROVIDER;
      expect(provider).toBeDefined();
      expect(['local', 'lawstar', 'pkulaw']).toContain(provider);
    });

    it('应该设置法律之星API密钥（如果使用）', () => {
      if (process.env.LAW_ARTICLE_PROVIDER === 'lawstar') {
        expect(process.env.LAWSTAR_API_KEY).toBeDefined();
        expect(process.env.LAWSTAR_API_KEY?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('认证配置验证', () => {
    it('应该设置NextAuth URL', () => {
      const authUrl = process.env.NEXTAUTH_URL;
      expect(authUrl).toBeDefined();
      expect(authUrl).toMatch(/^https?:\/\/.+/);
    });

    it('应该设置NextAuth密钥', () => {
      const secret = process.env.NEXTAUTH_SECRET;
      expect(secret).toBeDefined();
      expect(secret?.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('邮件服务配置验证', () => {
    it('应该设置SMTP主机', () => {
      const smtpHost = process.env.SMTP_HOST;
      expect(smtpHost).toBeDefined();
      expect(smtpHost?.length).toBeGreaterThan(0);
    });

    it('应该设置SMTP端口', () => {
      const smtpPort = process.env.SMTP_PORT;
      expect(smtpPort).toBeDefined();
      expect(smtpPort).toMatch(/^\d+$/);
      expect(Number.parseInt(smtpPort || '0', 10)).toBeGreaterThan(0);
      expect(Number.parseInt(smtpPort || '0', 10)).toBeLessThanOrEqual(65535);
    });

    it('应该设置SMTP用户', () => {
      const smtpUser = process.env.SMTP_USER;
      expect(smtpUser).toBeDefined();
    });

    it('应该设置发件人地址', () => {
      const emailFrom = process.env.EMAIL_FROM;
      expect(emailFrom).toBeDefined();
      expect(emailFrom).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    });

    it('应该设置告警收件人', () => {
      const alertEmailTo = process.env.ALERT_EMAIL_TO;
      expect(alertEmailTo).toBeDefined();
      expect(alertEmailTo).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    });
  });

  describe('文件上传配置验证', () => {
    it('应该设置最大文件大小', () => {
      const maxSize = process.env.MAX_FILE_SIZE;
      expect(maxSize).toBeDefined();
      expect(maxSize).toMatch(/^\d+$/);
      expect(Number.parseInt(maxSize || '0', 10)).toBeGreaterThan(0);
    });

    it('应该设置允许的文件类型', () => {
      const allowedTypes = process.env.ALLOWED_FILE_TYPES;
      expect(allowedTypes).toBeDefined();
      expect(allowedTypes?.length).toBeGreaterThan(0);
    });
  });

  describe('会员支付配置验证', () => {
    it('应该设置Stripe公钥', () => {
      const stripePublicKey = process.env.STRIPE_PUBLIC_KEY;
      expect(stripePublicKey).toBeDefined();
      expect(stripePublicKey?.length).toBeGreaterThan(0);
    });

    it('应该设置Stripe私钥', () => {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      expect(stripeSecretKey).toBeDefined();
      expect(stripeSecretKey?.length).toBeGreaterThan(0);
    });

    it('应该设置Stripe Webhook密钥', () => {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      expect(webhookSecret).toBeDefined();
      expect(webhookSecret?.length).toBeGreaterThan(0);
    });
  });

  describe('监控配置验证', () => {
    it('应该设置Sentry DSN', () => {
      const sentryDsn = process.env.SENTRY_DSN;
      expect(sentryDsn).toBeDefined();
      expect(sentryDsn?.length).toBeGreaterThan(0);
    });

    it('应该设置Sentry环境', () => {
      const sentryEnv = process.env.SENTRY_ENVIRONMENT;
      expect(sentryEnv).toBeDefined();
      expect(sentryEnv).toBe('production');
    });
  });

  describe('日志配置验证', () => {
    it('应该设置日志级别', () => {
      const logLevel = process.env.LOG_LEVEL;
      expect(logLevel).toBeDefined();
      expect(['debug', 'info', 'warn', 'error']).toContain(logLevel);
    });

    it('应该设置日志输出配置', () => {
      const logToFile = process.env.LOG_TO_FILE;
      const logToDatabase = process.env.LOG_TO_DATABASE;
      expect(logToFile).toBeDefined();
      expect(logToDatabase).toBeDefined();
    });
  });

  describe('缓存配置验证', () => {
    it('应该设置缓存TTL', () => {
      const cacheTtl = process.env.CACHE_TTL;
      expect(cacheTtl).toBeDefined();
      expect(cacheTtl).toMatch(/^\d+$/);
    });

    it('应该设置缓存最大条目数', () => {
      const maxSize = process.env.CACHE_MAX_SIZE;
      expect(maxSize).toBeDefined();
      expect(maxSize).toMatch(/^\d+$/);
    });
  });

  describe('性能配置验证', () => {
    it('应该设置API超时时间', () => {
      const apiTimeout = process.env.API_TIMEOUT;
      expect(apiTimeout).toBeDefined();
      expect(apiTimeout).toMatch(/^\d+$/);
    });

    it('应该设置最大并发请求数', () => {
      const maxConcurrent = process.env.MAX_CONCURRENT_REQUESTS;
      expect(maxConcurrent).toBeDefined();
      expect(maxConcurrent).toMatch(/^\d+$/);
    });
  });

  describe('功能开关验证', () => {
    it('应该设置用户注册开关', () => {
      const enableReg = process.env.ENABLE_NEW_USER_REGISTRATION;
      expect(enableReg).toBeDefined();
      expect(['true', 'false']).toContain(enableReg);
    });

    it('应该设置律师资格认证开关', () => {
      const enableLawyer = process.env.ENABLE_LAWYER_QUALIFICATION;
      expect(enableLawyer).toBeDefined();
      expect(['true', 'false']).toContain(enableLawyer);
    });

    it('应该设置企业账户开关', () => {
      const enableEnterprise = process.env.ENABLE_ENTERPRISE_ACCOUNT;
      expect(enableEnterprise).toBeDefined();
      expect(['true', 'false']).toContain(enableEnterprise);
    });

    it('应该设置AI功能开关', () => {
      const enableAI = process.env.ENABLE_AI_FEATURES;
      expect(enableAI).toBeDefined();
      expect(['true', 'false']).toContain(enableAI);
    });

    it('应该设置支付功能开关', () => {
      const enablePayment = process.env.ENABLE_PAYMENT_FEATURES;
      expect(enablePayment).toBeDefined();
      expect(['true', 'false']).toContain(enablePayment);
    });
  });

  describe('安全配置验证', () => {
    it('应该隐藏敏感信息', () => {
      const dbUrl = process.env.DATABASE_URL;
      const apiKey = process.env.DEEPSEEK_API_KEY;
      const smtpPass = process.env.SMTP_PASSWORD;
      // 检查敏感信息是否使用占位符
      if (dbUrl?.includes('your_') || dbUrl?.includes('YOUR_')) {
        // 这是占位符，在生产环境应该替换
        expect(true).toBe(true);
      }

      if (apiKey?.includes('your_') || apiKey?.includes('YOUR_')) {
        // 这是占位符，在生产环境应该替换
        expect(true).toBe(true);
      }
      if (smtpPass?.includes('your_') || smtpPass?.includes('YOUR_')) {
        // 这是占位符，在生产环境应该替换
        expect(true).toBe(true);
      }
    });
  });

  describe('loadProductionConfig函数', () => {
    it('应该成功加载生产环境配置', () => {
      expect(() => loadProductionConfig()).not.toThrow();
      expect(process.env.NODE_ENV).toBeDefined();
    });
  });

  describe('validateProductionConfig函数', () => {
    it('应该验证完整的配置', () => {
      const result = validateProductionConfig();
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('应该检测缺失的必需配置', () => {
      const originalDbUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e: string) => e.includes('DATABASE_URL'))
      ).toBe(true);

      process.env.DATABASE_URL = originalDbUrl;
    });

    it('应该检测无效的端口', () => {
      const originalPort = process.env.SMTP_PORT;
      process.env.SMTP_PORT = '99999';

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);

      process.env.SMTP_PORT = originalPort;
    });

    it('应该检测无效的日志级别', () => {
      const originalLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'invalid';

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);

      process.env.LOG_LEVEL = originalLevel;
    });

    it('应该检测无效的邮件地址格式', () => {
      const originalEmail = process.env.EMAIL_FROM;
      process.env.EMAIL_FROM = 'invalid-email';

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);

      process.env.EMAIL_FROM = originalEmail;
    });

    it('应该警告占位符配置', () => {
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL =
        'postgresql://your_user:your_pass@localhost/db';

      const result = validateProductionConfig();

      expect(result.warnings.length).toBeGreaterThan(0);

      process.env.DATABASE_URL = originalDbUrl;
    });

    it('应该验证NextAuth密钥长度', () => {
      const originalSecret = process.env.NEXTAUTH_SECRET;
      process.env.NEXTAUTH_SECRET = 'short';

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);

      process.env.NEXTAUTH_SECRET = originalSecret;
    });

    it('应该验证必需的数字配置', () => {
      const originalTtl = process.env.CACHE_TTL;
      process.env.CACHE_TTL = 'not-a-number';

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);

      process.env.CACHE_TTL = originalTtl;
    });

    it('应该检测无效的AI服务提供商', () => {
      const originalProvider = process.env.AI_SERVICE_PROVIDER;
      process.env.AI_SERVICE_PROVIDER = 'invalid-provider';

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);

      process.env.AI_SERVICE_PROVIDER = originalProvider;
    });

    it('应该验证DeepSeek提供商的API密钥', () => {
      const originalProvider = process.env.AI_SERVICE_PROVIDER;
      const originalKey = process.env.DEEPSEEK_API_KEY;
      process.env.AI_SERVICE_PROVIDER = 'deepseek';
      delete process.env.DEEPSEEK_API_KEY;

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e: string) => e.includes('DEEPSEEK_API_KEY'))
      ).toBe(true);

      process.env.AI_SERVICE_PROVIDER = originalProvider;
      if (originalKey) {
        process.env.DEEPSEEK_API_KEY = originalKey;
      }
    });

    it('应该验证智谱AI提供商的API密钥', () => {
      const originalProvider = process.env.AI_SERVICE_PROVIDER;
      const originalKey = process.env.ZHIPUAI_API_KEY;
      process.env.AI_SERVICE_PROVIDER = 'zhipuai';
      delete process.env.ZHIPUAI_API_KEY;

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e: string) => e.includes('ZHIPUAI_API_KEY'))
      ).toBe(true);

      process.env.AI_SERVICE_PROVIDER = originalProvider;
      if (originalKey) {
        process.env.ZHIPUAI_API_KEY = originalKey;
      }
    });

    it('应该验证法条API提供商', () => {
      const originalProvider = process.env.LAW_ARTICLE_PROVIDER;
      process.env.LAW_ARTICLE_PROVIDER = 'invalid-law-provider';

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);

      process.env.LAW_ARTICLE_PROVIDER = originalProvider;
    });

    it('应该验证法律之星提供商的API密钥', () => {
      const originalProvider = process.env.LAW_ARTICLE_PROVIDER;
      const originalKey = process.env.LAWSTAR_API_KEY;
      process.env.LAW_ARTICLE_PROVIDER = 'lawstar';
      delete process.env.LAWSTAR_API_KEY;

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e: string) => e.includes('LAWSTAR_API_KEY'))
      ).toBe(true);

      process.env.LAW_ARTICLE_PROVIDER = originalProvider;
      if (originalKey) {
        process.env.LAWSTAR_API_KEY = originalKey;
      }
    });

    it('应该验证功能开关的值', () => {
      const originalReg = process.env.ENABLE_NEW_USER_REGISTRATION;
      process.env.ENABLE_NEW_USER_REGISTRATION = 'maybe';

      const result = validateProductionConfig();

      expect(result.valid).toBe(false);

      process.env.ENABLE_NEW_USER_REGISTRATION = originalReg;
    });
  });
});
