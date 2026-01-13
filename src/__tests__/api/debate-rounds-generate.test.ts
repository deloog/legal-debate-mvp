import {
  POST,
  OPTIONS,
} from '@/app/api/v1/debate-rounds/[roundId]/generate/route';
import { createTestResponse, assertions } from './test-utils';

/**
 * 辩论论点生成API单元测试
 */

// Mock prisma
const mockDebateRoundFindUnique = jest.fn();
const mockDebateRoundUpdate = jest.fn();
const mockDebateRoundCreate = jest.fn();
const mockArgumentCount = jest.fn();
const mockArgumentCreateMany = jest.fn();
const mockDebateUpdate = jest.fn();
const mockLawArticleFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    debateRound: {
      findUnique: jest
        .fn()
        .mockImplementation(() => mockDebateRoundFindUnique()),
      update: jest.fn().mockImplementation(() => mockDebateRoundUpdate()),
      create: jest.fn().mockImplementation(() => mockDebateRoundCreate()),
    },
    argument: {
      count: jest.fn().mockImplementation(() => mockArgumentCount()),
      createMany: jest.fn().mockImplementation(() => mockArgumentCreateMany()),
    },
    debate: {
      update: jest.fn().mockImplementation(() => mockDebateUpdate()),
    },
    lawArticle: {
      findMany: jest.fn().mockImplementation(() => mockLawArticleFindMany()),
    },
  },
}));

