/**
 * 高级过滤API测试
 * 测试法条关系的高级过滤功能
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/law-article-relations/advanced-filter/route';

// Override global prisma mock with specific implementations needed by the route
jest.mock('@/lib/db/prisma', () => {
  const mockLawArticleRelation = {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  const mock = {
    lawArticleRelation: mockLawArticleRelation,
    lawArticle: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return { default: mock, prisma: mock };
});

// Sample relation data used by tests
const makeRelation = (overrides: Record<string, unknown> = {}) => ({
  id: 'rel-1',
  sourceId: 'art-1',
  targetId: 'art-2',
  relationType: 'CITES',
  strength: 0.95,
  confidence: 0.98,
  discoveryMethod: 'RULE_BASED',
  verificationStatus: 'VERIFIED',
  verifiedBy: 'admin-user',
  verifiedAt: new Date('2024-01-15'),
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
  source: {
    id: 'art-1',
    lawName: '高级过滤测试法1',
    articleNumber: '1',
    fullText: '内容1',
  },
  target: {
    id: 'art-2',
    lawName: '高级过滤测试法2',
    articleNumber: '2',
    fullText: '内容2',
  },
  ...overrides,
});

const getPrisma = () => {
  const { prisma } = require('@/lib/db/prisma');
  return prisma;
};

describe('高级过滤API测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks: return 5 relations covering all types/methods/statuses
    const sampleRelations = [
      makeRelation({
        id: 'rel-1',
        relationType: 'CITES',
        strength: 0.95,
        confidence: 0.98,
        discoveryMethod: 'RULE_BASED',
        verificationStatus: 'VERIFIED',
        createdAt: new Date('2024-01-15'),
      }),
      makeRelation({
        id: 'rel-2',
        relationType: 'COMPLETES',
        strength: 0.75,
        confidence: 0.8,
        discoveryMethod: 'AI_DETECTED',
        verificationStatus: 'PENDING',
        createdAt: new Date('2024-01-16'),
      }),
      makeRelation({
        id: 'rel-3',
        relationType: 'CONFLICTS',
        strength: 0.6,
        confidence: 0.65,
        discoveryMethod: 'CASE_DERIVED',
        verificationStatus: 'REJECTED',
        createdAt: new Date('2024-01-20'),
      }),
      makeRelation({
        id: 'rel-4',
        relationType: 'RELATED',
        strength: 0.85,
        confidence: 0.9,
        discoveryMethod: 'MANUAL',
        verificationStatus: 'VERIFIED',
        createdAt: new Date('2024-02-01'),
      }),
      makeRelation({
        id: 'rel-5',
        relationType: 'SUPERSEDES',
        strength: 0.7,
        confidence: 0.75,
        discoveryMethod: 'AI_DETECTED',
        verificationStatus: 'PENDING',
        createdAt: new Date('2024-02-10'),
      }),
    ];

    getPrisma().lawArticleRelation.count.mockResolvedValue(5);
    getPrisma().lawArticleRelation.findMany.mockResolvedValue(sampleRelations);
  });

  describe('按关系类型过滤', () => {
    it('应该按单个关系类型过滤', async () => {
      const citesRelations = [
        makeRelation({ id: 'rel-1', relationType: 'CITES' }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(1);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(citesRelations);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?relationType=CITES',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relations.length).toBeGreaterThan(0);
      data.data.relations.forEach((relation: { relationType: string }) => {
        expect(relation.relationType).toBe('CITES');
      });
    });

    it('应该按多个关系类型过滤', async () => {
      const filteredRelations = [
        makeRelation({ id: 'rel-1', relationType: 'CITES' }),
        makeRelation({ id: 'rel-2', relationType: 'COMPLETES' }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(2);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(
        filteredRelations
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?relationType=CITES,COMPLETES',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { relationType: string }) => {
        expect(['CITES', 'COMPLETES']).toContain(relation.relationType);
      });
    });
  });

  describe('按发现方式过滤', () => {
    it('应该按发现方式过滤', async () => {
      const aiRelations = [
        makeRelation({
          id: 'rel-2',
          discoveryMethod: 'AI_DETECTED',
          relationType: 'COMPLETES',
        }),
        makeRelation({
          id: 'rel-5',
          discoveryMethod: 'AI_DETECTED',
          relationType: 'SUPERSEDES',
        }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(2);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(aiRelations);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?discoveryMethod=AI_DETECTED',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { discoveryMethod: string }) => {
        expect(relation.discoveryMethod).toBe('AI_DETECTED');
      });
    });
  });

  describe('按置信度范围过滤', () => {
    it('应该按最小置信度过滤', async () => {
      const highConfidenceRelations = [
        makeRelation({ id: 'rel-1', confidence: 0.98 }),
        makeRelation({ id: 'rel-4', confidence: 0.9 }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(2);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(
        highConfidenceRelations
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minConfidence=0.85',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { confidence: number }) => {
        expect(relation.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });

    it('应该按最大置信度过滤', async () => {
      const lowConfidenceRelations = [
        makeRelation({ id: 'rel-3', confidence: 0.65 }),
        makeRelation({ id: 'rel-2', confidence: 0.8 }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(2);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(
        lowConfidenceRelations
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?maxConfidence=0.80',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { confidence: number }) => {
        expect(relation.confidence).toBeLessThanOrEqual(0.8);
      });
    });

    it('应该按置信度范围过滤', async () => {
      const rangeRelations = [
        makeRelation({ id: 'rel-2', confidence: 0.8 }),
        makeRelation({ id: 'rel-5', confidence: 0.75 }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(2);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(rangeRelations);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minConfidence=0.70&maxConfidence=0.90',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { confidence: number }) => {
        expect(relation.confidence).toBeGreaterThanOrEqual(0.7);
        expect(relation.confidence).toBeLessThanOrEqual(0.9);
      });
    });
  });

  describe('按强度范围过滤', () => {
    it('应该按最小强度过滤', async () => {
      const highStrengthRelations = [
        makeRelation({ id: 'rel-1', strength: 0.95 }),
        makeRelation({ id: 'rel-4', strength: 0.85 }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(2);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(
        highStrengthRelations
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minStrength=0.80',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { strength: number }) => {
        expect(relation.strength).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('应该按强度范围过滤', async () => {
      const rangeRelations = [
        makeRelation({ id: 'rel-3', strength: 0.6 }),
        makeRelation({ id: 'rel-5', strength: 0.7 }),
        makeRelation({ id: 'rel-4', strength: 0.85 }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(3);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(rangeRelations);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minStrength=0.60&maxStrength=0.85',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { strength: number }) => {
        expect(relation.strength).toBeGreaterThanOrEqual(0.6);
        expect(relation.strength).toBeLessThanOrEqual(0.85);
      });
    });
  });

  describe('按审核状态过滤', () => {
    it('应该按审核状态过滤', async () => {
      const verifiedRelations = [
        makeRelation({ id: 'rel-1', verificationStatus: 'VERIFIED' }),
        makeRelation({ id: 'rel-4', verificationStatus: 'VERIFIED' }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(2);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(
        verifiedRelations
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?verificationStatus=VERIFIED',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach(
        (relation: { verificationStatus: string }) => {
          expect(relation.verificationStatus).toBe('VERIFIED');
        }
      );
    });
  });

  describe('按法条名称搜索', () => {
    it('应该按源法条名称搜索', async () => {
      const sourceNameRelations = [
        makeRelation({
          id: 'rel-1',
          source: {
            id: 'art-1',
            lawName: '高级过滤测试法1',
            articleNumber: '1',
            fullText: '内容',
          },
        }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(1);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(
        sourceNameRelations
      );

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/advanced-filter?sourceLawName=${encodeURIComponent('高级过滤测试法1')}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relations.length).toBeGreaterThan(0);
    });

    it('应该按目标法条名称搜索', async () => {
      const targetNameRelations = [
        makeRelation({
          id: 'rel-1',
          target: {
            id: 'art-2',
            lawName: '高级过滤测试法2',
            articleNumber: '2',
            fullText: '内容',
          },
        }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(1);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(
        targetNameRelations
      );

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/advanced-filter?targetLawName=${encodeURIComponent('高级过滤测试法2')}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relations.length).toBeGreaterThan(0);
    });
  });

  describe('按时间范围过滤', () => {
    it('应该按创建时间范围过滤', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/advanced-filter?startDate=${startDate}&endDate=${endDate}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('组合过滤', () => {
    it('应该支持多个条件组合过滤', async () => {
      const combinedRelations = [
        makeRelation({
          id: 'rel-1',
          relationType: 'CITES',
          confidence: 0.98,
          verificationStatus: 'VERIFIED',
        }),
        makeRelation({
          id: 'rel-4',
          relationType: 'RELATED',
          confidence: 0.9,
          verificationStatus: 'VERIFIED',
        }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(2);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(
        combinedRelations
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?relationType=CITES,RELATED&minConfidence=0.85&verificationStatus=VERIFIED',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach(
        (relation: {
          relationType: string;
          confidence: number;
          verificationStatus: string;
        }) => {
          expect(['CITES', 'RELATED']).toContain(relation.relationType);
          expect(relation.confidence).toBeGreaterThanOrEqual(0.85);
          expect(relation.verificationStatus).toBe('VERIFIED');
        }
      );
    });
  });

  describe('分页和排序', () => {
    it('应该支持分页', async () => {
      const pagedRelations = [
        makeRelation({ id: 'rel-1' }),
        makeRelation({ id: 'rel-2' }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(5);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(pagedRelations);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?page=1&pageSize=2',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relations.length).toBeLessThanOrEqual(2);
      expect(data.data.pagination).toBeDefined();
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.pageSize).toBe(2);
    });

    it('应该支持按置信度排序', async () => {
      const sortedRelations = [
        makeRelation({ id: 'rel-1', confidence: 0.98 }),
        makeRelation({ id: 'rel-4', confidence: 0.9 }),
        makeRelation({ id: 'rel-2', confidence: 0.8 }),
        makeRelation({ id: 'rel-5', confidence: 0.75 }),
        makeRelation({ id: 'rel-3', confidence: 0.65 }),
      ];
      getPrisma().lawArticleRelation.count.mockResolvedValue(5);
      getPrisma().lawArticleRelation.findMany.mockResolvedValue(
        sortedRelations
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?sortBy=confidence&sortOrder=desc',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证排序
      const confidences = data.data.relations.map(
        (r: { confidence: number }) => r.confidence
      );
      for (let i = 1; i < confidences.length; i++) {
        expect(confidences[i - 1]).toBeGreaterThanOrEqual(confidences[i]);
      }
    });

    it('应该支持按创建时间排序', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?sortBy=createdAt&sortOrder=asc',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('参数验证', () => {
    it('应该验证置信度范围', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minConfidence=1.5',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('置信度');
    });

    it('应该验证强度范围', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minStrength=-0.1',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('强度');
    });

    it('应该验证分页参数', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?page=0',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('页码');
    });

    it('应该限制每页最大数量', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?pageSize=200',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('每页');
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成复杂查询', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?relationType=CITES,COMPLETES,RELATED&minConfidence=0.60&maxConfidence=1.0&minStrength=0.50&maxStrength=1.0&verificationStatus=VERIFIED,PENDING&sortBy=confidence&sortOrder=desc&page=1&pageSize=20',
        { method: 'GET' }
      );

      const startTime = Date.now();
      const response = await GET(request);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      // 复杂查询应该在2秒内完成
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });
});
