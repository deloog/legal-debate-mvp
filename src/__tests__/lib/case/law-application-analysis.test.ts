import {
  buildCaseLawApplicationAnalysis,
  createEmptyLawApplicationAnalysis,
} from '@/lib/case/law-application-analysis';
import { prisma } from '@/lib/db';
import { RelationType } from '@prisma/client';

jest.mock('@/lib/db', () => ({
  prisma: {
    legalReference: {
      findMany: jest.fn(),
    },
    lawArticle: {
      findMany: jest.fn(),
    },
    lawArticleRelation: {
      findMany: jest.fn(),
    },
  },
}));

describe('law-application-analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('空法条时返回空分析', () => {
    const result = createEmptyLawApplicationAnalysis();

    expect(result.version).toBe('2.0');
    expect(result.summary.coreCount).toBe(0);
    expect(result.nextActions.length).toBeGreaterThan(0);
  });

  it('应该把 LegalReference 和图谱关系转译为案件法条适用分析 2.0', async () => {
    (prisma.legalReference.findMany as jest.Mock).mockResolvedValue([
      {
        articleId: 'article-667',
        source: '民法典',
        articleNumber: '667',
        content: '借款合同是借款人向贷款人借款，到期返还借款并支付利息的合同。',
        applicabilityScore: 0.92,
        relevanceScore: null,
        applicabilityReason: '借款合同关系基础; 支撑返还借款本金请求',
        analysisResult: { reasons: ['合同关系与本案事实匹配'] },
        metadata: { source: 'applicability' },
        status: 'VALID',
        analyzedAt: new Date('2026-01-01'),
      },
      {
        articleId: 'article-old',
        source: '合同法',
        articleNumber: '196',
        content: '旧法条',
        applicabilityScore: 0.7,
        relevanceScore: null,
        applicabilityReason: '历史引用',
        analysisResult: null,
        metadata: null,
        status: 'REPEALED',
        analyzedAt: null,
      },
    ]);

    (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'article-667',
        lawName: '民法典',
        articleNumber: '667',
        fullText:
          '借款合同是借款人向贷款人借款，到期返还借款并支付利息的合同。',
        status: 'VALID',
        category: 'CIVIL',
        lawType: 'LAW',
      },
      {
        id: 'article-668',
        lawName: '民法典',
        articleNumber: '668',
        fullText:
          '借款合同应当采用书面形式，但是自然人之间借款另有约定的除外。',
        status: 'VALID',
        category: 'CIVIL',
        lawType: 'LAW',
      },
      {
        id: 'article-old',
        lawName: '合同法',
        articleNumber: '196',
        fullText: '旧法条',
        status: 'REPEALED',
        category: 'CIVIL',
        lawType: 'LAW',
      },
    ]);

    (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rel-1',
        sourceId: 'article-667',
        targetId: 'article-668',
        relationType: RelationType.COMPLETES,
        strength: 0.8,
        confidence: 0.76,
        description: '第668条补充说明借款合同形式。',
        source: {
          id: 'article-667',
          lawName: '民法典',
          articleNumber: '667',
        },
        target: {
          id: 'article-668',
          lawName: '民法典',
          articleNumber: '668',
        },
      },
    ]);

    const result = await buildCaseLawApplicationAnalysis({
      caseId: 'case-1',
      articleIds: ['article-667', 'article-old'],
      conflicts: [
        {
          sourceId: 'article-667',
          sourceName: '民法典第667条',
          targetId: 'article-old',
          targetName: '合同法第196条',
          description: '两条法律规定存在冲突',
        },
      ],
      evolutionChain: [
        {
          articleId: 'article-old',
          articleName: '合同法第196条',
          isSuperseded: true,
          supersededBy: '民法典第667条',
        },
      ],
      recommendedArticleIds: ['article-668'],
      keyInferences: [],
    });

    expect(result.version).toBe('2.0');
    expect(result.summary.coreCount).toBe(2);
    expect(result.summary.supportingCount).toBe(1);
    expect(result.summary.riskCount).toBeGreaterThanOrEqual(2);
    expect(result.coreArticles[0]).toMatchObject({
      articleId: 'article-667',
      title: '民法典第667条',
      confidence: 'high',
      sourceLabel: '适用性分析',
    });
    expect(result.coreArticles[0].reasons).toEqual(
      expect.arrayContaining(['借款合同关系基础', '合同关系与本案事实匹配'])
    );
    expect(result.supportingArticles[0]).toMatchObject({
      articleId: 'article-668',
      relationLabel: '补充',
      anchorTitle: '民法典第667条',
    });
    expect(result.riskArticles.map(item => item.title)).toEqual(
      expect.arrayContaining(['存在法条冲突', '疑似引用旧法或被替代条文'])
    );
    expect(result.applicationRoute.map(step => step.id)).toEqual([
      'claim_basis',
      'elements',
      'supplement',
      'risk_check',
      'writing_order',
    ]);
  });
});
