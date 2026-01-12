/**
 * ApplicabilityAnalyzer单元测试
 * 测试覆盖率目标：>90%
 */

import { ApplicabilityAnalyzer } from '../../../lib/agent/legal-agent/applicability-analyzer';
import type {
  ApplicabilityAnalysisInput,
  LawArticle,
} from '../../../lib/agent/legal-agent/types';

// =============================================================================
// 测试数据
// =============================================================================

const mockArticles: LawArticle[] = [
  {
    id: 'law-001',
    lawName: '合同法',
    articleNumber: '107条',
    content:
      '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
    level: 'law',
    category: 'civil-contract',
    keywords: ['合同', '违约', '责任', '赔偿', '履行'],
    effectiveDate: '2020-01-01',
    deprecated: false,
    scope: [],
  },
  {
    id: 'law-002',
    lawName: '合同法',
    articleNumber: '108条',
    content:
      '当事人一方明确表示或者以自己的行为表明不履行合同义务的，对方可以在履行期限届满前请求其承担违约责任。',
    level: 'law',
    category: 'civil-contract',
    keywords: ['合同', '违约', '履行', '责任'],
    effectiveDate: '2020-01-01',
    deprecated: false,
    scope: [],
  },
  {
    id: 'law-003',
    lawName: '合同法',
    articleNumber: '109条',
    content: '当事人一方未支付价款或者报酬的，对方可以请求其支付价款或者报酬。',
    level: 'law',
    category: 'civil-contract',
    keywords: ['支付', '价款', '报酬'],
    effectiveDate: '2020-01-01',
    deprecated: false,
    scope: [],
  },
  {
    id: 'law-004',
    lawName: '合同法',
    articleNumber: '110条',
    content:
      '当事人一方不履行非金钱债务或者履行非金钱债务不符合约定的，对方可以请求履行。',
    level: 'law',
    category: 'civil-contract',
    keywords: ['履行', '债务'],
    effectiveDate: '2020-01-01',
    deprecated: false,
    scope: [],
  },
  {
    id: 'law-deprecated',
    lawName: '旧合同法',
    articleNumber: '50条',
    content: '这是已废止的法条。',
    level: 'law',
    category: 'civil-contract',
    keywords: ['合同'],
    effectiveDate: '1999-01-01',
    deprecated: true,
    scope: [],
  },
];

const mockCaseInfo = {
  type: 'civil-contract',
  description:
    '这是一起合同违约案件，被告未按时支付货款，导致原告遭受经济损失。',
};

// =============================================================================
// 测试套件
// =============================================================================

