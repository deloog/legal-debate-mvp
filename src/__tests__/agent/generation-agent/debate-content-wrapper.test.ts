// DebateContentWrapper单元测试

import { DebateContentWrapper } from '@/lib/agent/generation-agent/debate-content-wrapper';
import { Argument } from '@/types/debate';
import type { LawArticle } from '@prisma/client';

describe('DebateContentWrapper', () => {
  let wrapper: DebateContentWrapper;
  let mockLawArticles: LawArticle[];

  beforeEach(() => {
    wrapper = new DebateContentWrapper();
    mockLawArticles = [
      {
        id: 'law-1',
        lawName: '民法典',
        articleNumber: '第一百一十九条',
        fullText: '依法成立的合同，对当事人具有法律约束力。',
        lawType: 'LAW',
        category: 'COMMERCIAL',
        subCategory: '合同',
        tags: ['合同', '民法典'],
        keywords: ['合同', '法律约束力'],
        version: '1.0',
        effectiveDate: new Date(),
        expiryDate: null,
        status: 'VALID',
        amendmentHistory: null,
        parentId: null,
        chapterNumber: null,
        sectionNumber: null,
        level: 0,
        issuingAuthority: '全国人民代表大会',
        jurisdiction: null,
        relatedArticles: [],
        legalBasis: null,
        searchableText: '依法成立的合同，对当事人具有法律约束力。',
        viewCount: 0,
        referenceCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      const defaultWrapper = new DebateContentWrapper();
      expect(defaultWrapper).toBeDefined();
    });

    it('应该使用自定义配置创建实例', () => {
      const customWrapper = new DebateContentWrapper({
        balanceStrictness: 'high',
        maxArgumentsPerSide: 5,
        qualityThreshold: 0.8,
      });
      expect(customWrapper).toBeDefined();
    });
  });

  describe('wrapDebateResult', () => {
    it('应该包装辩论结果', () => {
      const plaintiffArgs: Argument[] = [
        {
          side: 'plaintiff',
          content: '原告观点1',
          score: 0.8,
        },
      ];
      const defendantArgs: Argument[] = [
        {
          side: 'defendant',
          content: '被告观点1',
          score: 0.8,
        },
      ];

      const result = wrapper.wrapDebateResult(
        plaintiffArgs,
        defendantArgs,
        mockLawArticles
      );

      expect(result).toBeDefined();
      expect(result.plaintiffArguments).toHaveLength(1);
      expect(result.defendantArguments).toHaveLength(1);
      expect(result.legalBasis).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('应该过滤低质量论点', () => {
      const plaintiffArgs: Argument[] = [
        {
          side: 'plaintiff',
          content: '高质量论点',
          score: 0.8,
        },
        {
          side: 'plaintiff',
          content: '低质量论点',
          score: 0.5,
        },
      ];

      const defendantArgs: Argument[] = [
        {
          side: 'defendant',
          content: '被告观点1',
          score: 0.8,
        },
      ];

      const result = wrapper.wrapDebateResult(
        plaintiffArgs,
        defendantArgs,
        mockLawArticles
      );

      expect(result.plaintiffArguments).toHaveLength(1);
      expect(result.plaintiffArguments[0].content).toBe('高质量论点');
    });

    it('应该限制每方论点数量', () => {
      const plaintiffArgs: Argument[] = Array.from({ length: 5 }, (_, i) => ({
        side: 'plaintiff' as const,
        content: `论点${i}`,
        score: 0.9,
      }));

      const defendantArgs: Argument[] = [
        {
          side: 'defendant',
          content: '被告观点1',
          score: 0.8,
        },
      ];

      const result = wrapper.wrapDebateResult(
        plaintiffArgs,
        defendantArgs,
        mockLawArticles
      );

      expect(result.plaintiffArguments.length).toBeLessThanOrEqual(3);
    });
  });

  describe('formatDebateAsText', () => {
    it('应该格式化辩论为文本', () => {
      const mockResult = {
        plaintiffArguments: [
          {
            side: 'plaintiff' as const,
            content: '原告观点1',
            score: 0.8,
          },
        ],
        defendantArguments: [
          {
            side: 'defendant' as const,
            content: '被告观点1',
            score: 0.8,
          },
        ],
        legalBasis: [],
        metadata: {
          generatedAt: new Date(),
          model: 'test',
          tokensUsed: 100,
          confidence: 0.9,
          executionTime: 100,
        },
      };

      const text = wrapper.formatDebateAsText(mockResult);

      expect(text).toContain('【原告观点】');
      expect(text).toContain('【被告观点】');
      expect(text).toContain('原告观点1');
      expect(text).toContain('被告观点1');
    });

    it('应该包含法律依据', () => {
      wrapper.updateConfig({ includeLegalAnalysis: true });

      const mockResult = {
        plaintiffArguments: [
          {
            side: 'plaintiff' as const,
            content: '原告观点1',
            legalBasis: '民法典第119条',
            score: 0.8,
          },
        ],
        defendantArguments: [],
        legalBasis: mockLawArticles.map(article => ({
          lawName: article.lawName,
          articleNumber: article.articleNumber,
          fullText: article.fullText,
          relevanceScore: 0.8,
          applicabilityScore: 0.75,
        })),
        metadata: {
          generatedAt: new Date(),
          model: 'test',
          tokensUsed: 100,
          confidence: 0.9,
        },
      };

      const text = wrapper.formatDebateAsText(mockResult);

      expect(text).toContain('【法律依据】');
      expect(text).toContain('民法典');
    });
  });

  describe('formatDebateAsJSON', () => {
    it('应该格式化辩论为JSON', () => {
      const mockResult = {
        plaintiffArguments: [
          {
            side: 'plaintiff' as const,
            content: '原告观点1',
            score: 0.8,
          },
        ],
        defendantArguments: [],
        legalBasis: [],
        metadata: {
          generatedAt: new Date(),
          model: 'test',
          tokensUsed: 100,
          confidence: 0.9,
        },
      };

      const json = wrapper.formatDebateAsJSON(mockResult);
      const parsed = JSON.parse(json);

      expect(parsed).toBeDefined();
      expect(parsed.plaintiff).toBeDefined();
      expect(parsed.defendant).toBeDefined();
      expect(parsed.metadata).toBeDefined();
    });
  });

  describe('getQualityMetrics', () => {
    it('应该计算质量指标', () => {
      const mockResult = {
        plaintiffArguments: [
          {
            side: 'plaintiff' as const,
            content:
              '这是一个关于合同纠纷的论点，包含了法律依据和详细的论证过程。',
            legalBasis: '民法典第119条',
            reasoning: '根据合同法相关规定',
            score: 0.8,
          },
        ],
        defendantArguments: [
          {
            side: 'defendant' as const,
            content: '被告的回应',
            score: 0.8,
          },
        ],
        legalBasis: [],
        metadata: {
          generatedAt: new Date(),
          model: 'test',
          tokensUsed: 100,
          confidence: 0.9,
        },
      };

      const metrics = wrapper.getQualityMetrics(mockResult);

      expect(metrics).toBeDefined();
      expect(metrics.clarity).toBeGreaterThanOrEqual(0);
      expect(metrics.clarity).toBeLessThanOrEqual(1);
      expect(metrics.logic).toBeGreaterThanOrEqual(0);
      expect(metrics.logic).toBeLessThanOrEqual(1);
      expect(metrics.completeness).toBeGreaterThanOrEqual(0);
      expect(metrics.completeness).toBeLessThanOrEqual(1);
      expect(metrics.format).toBeGreaterThanOrEqual(0);
      expect(metrics.format).toBeLessThanOrEqual(1);
      expect(metrics.overall).toBeGreaterThanOrEqual(0);
      expect(metrics.overall).toBeLessThanOrEqual(1);
    });

    it('空辩论应该返回低分', () => {
      const mockResult = {
        plaintiffArguments: [],
        defendantArguments: [],
        legalBasis: [],
        metadata: {
          generatedAt: new Date(),
          model: 'test',
          tokensUsed: 0,
          confidence: 0,
        },
      };

      const metrics = wrapper.getQualityMetrics(mockResult);

      expect(metrics.overall).toBeLessThan(1);
    });
  });

  describe('updateConfig', () => {
    it('应该能够更新配置', () => {
      wrapper.updateConfig({ maxArgumentsPerSide: 5 });
      const config = wrapper.getConfig();

      expect(config.maxArgumentsPerSide).toBe(5);
    });

    it('应该能够更新多个配置项', () => {
      wrapper.updateConfig({
        balanceStrictness: 'high',
        qualityThreshold: 0.9,
      });
      const config = wrapper.getConfig();

      expect(config.balanceStrictness).toBe('high');
      expect(config.qualityThreshold).toBe(0.9);
    });
  });

  describe('getConfig', () => {
    it('应该返回配置的副本', () => {
      const config1 = wrapper.getConfig();
      const config2 = wrapper.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('边界情况', () => {
    it('应该处理空的论点列表', () => {
      const result = wrapper.wrapDebateResult([], [], mockLawArticles);

      expect(result).toBeDefined();
      expect(result.plaintiffArguments).toHaveLength(0);
      expect(result.defendantArguments).toHaveLength(0);
    });

    it('应该处理空的法律文章', () => {
      const plaintiffArgs: Argument[] = [
        {
          side: 'plaintiff',
          content: '原告观点1',
          score: 0.8,
        },
      ];

      const result = wrapper.wrapSideArguments('plaintiff', plaintiffArgs, []);

      expect(result).toBeDefined();
      expect(result[0].legalBasis).toBeDefined();
    });

    it('应该处理没有法律依据的论点', () => {
      const plaintiffArgs: Argument[] = [
        {
          side: 'plaintiff',
          content: '关于合同纠纷的论点',
          score: 0.8,
        },
      ];

      const result = wrapper.wrapSideArguments('plaintiff', plaintiffArgs, []);

      expect(result).toBeDefined();
      expect(result[0].legalBasis).toBeDefined();
    });
  });
});
