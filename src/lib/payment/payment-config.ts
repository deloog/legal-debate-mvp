/**
 * 支付配置管理
 * 提供支付相关配置的获取和验证
 */

import { logger } from '@/lib/logger';
import {
  AlipayConfig,
  AlipayEnvironment,
  WechatPayConfig,
} from '@/types/payment';
import fs from 'fs';
import path from 'path';
import {
  getAlipayEnv,
  getAlipayEnvironment,
  getWechatPayEnv,
  paymentEnvManager,
} from './payment-env';

/**
 * 支付配置类
 */
class PaymentConfig {
  private static instance: PaymentConfig | null = null;
  private wechatConfig: WechatPayConfig | null = null;
  private alipayConfig: AlipayConfig | null = null;

  private constructor() {
    // 私有构造函数
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): PaymentConfig {
    if (!PaymentConfig.instance) {
      PaymentConfig.instance = new PaymentConfig();
    }
    return PaymentConfig.instance;
  }

  /**
   * 初始化配置
   */
  public initialize(): void {
    this.initializeWechatConfig();
    this.initializeAlipayConfig();
  }

  /**
   * 初始化微信支付配置
   */
  private initializeWechatConfig(): void {
    if (!this.wechatConfig) {
      const env = getWechatPayEnv();
      this.wechatConfig = {
        appId: env.appId,
        mchId: env.mchId,
        apiKeyV3: env.apiKeyV3,
        certSerialNo: env.certSerialNo,
        privateKeyPath: env.privateKeyPath,
        certPath: env.certPath,
        notifyUrl: env.notifyUrl,
        refundNotifyUrl: env.refundNotifyUrl,
      };
    }
  }

  /**
   * 初始化支付宝配置
   */
  private initializeAlipayConfig(): void {
    if (!this.alipayConfig) {
      const env = getAlipayEnv();
      const environment =
        getAlipayEnvironment() === 'sandbox'
          ? AlipayEnvironment.SANDBOX
          : AlipayEnvironment.PRODUCTION;

      this.alipayConfig = {
        appId: env.appId,
        merchantId: env.merchantId,
        privateKey: env.privateKey,
        publicKey: env.publicKey,
        notifyUrl: env.notifyUrl,
        returnUrl: env.returnUrl,
        environment,
      };
    }
  }

  /**
   * 获取微信支付配置
   */
  public getWechatConfig(): WechatPayConfig {
    this.initializeWechatConfig();

    if (!this.wechatConfig) {
      throw new Error('微信支付配置未初始化');
    }

    return this.wechatConfig;
  }

  /**
   * 获取支付宝配置
   */
  public getAlipayConfig(): AlipayConfig {
    this.initializeAlipayConfig();

    if (!this.alipayConfig) {
      throw new Error('支付宝配置未初始化');
    }

    return this.alipayConfig;
  }

  /**
   * 验证微信支付配置
   */
  public validateWechatConfig(): boolean {
    const result = paymentEnvManager.validateWechatPayEnv();
    return result.valid;
  }

  /**
   * 验证支付宝配置
   */
  public validateAlipayConfig(): boolean {
    const result = paymentEnvManager.validateAlipayEnv();
    return result.valid;
  }

  /**
   * 获取微信私钥内容
   */
  public getWechatPrivateKey(): string {
    const config = this.getWechatConfig();
    const privateKeyPath = config.privateKeyPath;

    try {
      // 处理相对路径
      const absolutePath = path.isAbsolute(privateKeyPath)
        ? privateKeyPath
        : path.resolve(process.cwd(), privateKeyPath);

      const privateKeyContent = fs.readFileSync(absolutePath, 'utf-8');

      // 验证私钥格式
      if (!privateKeyContent.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('微信私钥格式不正确');
      }

      return privateKeyContent;
    } catch (error) {
      logger.error('[PaymentConfig] 读取微信私钥失败:', error);
      throw new Error(
        `读取微信私钥失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 读取微信支付平台证书（用于验证异步通知签名）
   * certPath 应指向从微信平台下载的平台证书（PEM 格式）
   * 返回 null 表示证书未配置或读取失败（调用方应拒绝通知）
   */
  public getWechatPlatformCert(): string | null {
    const config = this.getWechatConfig();
    const certPath = config.certPath;

    if (!certPath) {
      return null;
    }

    try {
      const absolutePath = path.isAbsolute(certPath)
        ? certPath
        : path.resolve(process.cwd(), certPath);

      const certContent = fs.readFileSync(absolutePath, 'utf-8');

      if (
        !certContent.includes('-----BEGIN CERTIFICATE-----') &&
        !certContent.includes('-----BEGIN PUBLIC KEY-----')
      ) {
        logger.error('[PaymentConfig] 微信平台证书格式不正确:', certPath);
        return null;
      }

      return certContent;
    } catch (error) {
      logger.error('[PaymentConfig] 读取微信平台证书失败:', {
        certPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 获取支付宝私钥
   */
  public getAlipayPrivateKey(): string {
    const config = this.getAlipayConfig();

    try {
      const privateKey = config.privateKey;

      // 验证私钥格式（支持PKCS#1和PKCS#8）
      if (
        !privateKey.includes('-----BEGIN') ||
        !privateKey.includes('PRIVATE KEY-----')
      ) {
        throw new Error('支付宝私钥格式不正确');
      }

      return privateKey;
    } catch (error) {
      logger.error('[PaymentConfig] 获取支付宝私钥失败:', error);
      throw new Error(
        `获取支付宝私钥失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 获取支付宝公钥
   */
  public getAlipayPublicKey(): string {
    const config = this.getAlipayConfig();

    try {
      const publicKey = config.publicKey;

      // 验证公钥格式
      if (
        !publicKey.includes('-----BEGIN') ||
        !publicKey.includes('PUBLIC KEY-----')
      ) {
        throw new Error('支付宝公钥格式不正确');
      }

      return publicKey;
    } catch (error) {
      logger.error('[PaymentConfig] 获取支付宝公钥失败:', error);
      throw new Error(
        `获取支付宝公钥失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 判断是否为支付宝沙箱环境
   */
  public isAlipaySandbox(): boolean {
    return paymentEnvManager.isAlipaySandbox();
  }

  /**
   * 获取支付宝API域名
   */
  public getAlipayApiDomain(): string {
    const isSandbox = this.isAlipaySandbox();
    return isSandbox
      ? 'openapi.alipaydev.com' // 沙箱环境
      : 'openapi.alipay.com'; // 生产环境
  }

  /**
   * 重置配置（主要用于测试）
   */
  public reset(): void {
    this.wechatConfig = null;
    this.alipayConfig = null;
  }
}

// 导出单例实例
export const paymentConfig = PaymentConfig.getInstance();
