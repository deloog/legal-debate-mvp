/**
 * CertificationService 单元测试
 */

// Mock prisma before imports
jest.mock('@/lib/db/prisma', () => ({
  prisma: require('@/__tests__/__mocks__/prisma-shared').prisma,
}));

import { certificationService } from '@/lib/knowledge-graph/expert/certification-service';
import { prisma as mockPrisma } from '@/__tests__/__mocks__/prisma-shared';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock expertService
jest.mock('@/lib/knowledge-graph/expert/expert-service', () => ({
  expertService: {
    calculateExpertAccuracyRate: jest.fn(),
    getExpertContributionStats: jest.fn(),
  },
}));

import { expertService } from '@/lib/knowledge-graph/expert/expert-service';

const mockExpertService = expertService as jest.Mocked<typeof expertService>;

describe('CertificationService', () => {
  const mockUserId = 'user123';
  const mockExpertId = 'expert123';
  const mockAdminId = 'admin123';
  const mockUser = {
    id: mockUserId,
    name: '张三',
    email: 'zhangsan@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('certifyExpert', () => {
    it('应该成功认证专家', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法'],
        expertLevel: 'JUNIOR' as const,
        certifiedBy: null,
        certifiedAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      const mockAdmin = {
        id: mockAdminId,
        role: 'ADMIN' as const,
        email: 'admin@example.com',
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);
      mockPrisma.user.findUnique.mockResolvedValue(mockAdmin);

      await certificationService.certifyExpert({
        expertId: mockExpertId,
        adminId: mockAdminId,
        notes: '测试认证',
      });

      expect(mockPrisma.knowledgeGraphExpert.update).toHaveBeenCalledWith({
        where: { id: mockExpertId },
        data: {
          certifiedBy: mockAdminId,
          certifiedAt: expect.any(Date),
        },
      });
    });

    it('当专家不存在时应抛出错误', async () => {
      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(null);

      await expect(
        certificationService.certifyExpert({
          expertId: mockExpertId,
          adminId: mockAdminId,
          notes: '测试认证',
        })
      ).rejects.toThrow('专家不存在');
    });

    it('当专家已认证时应抛出错误', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法'],
        expertLevel: 'SENIOR' as const,
        certifiedBy: 'admin123',
        certifiedAt: new Date(),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      await expect(
        certificationService.certifyExpert({
          expertId: mockExpertId,
          adminId: mockAdminId,
          notes: '测试认证',
        })
      ).rejects.toThrow('专家已认证，无需重复认证');
    });

    it('当用户无权限时应抛出错误', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法'],
        expertLevel: 'JUNIOR' as const,
        certifiedBy: null,
        certifiedAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      const mockNormalUser = {
        id: 'user456',
        role: 'USER' as const,
        email: 'user@example.com',
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);
      mockPrisma.user.findUnique.mockResolvedValue(mockNormalUser);

      await expect(
        certificationService.certifyExpert({
          expertId: mockExpertId,
          adminId: mockNormalUser.id,
          notes: '测试认证',
        })
      ).rejects.toThrow('无权限进行专家认证');
    });
  });

  describe('promoteExpert', () => {
    it('应该成功升级专家等级', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法'],
        expertLevel: 'JUNIOR' as const,
        certifiedBy: 'admin123',
        certifiedAt: new Date(),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      // Mock validation
      mockExpertService.calculateExpertAccuracyRate.mockResolvedValue({
        userId: mockUserId,
        totalVerified: 100,
        correctCount: 90,
        accuracyRate: 0.9,
        confidenceLevel: 'HIGH' as const,
        lastUpdated: new Date(),
      });

      mockExpertService.getExpertContributionStats.mockResolvedValue({
        userId: mockUserId,
        totalRelationsAdded: 50,
        totalRelationsVerified: 100,
        averageQualityScore: 0.85,
        lastUpdated: new Date(),
      });

      await certificationService.promoteExpert({
        expertId: mockExpertId,
        newLevel: 'SENIOR',
        reason: '符合升级条件',
      });

      expect(mockPrisma.knowledgeGraphExpert.update).toHaveBeenCalledWith({
        where: { id: mockExpertId },
        data: { expertLevel: 'SENIOR' },
      });
    });

    it('当专家未认证时应抛出错误', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法'],
        expertLevel: 'JUNIOR' as const,
        certifiedBy: null,
        certifiedAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      await expect(
        certificationService.promoteExpert({
          expertId: mockExpertId,
          newLevel: 'SENIOR',
          reason: '符合升级条件',
        })
      ).rejects.toThrow('专家未认证，无法升级等级');
    });

    it('当降级时应抛出错误', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法'],
        expertLevel: 'SENIOR' as const,
        certifiedBy: 'admin123',
        certifiedAt: new Date(),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      await expect(
        certificationService.promoteExpert({
          expertId: mockExpertId,
          newLevel: 'JUNIOR',
          reason: '降级测试',
        })
      ).rejects.toThrow('只能升级专家等级，不能降级');
    });
  });

  describe('evaluateExpertLevelSuggestion', () => {
    it('应该返回MASTER等级建议', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法'],
        expertLevel: 'SENIOR' as const,
        certifiedBy: 'admin123',
        certifiedAt: new Date(),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      mockExpertService.calculateExpertAccuracyRate.mockResolvedValue({
        userId: mockUserId,
        totalVerified: 100,
        correctCount: 95,
        accuracyRate: 0.95,
        confidenceLevel: 'HIGH' as const,
        lastUpdated: new Date(),
      });

      mockExpertService.getExpertContributionStats.mockResolvedValue({
        userId: mockUserId,
        totalRelationsAdded: 50,
        totalRelationsVerified: 100,
        averageQualityScore: 0.9,
        lastUpdated: new Date(),
      });

      const result =
        await certificationService.evaluateExpertLevelSuggestion(mockUserId);

      expect(result.suggestedLevel).toBe('MASTER');
      expect(result.currentLevel).toBe('SENIOR');
      expect(result.readyForPromotion).toBe(true);
      expect(result.reasons).toContain('准确率：95.0%');
    });

    it('应该返回SENIOR等级建议', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法'],
        expertLevel: 'JUNIOR' as const,
        certifiedBy: 'admin123',
        certifiedAt: new Date(),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      mockExpertService.calculateExpertAccuracyRate.mockResolvedValue({
        userId: mockUserId,
        totalVerified: 50,
        correctCount: 45,
        accuracyRate: 0.9,
        confidenceLevel: 'HIGH' as const,
        lastUpdated: new Date(),
      });

      mockExpertService.getExpertContributionStats.mockResolvedValue({
        userId: mockUserId,
        totalRelationsAdded: 20,
        totalRelationsVerified: 50,
        averageQualityScore: 0.85,
        lastUpdated: new Date(),
      });

      const result =
        await certificationService.evaluateExpertLevelSuggestion(mockUserId);

      expect(result.suggestedLevel).toBe('SENIOR');
      expect(result.currentLevel).toBe('JUNIOR');
      expect(result.readyForPromotion).toBe(true);
    });

    it('当准确率不足时应返回JUNIOR等级建议', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法'],
        expertLevel: 'SENIOR' as const,
        certifiedBy: 'admin123',
        certifiedAt: new Date(),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      mockExpertService.calculateExpertAccuracyRate.mockResolvedValue({
        userId: mockUserId,
        totalVerified: 50,
        correctCount: 40,
        accuracyRate: 0.8,
        confidenceLevel: 'MEDIUM' as const,
        lastUpdated: new Date(),
      });

      mockExpertService.getExpertContributionStats.mockResolvedValue({
        userId: mockUserId,
        totalRelationsAdded: 20,
        totalRelationsVerified: 50,
        averageQualityScore: 0.8,
        lastUpdated: new Date(),
      });

      const result =
        await certificationService.evaluateExpertLevelSuggestion(mockUserId);

      expect(result.suggestedLevel).toBe('SENIOR');
    });
  });

  describe('getExpertCertificationHistory', () => {
    it('应该返回专家认证历史', async () => {
      const mockExpert = {
        id: mockExpertId,
        userId: mockUserId,
        expertiseAreas: ['民法'],
        expertLevel: 'SENIOR' as const,
        certifiedBy: 'admin123',
        certifiedAt: new Date('2024-01-01'),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(mockExpert);

      const result =
        await certificationService.getExpertCertificationHistory(mockExpertId);

      expect(result).toEqual({
        certifiedAt: expect.any(Date),
        certifiedBy: 'admin123',
        levelHistory: [],
      });
    });

    it('当专家不存在时应抛出错误', async () => {
      mockPrisma.knowledgeGraphExpert.findUnique.mockResolvedValue(null);

      await expect(
        certificationService.getExpertCertificationHistory(mockExpertId)
      ).rejects.toThrow('专家不存在');
    });
  });

  describe('revokeExpertCertification', () => {
    it('应该成功撤销专家认证', async () => {
      const mockAdmin = {
        id: mockAdminId,
        role: 'ADMIN' as const,
        email: 'admin@example.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockAdmin);

      await certificationService.revokeExpertCertification(
        mockExpertId,
        mockAdminId,
        '测试撤销'
      );

      expect(mockPrisma.knowledgeGraphExpert.update).toHaveBeenCalledWith({
        where: { id: mockExpertId },
        data: {
          certifiedBy: null,
          certifiedAt: null,
          notes: '认证撤销：测试撤销',
        },
      });
    });

    it('当用户无权限时应抛出错误', async () => {
      const mockNormalUser = {
        id: 'user456',
        role: 'USER' as const,
        email: 'user@example.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockNormalUser);

      await expect(
        certificationService.revokeExpertCertification(
          mockExpertId,
          mockNormalUser.id,
          '测试撤销'
        )
      ).rejects.toThrow('无权限撤销专家认证');
    });
  });
});
