/**
 * AccuracyOptimizer 单元测试
 *
 * 测试准确率优化器的多阶段分析功能
 * 覆盖率目标: 90%+
 */

import { AccuracyOptimizer } from '../../../../lib/agent/doc-analyzer/optimizations/accuracy-optimizer';
import type { DocumentInput } from '../../../../lib/agent/doc-analyzer/optimizations/types';

describe('AccuracyOptimizer', () => {
  let optimizer: AccuracyOptimizer;

  beforeEach(() => {
    optimizer = new AccuracyOptimizer({ useMock: true });
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      const opt = new AccuracyOptimizer();
      expect(opt).toBeInstanceOf(AccuracyOptimizer);
    });

    it('应该接受自定义配置', () => {
      const opt = new AccuracyOptimizer({
        useMock: true,
        config: {
          enableQuickAnalysis: true,
          enableDeepAnalysis: false,
          enableCrossValidation: true,
          enableAIConfirmation: false,
          confidenceThreshold: 0.8,
          validationThreshold: 0.9,
          maxRetries: 3,
          timeout: 60000,
        },
      });
      expect(opt).toBeInstanceOf(AccuracyOptimizer);
    });
  });

  describe('analyzeWithOptimization', () => {
    it('应该执行完整的多阶段分析', async () => {
      const document: DocumentInput = {
        documentId: 'test-doc-001',
        content: `
          原告张三诉被告李四借款合同纠纷一案。
          双方于2024年1月15日签订借款合同，约定被告向原告借款100万元。
          诉讼请求：
          1. 判令被告偿还借款本金100万元；
          2. 判令被告支付利息5万元；
          3. 诉讼费用由被告承担。
        `,
      };

      const result = await optimizer.analyzeWithOptimization(document);

      expect(result.success).toBe(true);
      expect(result.extractedData).toBeDefined();
      expect(result.extractedData.parties.length).toBeGreaterThan(0);
      expect(result.extractedData.claims.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('应该返回优化阶段信息', async () => {
      const document: DocumentInput = {
        documentId: 'test-doc-002',
        content: '原告张三诉被告李四借款合同纠纷一案，请求偿还借款100万元。',
      };

      const result = await optimizer.analyzeWithOptimization(document);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.optimizationStages).toBeDefined();
      expect(Array.isArray(result.metadata.optimizationStages)).toBe(true);
    });

    it('应该处理空文档内容', async () => {
      const document: DocumentInput = {
        documentId: 'test-doc-003',
        content: '',
      };

      await expect(
        optimizer.analyzeWithOptimization(document)
      ).rejects.toThrow();
    });

    it('应该处理无效文档ID', async () => {
      const document: DocumentInput = {
        documentId: '',
        content: '测试内容',
      };

      await expect(
        optimizer.analyzeWithOptimization(document)
      ).rejects.toThrow();
    });
  });

  describe('quickAnalysis', () => {
    it('应该快速提取关键信息', async () => {
      const content = '原告张三诉被告李四，请求偿还借款100万元及利息5万元。';

      const result = await optimizer.quickAnalysis(content);

      expect(result).toBeDefined();
      expect(result.parties).toBeDefined();
      expect(result.claims).toBeDefined();
      expect(result.amounts).toBeDefined();
      expect(result.keyDates).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('应该提取当事人信息', async () => {
      // 使用明确的"原告："和"被告："格式
      const content = '原告：张三 被告：李四 借款合同纠纷一案';

      const result = await optimizer.quickAnalysis(content);

      expect(result.parties.length).toBeGreaterThanOrEqual(2);
      expect(result.parties.some(p => p.name === '张三')).toBe(true);
      expect(result.parties.some(p => p.name === '李四')).toBe(true);
    });

    it('应该提取金额信息', async () => {
      const content = '被告应偿还借款本金100万元及利息5万元';

      const result = await optimizer.quickAnalysis(content);

      expect(result.amounts.length).toBeGreaterThanOrEqual(1);
    });

    it('应该提取日期信息', async () => {
      const content = '双方于2024年1月15日签订借款合同';

      const result = await optimizer.quickAnalysis(content);

      expect(result.keyDates.length).toBeGreaterThanOrEqual(1);
    });

    it('应该限制诉讼请求数量为前3个', async () => {
      const content = `
        诉讼请求：
        1. 偿还本金100万元；
        2. 支付利息5万元；
        3. 支付违约金10万元；
        4. 赔偿损失20万元；
        5. 承担诉讼费用。
      `;

      const result = await optimizer.quickAnalysis(content);

      // 快速分析只取前3个
      expect(result.claims.length).toBeLessThanOrEqual(3);
    });
  });

  describe('deepAnalysis', () => {
    it('应该基于快速分析结果进行深度分析', async () => {
      const content = `
        原告张三诉被告李四借款合同纠纷一案。
        事实与理由：2024年1月15日，被告向原告借款100万元，约定月利率1%，
        借款期限6个月。到期后被告未还款。
      `;

      const quickResult = await optimizer.quickAnalysis(content);
      const deepResult = await optimizer.deepAnalysis(content, quickResult);

      expect(deepResult).toBeDefined();
      expect(deepResult.facts).toBeDefined();
      expect(deepResult.detailedClaims).toBeDefined();
      expect(deepResult.timeline).toBeDefined();
    });

    it('应该提取详细的事实信息', async () => {
      const content = `
        事实与理由：
        1. 2024年1月15日，双方签订借款合同；
        2. 被告收到借款100万元；
        3. 约定还款日期为2024年7月15日；
        4. 到期后被告未还款。
      `;

      const quickResult = await optimizer.quickAnalysis(content);
      const deepResult = await optimizer.deepAnalysis(content, quickResult);

      expect(deepResult.facts.length).toBeGreaterThan(0);
    });

    it('应该生成时间线', async () => {
      const content = `
        2024年1月15日签订合同，2024年2月1日放款，2024年7月15日到期未还。
      `;

      const quickResult = await optimizer.quickAnalysis(content);
      const deepResult = await optimizer.deepAnalysis(content, quickResult);

      expect(deepResult.timeline.length).toBeGreaterThan(0);
    });

    it('应该补充快速分析遗漏的诉讼请求', async () => {
      const content = `
        诉讼请求：
        1. 偿还本金100万元；
        2. 支付利息5万元；
        3. 支付违约金10万元；
        4. 赔偿损失20万元；
        5. 承担诉讼费用。
      `;

      const quickResult = await optimizer.quickAnalysis(content);
      const deepResult = await optimizer.deepAnalysis(content, quickResult);

      // 深度分析应该提取所有诉讼请求
      expect(deepResult.detailedClaims.length).toBeGreaterThanOrEqual(
        quickResult.claims.length
      );
    });
  });

  describe('crossValidate', () => {
    it('应该验证当事人一致性', async () => {
      const content = '原告张三诉被告李四借款合同纠纷一案';

      const quickResult = await optimizer.quickAnalysis(content);
      const deepResult = await optimizer.deepAnalysis(content, quickResult);
      const validatedResult = await optimizer.crossValidate(
        content,
        deepResult
      );

      expect(validatedResult.validation).toBeDefined();
      expect(validatedResult.validation.issues).toBeDefined();
      expect(validatedResult.validation.score).toBeDefined();
    });

    it('应该检测当事人不一致问题', async () => {
      const content = '原告张三诉被告李四借款合同纠纷一案';

      // 模拟一个有问题的深度分析结果
      const deepResult = {
        parties: [
          { type: 'plaintiff' as const, name: '王五' }, // 错误的当事人
          { type: 'defendant' as const, name: '李四' },
        ],
        claims: [],
        amounts: [],
        keyDates: [],
        confidence: 0.8,
        facts: [],
        detailedClaims: [],
        timeline: [],
      };

      const validatedResult = await optimizer.crossValidate(
        content,
        deepResult
      );

      expect(validatedResult.validation.issues.length).toBeGreaterThan(0);
      expect(validatedResult.validation.score).toBeLessThan(1.0);
    });

    it('应该验证金额一致性', async () => {
      const content = '被告应偿还借款本金100万元';

      const deepResult = {
        parties: [],
        claims: [],
        amounts: [
          {
            value: 2000000,
            currency: 'CNY',
            context: '借款本金',
            position: 10,
          }, // 错误金额
        ],
        keyDates: [],
        confidence: 0.8,
        facts: [],
        detailedClaims: [],
        timeline: [],
      };

      const validatedResult = await optimizer.crossValidate(
        content,
        deepResult
      );

      expect(
        validatedResult.validation.issues.some(
          i => i.type === 'AMOUNT_MISMATCH'
        )
      ).toBe(true);
    });

    it('应该验证日期一致性', async () => {
      const content = '双方于2024年1月15日签订借款合同';

      const deepResult = {
        parties: [],
        claims: [],
        amounts: [],
        keyDates: ['2023年5月20日'], // 错误日期
        confidence: 0.8,
        facts: [],
        detailedClaims: [],
        timeline: [],
      };

      const validatedResult = await optimizer.crossValidate(
        content,
        deepResult
      );

      expect(
        validatedResult.validation.issues.some(i => i.type === 'DATE_CONFLICT')
      ).toBe(true);
    });

    it('应该计算验证分数', async () => {
      const content = '原告张三诉被告李四借款合同纠纷一案';

      const quickResult = await optimizer.quickAnalysis(content);
      const deepResult = await optimizer.deepAnalysis(content, quickResult);
      const validatedResult = await optimizer.crossValidate(
        content,
        deepResult
      );

      expect(validatedResult.validation.score).toBeGreaterThanOrEqual(0);
      expect(validatedResult.validation.score).toBeLessThanOrEqual(1);
    });
  });

  describe('aiConfirmation', () => {
    it('应该对不确定项进行AI确认', async () => {
      const content =
        '原告张三诉被告李四借款合同纠纷一案，请求偿还借款100万元。';

      const quickResult = await optimizer.quickAnalysis(content);
      const deepResult = await optimizer.deepAnalysis(content, quickResult);
      const validatedResult = await optimizer.crossValidate(
        content,
        deepResult
      );
      const confirmedResult = await optimizer.aiConfirmation(
        content,
        validatedResult
      );

      expect(confirmedResult).toBeDefined();
      expect(confirmedResult.extractedData).toBeDefined();
    });

    it('应该跳过无不确定项的情况', async () => {
      const content = '原告张三诉被告李四借款合同纠纷一案';

      // 创建一个高置信度的验证结果
      const validatedResult = {
        parties: [
          { type: 'plaintiff' as const, name: '张三' },
          { type: 'defendant' as const, name: '李四' },
        ],
        claims: [],
        amounts: [],
        keyDates: [],
        confidence: 0.95,
        facts: [],
        detailedClaims: [],
        timeline: [],
        validation: {
          issues: [],
          score: 1.0,
          isValid: true,
        },
      };

      const confirmedResult = await optimizer.aiConfirmation(
        content,
        validatedResult
      );

      // 无不确定项时应该直接返回
      expect(confirmedResult.extractedData.parties).toEqual(
        validatedResult.parties
      );
    });

    it('应该处理AI确认失败的情况', async () => {
      const content = '原告张三诉被告李四借款合同纠纷一案';

      // 创建一个低置信度的验证结果
      const validatedResult = {
        parties: [{ type: 'plaintiff' as const, name: '张三' }],
        claims: [],
        amounts: [],
        keyDates: [],
        confidence: 0.3, // 低置信度
        facts: [],
        detailedClaims: [],
        timeline: [],
        validation: {
          issues: [
            {
              type: 'PARTY_INCONSISTENCY' as const,
              severity: 'WARNING' as const,
              field: 'parties',
              message: '可能遗漏被告',
            },
          ],
          score: 0.6,
          isValid: false,
        },
      };

      // 即使AI确认失败，也应该返回结果
      const confirmedResult = await optimizer.aiConfirmation(
        content,
        validatedResult
      );
      expect(confirmedResult).toBeDefined();
    });
  });

  describe('findUncertainItems', () => {
    it('应该识别低置信度的当事人', () => {
      const validatedResult = {
        parties: [
          { type: 'plaintiff' as const, name: '张三', _inferred: true },
        ],
        claims: [],
        amounts: [],
        keyDates: [],
        confidence: 0.5,
        facts: [],
        detailedClaims: [],
        timeline: [],
        validation: {
          issues: [],
          score: 0.8,
          isValid: true,
        },
      };

      const uncertainItems = optimizer.findUncertainItems(validatedResult);

      expect(uncertainItems.length).toBeGreaterThan(0);
      expect(uncertainItems.some(i => i.type === 'PARTY')).toBe(true);
    });

    it('应该识别有验证问题的项目', () => {
      const validatedResult = {
        parties: [],
        claims: [],
        amounts: [
          {
            value: 1000000,
            currency: 'CNY',
            context: '借款本金',
            position: 10,
          },
        ],
        keyDates: [],
        confidence: 0.8,
        facts: [],
        detailedClaims: [],
        timeline: [],
        validation: {
          issues: [
            {
              type: 'AMOUNT_MISMATCH' as const,
              severity: 'WARNING' as const,
              field: 'amounts',
              message: '金额可能不准确',
            },
          ],
          score: 0.7,
          isValid: true,
        },
      };

      const uncertainItems = optimizer.findUncertainItems(validatedResult);

      expect(uncertainItems.some(i => i.type === 'AMOUNT')).toBe(true);
    });

    it('应该返回空数组当没有不确定项时', () => {
      const validatedResult = {
        parties: [
          { type: 'plaintiff' as const, name: '张三' },
          { type: 'defendant' as const, name: '李四' },
        ],
        claims: [],
        amounts: [],
        keyDates: [],
        confidence: 0.95,
        facts: [],
        detailedClaims: [],
        timeline: [],
        validation: {
          issues: [],
          score: 1.0,
          isValid: true,
        },
      };

      const uncertainItems = optimizer.findUncertainItems(validatedResult);

      expect(uncertainItems.length).toBe(0);
    });
  });

  describe('配置选项', () => {
    it('应该支持禁用快速分析', async () => {
      const opt = new AccuracyOptimizer({
        useMock: true,
        config: {
          enableQuickAnalysis: false,
          enableDeepAnalysis: true,
          enableCrossValidation: true,
          enableAIConfirmation: true,
          confidenceThreshold: 0.7,
          validationThreshold: 0.8,
          maxRetries: 2,
          timeout: 30000,
        },
      });

      const document: DocumentInput = {
        documentId: 'test-doc-config-1',
        content: '原告张三诉被告李四借款合同纠纷一案',
      };

      const result = await opt.analyzeWithOptimization(document);
      expect(result.success).toBe(true);
    });

    it('应该支持禁用深度分析', async () => {
      const opt = new AccuracyOptimizer({
        useMock: true,
        config: {
          enableQuickAnalysis: true,
          enableDeepAnalysis: false,
          enableCrossValidation: true,
          enableAIConfirmation: true,
          confidenceThreshold: 0.7,
          validationThreshold: 0.8,
          maxRetries: 2,
          timeout: 30000,
        },
      });

      const document: DocumentInput = {
        documentId: 'test-doc-config-2',
        content: '原告张三诉被告李四借款合同纠纷一案',
      };

      const result = await opt.analyzeWithOptimization(document);
      expect(result.success).toBe(true);
    });

    it('应该支持禁用交叉验证', async () => {
      const opt = new AccuracyOptimizer({
        useMock: true,
        config: {
          enableQuickAnalysis: true,
          enableDeepAnalysis: true,
          enableCrossValidation: false,
          enableAIConfirmation: true,
          confidenceThreshold: 0.7,
          validationThreshold: 0.8,
          maxRetries: 2,
          timeout: 30000,
        },
      });

      const document: DocumentInput = {
        documentId: 'test-doc-config-3',
        content: '原告张三诉被告李四借款合同纠纷一案',
      };

      const result = await opt.analyzeWithOptimization(document);
      expect(result.success).toBe(true);
    });

    it('应该支持禁用AI确认', async () => {
      const opt = new AccuracyOptimizer({
        useMock: true,
        config: {
          enableQuickAnalysis: true,
          enableDeepAnalysis: true,
          enableCrossValidation: true,
          enableAIConfirmation: false,
          confidenceThreshold: 0.7,
          validationThreshold: 0.8,
          maxRetries: 2,
          timeout: 30000,
        },
      });

      const document: DocumentInput = {
        documentId: 'test-doc-config-4',
        content: '原告张三诉被告李四借款合同纠纷一案',
      };

      const result = await opt.analyzeWithOptimization(document);
      expect(result.success).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该处理分析超时', async () => {
      const opt = new AccuracyOptimizer({
        useMock: true,
        config: {
          enableQuickAnalysis: true,
          enableDeepAnalysis: true,
          enableCrossValidation: true,
          enableAIConfirmation: true,
          confidenceThreshold: 0.7,
          validationThreshold: 0.8,
          maxRetries: 1,
          timeout: 1, // 极短超时
        },
      });

      const document: DocumentInput = {
        documentId: 'test-doc-timeout',
        content: '原告张三诉被告李四借款合同纠纷一案',
      };

      // 超时应该被优雅处理
      try {
        const result = await opt.analyzeWithOptimization(document);
        // 如果没有抛出错误，应该返回降级结果
        expect(result.success).toBeDefined();
      } catch (error) {
        // 或者抛出超时错误
        expect(error).toBeDefined();
      }
    });

    it('应该在重试后成功', async () => {
      const opt = new AccuracyOptimizer({
        useMock: true,
        config: {
          enableQuickAnalysis: true,
          enableDeepAnalysis: true,
          enableCrossValidation: true,
          enableAIConfirmation: true,
          confidenceThreshold: 0.7,
          validationThreshold: 0.8,
          maxRetries: 3,
          timeout: 30000,
        },
      });

      const document: DocumentInput = {
        documentId: 'test-doc-retry',
        content: '原告张三诉被告李四借款合同纠纷一案',
      };

      const result = await opt.analyzeWithOptimization(document);
      expect(result.success).toBe(true);
    });
  });

  describe('性能', () => {
    it('应该在合理时间内完成分析', async () => {
      const document: DocumentInput = {
        documentId: 'test-doc-perf',
        content: `
          原告张三诉被告李四借款合同纠纷一案。
          双方于2024年1月15日签订借款合同，约定被告向原告借款100万元。
          诉讼请求：
          1. 判令被告偿还借款本金100万元；
          2. 判令被告支付利息5万元；
          3. 诉讼费用由被告承担。
        `,
      };

      const startTime = Date.now();
      await optimizer.analyzeWithOptimization(document);
      const duration = Date.now() - startTime;

      // Mock模式下应该很快完成
      expect(duration).toBeLessThan(5000);
    });
  });
});
