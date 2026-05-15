import { prisma } from '@/lib/db/prisma';
import { syncDebateLegalReferences } from '@/lib/debate/legal-reference-sync-service';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lawArticle: {
      findMany: jest.fn(),
    },
    legalReference: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('syncDebateLegalReferences', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('应该把辩论 legalBasis 沉淀为案件 LegalReference，并写入 articleId', async () => {
    (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'article-667',
        lawName: '民法典',
        articleNumber: '667',
        fullText: '借款合同是借款人向贷款人借款...',
        lawType: 'CIVIL',
        category: 'CIVIL',
      },
    ]);
    (prisma.legalReference.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.legalReference.create as jest.Mock).mockResolvedValue({
      id: 'ref-1',
    });

    const result = await syncDebateLegalReferences('case-1', 'round-1', [
      {
        side: 'PLAINTIFF',
        legalBasis: [
          {
            lawName: '民法典',
            articleNumber: '667',
            relevance: 0.92,
            explanation: '借款合同关系基础',
          },
        ],
      },
    ]);

    expect(result).toEqual({ total: 1, created: 1, updated: 0 });
    expect(prisma.legalReference.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: 'case-1',
        articleId: 'article-667',
        source: '民法典',
        articleNumber: '667',
        content: '借款合同是借款人向贷款人借款...',
        applicabilityScore: 0.92,
        applicabilityReason: '借款合同关系基础',
        metadata: expect.objectContaining({
          roundId: 'round-1',
          aiGenerated: true,
          source: 'debate_legal_basis',
          sides: ['PLAINTIFF'],
        }),
      }),
    });
  });

  it('应该合并同一法条的双方引用并更新已有 LegalReference', async () => {
    (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'article-667',
        lawName: '民法典',
        articleNumber: '667',
        fullText: '借款合同是借款人向贷款人借款...',
        lawType: 'CIVIL',
        category: 'CIVIL',
      },
    ]);
    (prisma.legalReference.findFirst as jest.Mock).mockResolvedValue({
      id: 'ref-1',
      articleId: 'article-667',
      content: '旧内容',
      lawType: 'CIVIL',
      category: 'CIVIL',
      metadata: { lawyerFeedback: { action: 'CONFIRMED' } },
    });

    const result = await syncDebateLegalReferences('case-1', 'round-2', [
      {
        side: 'PLAINTIFF',
        legalBasis: [
          {
            lawName: '民法典',
            articleNumber: '667',
            relevance: 0.6,
            explanation: '原告引用',
          },
        ],
      },
      {
        side: 'DEFENDANT',
        legalBasis: [
          {
            lawName: '民法典',
            articleNumber: '667',
            relevance: 0.85,
            explanation: '被告也引用',
          },
        ],
      },
    ]);

    expect(result).toEqual({ total: 1, created: 0, updated: 1 });
    expect(prisma.legalReference.update).toHaveBeenCalledWith({
      where: { id: 'ref-1' },
      data: expect.objectContaining({
        articleId: 'article-667',
        applicabilityScore: 0.85,
        metadata: expect.objectContaining({
          lawyerFeedback: { action: 'CONFIRMED' },
          roundId: 'round-2',
          sides: ['PLAINTIFF', 'DEFENDANT'],
        }),
      }),
    });
    expect(prisma.legalReference.create).not.toHaveBeenCalled();
  });

  it('没有 legalBasis 时不写库', async () => {
    const result = await syncDebateLegalReferences('case-1', 'round-1', [
      { side: 'PLAINTIFF', legalBasis: [] },
    ]);

    expect(result).toEqual({ total: 0, created: 0, updated: 0 });
    expect(prisma.lawArticle.findMany).not.toHaveBeenCalled();
    expect(prisma.legalReference.create).not.toHaveBeenCalled();
  });
});
