/**
 * 生产环境配置加载模块
 * 用于在测试和生产环境中加载.env.production配置
 */

import dotenv from 'dotenv';

// 加载生产环境配置
export function loadProductionConfig(): void {
  // 优先加载.env.production
  dotenv.config({ path: '.env.production' });
}

/**
 * 验证生产环境配置是否完整
 */
export function validateProductionConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查必需的配置
  const requiredConfigs = [
    { name: 'NODE_ENV', expected: 'production' },
    { name: 'NEXT_PUBLIC_APP_NAME' },
    { name: 'NEXT_PUBLIC_APP_URL' },
    { name: 'DATABASE_URL' },
    { name: 'REDIS_URL' },
    { name: 'AI_SERVICE_PROVIDER', expectedValues: ['deepseek', 'zhipuai'] },
    { name: 'NEXTAUTH_URL' },
    { name: 'NEXTAUTH_SECRET', minLength: 32 },
    { name: 'SMTP_HOST' },
    { name: 'SMTP_PORT', isNumber: true },
    { name: 'SMTP_USER' },
    { name: 'EMAIL_FROM', pattern: /^[^@]+@[^@]+\.[^@]+$/ },
    { name: 'ALERT_EMAIL_TO', pattern: /^[^@]+@[^@]+\.[^@]+$/ },
    { name: 'MAX_FILE_SIZE', isNumber: true },
    { name: 'ALLOWED_FILE_TYPES' },
    { name: 'STRIPE_PUBLIC_KEY' },
    { name: 'STRIPE_SECRET_KEY' },
    { name: 'STRIPE_WEBHOOK_SECRET' },
    { name: 'SENTRY_DSN' },
    { name: 'SENTRY_ENVIRONMENT', expected: 'production' },
    { name: 'LOG_LEVEL', expectedValues: ['debug', 'info', 'warn', 'error'] },
    { name: 'LOG_TO_FILE', expectedValues: ['true', 'false'] },
    { name: 'LOG_TO_DATABASE', expectedValues: ['true', 'false'] },
    { name: 'CACHE_TTL', isNumber: true },
    { name: 'CACHE_MAX_SIZE', isNumber: true },
    { name: 'API_TIMEOUT', isNumber: true },
    { name: 'MAX_CONCURRENT_REQUESTS', isNumber: true },
    { name: 'ENABLE_NEW_USER_REGISTRATION', expectedValues: ['true', 'false'] },
    { name: 'ENABLE_LAWYER_QUALIFICATION', expectedValues: ['true', 'false'] },
    { name: 'ENABLE_ENTERPRISE_ACCOUNT', expectedValues: ['true', 'false'] },
    { name: 'ENABLE_AI_FEATURES', expectedValues: ['true', 'false'] },
    { name: 'ENABLE_PAYMENT_FEATURES', expectedValues: ['true', 'false'] },
  ];

  // 可选但有默认值的配置
  const optionalConfigs = [
    { name: 'DATABASE_POOL_SIZE', default: '20', isNumber: true },
    { name: 'DATABASE_TIMEOUT', default: '30000', isNumber: true },
    { name: 'REDIS_PASSWORD' },
    { name: 'REDIS_MAX_RETRIES', default: '3', isNumber: true },
    { name: 'DEEPSEEK_API_KEY' },
    { name: 'DEEPSEEK_API_BASE_URL', default: 'https://api.deepseek.com' },
    { name: 'ZHIPUAI_API_KEY' },
    { name: 'ZHIPUAI_API_BASE_URL', default: 'https://open.bigmodel.cn' },
    {
      name: 'LAW_ARTICLE_PROVIDER',
      default: 'local',
      expectedValues: ['local', 'lawstar', 'pkulaw'],
    },
    { name: 'LAWSTAR_API_KEY' },
  ];

  // 验证必需配置
  for (const config of requiredConfigs) {
    const value = process.env[config.name];

    if (!value) {
      errors.push(`缺少必需配置: ${config.name}`);
      continue;
    }

    // 验证期望值
    if (config.expected && value !== config.expected) {
      errors.push(`${config.name} 应为 ${config.expected}, 实际为 ${value}`);
    }

    // 验证允许的值
    if (config.expectedValues && !config.expectedValues.includes(value)) {
      errors.push(
        `${config.name} 值 ${value} 无效, 允许的值: ${config.expectedValues.join(', ')}`
      );
    }

    // 验证最小长度
    if (config.minLength && value.length < config.minLength) {
      errors.push(`${config.name} 长度应至少 ${config.minLength} 字符`);
    }

    // 验证数字
    if (config.isNumber && !/^\d+$/.test(value)) {
      errors.push(`${config.name} 必须是数字`);
    }

    // 验证模式
    if (config.pattern && !config.pattern.test(value)) {
      errors.push(`${config.name} 格式无效`);
    }
  }

  // 验证可选配置
  for (const config of optionalConfigs) {
    const value = process.env[config.name];

    if (!value) {
      continue;
    }

    // 验证允许的值
    if (config.expectedValues && !config.expectedValues.includes(value)) {
      warnings.push(
        `${config.name} 值 ${value} 无效, 允许的值: ${config.expectedValues.join(', ')}`
      );
    }

    // 验证数字
    if (config.isNumber && !/^\d+$/.test(value)) {
      warnings.push(`${config.name} 必须是数字`);
    }
  }

  // 条件验证
  const provider = process.env.AI_SERVICE_PROVIDER;
  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      errors.push('AI服务提供商为deepseek时,必须设置DEEPSEEK_API_KEY');
    }
  }

  if (provider === 'zhipuai') {
    const apiKey = process.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      errors.push('AI服务提供商为zhipuai时,必须设置ZHIPUAI_API_KEY');
    }
  }

  const lawProvider = process.env.LAW_ARTICLE_PROVIDER;
  if (lawProvider === 'lawstar') {
    const apiKey = process.env.LAWSTAR_API_KEY;
    if (!apiKey) {
      errors.push('法条API提供商为lawstar时,必须设置LAWSTAR_API_KEY');
    }
  }

  // 安全警告
  const placeholderPatterns = ['your_', 'YOUR_'];
  for (const pattern of placeholderPatterns) {
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string' && value.includes(pattern)) {
        warnings.push(`${key} 可能使用了占位符, 请在生产环境替换为实际值`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