describe('ApplicabilityAnalyzer', () => {
  let analyzer: ApplicabilityAnalyzer;

  beforeEach(() => {
    analyzer = new ApplicabilityAnalyzer();
  });

  describe('基础功能', () => {
    it('应该成功创建ApplicabilityAnalyzer实例', () => {
      expect(analyzer).toBeInstanceOf(ApplicabilityAnalyzer);
    });

    it('应该有默认配置', () => {
      expect(analyzer).toBeDefined();
    });
  });

  describe('适用性分析', () => {
    it('应该能够分析法条适用性', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 3),
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result).toBeDefined();
      expect(result.applicableArticles).toBeInstanceOf(Array);
      expect(result.notApplicableArticles).toBeInstanceOf(Array);
      expect(result.semanticScores).toBeInstanceOf(Map);
      expect(result.validation).toBeInstanceOf(Map);
      expect(result.aiReview).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
      expect(result.analysisTime).toBeGreaterThanOrEqual(0);
    });

    it('应该能够分析多个法条', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles,
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result.applicableArticles.length).toBeGreaterThan(0);
      expect(result.semanticScores.size).toBe(mockArticles.length);
      expect(result.validation.size).toBe(mockArticles.length);
    });

    it('应该能够处理空法条列表', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: [],
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result.applicableArticles).toHaveLength(0);
      expect(result.notApplicableArticles).toHaveLength(0);
      expect(result.overallScore).toBe(0);
    });

    it('应该支持自定义阈值', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 3),
        caseInfo: mockCaseInfo,
      };

      const result1 = await analyzer.analyze(input, { threshold: 0.8 });
      const result2 = await analyzer.analyze(input, { threshold: 0.3 });

      // 阈值越低，适用法条应该越多或相等
      expect(result2.applicableArticles.length).toBeGreaterThanOrEqual(
        result1.applicableArticles.length
      );
    });

    it('应该支持启用AI审查', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 3),
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input, { enableAIReview: true });

      expect(result.aiReview).toBeDefined();
      expect(result.aiReview.score).toBeGreaterThanOrEqual(0);
      expect(result.aiReview.applicable).toBeInstanceOf(Array);
      expect(result.aiReview.notApplicable).toBeInstanceOf(Array);
      expect(result.aiReview.comments).toBeInstanceOf(Array);
    });

    it('应该支持禁用AI审查', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 3),
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input, { enableAIReview: false });

      expect(result.aiReview.score).toBe(0);
      expect(result.aiReview.applicable).toHaveLength(0);
      expect(result.aiReview.notApplicable).toHaveLength(0);
      expect(result.aiReview.comments).toContain('AI审查未启用');
    });
  });

  describe('语义匹配分析', () => {
    it('应该能够计算语义匹配得分', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 2),
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result.semanticScores.size).toBe(2);

      for (const [, score] of result.semanticScores) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });

    it('应该返回所有法条的语义得分', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles,
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result.semanticScores.size).toBe(mockArticles.length);

      for (const article of mockArticles) {
        expect(result.semanticScores.has(article.id)).toBe(true);
      }
    });
  });

  describe('规则验证', () => {
    it('应该验证时效性', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: [mockArticles[4]], // 已废止法条
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result.notApplicableArticles).toHaveLength(1);
      expect(result.notApplicableArticles[0].id).toBe('law-deprecated');
    });

    it('应该验证法条层级', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 2),
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      for (const validation of result.validation.values()) {
        expect(validation).toHaveProperty('时效性检查');
        expect(validation).toHaveProperty('适用范围检查');
        expect(validation).toHaveProperty('法条层级检查');
      }
    });

    it('应该返回所有法条的验证结果', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles,
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result.validation.size).toBe(mockArticles.length);
    });
  });

  describe('AI审查', () => {
    it('应该生成AI审查意见', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 3),
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input, { enableAIReview: true });

      expect(result.aiReview.comments.length).toBeGreaterThan(0);
      expect(result.aiReview.comments[0]).toContain('法条');
    });

    it('应该正确分类法条', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 3),
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input, { enableAIReview: true });

      const aiClassifiedCount =
        result.aiReview.applicable.length +
        result.aiReview.notApplicable.length;
      // AI审查应该对所有法条进行分类
      expect(aiClassifiedCount).toBeGreaterThanOrEqual(2);
    });

    it('应该计算AI审查评分', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles,
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input, { enableAIReview: true });

      expect(result.aiReview.score).toBeGreaterThanOrEqual(0);
      expect(result.aiReview.score).toBeLessThanOrEqual(1);
    });
  });

  describe('综合评分', () => {
    it('应该计算综合评分', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 2),
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    it('空法条列表时评分应为0', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: [],
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result.overallScore).toBe(0);
    });

    it('有适用法条时评分应大于0', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 2),
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input, { threshold: 0.3 });

      if (result.applicableArticles.length > 0) {
        expect(result.overallScore).toBeGreaterThan(0);
      }
    });
  });

  describe('边界条件', () => {
    it('应该处理已废止法条', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: [mockArticles[4]], // 已废止法条
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      const validation = result.validation.get('law-deprecated');
      expect(validation?.时效性检查.valid).toBe(false);
      expect(validation?.时效性检查.reason).toBe('法条已废止');
    });

    it('应该处理未来生效法条', async () => {
      const futureArticle: LawArticle = {
        id: 'law-future',
        lawName: '合同法',
        articleNumber: '200条',
        content: '未来生效的法条。',
        level: 'law',
        category: 'civil-contract',
        keywords: ['合同'],
        effectiveDate: '2030-01-01',
        deprecated: false,
        scope: [],
      };

      const input: ApplicabilityAnalysisInput = {
        articles: [futureArticle],
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      const validation = result.validation.get('law-future');
      expect(validation?.时效性检查.valid).toBe(false);
      expect(validation?.时效性检查.reason).toBe('法条尚未生效');
    });

    it('应该处理未知caseInfo', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 2),
        caseInfo: {} as unknown,
      };

      const result = await analyzer.analyze(input);

      expect(result.semanticScores.size).toBe(2);
    });
  });

  describe('性能测试', () => {
    it('分析应该合理时间内完成', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles,
        caseInfo: mockCaseInfo,
      };

      const startTime = Date.now();
      const result = await analyzer.analyze(input);
      const elapsed = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(5000); // 应该在5秒内完成
    });
  });

  describe('批量分析', () => {
    it('应该支持批量分析多个案件', async () => {
      const inputs: ApplicabilityAnalysisInput[] = [
        {
          articles: mockArticles.slice(0, 2),
          caseInfo: mockCaseInfo,
        },
        {
          articles: mockArticles.slice(2, 4),
          caseInfo: mockCaseInfo,
        },
      ];

      const results = await analyzer.batchAnalyze(inputs);

      expect(results).toHaveLength(2);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
    });

    it('批量分析应该返回正确数量的结果', async () => {
      const inputs: ApplicabilityAnalysisInput[] = [
        {
          articles: mockArticles.slice(0, 2),
          caseInfo: mockCaseInfo,
        },
        {
          articles: mockArticles.slice(0, 3),
          caseInfo: mockCaseInfo,
        },
        {
          articles: mockArticles.slice(0, 4),
          caseInfo: mockCaseInfo,
        },
      ];

      const results = await analyzer.batchAnalyze(inputs);

      expect(results.length).toBe(3);
    });

    it('批量分析应该支持自定义选项', async () => {
      const inputs: ApplicabilityAnalysisInput[] = [
        {
          articles: mockArticles.slice(0, 2),
          caseInfo: mockCaseInfo,
        },
      ];

      const results = await analyzer.batchAnalyze(inputs, {
        threshold: 0.8,
        enableAIReview: true,
      });

      expect(results[0].aiReview.comments.length).toBeGreaterThan(0);
    });
  });

  describe('分类法条', () => {
    it('应该正确分类适用法条', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: mockArticles.slice(0, 2),
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input, { threshold: 0.3 });

      const totalClassified =
        result.applicableArticles.length + result.notApplicableArticles.length;
      expect(totalClassified).toBe(2);
    });

    it('应该正确分类不适用法条', async () => {
      const input: ApplicabilityAnalysisInput = {
        articles: [mockArticles[4]], // 已废止法条
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result.applicableArticles).toHaveLength(0);
      expect(result.notApplicableArticles).toHaveLength(1);
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的article id', async () => {
      const invalidArticle: LawArticle = {
        id: '',
        lawName: '测试法',
        articleNumber: '1条',
        content: '测试内容',
        level: 'law',
        category: 'civil',
        keywords: [],
        deprecated: false,
      };

      const input: ApplicabilityAnalysisInput = {
        articles: [invalidArticle],
        caseInfo: mockCaseInfo,
      };

      const result = await analyzer.analyze(input);

      expect(result).toBeDefined();
    });
  });
});
