/**
 * AIReviewer单元测试
 */

import { AIReviewer } from '../../../../lib/agent/doc-analyzer/reviewers/ai-reviewer';
import type { ExtractedData } from '../../../../lib/agent/doc-analyzer/core/types';

describe('AIReviewer', () => {
  let reviewer: AIReviewer;

  beforeEach(() => {
    reviewer = new AIReviewer();
  });

  describe('初始化', () => {
    test('初始状态应该为未初始化', () => {
      expect(reviewer.isReady()).toBe(false);
    });

    test('应该能够初始化AI服务', async () => {
      const mockAIService = {
        chatCompletion: jest.fn()
      };

      await reviewer.initialize(mockAIService);
      expect(reviewer.isReady()).toBe(true);
    });
  });

  describe('执行审查', () => {
    const testData: ExtractedData = {
      parties: [
        { type: 'plaintiff', name: '张三' },
        { type: 'defendant', name: '李四' }
      ],
      claims: [
        {
          type: 'PAY_PRINCIPAL',
          content: '偿还本金100万元',
          amount: 1000000,
          currency: 'CNY'
        }
      ]
    };

    test('未初始化时应该跳过AI审查', async () => {
      const result = await reviewer.review(testData, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: []
      });

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].category).toBe('AI');
      expect(result.issues[0].severity).toBe('WARNING');
    });

    test('AI服务调用失败应该记录WARNING', async () => {
      const mockAIService = {
        chatCompletion: jest.fn().mockRejectedValue(new Error('AI服务错误'))
      };

      await reviewer.initialize(mockAIService);

      const result = await reviewer.review(testData, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: []
      });

      expect(result.passed).toBe(true);
      expect(result.issues.some(i => i.category === 'AI')).toBe(true);
    });
  });

  describe('解析AI响应', () => {
    test('应该正确解析JSON响应', () => {
      const content = `
        这里有一些文本
        {
          "issues": [
            {
              "severity": "WARNING",
              "category": "FORM",
              "message": "测试问题",
              "suggestion": "测试建议"
            }
          ],
          "corrections": [
            {
              "type": "ADD_CLAIM",
              "description": "添加诉讼费用",
              "rule": "TEST"
            }
          ]
        }
        这里还有一些文本
      `;

      const result = reviewer['parseJSONResponse'](content);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toBe('测试问题');
      expect(result.corrections).toHaveLength(1);
      expect(result.corrections[0].type).toBe('ADD_CLAIM');
    });

    test('无效JSON应该返回空结果', () => {
      const content = '这里没有有效的JSON';

      const result = reviewer['parseJSONResponse'](content);

      expect(result.issues).toEqual([]);
      expect(result.corrections).toEqual([]);
    });
  });

  describe('验证严重性级别', () => {
    test('应该接受有效的严重性级别', () => {
      expect(reviewer['isValidSeverity']('ERROR')).toBe(true);
      expect(reviewer['isValidSeverity']('WARNING')).toBe(true);
      expect(reviewer['isValidSeverity']('INFO')).toBe(true);
    });

    test('应该拒绝无效的严重性级别', () => {
      expect(reviewer['isValidSeverity']('CRITICAL')).toBe(false);
      expect(reviewer['isValidSeverity']('DEBUG')).toBe(false);
      expect(reviewer['isValidSeverity']('')).toBe(false);
    });
  });

  describe('验证修正类型', () => {
    test('应该接受有效的修正类型', () => {
      expect(reviewer['isValidCorrectionType']('ADD_CLAIM')).toBe(true);
      expect(reviewer['isValidCorrectionType']('ADD_PARTY')).toBe(true);
      expect(reviewer['isValidCorrectionType']('FIX_AMOUNT')).toBe(true);
      expect(reviewer['isValidCorrectionType']('FIX_ROLE')).toBe(true);
      expect(reviewer['isValidCorrectionType']('OTHER')).toBe(true);
    });

    test('应该拒绝无效的修正类型', () => {
      expect(reviewer['isValidCorrectionType']('INVALID')).toBe(false);
      expect(reviewer['isValidCorrectionType']('')).toBe(false);
    });
  });

  describe('计算评分', () => {
    test('没有问题应该得1.0分', () => {
      const score = reviewer['calculateScore']([]);
      expect(score).toBe(1.0);
    });

    test('ERROR应该降低更多分数', () => {
      const issues = [
        { severity: 'ERROR' as const, category: 'FORM', message: '错误1' }
      ];

      const score = reviewer['calculateScore'](issues);
      expect(score).toBeLessThan(1.0);
      expect(score).toBeGreaterThanOrEqual(0.6);
    });

    test('多个ERROR应该大幅降低分数', () => {
      const issues = [
        { severity: 'ERROR' as const, category: 'FORM', message: '错误1' },
        { severity: 'ERROR' as const, category: 'FORM', message: '错误2' }
      ];

      const score = reviewer['calculateScore'](issues);
      expect(score).toBeLessThan(0.6);
    });

    test('WARNING应该降低较少分数', () => {
      const issues = [
        { severity: 'WARNING' as const, category: 'FORM', message: '警告1' }
      ];

      const score = reviewer['calculateScore'](issues);
      expect(score).toBeLessThan(1.0);
      expect(score).toBeGreaterThan(0.6);
    });

    test('应该正确处理混合严重性问题', () => {
      const issues = [
        { severity: 'ERROR' as const, category: 'FORM', message: '错误1' },
        { severity: 'WARNING' as const, category: 'LOGIC', message: '警告1' },
        { severity: 'WARNING' as const, category: 'LOGIC', message: '警告2' }
      ];

      const score = reviewer['calculateScore'](issues);
      // 1个ERROR(4) + 2个WARNING(2) = 6, 1 - 6/10 = 0.4
      expect(score).toBeLessThan(0.6);
    });
  });

  describe('构建审查提示词', () => {
    test('应该构建完整的审查提示词', () => {
      const data: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三' }],
        claims: [{
          type: 'PAY_PRINCIPAL',
          content: '偿还本金',
          amount: 1000,
          currency: 'CNY'
        }]
      };

      const prompt = reviewer['buildReviewPrompt'](data, '测试文档内容');

      expect(prompt).toContain('文档原文');
      expect(prompt).toContain('当事人信息');
      expect(prompt).toContain('诉讼请求');
      expect(prompt).toContain('张三');
      expect(prompt).toContain('PAY_PRINCIPAL');
      expect(prompt).toContain('质量审查');
    });

    test('应该限制文档原文长度', () => {
      const longText = 'A'.repeat(5000);
      const data: ExtractedData = {
        parties: [],
        claims: []
      };

      const prompt = reviewer['buildReviewPrompt'](data, longText);

      // 原文应该被截断到2000字符
      expect(prompt.length).toBeLessThan(longText.length);
    });
  });
});
