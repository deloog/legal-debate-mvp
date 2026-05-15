import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnterpriseRiskProfileService } from '@/services/enterprise/legal/enterprise-risk-profile.service';
import { logger } from '@/lib/logger';

// Mock Prisma Client - 使用 any 类型避免复杂的 Prisma 类型
const mockPrisma = {
  enterpriseAccount: {
    findUnique: jest.fn() as any,
  },
  contract: {
    findMany: jest.fn() as any,
  },
  contractClauseRisk: {
    findMany: jest.fn() as any,
  },
  enterpriseRiskProfile: {
    findFirst: jest.fn() as any,
    findMany: jest.fn() as any,
    create: jest.fn() as any,
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock logger
jest.mock('@/lib/logger');

describe('EnterpriseRiskProfileService', () => {
  let service: EnterpriseRiskProfileService;

  const mockEnterprise = {
    id: 'enterprise-1',
    userId: 'enterprise-user-1',
    enterpriseName: '测试企业',
    creditCode: '91110000000000001X',
    industryType: 'TECHNOLOGY',
    legalPerson: '张三',
    status: 'APPROVED' as const,
  };

  const mockContractRisks: any[] = [
    {
      id: 'risk-1',
      contractId: 'contract-1',
      clauseNumber: '1.1',
      riskLevel: 'LOW',
      riskDescription: '低风险条款',
      riskFactors: [
        { type: 'legality', severity: 'low' },
        { type: 'fairness', severity: 'low' },
      ],
    },
    {
      id: 'risk-2',
      contractId: 'contract-2',
      clauseNumber: '2.1',
      riskLevel: 'HIGH',
      riskDescription: '高风险条款',
      riskFactors: [
        { type: 'legality', severity: 'high' },
        { type: 'fairness', severity: 'medium' },
      ],
    },
    {
      id: 'risk-3',
      contractId: 'contract-3',
      clauseNumber: '3.1',
      riskLevel: 'MEDIUM',
      riskDescription: '中等风险条款',
      riskFactors: [{ type: 'completeness', severity: 'medium' }],
    },
    {
      id: 'risk-4',
      contractId: 'contract-4',
      clauseNumber: '4.1',
      riskLevel: 'HIGH',
      riskDescription: '高风险条款',
      riskFactors: [
        { type: 'legality', severity: 'high' },
        { type: 'fairness', severity: 'high' },
      ],
    },
    {
      id: 'risk-5',
      contractId: 'contract-5',
      clauseNumber: '5.1',
      riskLevel: 'LOW',
      riskDescription: '低风险条款',
      riskFactors: [{ type: 'legality', severity: 'low' }],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EnterpriseRiskProfileService(mockPrisma as any);
  });

  describe('generateEnterpriseRiskProfile', () => {
    it('应该成功生成企业风险画像', async () => {
      // Arrange
      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(mockEnterprise);
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contractClauseRisk.findMany.mockResolvedValue(
        mockContractRisks
      );
      mockPrisma.enterpriseRiskProfile.create.mockResolvedValue({
        id: 'profile-1',
        enterpriseId: 'enterprise-1',
        industryType: 'TECHNOLOGY',
        overallRiskScore: 60,
        riskLevel: 'HIGH',
      });

      // Act
      const profile = await service.generateEnterpriseRiskProfile(
        'enterprise-1',
        'user-1'
      );

      // Assert
      expect(profile).toBeDefined();
      expect(profile.enterpriseId).toBe('enterprise-1');
      expect(profile.industryType).toBe('TECHNOLOGY');
      expect(profile.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(profile.overallRiskScore).toBeLessThanOrEqual(100);
      expect(profile.riskLevel).toBeDefined();
      expect(profile.riskFactors).toBeDefined();
      expect(profile.topRisks).toBeDefined();
      expect(profile.recommendations).toBeDefined();

      expect(mockPrisma.enterpriseAccount.findUnique).toHaveBeenCalledWith({
        where: { id: 'enterprise-1' },
      });
      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith({
        where: {
          case: { is: { userId: 'enterprise-user-1', deletedAt: null } },
          status: { notIn: ['DRAFT', 'TERMINATED'] },
        },
      });
      expect(mockPrisma.enterpriseRiskProfile.create).toHaveBeenCalled();
    });

    it('当企业不存在时应抛出错误', async () => {
      // Arrange
      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.generateEnterpriseRiskProfile('invalid-id', 'user-1')
      ).rejects.toThrow('企业不存在');
    });

    it('应该根据风险等级生成建议', async () => {
      // Arrange
      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(mockEnterprise);
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contractClauseRisk.findMany.mockResolvedValue(
        mockContractRisks
      );
      mockPrisma.enterpriseRiskProfile.create.mockImplementation(
        async (data: Record<string, unknown>) => ({
          id: 'profile-1',
          ...data,
        })
      );

      // Act
      const profile = await service.generateEnterpriseRiskProfile(
        'enterprise-1',
        'user-1'
      );

      // Assert
      expect(profile.recommendations).toBeInstanceOf(Array);
      expect(profile.recommendations.length).toBeGreaterThan(0);
    });

    it('应该识别大写风险枚举的Top风险', async () => {
      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(mockEnterprise);
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contractClauseRisk.findMany.mockResolvedValue(
        mockContractRisks
      );
      mockPrisma.enterpriseRiskProfile.create.mockImplementation(
        async (data: Record<string, unknown>) => ({
          id: 'profile-1',
          ...data,
        })
      );

      const profile = await service.generateEnterpriseRiskProfile(
        'enterprise-1',
        'user-1'
      );

      expect(profile.topRisks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            contractId: 'contract-2',
            riskLevel: 'HIGH',
          }),
          expect.objectContaining({
            contractId: 'contract-4',
            riskLevel: 'HIGH',
          }),
        ])
      );
    });
  });

  describe('getEnterpriseRiskProfile', () => {
    it('应该获取最新的企业风险画像', async () => {
      // Arrange
      const mockProfile: any = {
        id: 'profile-1',
        enterpriseId: 'enterprise-1',
        industryType: 'TECHNOLOGY',
        overallRiskScore: 45,
        riskLevel: 'MEDIUM',
        assessedAt: new Date(),
        topRisks: [{ type: 'contract', level: 'high' }],
        recommendations: [{ priority: 'high', text: '优化合同条款' }],
      };

      mockPrisma.enterpriseRiskProfile.findFirst.mockResolvedValue(mockProfile);

      // Act
      const profile = await service.getEnterpriseRiskProfile('enterprise-1');

      // Assert
      expect(profile).toBeDefined();
      expect(profile.enterpriseId).toBe('enterprise-1');
      expect(mockPrisma.enterpriseRiskProfile.findFirst).toHaveBeenCalledWith({
        where: { enterpriseId: 'enterprise-1' },
        orderBy: { assessedAt: 'desc' },
      });
    });

    it('当没有画像时应返回null', async () => {
      // Arrange
      mockPrisma.enterpriseRiskProfile.findFirst.mockResolvedValue(null);

      // Act
      const profile = await service.getEnterpriseRiskProfile('enterprise-1');

      // Assert
      expect(profile).toBeNull();
    });
  });

  describe('getEnterpriseRiskHistory', () => {
    it('应该获取企业风险历史记录', async () => {
      // Arrange
      const mockHistory = [
        {
          id: 'profile-1',
          assessedAt: new Date('2024-01-01'),
          overallRiskScore: 50,
        },
        {
          id: 'profile-2',
          assessedAt: new Date('2024-02-01'),
          overallRiskScore: 60,
        },
        {
          id: 'profile-3',
          assessedAt: new Date('2024-03-01'),
          overallRiskScore: 45,
        },
      ];

      mockPrisma.enterpriseRiskProfile.findMany.mockResolvedValue(mockHistory);

      // Act
      const history = await service.getEnterpriseRiskHistory(
        'enterprise-1',
        10
      );

      // Assert
      expect(history).toHaveLength(3);
      expect(history).toEqual(mockHistory);
      expect(mockPrisma.enterpriseRiskProfile.findMany).toHaveBeenCalledWith({
        where: { enterpriseId: 'enterprise-1' },
        orderBy: { assessedAt: 'desc' },
        take: 10,
      });
    });
  });

  describe('compareWithIndustryBenchmark', () => {
    it('应该与行业基准进行比较', async () => {
      // Arrange
      const mockProfile = {
        id: 'profile-1',
        enterpriseId: 'enterprise-1',
        industryType: 'TECHNOLOGY',
        overallRiskScore: 45,
      };

      const mockBenchmark = {
        industryType: 'TECHNOLOGY',
        averageRiskScore: 50,
        riskLevelDistribution: { low: 30, medium: 50, high: 20, critical: 0 },
      };

      mockPrisma.enterpriseRiskProfile.findFirst.mockResolvedValue(mockProfile);

      // Act
      const comparison = await service.compareWithIndustryBenchmark(
        'enterprise-1',
        mockBenchmark
      );

      // Assert
      expect(comparison).toBeDefined();
      expect(comparison.enterpriseRiskScore).toBe(45);
      expect(comparison.industryAverageRiskScore).toBe(50);
      expect(comparison.difference).toBe(-5);
      expect(comparison.position).toBeDefined();
    });
  });
});
