/**
 * ExpertService 单元测试
 */

// Mock prisma before imports
jest.mock('@/lib/db/prisma', () => ({
  prisma: require('@/__tests__/__mocks__/prisma-shared').prisma,
}));

import { expertService } from '@/lib/knowledge-graph/expert/expert-service';
import { prisma as mockPrisma } from '@/__tests__/__mocks__/prisma-shared';

describe('ExpertService', () => {
  const mockUserId = 'user123';
  const mockExpertId = 'expert123';
  const mockUser = {
    id: mockUserId,
    name: '张三',
    email: 'zhangsan@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateExpertProfile', () => {
    it('应该返回已存在的专家档案', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法', '刑法'],
        expertLevel: 'SENIOR' as const,
        certifiedBy: 'admin123',
        certifiedAt: new Date('2024-01-01'),
        notes: '测试专家',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: mockUser,
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      const result = await expertService.getOrCreateExpertProfile(mockUserId);

      expect(result).toEqual({
        id: mockExpertId,
        userId: mockUserId,
        userName: '张三',
        userEmail: 'zhangsan@example.com',
        expertiseAreas: ['民法', '刑法'],
        expertLevel: 'SENIOR',
        certifiedBy: 'admin123',
        certifiedAt: expect.any(Date),
        notes: '测试专家',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(mockPrisma.knowledgeGraphExpert.create).not.toHaveBeenCalled();
    });

    it('应该创建新的专家档案', async () => {
      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeGraphExpert.create.mockResolvedValue({
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: [],
        expertLevel: 'JUNIOR' as const,
        certifiedBy: null,
        certifiedAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      });

      const result = await expertService.getOrCreateExpertProfile(mockUserId);

      expect(mockPrisma.knowledgeGraphExpert.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          expertLevel: 'JUNIOR',
          expertiseAreas: [],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      expect(result).toBeDefined();
      expect(result.expertLevel).toBe('JUNIOR');
    });
  });

  describe('updateExpertProfile', () => {
    it('应该更新专家档案', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法', '刑法', '商法'],
        expertLevel: 'SENIOR' as const,
        certifiedBy: null,
        certifiedAt: null,
        notes: '更新后的备注',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      mockPrisma.knowledgeGraphExpert.update.mockResolvedValue(mockExpert);

      const result = await expertService.updateExpertProfile(mockUserId, {
        expertiseAreas: ['民法', '刑法', '商法'],
        notes: '更新后的备注',
      });

      expect(mockPrisma.knowledgeGraphExpert.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          expertiseAreas: { set: ['民法', '刑法', '商法'] },
          notes: '更新后的备注',
        },
        include: expect.any(Object),
      });

      expect(result.expertiseAreas).toEqual(['民法', '刑法', '商法']);
    });
  });

  describe('getExpertContributionStats', () => {
    it('应该返回专家贡献统计', async () => {
      const mockExpert = { id: mockExpertId };
      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      mockPrisma.lawArticleRelation.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);

      mockPrisma.lawArticleRelation.aggregate.mockResolvedValue({
        _avg: { confidence: 0.85 },
      });

      const result = await expertService.getExpertContributionStats(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        totalRelationsAdded: 10,
        totalRelationsVerified: 5,
        averageQualityScore: 0.85,
        lastUpdated: expect.any(Date),
      });
    });

    it('当专家不存在时应返回默认统计', async () => {
      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(null);

      const result = await expertService.getExpertContributionStats(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        totalRelationsAdded: 0,
        totalRelationsVerified: 0,
        averageQualityScore: 0,
        lastUpdated: expect.any(Date),
      });
    });
  });

  describe('calculateExpertAccuracyRate', () => {
    it('应该计算专家准确率', async () => {
      const mockExpert = { id: mockExpertId };
      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      const mockRelations = [
        {
          id: 'rel1',
          verifiedBy: mockExpertId,
          qualityScore: { qualityScore: 0.9 },
        },
        {
          id: 'rel2',
          verifiedBy: mockExpertId,
          qualityScore: { qualityScore: 0.8 },
        },
        {
          id: 'rel3',
          verifiedBy: mockExpertId,
          qualityScore: { qualityScore: 0.7 },
        },
      ];

      mockPrisma.lawArticleRelation.findMany.mockResolvedValue(
        mockRelations as any
      );

      const result =
        await expertService.calculateExpertAccuracyRate(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        totalVerified: 3,
        correctCount: 2, // 0.9和0.8 >= 0.8
        accuracyRate: 2 / 3,
        confidenceLevel: 'LOW',
        lastUpdated: expect.any(Date),
      });
    });

    it('当没有验证关系时应返回默认准确率', async () => {
      const mockExpert = { id: mockExpertId };
      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([]);

      const result =
        await expertService.calculateExpertAccuracyRate(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        totalVerified: 0,
        correctCount: 0,
        accuracyRate: 0,
        confidenceLevel: 'LOW',
        lastUpdated: expect.any(Date),
      });
    });

    it('应该正确计算置信度等级', async () => {
      const mockExpert = { id: mockExpertId };
      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      const mockRelations = Array.from({ length: 50 }, (_, i) => ({
        id: `rel${i}`,
        verifiedBy: mockExpertId,
        qualityScore: { qualityScore: 0.95 },
      }));

      mockPrisma.lawArticleRelation.findMany.mockResolvedValue(
        mockRelations as any
      );

      const result =
        await expertService.calculateExpertAccuracyRate(mockUserId);

      expect(result.confidenceLevel).toBe('HIGH');
    });
  });

  describe('getExpertList', () => {
    it('应该返回专家列表', async () => {
      const mockExperts = [
        {
          id: 'expert1',
          userId: 'user1',
          expertiseAreas: ['民法'],
          expertLevel: 'JUNIOR' as const,
          certifiedBy: null,
          certifiedAt: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user1', name: '张三', email: 'zhang@example.com' },
        },
        {
          id: 'expert2',
          userId: 'user2',
          expertiseAreas: ['刑法'],
          expertLevel: 'SENIOR' as const,
          certifiedBy: null,
          certifiedAt: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user2', name: '李四', email: 'li@example.com' },
        },
      ];

      mockPrisma.knowledgeGraphExpert.findMany.mockResolvedValue(
        mockExperts as any
      );
      mockPrisma.knowledgeGraphExpert.count.mockResolvedValue(2);

      const result = await expertService.getExpertList({
        page: 1,
        pageSize: 20,
      });

      expect(result.experts).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('应该根据等级过滤专家', async () => {
      mockPrisma.knowledgeGraphExpert.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeGraphExpert.count.mockResolvedValue(0);

      await expertService.getExpertList({
        expertLevel: 'SENIOR',
        page: 1,
        pageSize: 20,
      });

      expect(mockPrisma.knowledgeGraphExpert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            expertLevel: 'SENIOR',
          },
        })
      );
    });
  });

  describe('deleteExpertProfile', () => {
    it('应该删除专家档案', async () => {
      mockPrisma.knowledgeGraphExpert.delete.mockResolvedValue({} as any);

      await expect(
        expertService.deleteExpertProfile(mockUserId)
      ).resolves.not.toThrow();

      expect(mockPrisma.knowledgeGraphExpert.delete).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });
  });

  describe('verifyExpertLevel', () => {
    it('应该验证专家等级', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: [],
        expertLevel: 'SENIOR' as const,
        certifiedBy: null,
        certifiedAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      const result = await expertService.verifyExpertLevel(
        mockUserId,
        'JUNIOR'
      );

      expect(result).toBe(true); // SENIOR >= JUNIOR
    });

    it('当专家不存在时应返回false', async () => {
      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(null);

      const result = await expertService.verifyExpertLevel(
        mockUserId,
        'JUNIOR'
      );

      expect(result).toBe(false);
    });

    it('当专家等级不足时应返回false', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: [],
        expertLevel: 'JUNIOR' as const,
        certifiedBy: null,
        certifiedAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      const result = await expertService.verifyExpertLevel(
        mockUserId,
        'SENIOR'
      );

      expect(result).toBe(false); // JUNIOR < SENIOR
    });
  });
});
