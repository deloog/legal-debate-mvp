/**
 * 支付SDK环境变量管理
 * 提供支付相关环境变量的验证、获取和转换
 */

/**
 * 应用环境类型
 */
export enum Environment {
  DEVELOPMENT = 'development',
  TEST = 'test',
  PRODUCTION = 'production',
}

/**
 * 环境变量验证结果
 */
export interface ValidationResult {
  valid: boolean;
  missing: string[];
  invalid: string[];
}

/**
 * 支付环境变量配置
 */
export interface PaymentEnvironmentConfig {
  environment: Environment;
  nodeEnv: string;
  isProduction: boolean;
  isTest: boolean;
  isDevelopment: boolean;
}

/**
 * 微信支付环境变量
 */
interface WechatPayEnvVars {
  appId: string;
  mchId: string;
  apiKeyV3: string;
  certSerialNo: string;
  privateKeyPath: string;
  certPath: string;
  notifyUrl: string;
  refundNotifyUrl: string;
}

/**
 * 支付宝环境变量
 */
interface AlipayEnvVars {
  appId: string;
  merchantId: string;
  privateKey: string;
  publicKey: string;
  notifyUrl: string;
  returnUrl: string;
  sandbox: string;
}

/**
 * 支付环境变量管理类
 */
export class PaymentEnvironmentManager {
  private static instance: PaymentEnvironmentManager | null = null;
  private readonly envConfig: PaymentEnvironmentConfig;

  private constructor() {
    this.envConfig = this.loadEnvironmentConfig();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): PaymentEnvironmentManager {
    if (!PaymentEnvironmentManager.instance) {
      PaymentEnvironmentManager.instance = new PaymentEnvironmentManager();
    }
    return PaymentEnvironmentManager.instance;
  }

  /**
   * 加载环境配置
   */
  private loadEnvironmentConfig(): PaymentEnvironmentConfig {
    const nodeEnv = this.getRequiredEnvVar('NODE_ENV');
    const environment = this.parseEnvironment(nodeEnv);

    return {
      environment,
      nodeEnv,
      isProduction: environment === Environment.PRODUCTION,
      isTest: environment === Environment.TEST,
      isDevelopment: environment === Environment.DEVELOPMENT,
    };
  }

  /**
   * 解析环境类型
   */
  private parseEnvironment(nodeEnv: string): Environment {
    const normalized = nodeEnv.toLowerCase();

    if (normalized === 'production' || normalized === 'prod') {
      return Environment.PRODUCTION;
    }

    if (normalized === 'test') {
      return Environment.TEST;
    }

    return Environment.DEVELOPMENT;
  }

  /**
   * 获取环境配置
   */
  public getEnvConfig(): PaymentEnvironmentConfig {
    return this.envConfig;
  }

  /**
   * 验证微信支付环境变量
   */
  public validateWechatPayEnv(): ValidationResult {
    const requiredVars: Array<keyof WechatPayEnvVars> = [
      'appId',
      'mchId',
      'apiKeyV3',
      'certSerialNo',
      'privateKeyPath',
      'certPath',
      'notifyUrl',
      'refundNotifyUrl',
    ];

    const missing: string[] = [];
    const invalid: string[] = [];

    for (const field of requiredVars) {
      const envKey = `WECHAT_${this.toEnvKey(field)}`;
      const value = process.env[envKey];

      if (!value || value.trim() === '') {
        missing.push(envKey);
      } else if (!this.validateEnvValue(envKey, value)) {
        invalid.push(envKey);
      }
    }

    return {
      valid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid,
    };
  }

  /**
   * 验证支付宝环境变量
   */
  public validateAlipayEnv(): ValidationResult {
    const requiredVars: Array<keyof AlipayEnvVars> = [
      'appId',
      'merchantId',
      'privateKey',
      'publicKey',
      'notifyUrl',
      'returnUrl',
      'sandbox',
    ];

    const missing: string[] = [];
    const invalid: string[] = [];

    for (const field of requiredVars) {
      const envKey = `ALIPAY_${this.toEnvKey(field)}`;
      const value = process.env[envKey];

      if (!value || value.trim() === '') {
        missing.push(envKey);
      } else if (!this.validateEnvValue(envKey, value)) {
        invalid.push(envKey);
      }
    }

    return {
      valid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid,
    };
  }

  /**
   * 验证所有支付环境变量
   */
  public validateAll(): ValidationResult {
    const wechatResult = this.validateWechatPayEnv();
    const alipayResult = this.validateAlipayEnv();

    const allMissing = [...wechatResult.missing, ...alipayResult.missing];
    const allInvalid = [...wechatResult.invalid, ...alipayResult.invalid];

    return {
      valid: allMissing.length === 0 && allInvalid.length === 0,
      missing: [...new Set(allMissing)],
      invalid: [...new Set(allInvalid)],
    };
  }

