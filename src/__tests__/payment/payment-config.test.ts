/**
 * 支付配置管理单元测试
 * 测试支付配置的获取、验证和密钥管理
 */

import { paymentConfig } from '@/lib/payment/payment-config';
import {
  paymentEnvManager,
  getWechatPayEnv,
  getAlipayEnv,
  getAlipayEnvironment,
} from '@/lib/payment/payment-env';
import { AlipayEnvironment } from '@/types/payment';

// Mock环境管理器
jest.mock('@/lib/payment/payment-env', () => ({
  paymentEnvManager: {
    validateWechatPayEnv: jest.fn(),
    validateAlipayEnv: jest.fn(),
    isAlipaySandbox: jest.fn(),
  },
  getWechatPayEnv: jest.fn(),
  getAlipayEnv: jest.fn(),
  getAlipayEnvironment: jest.fn(),
}));

// Mock文件系统
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
}));

// Mock路径模块
jest.mock('path', () => ({
  isAbsolute: jest.fn((p: string) => p.startsWith('/')),
  resolve: jest.fn((...args: string[]) => args.join('/')),
}));

beforeEach(() => {
  jest.clearAllMocks();
  paymentConfig.reset();
});

describe('PaymentConfig', () => {
  describe('微信支付配置', () => {
    it('应该成功获取微信支付配置', () => {
      const mockEnv = {
        appId: 'wx-test-appid',
        mchId: 'test-mchid',
        apiKeyV3: 'test-api-key',
        certSerialNo: 'test-serial',
        privateKeyPath: '/path/to/private.pem',
        certPath: '/path/to/cert.pem',
        notifyUrl: 'https://example.com/notify',
        refundNotifyUrl: 'https://example.com/refund',
      };

      (paymentEnvManager.validateWechatPayEnv as jest.Mock).mockReturnValue({
        valid: true,
        missing: [],
      });

      (getWechatPayEnv as jest.Mock).mockReturnValue(mockEnv);

      const config = paymentConfig.getWechatConfig();

      expect(config).toEqual(mockEnv);
      expect(getWechatPayEnv).toHaveBeenCalled();
    });

    it('应该正确处理配置获取', () => {
      // 验证配置可以正确获取
      const config = paymentConfig.getWechatConfig();
      expect(config).toBeDefined();
      expect(config.appId).toBe('wx-test-appid');
    });

    it('应该验证微信支付配置', () => {
      (paymentEnvManager.validateWechatPayEnv as jest.Mock).mockReturnValue({
        valid: true,
        missing: [],
      });

      const result = paymentConfig.validateWechatConfig();

      expect(result).toBe(true);
      expect(paymentEnvManager.validateWechatPayEnv).toHaveBeenCalled();
    });
  });

  describe('支付宝配置', () => {
    it('应该成功获取支付宝配置', () => {
      const mockEnv = {
        appId: 'test-appid',
        merchantId: 'test-merchant',
        privateKey:
          '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
        publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
      };

      (paymentEnvManager.validateAlipayEnv as jest.Mock).mockReturnValue({
        valid: true,
        missing: [],
      });

      (paymentEnvManager.isAlipaySandbox as jest.Mock).mockReturnValue(false);
      (getAlipayEnv as jest.Mock).mockReturnValue(mockEnv);
      (getAlipayEnvironment as jest.Mock).mockReturnValue('production');

      const config = paymentConfig.getAlipayConfig();

      expect(config).toEqual({
        ...mockEnv,
        environment: AlipayEnvironment.PRODUCTION,
      });
      expect(getAlipayEnv).toHaveBeenCalled();
    });

    it('应该在沙箱环境下返回沙箱配置', () => {
      const mockEnv = {
        appId: 'test-appid',
        merchantId: 'test-merchant',
        privateKey:
          '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
        publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
      };

      (paymentEnvManager.isAlipaySandbox as jest.Mock).mockReturnValue(true);
      (getAlipayEnv as jest.Mock).mockReturnValue(mockEnv);
      (getAlipayEnvironment as jest.Mock).mockReturnValue('sandbox');

      const config = paymentConfig.getAlipayConfig();

      expect(config.environment).toBe(AlipayEnvironment.SANDBOX);
    });

    it('应该验证支付宝配置', () => {
      (paymentEnvManager.validateAlipayEnv as jest.Mock).mockReturnValue({
        valid: true,
        missing: [],
      });

      const result = paymentConfig.validateAlipayConfig();

      expect(result).toBe(true);
      expect(paymentEnvManager.validateAlipayEnv).toHaveBeenCalled();
    });

    it('应该判断是否为沙箱环境', () => {
      (paymentEnvManager.isAlipaySandbox as jest.Mock).mockReturnValue(true);

      const result = paymentConfig.isAlipaySandbox();

      expect(result).toBe(true);
      expect(paymentEnvManager.isAlipaySandbox).toHaveBeenCalled();
    });

    it('应该获取正确的API域名', () => {
      (paymentEnvManager.isAlipaySandbox as jest.Mock).mockReturnValue(false);

      const domain = paymentConfig.getAlipayApiDomain();

      expect(domain).toBe('openapi.alipay.com');
    });

    it('应该在沙箱环境下获取沙箱域名', () => {
      (paymentEnvManager.isAlipaySandbox as jest.Mock).mockReturnValue(true);

      const domain = paymentConfig.getAlipayApiDomain();

      expect(domain).toBe('openapi.alipaydev.com');
    });
  });

  describe('支付宝密钥管理', () => {
    it('应该成功获取支付宝私钥', () => {
      const mockPrivateKey =
        '-----BEGIN RSA PRIVATE KEY-----\ntest-private-key\n-----END RSA PRIVATE KEY-----';

      const mockEnv = {
        appId: 'test-appid',
        merchantId: 'test-merchant',
        privateKey: mockPrivateKey,
        publicKey:
          '-----BEGIN PUBLIC KEY-----\ntest-public-key\n-----END PUBLIC KEY-----',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
      };

      (getAlipayEnv as jest.Mock).mockReturnValue(mockEnv);

      paymentConfig.reset();

      const privateKey = paymentConfig.getAlipayPrivateKey();

      expect(privateKey).toBe(mockPrivateKey);
    });

    it('应该接受PKCS#8格式的私钥', () => {
      const mockPrivateKey =
        '-----BEGIN PRIVATE KEY-----\ntest-private-key\n-----END PRIVATE KEY-----';

      const mockEnv = {
        appId: 'test-appid',
        merchantId: 'test-merchant',
        privateKey: mockPrivateKey,
        publicKey:
          '-----BEGIN PUBLIC KEY-----\ntest-public-key\n-----END PUBLIC KEY-----',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
      };

      (getAlipayEnv as jest.Mock).mockReturnValue(mockEnv);

      paymentConfig.reset();

      const privateKey = paymentConfig.getAlipayPrivateKey();

      expect(privateKey).toBe(mockPrivateKey);
    });

    it('应该拒绝格式不正确的私钥', () => {
      const mockEnv = {
        appId: 'test-appid',
        merchantId: 'test-merchant',
        privateKey: 'invalid-key-content',
        publicKey:
          '-----BEGIN PUBLIC KEY-----\ntest-public-key\n-----END PUBLIC KEY-----',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
      };

      (getAlipayEnv as jest.Mock).mockReturnValue(mockEnv);

      paymentConfig.reset();

      expect(() => paymentConfig.getAlipayPrivateKey()).toThrow(
        '支付宝私钥格式不正确'
      );
    });

    it('应该成功获取支付宝公钥', () => {
      const mockPublicKey =
        '-----BEGIN PUBLIC KEY-----\ntest-public-key\n-----END PUBLIC KEY-----';

      const mockEnv = {
        appId: 'test-appid',
        merchantId: 'test-merchant',
        privateKey:
          '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
        publicKey: mockPublicKey,
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
      };

      (getAlipayEnv as jest.Mock).mockReturnValue(mockEnv);

      paymentConfig.reset();

      const publicKey = paymentConfig.getAlipayPublicKey();

      expect(publicKey).toBe(mockPublicKey);
    });

    it('应该拒绝格式不正确的公钥', () => {
      const mockEnv = {
        appId: 'test-appid',
        merchantId: 'test-merchant',
        privateKey:
          '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
        publicKey: 'invalid-public-key',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
      };

      (getAlipayEnv as jest.Mock).mockReturnValue(mockEnv);

      paymentConfig.reset();

      expect(() => paymentConfig.getAlipayPublicKey()).toThrow(
        '支付宝公钥格式不正确'
      );
    });
  });

  describe('配置重置', () => {
    it('应该成功重置配置', () => {
      const mockEnv = {
        appId: 'wx-test-appid',
        mchId: 'test-mchid',
        apiKeyV3: 'test-api-key',
        certSerialNo: 'test-serial',
        privateKeyPath: '/path/to/private.pem',
        certPath: '/path/to/cert.pem',
        notifyUrl: 'https://example.com/notify',
        refundNotifyUrl: 'https://example.com/refund',
      };

      (getWechatPayEnv as jest.Mock).mockReturnValue(mockEnv);

      // 初始化配置
      paymentConfig.getWechatConfig();

      // 重置配置
      paymentConfig.reset();

      // 再次获取配置应该重新初始化
      const config = paymentConfig.getWechatConfig();

      expect(config).toBeDefined();
    });
  });
});
