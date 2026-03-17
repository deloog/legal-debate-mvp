import { POST, OPTIONS } from '@/app/api/v1/legal-analysis/applicability/route';
import {
  createMockRequest,
  createTestResponse,
  assertions,
} from './test-utils';

/**
 * 法条适用性分析 API 单元测试
 */

// Mock ApplicabilityAnalyzer
const mockAnalyze = jest.fn();
const mockInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/law-article/applicability/applicability-analyzer', () => ({
  ApplicabilityAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: mockAnalyze,
    initialize: mockInitialize,
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock JWT auth
jest.mock('@/lib/auth/jwt', () => ({
  extractTokenFromHeader: jest.fn((header: string) =>
    header?.startsWith('Bearer ') ? header.slice(7) : null
  ),
  verifyToken: jest.fn((token: string) => {
    if (token === 'valid-token') {
      return { valid: true, payload: { userId: 'user-1' } };
    }
    return { valid: false };
  }),
}));

import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';

// Mock prisma
const mockLegalReferenceUpsert = jest.fn();
const mockCaseFindUnique = jest.fn();
const mockLawArticleFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    legalReference: {
      upsert: jest
        .fn()
        .mockImplementation(options => mockLegalReferenceUpsert(options)),
    },
    case: {
      findUnique: jest.fn().mockImplementation(() => mockCaseFindUnique()),
    },
    lawArticle: {
      findMany: jest.fn().mockImplementation(() => mockLawArticleFindMany()),
    },
  },
}));

// ─── 公共 mock 数据 ────────────────────────────────────────────────────────

const mockCaseWithDocs = {
  id: 'case-1',
  documents: [
    {
      analysisStatus: 'COMPLETED',
      analysisResult: {
        extractedData: {
          caseType: 'civil',
          parties: [{ type: 'plaintiff', name: '张三' }],
          claims: [{ content: '赔偿损失' }],
          keyFacts: [{ description: '违约事实' }],
          disputeFocuses: [{ coreIssue: '违约认定' }],
          timeline: [],
          summary: '合同违约纠纷',
        },
      },
    },
  ],
};

const mockArticles = [
  {
    id: 'article-1',
    articleNumber: '第一百零七条',
    lawName: '合同法',
    fullText: '当事人一方不履行合同义务...',
    lawType: 'LAW',
    category: 'CIVIL',
  },
  {
    id: 'article-2',
    articleNumber: '第一百零八条',
    lawName: '合同法',
    fullText: '当事人应当承担违约责任...',
    lawType: 'LAW',
    category: 'CIVIL',
  },
];

const mockAnalyzeResult = {
  analyzedAt: new Date(),
  totalArticles: 2,
  applicableArticles: 2,
  notApplicableArticles: 0,
  results: [
    {
      articleId: 'article-1',
      articleNumber: '第一百零七条',
      lawName: '合同法',
      applicable: true,
      score: 0.85,
      semanticScore: 0.85,
      ruleScore: 1.0,
      reasons: ['法条与案情直接相关'],
      warnings: [],
      ruleValidation: { passed: true, warnings: [] },
    },
    {
      articleId: 'article-2',
      articleNumber: '第一百零八条',
      lawName: '合同法',
      applicable: true,
      score: 0.72,
      semanticScore: 0.72,
      ruleScore: 1.0,
      reasons: ['法条部分相关'],
      warnings: [],
      ruleValidation: { passed: true, warnings: [] },
    },
  ],
  statistics: {
    averageScore: 0.785,
    maxScore: 0.85,
    minScore: 0.72,
    executionTime: 100,
    semanticMatchingTime: 80,
    ruleValidationTime: 5,
    aiReviewTime: 0,
    applicableRatio: 1,
    byType: { LAW: 2 },
    byCategory: { CIVIL: 2 },
  },
  config: {
    useAI: true,
    useRuleValidation: true,
    useAIReview: true,
    minApplicabilityScore: 0.5,
    minSemanticRelevance: 0.3,
    concurrency: 5,
    parallel: true,
    useCache: false,
    minExclusionScore: 0.1,
    aiLowConfidenceThreshold: 0.3,
    defaultApplicabilityThreshold: 0.2,
  },
};

const authHeader = { authorization: 'Bearer valid-token' };

