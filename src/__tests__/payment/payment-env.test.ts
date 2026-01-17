/**
 * 支付SDK环境变量管理测试
 */

import {
  PaymentEnvironmentManager,
  Environment,
  getEnvConfig,
  validateWechatPayEnv,
  validateAlipayEnv,
  validateAllPaymentEnv,
  getWechatPayEnv,
  getAlipayEnv,
  isAlipaySandbox,
  getAlipayEnvironment,
  PaymentEnvironmentConfig,
} from '@/lib/payment/payment-env';

describe('PaymentEnvironmentManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    // 恢复原始环境变量
    Object.assign(process.env, originalEnv);
  });

  afterAll(() => {
    // 恢复原始环境变量
    Object.assign(process.env, originalEnv);
  });

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = PaymentEnvironmentManager.getInstance();
      const instance2 = PaymentEnvironmentManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('应该始终返回同一个实例', () => {
      const instance = PaymentEnvironmentManager.getInstance();

      expect(PaymentEnvironmentManager.getInstance()).toBe(instance);
      expect(PaymentEnvironmentManager.getInstance()).toBe(instance);
    });
  });

  describe('getEnvConfig', () => {
    it('应该返回环境配置对象', () => {
      const config = getEnvConfig();

      expect(config).toBeDefined();
      expect(typeof config.environment).toBe('string');
      expect(typeof config.isProduction).toBe('boolean');
      expect(typeof config.isTest).toBe('boolean');
      expect(typeof config.isDevelopment).toBe('boolean');
    });

    it('环境配置应该包含正确的属性', () => {
      const config = getEnvConfig();

      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('nodeEnv');
      expect(config).toHaveProperty('isProduction');
      expect(config).toHaveProperty('isTest');
      expect(config).toHaveProperty('isDevelopment');
    });
  });

  describe('validateWechatPayEnv', () => {
    beforeEach(() => {
      // 设置有效的微信支付环境变量
      process.env.WECHAT_APP_ID = 'wx1234567890';
      process.env.WECHAT_MCH_ID = '1234567890';
      process.env.WECHAT_API_KEY_V3 = 'mock_api_key_v3';
      process.env.WECHAT_CERT_SERIAL_NO = 'mock_serial_no';
      process.env.WECHAT_PRIVATE_KEY_PATH = '/path/to/private_key.pem';
      process.env.WECHAT_CERT_PATH = '/path/to/cert.pem';
      process.env.WECHAT_NOTIFY_URL = 'https://example.com/notify';
      process.env.WECHAT_REFUND_NOTIFY_URL =
        'https://example.com/refund-notify';
    });

    it('当所有环境变量都设置时应该验证通过', () => {
      const result = validateWechatPayEnv();

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
    });

    it('应该检测缺失的环境变量', () => {
      delete process.env.WECHAT_APP_ID;

      const result = validateWechatPayEnv();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('WECHAT_APP_ID');
    });

    it('应该检测所有缺失的环境变量', () => {
      delete process.env.WECHAT_APP_ID;
      delete process.env.WECHAT_MCH_ID;

      const result = validateWechatPayEnv();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('WECHAT_APP_ID');
      expect(result.missing).toContain('WECHAT_MCH_ID');
    });

    it('应该检测无效的URL', () => {
      process.env.WECHAT_NOTIFY_URL = 'invalid-url';

      const result = validateWechatPayEnv();

      expect(result.valid).toBe(false);
      expect(result.invalid).toContain('WECHAT_NOTIFY_URL');
    });

    it('应该接受有效的URL', () => {
      process.env.WECHAT_NOTIFY_URL = 'https://example.com/notify';

      const result = validateWechatPayEnv();

      expect(result.invalid).not.toContain('WECHAT_NOTIFY_URL');
    });
  });

  describe('validateAlipayEnv', () => {
    beforeEach(() => {
      // 设置有效的支付宝环境变量
      process.env.ALIPAY_APP_ID = '2021001234567890';
      process.env.ALIPAY_MERCHANT_ID = '20881234567890123';
      process.env.ALIPAY_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----';
      process.env.ALIPAY_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----';
      process.env.ALIPAY_NOTIFY_URL = 'https://example.com/notify';
      process.env.ALIPAY_RETURN_URL = 'https://example.com/return';
      process.env.ALIPAY_SANDBOX = 'false';
    });

    it('当所有环境变量都设置时应该验证通过', () => {
      const result = validateAlipayEnv();

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
    });

    it('应该检测缺失的环境变量', () => {
      delete process.env.ALIPAY_APP_ID;

      const result = validateAlipayEnv();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('ALIPAY_APP_ID');
    });

    it('应该检测无效的ALIPAY_SANDBOX值', () => {
      process.env.ALIPAY_SANDBOX = 'invalid';

      const result = validateAlipayEnv();

      expect(result.valid).toBe(false);
      expect(result.invalid).toContain('ALIPAY_SANDBOX');
    });

    it('应该接受有效的ALIPAY_SANDBOX值', () => {
      process.env.ALIPAY_SANDBOX = 'true';
      let result = validateAlipayEnv();
      expect(result.invalid).not.toContain('ALIPAY_SANDBOX');

      process.env.ALIPAY_SANDBOX = 'false';
      result = validateAlipayEnv();
      expect(result.invalid).not.toContain('ALIPAY_SANDBOX');

      process.env.ALIPAY_SANDBOX = '1';
      result = validateAlipayEnv();
      expect(result.invalid).not.toContain('ALIPAY_SANDBOX');

      process.env.ALIPAY_SANDBOX = '0';
      result = validateAlipayEnv();
      expect(result.invalid).not.toContain('ALIPAY_SANDBOX');
    });
  });

  describe('validateAllPaymentEnv', () => {
    beforeEach(() => {
      // 设置所有有效的环境变量
      process.env.WECHAT_APP_ID = 'wx1234567890';
      process.env.WECHAT_MCH_ID = '1234567890';
      process.env.WECHAT_API_KEY_V3 = 'mock_api_key_v3';
      process.env.WECHAT_CERT_SERIAL_NO = 'mock_serial_no';
      process.env.WECHAT_PRIVATE_KEY_PATH = '/path/to/private_key.pem';
      process.env.WECHAT_CERT_PATH = '/path/to/cert.pem';
      process.env.WECHAT_NOTIFY_URL = 'https://example.com/notify';
      process.env.WECHAT_REFUND_NOTIFY_URL =
        'https://example.com/refund-notify';
      process.env.ALIPAY_APP_ID = '2021001234567890';
      process.env.ALIPAY_MERCHANT_ID = '20881234567890123';
      process.env.ALIPAY_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----';
      process.env.ALIPAY_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----';
      process.env.ALIPAY_NOTIFY_URL = 'https://example.com/notify';
      process.env.ALIPAY_RETURN_URL = 'https://example.com/return';
      process.env.ALIPAY_SANDBOX = 'false';
    });

    it('当所有环境变量都有效时应该验证通过', () => {
      const result = validateAllPaymentEnv();

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
    });

    it('应该汇总微信和支付宝的验证结果', () => {
      delete process.env.WECHAT_APP_ID;
      delete process.env.ALIPAY_APP_ID;

      const result = validateAllPaymentEnv();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('WECHAT_APP_ID');
      expect(result.missing).toContain('ALIPAY_APP_ID');
    });

    it('应该去除重复的缺失项', () => {
      // 确保没有重复项
      const result = validateAllPaymentEnv();

      const uniqueMissing = [...new Set(result.missing)];
      expect(result.missing).toEqual(uniqueMissing);
    });
  });

  describe('getWechatPayEnv', () => {
    beforeEach(() => {
      process.env.WECHAT_APP_ID = 'wx1234567890';
      process.env.WECHAT_MCH_ID = '1234567890';
      process.env.WECHAT_API_KEY_V3 = 'mock_api_key_v3';
      process.env.WECHAT_CERT_SERIAL_NO = 'mock_serial_no';
      process.env.WECHAT_PRIVATE_KEY_PATH = '/path/to/private_key.pem';
      process.env.WECHAT_CERT_PATH = '/path/to/cert.pem';
      process.env.WECHAT_NOTIFY_URL = 'https://example.com/notify';
      process.env.WECHAT_REFUND_NOTIFY_URL =
        'https://example.com/refund-notify';
    });

    it('应该返回完整的微信支付环境变量', () => {
      const env = getWechatPayEnv();

      expect(env.appId).toBe('wx1234567890');
      expect(env.mchId).toBe('1234567890');
      expect(env.apiKeyV3).toBe('mock_api_key_v3');
      expect(env.certSerialNo).toBe('mock_serial_no');
      expect(env.privateKeyPath).toBe('/path/to/private_key.pem');
      expect(env.certPath).toBe('/path/to/cert.pem');
      expect(env.notifyUrl).toBe('https://example.com/notify');
      expect(env.refundNotifyUrl).toBe('https://example.com/refund-notify');
    });

    it('应该去除环境变量的前后空格', () => {
      process.env.WECHAT_APP_ID = '  wx1234567890  ';
      process.env.WECHAT_MCH_ID = '  1234567890  ';

      const env = getWechatPayEnv();

      expect(env.appId).toBe('wx1234567890');
      expect(env.mchId).toBe('1234567890');
    });

    it('当环境变量验证失败时应该抛出错误', () => {
      delete process.env.WECHAT_APP_ID;

      expect(() => getWechatPayEnv()).toThrow('微信支付环境变量验证失败');
    });
  });

  describe('getAlipayEnv', () => {
    beforeEach(() => {
      process.env.ALIPAY_APP_ID = '2021001234567890';
      process.env.ALIPAY_MERCHANT_ID = '20881234567890123';
      process.env.ALIPAY_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----';
      process.env.ALIPAY_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----';
      process.env.ALIPAY_NOTIFY_URL = 'https://example.com/notify';
      process.env.ALIPAY_RETURN_URL = 'https://example.com/return';
      process.env.ALIPAY_SANDBOX = 'false';
    });

    it('应该返回完整的支付宝环境变量', () => {
      const env = getAlipayEnv();

      expect(env.appId).toBe('2021001234567890');
      expect(env.merchantId).toBe('20881234567890123');
      expect(env.privateKey).toBe('-----BEGIN PRIVATE KEY-----');
      expect(env.publicKey).toBe('-----BEGIN PUBLIC KEY-----');
      expect(env.notifyUrl).toBe('https://example.com/notify');
      expect(env.returnUrl).toBe('https://example.com/return');
      expect(env.sandbox).toBe('false');
    });

    it('应该去除环境变量的前后空格', () => {
      process.env.ALIPAY_APP_ID = '  2021001234567890  ';

      const env = getAlipayEnv();

      expect(env.appId).toBe('2021001234567890');
    });

    it('当环境变量验证失败时应该抛出错误', () => {
      delete process.env.ALIPAY_APP_ID;

      expect(() => getAlipayEnv()).toThrow('支付宝环境变量验证失败');
    });
  });

  describe('isAlipaySandbox', () => {
    it('当ALIPAY_SANDBOX为true时应该返回true', () => {
      process.env.ALIPAY_SANDBOX = 'true';

      expect(isAlipaySandbox()).toBe(true);
    });

    it('当ALIPAY_SANDBOX为1时应该返回true', () => {
      process.env.ALIPAY_SANDBOX = '1';

      expect(isAlipaySandbox()).toBe(true);
    });

    it('当ALIPAY_SANDBOX为false时应该返回false', () => {
      process.env.ALIPAY_SANDBOX = 'false';

      expect(isAlipaySandbox()).toBe(false);
    });

    it('当ALIPAY_SANDBOX为0时应该返回false', () => {
      process.env.ALIPAY_SANDBOX = '0';

      expect(isAlipaySandbox()).toBe(false);
    });

    it('当ALIPAY_SANDBOX未设置时应该返回false', () => {
      delete process.env.ALIPAY_SANDBOX;

      expect(isAlipaySandbox()).toBe(false);
    });

    it('应该大小写不敏感', () => {
      process.env.ALIPAY_SANDBOX = 'TRUE';
      expect(isAlipaySandbox()).toBe(true);

      process.env.ALIPAY_SANDBOX = 'True';
      expect(isAlipaySandbox()).toBe(true);

      process.env.ALIPAY_SANDBOX = 'FALSE';
      expect(isAlipaySandbox()).toBe(false);
    });
  });

  describe('getAlipayEnvironment', () => {
    it('当为沙箱环境时应该返回sandbox', () => {
      process.env.ALIPAY_SANDBOX = 'true';

      expect(getAlipayEnvironment()).toBe('sandbox');
    });

    it('当为生产环境时应该返回production', () => {
      process.env.ALIPAY_SANDBOX = 'false';

      expect(getAlipayEnvironment()).toBe('production');
    });

    it('当ALIPAY_SANDBOX未设置时应该返回production', () => {
      delete process.env.ALIPAY_SANDBOX;

      expect(getAlipayEnvironment()).toBe('production');
    });
  });
});
