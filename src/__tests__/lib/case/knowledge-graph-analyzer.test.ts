import { CaseKnowledgeGraphAnalyzer } from '@/lib/case/knowledge-graph-analyzer';
import { prisma } from '@/lib/db';

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

jest.mock('@/lib/knowledge-graph/reasoning/rule-engine', () => ({
  RuleEngine: jest.fn().mockImplementation(() => ({
    registerRule: jest.fn(),
    runReasoning: jest.fn().mockResolvedValue({ inferences: [] }),
  })),
}));

describe('CaseKnowledgeGraphAnalyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该优先使用 LegalReference.articleId 构建案件图谱', async () => {
    (prisma.legalReference.findMany as jest.Mock).mockResolvedValue([
      {
        articleId: 'article-1',
        source: 'LAW_ARTICLE',
        articleNumber: null,
      },
    ]);

    (prisma.lawArticle.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'article-1',
          lawName: '民法典',
          articleNumber: '667',
          status: 'VALID',
          effectiveDate: new Date('2021-01-01'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'article-1',
          lawName: '民法典',
          articleNumber: '667',
          category: 'CIVIL',
        },
      ]);

    (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

    const result = await CaseKnowledgeGraphAnalyzer.analyze('case-1');

    expect(result.hasData).toBe(true);
    expect(result.articleIds).toEqual(['article-1']);
    expect(result.graphData.nodes).toEqual([
      expect.objectContaining({
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '667',
      }),
    ]);
    expect(prisma.lawArticle.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              lawName: expect.anything(),
            }),
          ]),
        }),
      })
    );
  });

  it('旧数据没有 articleId 时仍应回退到 source + articleNumber 软匹配', async () => {
    (prisma.legalReference.findMany as jest.Mock).mockResolvedValue([
      {
        articleId: null,
        source: '民法典',
        articleNumber: '667',
      },
    ]);

    (prisma.lawArticle.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'article-667' }])
      .mockResolvedValueOnce([
        {
          id: 'article-667',
          lawName: '民法典',
          articleNumber: '667',
          status: 'VALID',
          effectiveDate: new Date('2021-01-01'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'article-667',
          lawName: '民法典',
          articleNumber: '667',
          category: 'CIVIL',
        },
      ]);

    (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

    const result = await CaseKnowledgeGraphAnalyzer.analyze('case-1');

    expect(result.hasData).toBe(true);
    expect(result.articleIds).toEqual(['article-667']);
    expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              lawName: { contains: '民法典', mode: 'insensitive' },
              articleNumber: '667',
            },
          ],
        },
      })
    );
  });
});
