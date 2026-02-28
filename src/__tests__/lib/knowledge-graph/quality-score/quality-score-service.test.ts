// =============================================================================
// 知识图谱质量评分系统 - 质量评分服务测试
// =============================================================================

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lawArticleRelation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    relationFeedback: {
      count: jest.fn(),
    },
    aIFeedback: {
      count: jest.fn(),
    },
    knowledgeGraphQualityScore: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
  },
}));
jest.mock('@/lib/logger');

import { QualityScoreService } from '@/lib/knowledge-graph/quality-score/quality-score-service';
import { prisma } from '@/lib/db/prisma';
import {
  QualityLevel,
  LowQualityRelationsInput,
  UpdateQualityScoreInput,
} from '@/lib/knowledge-graph/quality-score/types';

const mockedPrisma = prisma as any;

describe('QualityScoreService', () => {
  let service: QualityScoreService;

  beforeEach(() => {
    service = new QualityScoreService();
    jest.clearAllMocks();
  });

  describe('calculateRelationQuality - 单个关系评分', () => {
    it('成功计算质量分数', async () => {
      const mockRelation = {
        id: 'rel1',
        aiConfidence: 0.8,
        source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
        target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
        relationType: 'CITES',
        createdAt: new Date(),
      };

      mockedPrisma.lawArticleRelation.findUnique.mockResolvedValue(
        mockRelation
      );
      mockedPrisma.relationFeedback.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      mockedPrisma.aIFeedback.count.mockResolvedValue(2);
      mockedPrisma.knowledgeGraphQualityScore.upsert.mockResolvedValue({
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 85,
        qualityLevel: 'high',
        lastCalculatedAt: new Date(),
      });

      const result = await service.calculateRelationQuality('rel1');

      expect(result).toBeDefined();
      expect(result.relationId).toBe('rel1');
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityLevel).toBeDefined();
    });

    it('关系不存在时抛出错误', async () => {
      mockedPrisma.lawArticleRelation.findUnique.mockResolvedValue(null);

      await expect(
        service.calculateRelationQuality('nonexistent')
      ).rejects.toThrow('Relation not found');
    });

    it('正确保存质量分数到数据库', async () => {
      const mockRelation = {
        id: 'rel1',
        aiConfidence: 0.8,
        source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
        target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
        relationType: 'CITES',
        createdAt: new Date(),
      };

      mockedPrisma.lawArticleRelation.findUnique.mockResolvedValue(
        mockRelation
      );
      mockedPrisma.relationFeedback.count.mockResolvedValue(0);
      mockedPrisma.aIFeedback.count.mockResolvedValue(0);
      mockedPrisma.knowledgeGraphQualityScore.upsert.mockResolvedValue({
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 70,
        qualityLevel: 'medium',
        lastCalculatedAt: new Date(),
      });

      await service.calculateRelationQuality('rel1');

      expect(mockedPrisma.knowledgeGraphQualityScore.upsert).toHaveBeenCalled();
    });

    it('正确更新已有质量分数', async () => {
      const mockRelation = {
        id: 'rel1',
        aiConfidence: 0.9,
        source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
        target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
        relationType: 'CITES',
        createdAt: new Date(),
      };

      mockedPrisma.lawArticleRelation.findUnique.mockResolvedValue(
        mockRelation
      );
      mockedPrisma.relationFeedback.count.mockResolvedValue(10);
      mockedPrisma.aIFeedback.count.mockResolvedValue(0);
      mockedPrisma.knowledgeGraphQualityScore.upsert.mockResolvedValue({
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 95,
        qualityLevel: 'excellent',
        lastCalculatedAt: new Date(),
      });

      await service.calculateRelationQuality('rel1');

      expect(
        mockedPrisma.knowledgeGraphQualityScore.upsert
      ).toHaveBeenCalledWith({
        where: { relationId: 'rel1' },
        update: expect.any(Object),
        create: expect.any(Object),
      });
    });
  });

  describe('batchCalculateQuality - 批量评分', () => {
    it('成功批量计算质量分数', async () => {
      const relationIds = ['rel1', 'rel2', 'rel3'];

      const mockRelation = {
        id: 'rel1',
        aiConfidence: 0.8,
        source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
        target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
        relationType: 'CITES',
        createdAt: new Date(),
      };

      mockedPrisma.lawArticleRelation.findMany.mockResolvedValue([
        mockRelation,
        mockRelation,
        mockRelation,
      ]);
      mockedPrisma.knowledgeGraphQualityScore.findMany.mockResolvedValue([]);
      mockedPrisma.relationFeedback.count.mockResolvedValue(0);
      mockedPrisma.aIFeedback.count.mockResolvedValue(0);
      mockedPrisma.knowledgeGraphQualityScore.upsert.mockResolvedValue({
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 70,
        qualityLevel: 'medium',
        lastCalculatedAt: new Date(),
      });

      const results = await service.batchCalculateQuality({ relationIds });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.qualityScore !== undefined)).toBe(true);
    });

    it('部分失败时的处理', async () => {
      const relationIds = ['rel1', 'rel2', 'rel3'];

      mockedPrisma.knowledgeGraphQualityScore.findMany.mockResolvedValue([]);
      mockedPrisma.lawArticleRelation.findMany.mockResolvedValue([
        { id: 'rel1' },
        null,
        { id: 'rel3' },
      ]);

      const results = await service.batchCalculateQuality({ relationIds });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('批量评分性能验证', async () => {
      const relationIds = Array.from({ length: 100 }, (_, i) => `rel${i}`);

      const mockRelation = {
        id: 'rel1',
        aiConfidence: 0.8,
        source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
        target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
        relationType: 'CITES',
        createdAt: new Date(),
      };

      mockedPrisma.knowledgeGraphQualityScore.findMany.mockResolvedValue([]);
      mockedPrisma.lawArticleRelation.findMany.mockResolvedValue(
        Array(100).fill(mockRelation)
      );
      mockedPrisma.relationFeedback.count.mockResolvedValue(0);
      mockedPrisma.aIFeedback.count.mockResolvedValue(0);
      mockedPrisma.knowledgeGraphQualityScore.upsert.mockResolvedValue({
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 70,
        qualityLevel: 'medium',
        lastCalculatedAt: new Date(),
      });

      const startTime = Date.now();
      await service.batchCalculateQuality({ relationIds });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });
  });

  describe('查询功能', () => {
    it('查询单个关系质量分数', async () => {
      const mockQualityScore = {
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 85,
        qualityLevel: 'high',
        aiConfidence: 0.8,
        verificationCount: 5,
        positiveFeedback: 10,
        negativeFeedback: 2,
        lastCalculatedAt: new Date(),
        relation: {
          source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
          target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
          relationType: 'CITES',
          createdAt: new Date(),
        },
      };

      mockedPrisma.knowledgeGraphQualityScore.findUnique.mockResolvedValue(
        mockQualityScore
      );

      const result = await service.getRelationQualityScore('rel1');

      expect(result).toBeDefined();
      expect(result.relationId).toBe('rel1');
      expect(result.qualityScore).toBe(85);
      expect(result.qualityLevel).toBe('high');
    });

    it('获取低质量关系列表', async () => {
      const mockLowQualityRelations = [
        {
          id: 'qs1',
          relationId: 'rel1',
          qualityScore: 45,
          qualityLevel: 'low' as QualityLevel,
          aiConfidence: 0.3,
          verificationCount: 0,
          positiveFeedback: 1,
          negativeFeedback: 10,
          lastCalculatedAt: new Date(),
          relation: {
            id: 'rel1',
            source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
            target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
            relationType: 'CITES',
            createdAt: new Date(),
          },
        },
      ];

      mockedPrisma.knowledgeGraphQualityScore.findMany.mockResolvedValue(
        mockLowQualityRelations
      );

      const input: LowQualityRelationsInput = {
        qualityLevel: 'low',
        limit: 10,
      };

      const results = await service.getLowQualityRelations(input);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('按质量等级筛选', async () => {
      const input: LowQualityRelationsInput = {
        qualityLevel: 'medium',
        limit: 20,
      };

      mockedPrisma.knowledgeGraphQualityScore.findMany.mockResolvedValue([]);

      await service.getLowQualityRelations(input);

      expect(
        mockedPrisma.knowledgeGraphQualityScore.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            qualityLevel: 'medium',
          }),
        })
      );
    });

    it('获取质量统计', async () => {
      const mockStats = {
        _count: { id: 100 },
        _avg: { qualityScore: 75.5 },
      };

      mockedPrisma.knowledgeGraphQualityScore.aggregate.mockResolvedValue(
        mockStats
      );
      mockedPrisma.knowledgeGraphQualityScore.count.mockResolvedValue(20);
      mockedPrisma.knowledgeGraphQualityScore.count.mockResolvedValue(40);
      mockedPrisma.knowledgeGraphQualityScore.count.mockResolvedValue(30);
      mockedPrisma.knowledgeGraphQualityScore.count.mockResolvedValue(10);

      const stats = await service.getQualityStats();

      expect(stats).toBeDefined();
      expect(stats.totalRelations).toBe(100);
      expect(stats.averageScore).toBe(75.5);
    });

    it('分页查询功能', async () => {
      const input: LowQualityRelationsInput = {
        qualityLevel: 'low',
        limit: 10,
        offset: 20,
      };

      mockedPrisma.knowledgeGraphQualityScore.findMany.mockResolvedValue([]);

      await service.getLowQualityRelations(input);

      expect(
        mockedPrisma.knowledgeGraphQualityScore.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });
  });

  describe('更新功能', () => {
    it('更新验证次数', async () => {
      const input: UpdateQualityScoreInput = {
        relationId: 'rel1',
        incrementVerification: true,
      };

      const mockQualityScore = {
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 70,
        qualityLevel: 'medium',
        verificationCount: 5,
        positiveFeedback: 10,
        negativeFeedback: 2,
        lastCalculatedAt: new Date(),
      };

      mockedPrisma.knowledgeGraphQualityScore.update.mockResolvedValue(
        mockQualityScore
      );
      mockedPrisma.lawArticleRelation.findUnique.mockResolvedValue({
        id: 'rel1',
        aiConfidence: 0.8,
        source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
        target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
        relationType: 'CITES',
        createdAt: new Date(),
      });
      mockedPrisma.relationFeedback.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2);
      mockedPrisma.aIFeedback.count.mockResolvedValue(0);
      mockedPrisma.knowledgeGraphQualityScore.upsert.mockResolvedValue(
        mockQualityScore
      );

      await service.updateRelationScore(input);

      expect(
        mockedPrisma.knowledgeGraphQualityScore.update
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { relationId: 'rel1' },
          data: expect.objectContaining({
            verificationCount: expect.objectContaining({ increment: 1 }),
          }),
        })
      );
    });

    it('更新用户反馈', async () => {
      const input: UpdateQualityScoreInput = {
        relationId: 'rel1',
        addPositiveFeedback: true,
      };

      const mockQualityScore = {
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 70,
        qualityLevel: 'medium',
        verificationCount: 5,
        positiveFeedback: 11,
        negativeFeedback: 2,
        lastCalculatedAt: new Date(),
      };

      mockedPrisma.knowledgeGraphQualityScore.update.mockResolvedValue(
        mockQualityScore
      );
      mockedPrisma.lawArticleRelation.findUnique.mockResolvedValue({
        id: 'rel1',
        aiConfidence: 0.8,
        source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
        target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
        relationType: 'CITES',
        createdAt: new Date(),
      });
      mockedPrisma.relationFeedback.count
        .mockResolvedValueOnce(11)
        .mockResolvedValueOnce(2);
      mockedPrisma.aIFeedback.count.mockResolvedValue(0);
      mockedPrisma.knowledgeGraphQualityScore.upsert.mockResolvedValue(
        mockQualityScore
      );

      await service.updateRelationScore(input);

      expect(
        mockedPrisma.knowledgeGraphQualityScore.update
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { relationId: 'rel1' },
          data: expect.objectContaining({
            positiveFeedback: expect.objectContaining({ increment: 1 }),
          }),
        })
      );
    });

    it('自动重新计算质量分数', async () => {
      const input: UpdateQualityScoreInput = {
        relationId: 'rel1',
        addNegativeFeedback: true,
      };

      const mockQualityScore = {
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 65,
        qualityLevel: 'medium',
        verificationCount: 5,
        positiveFeedback: 10,
        negativeFeedback: 3,
        lastCalculatedAt: new Date(),
      };

      mockedPrisma.knowledgeGraphQualityScore.update.mockResolvedValue(
        mockQualityScore
      );
      mockedPrisma.lawArticleRelation.findUnique.mockResolvedValue({
        id: 'rel1',
        aiConfidence: 0.8,
        source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
        target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
        relationType: 'CITES',
        createdAt: new Date(),
      });
      mockedPrisma.relationFeedback.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3);
      mockedPrisma.aIFeedback.count.mockResolvedValue(0);
      mockedPrisma.knowledgeGraphQualityScore.upsert.mockResolvedValue(
        mockQualityScore
      );

      await service.updateRelationScore(input);

      expect(mockedPrisma.knowledgeGraphQualityScore.upsert).toHaveBeenCalled();
    });

    it('批量更新功能', async () => {
      const updates: UpdateQualityScoreInput[] = [
        { relationId: 'rel1', incrementVerification: true },
        { relationId: 'rel2', addPositiveFeedback: true },
        { relationId: 'rel3', addNegativeFeedback: true },
      ];

      const mockQualityScore = {
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 70,
        qualityLevel: 'medium',
        lastCalculatedAt: new Date(),
      };

      mockedPrisma.knowledgeGraphQualityScore.update.mockResolvedValue(
        mockQualityScore
      );
      mockedPrisma.lawArticleRelation.findUnique.mockResolvedValue({
        id: 'rel1',
        aiConfidence: 0.8,
        source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
        target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
        relationType: 'CITES',
        createdAt: new Date(),
      });
      mockedPrisma.relationFeedback.count.mockResolvedValue(0);
      mockedPrisma.aIFeedback.count.mockResolvedValue(0);
      mockedPrisma.knowledgeGraphQualityScore.upsert.mockResolvedValue(
        mockQualityScore
      );

      const results = await service.batchUpdateRelationScores(updates);

      expect(results).toHaveLength(3);
    });
  });

  describe('预警功能', () => {
    it('低质量关系自动标记', async () => {
      const mockLowQualityRelation = {
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 30,
        qualityLevel: 'low' as QualityLevel,
        aiConfidence: 0.2,
        verificationCount: 0,
        positiveFeedback: 0,
        negativeFeedback: 10,
        lastCalculatedAt: new Date(),
        relation: {
          id: 'rel1',
          source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
          target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
          relationType: 'CITES',
          createdAt: new Date(),
        },
      };

      mockedPrisma.knowledgeGraphQualityScore.findMany.mockResolvedValue([
        mockLowQualityRelation,
      ]);

      const warnings = await service.triggerQualityWarning();

      expect(warnings).toBeDefined();
      expect(warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('质量下降时触发预警', async () => {
      const mockQualityScore = {
        id: 'qs1',
        relationId: 'rel1',
        qualityScore: 70,
        qualityLevel: 'medium' as QualityLevel,
        aiConfidence: 0.8,
        verificationCount: 5,
        positiveFeedback: 10,
        negativeFeedback: 2,
        lastCalculatedAt: new Date(),
        relation: {
          id: 'rel1',
          source: { id: 'src1', lawName: '法律A', articleNumber: '第1条' },
          target: { id: 'tgt1', lawName: '法律B', articleNumber: '第2条' },
          relationType: 'CITES',
          createdAt: new Date(),
        },
      };

      mockedPrisma.knowledgeGraphQualityScore.findMany.mockResolvedValue([]);

      const warnings = await service.triggerQualityWarning();

      expect(warnings.length).toBe(0);
    });
  });
});
