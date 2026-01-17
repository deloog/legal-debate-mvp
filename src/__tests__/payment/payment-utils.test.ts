/**
 * 微信支付工具函数测试
 */

import {
  generateRandomString,
  generateOrderNo,
  generateRefundNo,
  generateTimestamp,
  generateNonceStr,
  convertYuanToFen,
  convertFenToYuan,
  formatAmount,
  calculateOrderExpireTime,
  isOrderExpired,
} from '@/lib/payment/wechat-utils';

describe('微信支付工具函数', () => {
  describe('generateRandomString', () => {
    it('应该生成指定长度的随机字符串', () => {
      const str1 = generateRandomString(10);
      const str2 = generateRandomString(10);

      expect(str1).toHaveLength(10);
      expect(str2).toHaveLength(10);
      expect(str1).not.toBe(str2);
    });

    it('应该生成包含字母和数字的字符串', () => {
      const str = generateRandomString(32);
      expect(str).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('默认应该生成32位字符串', () => {
      const str = generateRandomString();
      expect(str).toHaveLength(32);
    });
  });

  describe('generateOrderNo', () => {
    it('应该生成唯一的订单号', () => {
      const orderNo1 = generateOrderNo();
      const orderNo2 = generateOrderNo();

      expect(orderNo1).toMatch(/^ORD\d+[A-Z0-9]{8}$/);
      expect(orderNo2).toMatch(/^ORD\d+[A-Z0-9]{8}$/);
      expect(orderNo1).not.toBe(orderNo2);
    });

    it('应该支持自定义前缀', () => {
      const orderNo = generateOrderNo('TEST');
      expect(orderNo).toMatch(/^TEST\d+[A-Z0-9]{8}$/);
    });

    it('应该生成大写订单号', () => {
      const orderNo = generateOrderNo();
      expect(orderNo).toBe(orderNo.toUpperCase());
    });
  });

  describe('generateRefundNo', () => {
    it('应该生成唯一的退款单号', () => {
      const refundNo1 = generateRefundNo();
      const refundNo2 = generateRefundNo();

      expect(refundNo1).toMatch(/^REF\d+[A-Z0-9]{8}$/);
      expect(refundNo2).toMatch(/^REF\d+[A-Z0-9]{8}$/);
      expect(refundNo1).not.toBe(refundNo2);
    });

    it('应该支持自定义前缀', () => {
      const refundNo = generateRefundNo('TEST');
      expect(refundNo).toMatch(/^TEST\d+[A-Z0-9]{8}$/);
    });
  });

  describe('generateTimestamp', () => {
    it('应该生成当前时间戳', () => {
      const timestamp = generateTimestamp();
      const now = Math.floor(Date.now() / 1000);

      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeLessThanOrEqual(now);
      expect(timestamp).toBeGreaterThan(now - 2);
    });
  });

  describe('generateNonceStr', () => {
    it('应该生成随机字符串', () => {
      const nonce1 = generateNonceStr();
      const nonce2 = generateNonceStr();

      expect(nonce1).toHaveLength(32);
      expect(nonce2).toHaveLength(32);
      expect(nonce1).not.toBe(nonce2);
    });

    it('应该支持自定义长度', () => {
      const nonce = generateNonceStr(16);
      expect(nonce).toHaveLength(16);
    });
  });

  describe('convertYuanToFen', () => {
    it('应该正确将元转换为分', () => {
      expect(convertYuanToFen(1)).toBe(100);
      expect(convertYuanToFen(0.01)).toBe(1);
      expect(convertYuanToFen(10.5)).toBe(1050);
      expect(convertYuanToFen(100.99)).toBe(10099);
    });

    it('应该处理整数金额', () => {
      expect(convertYuanToFen(10)).toBe(1000);
      expect(convertYuanToFen(0)).toBe(0);
    });

    it('应该正确四舍五入', () => {
      expect(convertYuanToFen(1.235)).toBe(124);
      expect(convertYuanToFen(1.234)).toBe(123);
    });
  });

  describe('convertFenToYuan', () => {
    it('应该正确将分转换为元', () => {
      expect(convertFenToYuan(100)).toBe(1);
      expect(convertFenToYuan(1)).toBe(0.01);
      expect(convertFenToYuan(1050)).toBe(10.5);
    });

    it('应该处理零', () => {
      expect(convertFenToYuan(0)).toBe(0);
    });
  });

  describe('formatAmount', () => {
    it('应该正确格式化金额', () => {
      expect(formatAmount(10.5)).toBe('10.50');
      expect(formatAmount(100)).toBe('100.00');
      expect(formatAmount(0.1)).toBe('0.10');
    });

    it('应该支持自定义小数位数', () => {
      expect(formatAmount(10.5, 0)).toBe('11');
      expect(formatAmount(10.5, 1)).toBe('10.5');
      expect(formatAmount(10.5, 3)).toBe('10.500');
    });
  });

  describe('calculateOrderExpireTime', () => {
    it('应该计算订单过期时间（默认120分钟）', () => {
      const expiredAt = calculateOrderExpireTime();
      const now = new Date();
      const diff = expiredAt.getTime() - now.getTime();

      expect(diff).toBeGreaterThan(119 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(121 * 60 * 1000);
    });

    it('应该支持自定义过期时间', () => {
      const expiredAt = calculateOrderExpireTime(30);
      const now = new Date();
      const diff = expiredAt.getTime() - now.getTime();

      expect(diff).toBeGreaterThan(29 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(31 * 60 * 1000);
    });
  });

  describe('isOrderExpired', () => {
    it('应该正确判断订单是否过期', () => {
      const pastDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 1000);

      expect(isOrderExpired(pastDate)).toBe(true);
      expect(isOrderExpired(futureDate)).toBe(false);
    });

    it('应该正确处理当前时间', () => {
      const now = new Date();
      expect(isOrderExpired(now)).toBe(false);
    });
  });
});