  /**
   * 获取微信支付环境变量
   */
  public getWechatPayEnv(): WechatPayEnvVars {
    const result = this.validateWechatPayEnv();

    if (!result.valid) {
      throw new Error(
        `微信支付环境变量验证失败: 缺失 [${result.missing.join(', ')}], 无效 [${result.invalid.join(', ')}]`
      );
    }

    return {
      appId: this.getEnvVar('WECHAT_APP_ID'),
      mchId: this.getEnvVar('WECHAT_MCH_ID'),
      apiKeyV3: this.getEnvVar('WECHAT_API_KEY_V3'),
      certSerialNo: this.getEnvVar('WECHAT_CERT_SERIAL_NO'),
      privateKeyPath: this.getEnvVar('WECHAT_PRIVATE_KEY_PATH'),
      certPath: this.getEnvVar('WECHAT_CERT_PATH'),
      notifyUrl: this.getEnvVar('WECHAT_NOTIFY_URL'),
      refundNotifyUrl: this.getEnvVar('WECHAT_REFUND_NOTIFY_URL'),
    };
  }

  /**
   * 获取支付宝环境变量
   */
  public getAlipayEnv(): AlipayEnvVars {
    const result = this.validateAlipayEnv();

    if (!result.valid) {
      // 构建时不抛出错误，只记录警告
      if (
        process.env.NODE_ENV !== 'production' ||
        process.env.SKIP_ENV_VALIDATION === 'true'
      ) {
        console.warn(
          `⚠️  支付宝环境变量未完全配置: 缺失 [${result.missing.join(', ')}]`
        );
      } else {
        throw new Error(
          `支付宝环境变量验证失败: 缺失 [${result.missing.join(', ')}], 无效 [${result.invalid.join(', ')}]`
        );
      }
    }

    return {
      appId: this.getEnvVar('ALIPAY_APP_ID'),
      merchantId: this.getEnvVar('ALIPAY_MERCHANT_ID'),
      privateKey: this.getEnvVar('ALIPAY_PRIVATE_KEY'),
      publicKey: this.getEnvVar('ALIPAY_PUBLIC_KEY'),
      notifyUrl: this.getEnvVar('ALIPAY_NOTIFY_URL'),
      returnUrl: this.getEnvVar('ALIPAY_RETURN_URL'),
      sandbox: this.getEnvVar('ALIPAY_SANDBOX'),
    };
  }

  /**
   * 获取必需的环境变量
   */
  private getRequiredEnvVar(key: string): string {
    const value = process.env[key];

    if (!value || value.trim() === '') {
      throw new Error(`必需的环境变量 ${key} 未设置`);
    }

    return value.trim();
  }

  /**
   * 获取环境变量（允许为空）
   */
  private getEnvVar(key: string): string {
    const value = process.env[key];

    if (!value) {
      return '';
    }

    return value.trim();
  }

  /**
   * 验证环境变量值
   */
  private validateEnvValue(key: string, value: string): boolean {
    // 特殊验证规则
    if (key === 'ALIPAY_SANDBOX') {
      return ['true', 'false', '0', '1'].includes(value.toLowerCase());
    }

    // URL验证
    if (key.includes('URL') || key.includes('URL')) {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }

    // 路径验证（仅检查格式）
    if (key.includes('PATH')) {
      return value.length > 0;
    }

    // 默认验证：非空且不是占位符
    if (
      value === '' ||
      value === 'your_value_here' ||
      value === 'REPLACE_WITH_YOUR_VALUE'
    ) {
      return false;
    }

    return true;
  }

  /**
   * 将字段名转换为环境变量键名
   */
  private toEnvKey(field: string): string {
    return field
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase()
      .replace(/^_/, '');
  }

  /**
   * 检查是否为支付宝沙箱环境
   */
  public isAlipaySandbox(): boolean {
    const sandbox = this.getEnvVar('ALIPAY_SANDBOX').toLowerCase();
    return sandbox === 'true' || sandbox === '1';
  }

  /**
   * 获取支付宝环境类型
   */
  public getAlipayEnvironment(): 'sandbox' | 'production' {
    return this.isAlipaySandbox() ? 'sandbox' : 'production';
  }

  /**
   * 重置环境配置（主要用于测试）
   */
  public reset(): void {
    // 单例重置通过工厂方法实现，这里保留扩展性
  }
}

// 导出单例实例
export const paymentEnvManager = PaymentEnvironmentManager.getInstance();

// 便捷函数导出
export function getEnvConfig(): PaymentEnvironmentConfig {
  return paymentEnvManager.getEnvConfig();
}

export function validateWechatPayEnv(): ValidationResult {
  return paymentEnvManager.validateWechatPayEnv();
}

export function validateAlipayEnv(): ValidationResult {
  return paymentEnvManager.validateAlipayEnv();
}

export function validateAllPaymentEnv(): ValidationResult {
  return paymentEnvManager.validateAll();
}

export function getWechatPayEnv(): WechatPayEnvVars {
  return paymentEnvManager.getWechatPayEnv();
}

export function getAlipayEnv(): AlipayEnvVars {
  return paymentEnvManager.getAlipayEnv();
}

export function isAlipaySandbox(): boolean {
  return paymentEnvManager.isAlipaySandbox();
}

export function getAlipayEnvironment(): 'sandbox' | 'production' {
  return paymentEnvManager.getAlipayEnvironment();
}
