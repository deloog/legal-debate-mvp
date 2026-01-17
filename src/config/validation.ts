/**
 * 配置验证工具
 * 用于验证环境变量和配置的正确性
 */

import type {
  AppConfig,
  DatabaseConfig,
  RedisConfig,
  AuthConfig,
  PaymentConfig,
  MembershipConfig,
} from '../types/config';
import { Environment } from '../types/config';

/**
 * 验证错误类型
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * 配置验证器类
 */
export class ConfigValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  /**
   * 验证配置
   */
  public validate(config: AppConfig): ValidationResult {
    this.errors = [];
    this.warnings = [];

    this.validateDatabase(config.database);
    this.validateRedis(config.redis);
    this.validateAuth(config.auth);
    this.validatePayment(config.payment);
    this.validateMembership(config.membership);
    this.validateEnvironment(config.environment);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * 验证数据库配置
   */
  private validateDatabase(config: DatabaseConfig): void {
    if (!config.url || config.url.trim() === '') {
      this.addError('database.url', '数据库URL不能为空');
    }

    if (!this.isValidUrl(config.url)) {
      this.addError('database.url', '数据库URL格式不正确');
    }

    if (config.poolMin < 1) {
      this.addError('database.poolMin', '最小连接数必须大于0');
    }

    if (config.poolMax < config.poolMin) {
      this.addError('database.poolMax', '最大连接数不能小于最小连接数');
    }

    if (config.poolMax > 100) {
      this.addWarning('database.poolMax', '最大连接数超过100可能导致性能问题');
    }

    if (config.idleTimeout < 0) {
      this.addError('database.idleTimeout', '空闲超时时间不能为负数');
    }

    if (config.connectTimeout < 1000) {
      this.addWarning(
        'database.connectTimeout',
        '连接超时时间小于1000ms可能导致连接失败'
      );
    }
  }

  /**
   * 验证Redis配置
   */
  private validateRedis(config: RedisConfig): void {
    if (!config.url || config.url.trim() === '') {
      this.addError('redis.url', 'Redis URL不能为空');
    }

    if (!this.isValidUrl(config.url)) {
      this.addError('redis.url', 'Redis URL格式不正确');
    }

    if (config.maxRetries < 0 || config.maxRetries > 10) {
      this.addWarning('redis.maxRetries', '重试次数建议在0-10之间');
    }

    if (config.connectTimeout < 1000) {
      this.addWarning(
        'redis.connectTimeout',
        '连接超时时间小于1000ms可能导致连接失败'
      );
    }

    if (config.maxRetriesPerRequest < 0) {
      this.addError('redis.maxRetriesPerRequest', '每请求重试次数不能为负数');
    }
  }

  /**
   * 验证认证配置
   */
  private validateAuth(config: AuthConfig): void {
    if (!config.jwtSecret || config.jwtSecret.trim() === '') {
      this.addError('auth.jwtSecret', 'JWT密钥不能为空');
    }

    if (config.jwtSecret.length < 32) {
      this.addError('auth.jwtSecret', 'JWT密钥长度必须至少32个字符');
    }

    if (!this.isValidDuration(config.jwtExpiresIn)) {
      this.addError(
        'auth.jwtExpiresIn',
        'JWT过期时间格式不正确，如：7d, 24h, 60m'
      );
    }

    if (config.bcryptSaltRounds < 10 || config.bcryptSaltRounds > 16) {
      this.addWarning(
        'auth.bcryptSaltRounds',
        'BCrypt salt rounds建议在10-16之间'
      );
    }
  }

  /**
   * 验证支付配置
   */
  private validatePayment(config: PaymentConfig): void {
    // 验证微信支付配置
    if (!config.wechat.appId || config.wechat.appId.trim() === '') {
      this.addWarning(
        'payment.wechat.appId',
        '微信支付AppID未配置，微信支付功能将不可用'
      );
    }

    if (!config.wechat.mchId || config.wechat.mchId.trim() === '') {
      this.addWarning(
        'payment.wechat.mchId',
        '微信支付商户号未配置，微信支付功能将不可用'
      );
    }

    if (!config.wechat.apiKey || config.wechat.apiKey.trim() === '') {
      this.addWarning(
        'payment.wechat.apiKey',
        '微信支付API密钥未配置，微信支付功能将不可用'
      );
    }

    // 验证支付宝配置
    if (!config.alipay.appId || config.alipay.appId.trim() === '') {
      this.addWarning(
        'payment.alipay.appId',
        '支付宝AppID未配置，支付宝支付功能将不可用'
      );
    }

    if (!config.alipay.privateKey || config.alipay.privateKey.trim() === '') {
      this.addWarning(
        'payment.alipay.privateKey',
        '支付宝私钥未配置，支付宝支付功能将不可用'
      );
    }

    // 验证支付安全配置
    if (config.timeout < 60000) {
      this.addWarning(
        'payment.timeout',
        '支付超时时间小于60秒可能导致订单过期'
      );
    }

    if (config.retryCount < 0 || config.retryCount > 5) {
      this.addError('payment.retryCount', '支付重试次数必须在0-5之间');
    }

    if (
      config.successCallbackAttempts < 1 ||
      config.successCallbackAttempts > 10
    ) {
      this.addWarning(
        'payment.successCallbackAttempts',
        '支付回调重试次数建议在1-10之间'
      );
    }
  }

  /**
   * 验证会员配置
   */
  private validateMembership(config: MembershipConfig): void {
    // 验证价格配置
    if (config.prices.free !== 0) {
      this.addWarning('membership.prices.free', '免费会员价格应该为0');
    }

    if (config.prices.basic <= 0) {
      this.addError('membership.prices.basic', '基础会员价格必须大于0');
    }

    if (config.prices.professional <= config.prices.basic) {
      this.addWarning(
        'membership.prices.professional',
        '专业会员价格应该高于基础会员价格'
      );
    }

    if (config.prices.enterprise <= config.prices.professional) {
      this.addWarning(
        'membership.prices.enterprise',
        '企业会员价格应该高于专业会员价格'
      );
    }

    // 验证折扣配置
    if (config.discounts.quarterly <= 0 || config.discounts.quarterly > 1) {
      this.addWarning(
        'membership.discounts.quarterly',
        '季度折扣系数应该在0-1之间'
      );
    }

    if (config.discounts.yearly <= 0 || config.discounts.yearly > 1) {
      this.addWarning(
        'membership.discounts.yearly',
        '年度折扣系数应该在0-1之间'
      );
    }

    if (config.discounts.yearly > config.discounts.quarterly) {
      this.addWarning('membership.discounts', '年度折扣应该比季度折扣更大');
    }

    // 验证订单配置
    if (config.orderExpireHours < 1) {
      this.addError('membership.orderExpireHours', '订单过期时间必须至少1小时');
    }

    if (config.orderExpireHours > 48) {
      this.addWarning(
        'membership.orderExpireHours',
        '订单过期时间超过48小时可能导致库存问题'
      );
    }

    if (config.retryPaymentCount < 0 || config.retryPaymentCount > 10) {
      this.addError(
        'membership.retryPaymentCount',
        '支付重试次数必须在0-10之间'
      );
    }
  }

  /**
   * 验证环境配置
   */
  private validateEnvironment(environment: Environment): void {
    if (
      environment !== Environment.DEVELOPMENT &&
      environment !== Environment.TEST &&
      environment !== Environment.PRODUCTION
    ) {
      this.addError('environment', `无效的环境类型: ${environment}`);
    }
  }

  /**
   * 验证URL格式
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证持续时间格式
   */
  private isValidDuration(duration: string): boolean {
    const pattern = /^\d+(s|m|h|d)$/;
    return pattern.test(duration);
  }

  /**
   * 添加错误
   */
  private addError(field: string, message: string): void {
    this.errors.push({
      field,
      message,
      severity: 'error',
    });
  }

  /**
   * 添加警告
   */
  private addWarning(field: string, message: string): void {
    this.warnings.push({
      field,
      message,
      severity: 'warning',
    });
  }

  /**
   * 获取验证摘要
   */
  public getSummary(validation: ValidationResult): string {
    const lines: string[] = [];

    if (validation.isValid) {
      lines.push('✅ 配置验证通过');
    } else {
      lines.push('❌ 配置验证失败');
    }

    if (this.errors.length > 0) {
      lines.push(`\n错误 (${this.errors.length}个):`);
      this.errors.forEach(error => {
        lines.push(`  - ${error.field}: ${error.message}`);
      });
    }

    if (this.warnings.length > 0) {
      lines.push(`\n警告 (${this.warnings.length}个):`);
      this.warnings.forEach(warning => {
        lines.push(`  - ${warning.field}: ${warning.message}`);
      });
    }

    return lines.join('\n');
  }
}

/**
 * 验证环境变量是否存在
 */
export function validateRequiredEnvVars(
  requiredVars: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push({
        field: varName,
        message: `环境变量 ${varName} 未设置`,
        severity: 'error',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 生产环境必需的环境变量
 */
export const PRODUCTION_REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
];

/**
 * 开发环境必需的环境变量
 */
export const DEVELOPMENT_REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
];

/**
 * 验证当前环境
 */
export function validateCurrentEnvironment(
  environment: Environment
): ValidationResult {
  const requiredVars =
    environment === Environment.PRODUCTION
      ? PRODUCTION_REQUIRED_ENV_VARS
      : DEVELOPMENT_REQUIRED_ENV_VARS;

  return validateRequiredEnvVars(requiredVars);
}