describe('辩论论点生成API', () => {
  let mockReq: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      url: 'http://localhost:3000/api/v1/debate-rounds/round-1/generate',
      json: jest.fn(),
      headers: new Headers(),
    } as any;
  });

  describe('POST /api/v1/debate-rounds/[roundId]/generate', () => {
    it('应该成功生成双方论点', async () => {
      const body = {
        applicableArticles: ['article-1'],
      };
      mockReq.json = jest.fn().mockResolvedValue(body);

      mockDebateRoundFindUnique.mockResolvedValue({
        id: 'round-1',
        debateId: 'debate-1',
        roundNumber: 1,
        status: 'PENDING',
        arguments: [],
        debate: {
          id: 'debate-1',
          debateConfig: { maxRounds: 3 },
          case: {
            documents: [
              {
                analysisResult: {
                  extractedData: {
                    parties: [
                      { type: 'plaintiff', name: '张三' },
                      { type: 'defendant', name: '李四' },
                    ],
                    claims: [{ content: '赔偿损失' }],
                    keyFacts: [{ description: '违约事实' }],
                  },
                } as any,
              },
            ],
          },
        },
      });

      mockArgumentCount.mockResolvedValue(0);
      mockLawArticleFindMany.mockResolvedValue([
        {
          id: 'article-1',
          fullText: '当事人一方不履行合同义务...',
          lawName: '合同法',
          articleNumber: '第一百零七条',
        },
      ]);

      mockDebateRoundUpdate
        .mockResolvedValueOnce({ id: 'round-1', status: 'IN_PROGRESS' })
        .mockResolvedValueOnce({ id: 'round-1', status: 'COMPLETED' });

      mockArgumentCreateMany.mockResolvedValue({ count: 6 });
      mockDebateUpdate.mockResolvedValue({});

      const response = await POST(mockReq, {
        params: Promise.resolve({ roundId: 'round-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.roundId).toBe('round-1');
      expect(testResponse.data.roundNumber).toBe(1);
      expect(testResponse.data.plaintiff.arguments).toBeDefined();
      expect(testResponse.data.defendant.arguments).toBeDefined();
      expect(testResponse.data.generatedAt).toBeDefined();
    });

    it('应该在轮次不存在时返回错误', async () => {
      mockDebateRoundFindUnique.mockResolvedValue(null);

      const response = await POST(mockReq, {
        params: Promise.resolve({ roundId: 'non-existent-round' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertNotFound(testResponse);
      expect(testResponse.error?.code).toBe('ROUND_NOT_FOUND');
    });

    it('应该在论点已生成时返回错误', async () => {
      mockDebateRoundFindUnique.mockResolvedValue({
        id: 'round-1',
        debateId: 'debate-1',
        roundNumber: 1,
        status: 'PENDING',
        arguments: [],
        debate: {
          id: 'debate-1',
          debateConfig: { maxRounds: 3 },
          case: {
            documents: [
              {
                analysisResult: {
                  extractedData: {
                    parties: [],
                    claims: [],
                    keyFacts: [],
                  },
                } as any,
              },
            ],
          },
        },
      });

      mockArgumentCount.mockResolvedValue(5);

      const response = await POST(mockReq, {
        params: Promise.resolve({ roundId: 'round-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error?.code).toBe('ARGUMENTS_ALREADY_GENERATED');
    });

    it('应该更新轮次状态为进行中', async () => {
      mockDebateRoundFindUnique.mockResolvedValue({
        id: 'round-1',
        debateId: 'debate-1',
        roundNumber: 1,
        status: 'PENDING',
        arguments: [],
        debate: {
          id: 'debate-1',
          debateConfig: { maxRounds: 3 },
          case: {
            documents: [
              {
                analysisResult: {
                  extractedData: {
                    parties: [],
                    claims: [],
                    keyFacts: [],
                  },
                } as any,
              },
            ],
          },
        },
      });

      mockArgumentCount.mockResolvedValue(0);
      mockLawArticleFindMany.mockResolvedValue([]);
      mockDebateRoundUpdate.mockResolvedValue({});
      mockArgumentCreateMany.mockResolvedValue({ count: 0 });
      mockDebateUpdate.mockResolvedValue({});

      await POST(mockReq, {
        params: Promise.resolve({ roundId: 'round-1' }),
      });

      expect(mockDebateRoundUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'round-1' },
          data: expect.objectContaining({
            status: 'IN_PROGRESS',
          }),
        })
      );
    });

    it('应该生成法律依据论点', async () => {
      const body = { applicableArticles: ['article-1'] };
      mockReq.json = jest.fn().mockResolvedValue(body);

      mockDebateRoundFindUnique.mockResolvedValue({
        id: 'round-1',
        debateId: 'debate-1',
        roundNumber: 1,
        status: 'PENDING',
        arguments: [],
        debate: {
          id: 'debate-1',
          debateConfig: { maxRounds: 3 },
          case: {
            documents: [
              {
                analysisResult: {
                  extractedData: {
                    parties: [],
                    claims: [],
                    keyFacts: [],
                  },
                } as any,
              },
            ],
          },
        },
      });

      mockArgumentCount.mockResolvedValue(0);
      mockLawArticleFindMany.mockResolvedValue([
        {
          id: 'article-1',
          fullText: 'text',
          lawName: '合同法',
          articleNumber: '第一百零七条',
        },
      ]);

      mockDebateRoundUpdate.mockResolvedValue({});
      mockArgumentCreateMany.mockResolvedValue({ count: 0 });
      mockDebateUpdate.mockResolvedValue({});

      const response = await POST(mockReq, {
        params: Promise.resolve({ roundId: 'round-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(
        testResponse.data.plaintiff.arguments.some(
          (arg: { type: string }) => arg.type === 'LEGAL_BASIS'
        )
      ).toBe(true);
      expect(
        testResponse.data.defendant.arguments.some(
          (arg: { type: string }) => arg.type === 'LEGAL_BASIS'
        )
      ).toBe(true);
    });

    it('应该生成主要论点', async () => {
      mockDebateRoundFindUnique.mockResolvedValue({
        id: 'round-1',
        debateId: 'debate-1',
        roundNumber: 1,
        status: 'PENDING',
        arguments: [],
        debate: {
          id: 'debate-1',
          debateConfig: { maxRounds: 3 },
          case: {
            documents: [
              {
                analysisResult: {
                  extractedData: {
                    parties: [],
                    claims: [{ content: '赔偿损失' }],
                    keyFacts: [],
                  },
                } as any,
              },
            ],
          },
        },
      });

      mockArgumentCount.mockResolvedValue(0);
      mockLawArticleFindMany.mockResolvedValue([]);
      mockDebateRoundUpdate.mockResolvedValue({});
      mockArgumentCreateMany.mockResolvedValue({ count: 0 });
      mockDebateUpdate.mockResolvedValue({});

      const response = await POST(mockReq, {
        params: Promise.resolve({ roundId: 'round-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(
        testResponse.data.plaintiff.arguments.some(
          (arg: { type: string }) => arg.type === 'MAIN_POINT'
        )
      ).toBe(true);
    });

    it('应该生成支持论点', async () => {
      mockDebateRoundFindUnique.mockResolvedValue({
        id: 'round-1',
        debateId: 'debate-1',
        roundNumber: 1,
        status: 'PENDING',
        arguments: [],
        debate: {
          id: 'debate-1',
          debateConfig: { maxRounds: 3 },
          case: {
            documents: [
              {
                analysisResult: {
                  extractedData: {
                    parties: [],
                    claims: [],
                    keyFacts: [{ description: '违约事实' }],
                  },
                } as any,
              },
            ],
          },
        },
      });

      mockArgumentCount.mockResolvedValue(0);
      mockLawArticleFindMany.mockResolvedValue([]);
      mockDebateRoundUpdate.mockResolvedValue({});
      mockArgumentCreateMany.mockResolvedValue({ count: 0 });
      mockDebateUpdate.mockResolvedValue({});

      const response = await POST(mockReq, {
        params: Promise.resolve({ roundId: 'round-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(
        testResponse.data.plaintiff.arguments.some(
          (arg: { type: string }) => arg.type === 'SUPPORTING'
        )
      ).toBe(true);
    });

    it('应该保存论点到数据库', async () => {
      mockDebateRoundFindUnique.mockResolvedValue({
        id: 'round-1',
        debateId: 'debate-1',
        roundNumber: 1,
        status: 'PENDING',
        arguments: [],
        debate: {
          id: 'debate-1',
          debateConfig: { maxRounds: 3 },
          case: {
            documents: [
              {
                analysisResult: {
                  extractedData: {
                    parties: [],
                    claims: [],
                    keyFacts: [],
                  },
                } as any,
              },
            ],
          },
        },
      });

      mockArgumentCount.mockResolvedValue(0);
      mockLawArticleFindMany.mockResolvedValue([]);
      mockDebateRoundUpdate.mockResolvedValue({});
      mockArgumentCreateMany.mockResolvedValue({ count: 0 });
      mockDebateUpdate.mockResolvedValue({});

      await POST(mockReq, {
        params: Promise.resolve({ roundId: 'round-1' }),
      });

      expect(mockArgumentCreateMany).toHaveBeenCalled();
    });

    it('应该在最后一轮时更新辩论状态为已完成', async () => {
      mockDebateRoundFindUnique.mockResolvedValue({
        id: 'round-3',
        debateId: 'debate-1',
        roundNumber: 3,
        status: 'PENDING',
        arguments: [],
        debate: {
          id: 'debate-1',
          debateConfig: { maxRounds: 3 },
          case: {
            documents: [
              {
                analysisResult: {
                  extractedData: {
                    parties: [],
                    claims: [],
                    keyFacts: [],
                  },
                } as any,
              },
            ],
          },
        },
      });

      mockArgumentCount.mockResolvedValue(0);
      mockLawArticleFindMany.mockResolvedValue([]);
      mockDebateRoundUpdate.mockResolvedValue({});
      mockArgumentCreateMany.mockResolvedValue({ count: 0 });

      await POST(mockReq, {
        params: Promise.resolve({ roundId: 'round-3' }),
      });

      expect(mockDebateUpdate).toHaveBeenCalledWith({
        where: { id: 'debate-1' },
        data: { status: 'COMPLETED' },
      });
    });

    it('应该在未达到最大轮次时创建新轮次', async () => {
      mockDebateRoundFindUnique.mockResolvedValue({
        id: 'round-1',
        debateId: 'debate-1',
        roundNumber: 1,
        status: 'PENDING',
        arguments: [],
        debate: {
          id: 'debate-1',
          debateConfig: { maxRounds: 3 },
          case: {
            documents: [
              {
                analysisResult: {
                  extractedData: {
                    parties: [],
                    claims: [],
                    keyFacts: [],
                  },
                } as any,
              },
            ],
          },
        },
      });

      mockArgumentCount.mockResolvedValue(0);
      mockLawArticleFindMany.mockResolvedValue([]);
      mockDebateRoundUpdate.mockResolvedValue({});
      mockArgumentCreateMany.mockResolvedValue({ count: 0 });
      mockDebateRoundCreate.mockResolvedValue({});

      await POST(mockReq, {
        params: Promise.resolve({ roundId: 'round-1' }),
      });

      expect(mockDebateRoundCreate).toHaveBeenCalledWith({
        data: {
          debateId: 'debate-1',
          roundNumber: 2,
          status: 'PENDING',
        },
      });
    });

    it('应该返回包含论点引用', async () => {
      const body = { applicableArticles: ['article-1'] };
      mockReq.json = jest.fn().mockResolvedValue(body);

      mockDebateRoundFindUnique.mockResolvedValue({
        id: 'round-1',
        debateId: 'debate-1',
        roundNumber: 1,
        status: 'PENDING',
        arguments: [],
        debate: {
          id: 'debate-1',
          debateConfig: { maxRounds: 3 },
          case: {
            documents: [
              {
                analysisResult: {
                  extractedData: {
                    parties: [],
                    claims: [],
                    keyFacts: [],
                  },
                } as any,
              },
            ],
          },
        },
      });

      mockArgumentCount.mockResolvedValue(0);
      mockLawArticleFindMany.mockResolvedValue([
        {
          id: 'article-1',
          fullText: 'text',
          lawName: '合同法',
          articleNumber: '第一百零七条',
        },
      ]);

      mockDebateRoundUpdate.mockResolvedValue({});
      mockArgumentCreateMany.mockResolvedValue({ count: 0 });
      mockDebateUpdate.mockResolvedValue({});

      const response = await POST(mockReq, {
        params: Promise.resolve({ roundId: 'round-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      const legalArg = testResponse.data.plaintiff.arguments.find(
        (arg: { type: string }) => arg.type === 'LEGAL_BASIS'
      );
      expect(legalArg).toBeDefined();
      expect(legalArg.legalBasis).toBeDefined();
      expect(legalArg.legalBasis[0].articleId).toBe('article-1');
    });
  });

  describe('OPTIONS /api/v1/debate-rounds/[roundId]/generate', () => {
    it('应该返回正确的CORS头部', async () => {
      const response = await OPTIONS(mockReq);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type'
      );
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });
});
