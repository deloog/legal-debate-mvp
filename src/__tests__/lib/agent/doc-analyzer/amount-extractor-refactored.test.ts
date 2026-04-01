/**
 * 重构后的金额提取器单元测试
 * TDD 红阶段 - 验证 AmountExtractor 与 VerificationAgent 解耦
 */

import { AmountExtractor } from '@/lib/agent/doc-analyzer/extractors/amount-extractor';
import { AmountValidationService } from '@/lib/agent/amount-validation-service';

// Mock 依赖
jest.mock('@/lib/extraction/amount-extractor-precision', () => ({
  PrecisionAmountExtractor: jest.fn().mockImplementation(() => ({
    extractWithPrecision: jest.fn().mockResolvedValue([
      {
        originalText: '10000元',
        normalizedAmount: 10000,
        currency: 'CNY',
        confidence: 0.9,
      },
    ]),
    getBestExtraction: jest.fn().mockReturnValue({
      originalText: '10000元',
      normalizedAmount: 10000,
      currency: 'CNY',
      confidence: 0.9,
    }),
  })),
}));
jest.mock('@/lib/agent/amount-validation-service', () => ({
  AmountValidationService: jest.fn().mockImplementation(() => ({
    validateAmounts: jest.fn().mockResolvedValue([
      {
        amount: { normalizedAmount: 10000 },
        adjustedConfidence: 0.95,
        factualValid: true,
      },
    ]),
  })),
}));

describe('AmountExtractor (Refactored)', () => {
  let extractor: AmountExtractor;

  beforeEach(() => {
    jest.clearAllMocks();
    extractor = new AmountExtractor();
  });

  describe('constructor', () => {
    it('should create extractor without VerificationAgent dependency', () => {
      const extractor = new AmountExtractor();
      expect(extractor).toBeDefined();
      // 验证不再直接依赖 VerificationAgent
      expect((extractor as any).verificationAgent).toBeUndefined();
    });

    it('should accept optional validation service', () => {
      const mockValidationService = new AmountValidationService();
      const extractor = new AmountExtractor({
        validationService: mockValidationService,
      });

      expect((extractor as any).validationService).toBe(mockValidationService);
    });
  });

  describe('extractFromText', () => {
    it('should extract amounts without validation by default', async () => {
      const extractor = new AmountExtractor();

      // 模拟提取结果
      const mockExtract = jest
        .spyOn(extractor as any, 'processExtractionResults')
        .mockReturnValue([{ normalizedAmount: 10000, confidence: 0.9 }]);

      const result = await extractor.extractFromText('借款10000元');

      expect(result.amounts).toBeDefined();
      expect(result.amounts.length).toBeGreaterThan(0);
    });

    it('should validate when validation callback is provided', async () => {
      const mockValidationService = {
        validateAmounts: jest.fn().mockResolvedValue([
          {
            amount: { normalizedAmount: 10000 },
            adjustedConfidence: 0.95,
            factualValid: true,
          },
        ]),
      };

      const extractor = new AmountExtractor({
        validationService: mockValidationService as any,
      });

      await extractor.extractFromText('借款10000元', {
        validate: true,
      });

      expect(mockValidationService.validateAmounts).toHaveBeenCalled();
    });

    it('should skip validation when validate option is false', async () => {
      const mockValidationService = {
        validateAmounts: jest.fn(),
      };

      const extractor = new AmountExtractor({
        validationService: mockValidationService as any,
      });

      await extractor.extractFromText('借款10000元', {
        validate: false,
      });

      expect(mockValidationService.validateAmounts).not.toHaveBeenCalled();
    });

    it('should use callback for validation results', async () => {
      const validationCallback = jest.fn();
      const mockValidationService = {
        validateAmounts: jest
          .fn()
          .mockImplementation(async (amounts, options) => {
            // 模拟验证服务调用回调
            if (options.callback) {
              for (let i = 0; i < amounts.length; i++) {
                await options.callback(
                  { amount: amounts[i], adjustedConfidence: 0.95 },
                  i,
                  amounts.length
                );
              }
            }
            return amounts.map((a: any) => ({
              amount: a,
              adjustedConfidence: 0.95,
            }));
          }),
      };

      const extractor = new AmountExtractor({
        validationService: mockValidationService as any,
      });

      await extractor.extractFromText('借款10000元', {
        validate: true,
        onValidationResult: validationCallback,
      });

      expect(validationCallback).toHaveBeenCalled();
    });
  });

  describe('decoupling verification', () => {
    it('should not have verifyFactualAccuracy method using VerificationAgent directly', () => {
      // 验证不再直接调用 VerificationAgent
      expect((extractor as any).verifyFactualAccuracy).toBeUndefined();
    });

    it('should delegate validation to validation service', async () => {
      const mockValidate = jest.fn().mockResolvedValue([
        {
          amount: { normalizedAmount: 10000 },
          factualValid: true,
          logicalValid: true,
          adjustedConfidence: 0.95,
        },
      ]);

      const mockValidationService = {
        validateAmounts: mockValidate,
      };

      const extractor = new AmountExtractor({
        validationService: mockValidationService as any,
      });

      // 通过 extractFromText 触发验证
      await extractor.extractFromText('借款10000元', {
        validate: true,
      });

      expect(mockValidate).toHaveBeenCalled();
    });
  });

  describe('backward compatibility', () => {
    it('should maintain same output format', async () => {
      const result = await extractor.extractFromText('借款10000元');

      expect(result).toHaveProperty('amounts');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('validation');
      expect(Array.isArray(result.amounts)).toBe(true);
    });

    it('should support existing extraction options', async () => {
      const result = await extractor.extractFromText('借款10000元', {
        currency: 'CNY',
        minConfidence: 0.5,
      });

      expect(result).toBeDefined();
    });
  });
});
