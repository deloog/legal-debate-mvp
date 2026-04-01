/**
 * 金额验证服务单元测试
 * TDD 红阶段 - 先写测试再实现
 *
 * 任务: 将 VerificationAgent 从 AmountExtractor 中解耦
 * 创建独立的验证调用层
 */

import {
  AmountValidationService,
  createAmountValidationService,
  type ValidationCallback,
  type AmountValidationResult,
} from '@/lib/agent/amount-validation-service';
import { VerificationAgent } from '@/lib/agent/verification-agent';

// Mock VerificationAgent
jest.mock('@/lib/agent/verification-agent', () => ({
  VerificationAgent: jest.fn().mockImplementation(() => ({
    verify: jest.fn(),
  })),
}));

describe('AmountValidationService', () => {
  let service: AmountValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AmountValidationService();
  });

  describe('constructor', () => {
    it('should create service without VerificationAgent dependency', () => {
      const service = new AmountValidationService();
      expect(service).toBeDefined();
    });

    it('should accept optional VerificationAgent instance', () => {
      const mockAgent = new VerificationAgent();
      const service = new AmountValidationService(mockAgent);
      expect(service).toBeDefined();
    });
  });

  describe('validateAmount', () => {
    const mockAmount = {
      originalText: '10000元',
      normalizedAmount: 10000,
      currency: 'CNY',
      confidence: 0.9,
    };

    it('should validate amount using VerificationAgent when available', async () => {
      const mockVerify = jest.fn().mockResolvedValue({ passed: true });
      const mockAgent = {
        verify: mockVerify,
      };

      const service = new AmountValidationService(mockAgent as any);
      const result = await service.validateAmount(mockAmount);

      expect(mockVerify).toHaveBeenCalled();
      expect(result.factualValid).toBe(true);
    });

    it('should skip validation when VerificationAgent is not available', async () => {
      const service = new AmountValidationService(null as any);
      const result = await service.validateAmount(mockAmount);

      expect(result.factualValid).toBe(true); // 默认通过
      expect(result.skipped).toBe(true);
    });

    it('should handle VerificationAgent errors gracefully', async () => {
      const mockVerify = jest
        .fn()
        .mockRejectedValue(new Error('Verification failed'));
      const mockAgent = {
        verify: mockVerify,
      };

      const service = new AmountValidationService(mockAgent as any);
      const result = await service.validateAmount(mockAmount);

      expect(result.factualValid).toBe(true); // 错误时默认通过
      expect(result.error).toBeDefined();
    });

    it('should validate logical consistency', async () => {
      const result = await service.validateAmount(mockAmount, {
        fullText: '借款金额为10000元',
      });

      expect(result.logicalValid).toBe(true);
    });

    it('should detect unreasonable amounts', async () => {
      const unreasonableAmount = {
        ...mockAmount,
        normalizedAmount: 999999999999, // 不合理的金额
      };

      const result = await service.validateAmount(unreasonableAmount, {
        fullText: '赔偿金额',
      });

      expect(result.logicalValid).toBe(false);
    });
  });

  describe('validateAmounts', () => {
    const mockAmounts = [
      {
        originalText: '10000元',
        normalizedAmount: 10000,
        currency: 'CNY',
        confidence: 0.9,
      },
      {
        originalText: '5000元',
        normalizedAmount: 5000,
        currency: 'CNY',
        confidence: 0.85,
      },
    ];

    it('should validate multiple amounts', async () => {
      const results = await service.validateAmounts(mockAmounts);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('amount');
      expect(results[0]).toHaveProperty('factualValid');
      expect(results[0]).toHaveProperty('logicalValid');
    });

    it('should use callback for each validation result', async () => {
      const callback: ValidationCallback = jest.fn();

      await service.validateAmounts(mockAmounts, { callback });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should allow cancellation through callback', async () => {
      const callback: ValidationCallback = jest.fn().mockReturnValue(false);

      const results = await service.validateAmounts(mockAmounts, { callback });

      // 当回调返回 false 时，应该停止验证
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('validation strategies', () => {
    const mockAmount = {
      originalText: '10000元',
      normalizedAmount: 10000,
      currency: 'CNY',
      confidence: 0.9,
    };

    it('should support FACTUAL_ONLY strategy', async () => {
      const result = await service.validateAmount(mockAmount, {
        strategy: 'FACTUAL_ONLY',
      });

      expect(result.factualValid).toBeDefined();
      // 逻辑验证应该被跳过
      expect(result.logicalValid).toBeNull();
    });

    it('should support LOGICAL_ONLY strategy', async () => {
      const result = await service.validateAmount(mockAmount, {
        strategy: 'LOGICAL_ONLY',
        fullText: '借款10000元',
      });

      expect(result.logicalValid).toBeDefined();
      // 事实验证应该被跳过
      expect(result.factualValid).toBeNull();
    });

    it('should support FULL strategy (default)', async () => {
      const result = await service.validateAmount(mockAmount, {
        strategy: 'FULL',
        fullText: '借款10000元',
      });

      expect(result.factualValid).toBeDefined();
      expect(result.logicalValid).toBeDefined();
      expect(result.completenessValid).toBeDefined();
    });

    it('should support NONE strategy', async () => {
      const result = await service.validateAmount(mockAmount, {
        strategy: 'NONE',
      });

      expect(result.skipped).toBe(true);
    });
  });

  describe('adjustConfidence', () => {
    it('should increase confidence for valid results', () => {
      const adjusted = service.adjustConfidence(0.8, true, true, true);
      expect(adjusted).toBeGreaterThan(0.8);
    });

    it('should decrease confidence for invalid results', () => {
      const adjusted = service.adjustConfidence(0.8, false, true, true);
      expect(adjusted).toBeLessThan(0.8);
    });

    it('should not decrease confidence below 0', () => {
      const adjusted = service.adjustConfidence(0.1, false, false, false);
      expect(adjusted).toBe(0);
    });

    it('should not increase confidence above 1', () => {
      const adjusted = service.adjustConfidence(0.95, true, true, true);
      expect(adjusted).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases and security', () => {
    it('should reject unreasonably large amounts (> 1 trillion)', async () => {
      const hugeAmount = {
        originalText: '9999999999999元',
        normalizedAmount: 9999999999999,
        currency: 'CNY',
        confidence: 0.9,
      };
      const result = await service.validateAmount(hugeAmount, {
        fullText: '借款',
      });
      expect(result.logicalValid).toBe(false);
    });

    it('should validate 违约金 amount range (<= 50 million)', async () => {
      const penaltyAmount = {
        originalText: '1亿元',
        normalizedAmount: 100000000,
        currency: 'CNY',
        confidence: 0.9,
      };
      const result = await service.validateAmount(penaltyAmount, {
        fullText: '违约金1亿元',
      });
      expect(result.logicalValid).toBe(false); // 超过5000万
    });

    it('should accept valid 违约金 amount', async () => {
      const validPenaltyAmount = {
        originalText: '1000万元',
        normalizedAmount: 10000000,
        currency: 'CNY',
        confidence: 0.9,
      };
      const result = await service.validateAmount(validPenaltyAmount, {
        fullText: '违约金1000万元',
      });
      expect(result.logicalValid).toBe(true);
    });

    it('should validate currency requirement', async () => {
      const amountWithoutCurrency = {
        originalText: '10000',
        normalizedAmount: 10000,
        currency: '',
        confidence: 0.9,
      };
      const result = await service.validateAmount(amountWithoutCurrency, {
        requireCurrency: true,
      });
      expect(result.completenessValid).toBe(false);
    });

    it('should validate min confidence requirement', async () => {
      const lowConfidenceAmount = {
        originalText: '10000元',
        normalizedAmount: 10000,
        currency: 'CNY',
        confidence: 0.3,
      };
      const result = await service.validateAmount(lowConfidenceAmount, {
        minConfidence: 0.5,
      });
      expect(result.completenessValid).toBe(false);
    });
  });

  describe('batch validation limits', () => {
    it('should throw error when batch size exceeds MAX_BATCH_SIZE', async () => {
      const amounts = Array.from({ length: 1001 }, (_, i) => ({
        originalText: `${i}元`,
        normalizedAmount: i,
        currency: 'CNY',
        confidence: 0.9,
      }));

      await expect(service.validateAmounts(amounts)).rejects.toThrow(
        '批量验证数量不能超过'
      );
    });

    it('should validate batch within limit', async () => {
      const amounts = Array.from({ length: 100 }, (_, i) => ({
        originalText: `${i}元`,
        normalizedAmount: i,
        currency: 'CNY',
        confidence: 0.9,
      }));

      const results = await service.validateAmounts(amounts);
      expect(results).toHaveLength(100);
    });

    it('should support parallel validation for large batches', async () => {
      const amounts = Array.from({ length: 50 }, (_, i) => ({
        originalText: `${i}元`,
        normalizedAmount: i,
        currency: 'CNY',
        confidence: 0.9,
      }));

      const start = Date.now();
      const results = await service.validateAmounts(amounts, {
        parallel: true,
      });
      const duration = Date.now() - start;

      expect(results).toHaveLength(50);
      // 并行验证应该更快，但这里不严格断言时间以避免不稳定
    });
  });

  describe('factory function', () => {
    it('should create service via factory function', () => {
      const service = createAmountValidationService();
      expect(service).toBeInstanceOf(AmountValidationService);
    });

    it('should create service with VerificationAgent via factory', () => {
      const mockAgent = new VerificationAgent();
      const service = createAmountValidationService(mockAgent);
      expect(service).toBeInstanceOf(AmountValidationService);
    });
  });
});