describe('法条适用性分析API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLegalReferenceUpsert.mockResolvedValue({ id: 'ref-1' });

    // Re-setup JWT mocks after clearAllMocks (clearAllMocks also clears implementations)
    (extractTokenFromHeader as jest.Mock).mockImplementation(
      (header: string) =>
        header?.startsWith('Bearer ') ? header.slice(7) : null
    );
    (verifyToken as jest.Mock).mockImplementation((token: string) => {
      if (token === 'valid-token') {
        return { valid: true, payload: { userId: 'user-1' } };
      }
      return { valid: false };
    });
  });

  describe('POST /api/v1/legal-analysis/applicability', () => {
    it('应该成功返回法条适用性分析结果', async () => {
      mockCaseFindUnique.mockResolvedValue(mockCaseWithDocs);
      mockLawArticleFindMany.mockResolvedValue(mockArticles);
      mockAnalyze.mockResolvedValue(mockAnalyzeResult);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          headers: authHeader,
          body: { caseId: 'case-1', articleIds: ['article-1', 'article-2'] },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.results).toHaveLength(2);
      expect(testResponse.data.totalArticles).toBe(2);
      expect(testResponse.data.applicableArticles).toBe(2);
      expect(testResponse.data.results[0].applicable).toBe(true);
      expect(mockAnalyze).toHaveBeenCalled();
    });

    it('应该在未提供 Token 时返回 401', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          body: { caseId: 'case-1', articleIds: ['article-1'] },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(response.status).toBe(401);
      expect(testResponse.error?.code).toBe('UNAUTHORIZED');
    });

    it('应该在提供无效 Token 时返回 401', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer invalid-token' },
          body: { caseId: 'case-1', articleIds: ['article-1'] },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(response.status).toBe(401);
    });

    it('应该在缺少 caseId 时返回 400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          headers: authHeader,
          body: { articleIds: ['article-1'] },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error?.code).toBe('INVALID_PARAMS');
    });

    it('应该在 articleIds 为空时返回 400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          headers: authHeader,
          body: { caseId: 'case-1', articleIds: [] },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error?.code).toBe('INVALID_PARAMS');
    });

    it('应该在 articleIds 不是数组时返回 400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          headers: authHeader,
          body: { caseId: 'case-1', articleIds: 'invalid' },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error?.code).toBe('INVALID_PARAMS');
    });

    it('应该在案件不存在时返回 404', async () => {
      mockCaseFindUnique.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          headers: authHeader,
          body: { caseId: 'non-existent', articleIds: ['article-1'] },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 404);
      expect(testResponse.error?.code).toBe('CASE_NOT_FOUND');
    });

    it('应该在所有法条都不存在时返回 404', async () => {
      mockCaseFindUnique.mockResolvedValue(mockCaseWithDocs);
      mockLawArticleFindMany.mockResolvedValue([]);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          headers: authHeader,
          body: { caseId: 'case-1', articleIds: ['article-1'] },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 404);
      expect(testResponse.error?.code).toBe('ARTICLES_NOT_FOUND');
    });

    it('应该使用正确的 (caseId, articleId) 复合键保存结果', async () => {
      mockCaseFindUnique.mockResolvedValue(mockCaseWithDocs);
      mockLawArticleFindMany.mockResolvedValue([mockArticles[0]]);
      mockAnalyze.mockResolvedValue({
        ...mockAnalyzeResult,
        totalArticles: 1,
        applicableArticles: 1,
        notApplicableArticles: 0,
        results: [mockAnalyzeResult.results[0]],
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          headers: authHeader,
          body: { caseId: 'case-1', articleIds: ['article-1'] },
        }
      );

      await POST(request);

      expect(mockLegalReferenceUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            caseId_articleId: { caseId: 'case-1', articleId: 'article-1' },
          },
          update: expect.objectContaining({
            applicabilityScore: 0.85,
            status: 'VALID',
          }),
          create: expect.objectContaining({
            caseId: 'case-1',
            articleId: 'article-1',
          }),
        })
      );
    });

    it('应该处理分析器抛出的错误', async () => {
      mockCaseFindUnique.mockResolvedValue(mockCaseWithDocs);
      mockLawArticleFindMany.mockResolvedValue(mockArticles);
      mockAnalyze.mockRejectedValue(new Error('Analysis failed'));

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          headers: authHeader,
          body: { caseId: 'case-1', articleIds: ['article-1'] },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 500);
      expect(testResponse.error?.code).toBeDefined();
    });

    it('应该包含分析统计信息和配置', async () => {
      mockCaseFindUnique.mockResolvedValue(mockCaseWithDocs);
      mockLawArticleFindMany.mockResolvedValue(mockArticles);
      mockAnalyze.mockResolvedValue(mockAnalyzeResult);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        {
          method: 'POST',
          headers: authHeader,
          body: { caseId: 'case-1', articleIds: ['article-1', 'article-2'] },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.statistics).toBeDefined();
      expect(testResponse.data.config).toBeDefined();
      expect(testResponse.data.applicableArticles).toBe(2);
      expect(testResponse.data.notApplicableArticles).toBe(0);
    });
  });

  describe('OPTIONS /api/v1/legal-analysis/applicability', () => {
    it('应该返回正确的 CORS 头部', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-analysis/applicability',
        { method: 'OPTIONS' }
      );

      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
        'POST'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
        'Authorization'
      );
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });
});
