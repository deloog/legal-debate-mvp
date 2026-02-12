/**
 * 环境变量验证模块
 * 在应用启动时验证所有必需的环境变量
 */

/**
 * 必需的环境变量列表
 */
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'JWT_SECRET',
] as const;

/**
 * 生产环境必需的API密钥
 */
const REQUIRED_API_KEYS_PROD = ['DEEPSEEK_API_KEY', 'ZHIPU_API_KEY'] as const;

/**
 * 不安全的占位符模式
 */
const PLACEHOLDER_PATTERNS = [
  'your-',
  'placeholder',
  'example.com',
  'test-key',
  'secret-key-here',
];

/**
 * 弱密码模式
 */
const WEAK_PASSWORD_PATTERNS = ['password', '123456', 'admin', 'root'];

/**
 * 验证所有必需的环境变量
 * @throws Error 如果有环境变量缺失或不安全
 */
export function validateRequiredEnv(): void {
  const missing: string[] = [];
  const placeholders: string[] = [];
  const weakPasswords: string[] = [];

  // 检查基本必需变量
  for (const key of REQUIRED_ENV_VARS) {
    const value = process.env[key];

    if (!value) {
      missing.push(key);
      continue;
    }

    // 检查占位符
    if (hasPlaceholder(value)) {
      placeholders.push(key);
    }

    // 检查数据库密码
    if (key === 'DATABASE_URL' && hasWeakPassword(value)) {
      weakPasswords.push(key);
    }
  }

  // 生产环境额外检查
  if (process.env.NODE_ENV === 'production') {
    for (const key of REQUIRED_API_KEYS_PROD) {
      const value = process.env[key];

      if (!value) {
        missing.push(key);
        continue;
      }

      if (hasPlaceholder(value)) {
        placeholders.push(key);
      }
    }
  }

  // 报告错误
  const errors: string[] = [];

  if (missing.length > 0) {
    errors.push(
      `❌ 缺少必需的环境变量:\n   ${missing.map(k => `- ${k}`).join('\n   ')}`
    );
  }

  if (placeholders.length > 0) {
    errors.push(
      `⚠️  发现占位符配置（${process.env.NODE_ENV === 'production' ? '生产环境禁止使用' : '建议更换'}）:\n   ${placeholders.map(k => `- ${k}: ${process.env[k]}`).join('\n   ')}`
    );
  }

  if (weakPasswords.length > 0) {
    errors.push(
      `🔒 发现弱密码配置:\n   ${weakPasswords.map(k => `- ${k} 使用了弱密码`).join('\n   ')}`
    );
  }

  if (errors.length > 0) {
    const errorMessage = [
      '',
      '═'.repeat(70),
      '  环境变量配置错误',
      '═'.repeat(70),
      '',
      ...errors,
      '',
      '请检查以下文件的配置:',
      `  - ${process.env.NODE_ENV === 'production' ? '.env.production' : '.env'}`,
      '',
      '配置指南:',
      '  1. 复制 .env.example 到 .env (如果存在)',
      '  2. 替换所有占位符值为真实配置',
      '  3. 使用强密码（至少12个字符，包含字母数字和特殊字符）',
      '  4. 不要将 .env 文件提交到版本控制',
      '',
      '生成强密钥:',
      "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      '',
      '═'.repeat(70),
      '',
    ].join('\n');

    // 生产环境：抛出错误，阻止启动
    if (
      process.env.NODE_ENV === 'production' &&
      (missing.length > 0 || placeholders.length > 0)
    ) {
      throw new Error(errorMessage);
    }

    // 开发环境：只是警告
    console.warn(errorMessage);
  } else {
    console.log('✅ 环境变量验证通过');
  }
}

/**
 * 检查值是否包含占位符模式
 */
function hasPlaceholder(value: string): boolean {
  const lowerValue = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some(pattern => lowerValue.includes(pattern));
}

/**
 * 检查数据库URL是否使用弱密码
 */
function hasWeakPassword(dbUrl: string): boolean {
  const lowerUrl = dbUrl.toLowerCase();
  return WEAK_PASSWORD_PATTERNS.some(pattern => {
    // 检查密码部分（在://和@之间）
    const match = lowerUrl.match(/\/\/[^:]*:([^@]*)@/);
    if (match && match[1]) {
      return match[1].includes(pattern);
    }
    return false;
  });
}

/**
 * 获取必需环境变量（带类型安全）
 * @param key 环境变量名
 * @throws Error 如果变量不存在
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `环境变量 ${key} 是必需的但未设置。\n` +
        `请在 ${process.env.NODE_ENV === 'production' ? '.env.production' : '.env'} 中配置。`
    );
  }
  return value;
}

/**
 * 获取可选环境变量
 * @param key 环境变量名
 * @param defaultValue 默认值
 */
export function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}
