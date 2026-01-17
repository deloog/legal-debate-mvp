/**
 * 支付宝工具函数测试
 */

import {
  generateNonceStr,
  generateTimestamp,
  generateOrderNo,
  calculateOrderExpireTime,
  generateRefundNo,
  safeParseJSON,
  safeStringifyJSON,
  formatAmount,
  parseAmount,
  isPaymentSuccess,
  isPaymentFailed,
} from '@/lib/payment/alipay-utils';

describe('支付宝工具函数', () => {
  describe('generateNonceStr', () => {
    it('应该生成随机字符串', () => {
      const nonce1 = generateNonceStr();
      const nonce2 = generateNonceStr();

      expect(typeof nonce1).toBe('string');
      expect(nonce1.length).toBeGreaterThan(0);
      expect(nonce2.length).toBeGreaterThan(0);
      expect(nonce1).not.toBe(nonce2);
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

  describe('generateOrderNo', () => {
    it('应该生成唯一的订单号', () => {
      const orderNo1 = generateOrderNo();
      const orderNo2 = generateOrderNo();

      expect(orderNo1).toMatch(/^ALI\d+$/);
      expect(orderNo2).toMatch(/^ALI\d+$/);
      expect(orderNo1).not.toBe(orderNo2);
    });

    it('应该生成固定长度的订单号', () => {
      const orderNo = generateOrderNo();
      expect(orderNo).toHaveLength(20);
    });
  });

  describe('calculateOrderExpireTime', () => {
    it('应该计算订单过期时间', () => {
      const expiredAt = calculateOrderExpireTime(30);
      const now = new Date();
      const diff = expiredAt.getTime() - now.getTime();

      expect(expiredAt).toBeInstanceOf(Date);
      expect(diff).toBeGreaterThan(29 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(31 * 60 * 1000);
    });

    it('应该支持不同分钟的过期时间', () => {
      const expiredAt1 = calculateOrderExpireTime(10);
      const expiredAt2 = calculateOrderExpireTime(60);
      const now = new Date();

      const diff1 = expiredAt1.getTime() - now.getTime();
      const diff2 = expiredAt2.getTime() - now.getTime();

      expect(diff1).toBeGreaterThan(9 * 60 * 1000);
      expect(diff2).toBeGreaterThan(59 * 60 * 1000);
    });
  });

  describe('generateRefundNo', () => {
    it('应该生成唯一的退款单号', () => {
      const refundNo1 = generateRefundNo();
      const refundNo2 = generateRefundNo();

      expect(refundNo1).toMatch(/^REF\d+$/);
      expect(refundNo2).toMatch(/^REF\d+$/);
      expect(refundNo1).not.toBe(refundNo2);
    });

    it('应该生成固定长度的退款单号', () => {
      const refundNo = generateRefundNo();
      expect(refundNo).toHaveLength(20);
    });
  });

  describe('safeParseJSON', () => {
    it('应该正确解析JSON字符串', () => {
      const json = '{"name":"test","value":123}';
      const result = safeParseJSON<{ name: string; value: number }>(json);

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('应该处理无效JSON返回null', () => {
      const invalidJson = '{"name":"test",';
      const result = safeParseJSON(invalidJson);

      expect(result).toBeNull();
    });

    it('应该处理空字符串', () => {
      const result = safeParseJSON('');
      expect(result).toBeNull();
    });
  });

  describe('safeStringifyJSON', () => {
    it('应该正确序列化对象', () => {
      const obj = { name: 'test', value: 123 };
      const result = safeStringifyJSON(obj);

      expect(result).toBe('{"name":"test","value":123}');
    });

    it('应该处理循环引用对象', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;

      const result = safeStringifyJSON(obj);
      expect(result).toBe('{}');
    });

    it('应该处理无效对象', () => {
      const obj = { fn: () => {} };
      const result = safeStringifyJSON(obj);
      expect(result).toBe('{}');
    });
  });

  describe('formatAmount', () => {
    it('应该正确格式化金额保留两位小数', () => {
      expect(formatAmount(10.5)).toBe('10.50');
      expect(formatAmount(100)).toBe('100.00');
      expect(formatAmount(0.1)).toBe('0.10');
      expect(formatAmount(99.999)).toBe('100.00');
    });

    it('应该处理负数金额', () => {
      expect(formatAmount(-10.5)).toBe('-10.50');
      expect(formatAmount(-0.01)).toBe('-0.01');
    });

    it('应该处理零金额', () => {
      expect(formatAmount(0)).toBe('0.00');
    });
  });

  describe('parseAmount', () => {
    it('应该正确解析金额字符串', () => {
      expect(parseAmount('10.50')).toBe(10.5);
      expect(parseAmount('100.00')).toBe(100);
      expect(parseAmount('0.10')).toBe(0.1);
    });

    it('应该直接返回数字', () => {
      expect(parseAmount(10.5)).toBe(10.5);
      expect(parseAmount(100)).toBe(100);
    });

    it('应该处理无效字符串', () => {
      expect(parseAmount('invalid')).toBeNaN();
    });
  });

  describe('isPaymentSuccess', () => {
    it('应该判断支付成功状态', () => {
      expect(isPaymentSuccess('TRADE_SUCCESS')).toBe(true);
      expect(isPaymentSuccess('TRADE_FINISHED')).toBe(true);
    });

    it('应该判断非支付成功状态', () => {
      expect(isPaymentSuccess('WAIT_BUYER_PAY')).toBe(false);
      expect(isPaymentSuccess('TRADE_CLOSED')).toBe(false);
      expect(isPaymentSuccess('UNKNOWN')).toBe(false);
    });
  });

  describe('isPaymentFailed', () => {
    it('应该判断支付失败状态', () => {
      expect(isPaymentFailed('TRADE_CLOSED')).toBe(true);
    });

    it('应该判断非支付失败状态', () => {
      expect(isPaymentFailed('TRADE_SUCCESS')).toBe(false);
      expect(isPaymentFailed('TRADE_FINISHED')).toBe(false);
      expect(isPaymentFailed('WAIT_BUYER_PAY')).toBe(false);
    });
  });
});
