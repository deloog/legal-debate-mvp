import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ContractClauseRiskService } from '@/services/enterprise/legal/contract-clause-risk.service';
import { logger } from '@/lib/logger';

// Mock Prisma Client
const mockPrisma = {
  contract: {
    findUnique: jest.fn(),
  },
  lawArticle: {
    findMany: jest.fn(),
  },
  lawArticleRelation: {
    findMany: jest.fn(),
  },
  contractClauseRisk: {
    create: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as any;

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock logger
jest.mock('@/lib/logger');

describe('ContractClauseRiskService', () => {
  let service: ContractClauseRiskService;

  const mockContract = {
    id: 'contract-1',
    contractNumber: 'HT202401001',
    clientName: '测试企业',
    status: 'SIGNED' as const,
  };

  const mockLawArticle1 = {
    id: 'law-1',
    lawName: '中华人民共和国合同法',
    articleNumber: '第五十二条',
  };

  const mockLawArticle2 = {
    id: 'law-2',
    lawName: '中华人民共和国劳动合同法',
    articleNumber: '第十条',
  };

  const mockConflictRelation = {
    id: 'relation-1',
    sourceId: 'law-1',
    targetId: 'law-2',
    relationType: 'CONFLICTS' as const,
    confidence: 0.9,
  };

  const mockObsoleteRelation = {
    id: 'relation-2',
    sourceId: 'law-1',
    targetId: 'law-3',
    relationType: 'SUPERSEDED_BY' as const,
    confidence: 0.95,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContractClauseRiskService(mockPrisma);
  });

  describe('analyzeClauseRisk', () => {
    it('应该成功分析单个合同条款风险', async () => {
      // Arrange
      const clauseText = '双方应在签订合同后15日内支付全部款项';
      const clauseNumber = '3.1';
      const clauseType = '付款条款';

      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.lawArticle.findMany.mockResolvedValue([
        mockLawArticle1,
        mockLawArticle2,
      ]);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([
        mockConflictRelation,
      ]);
      mockPrisma.contractClauseRisk.create.mockResolvedValue({
        id: 'risk-1',
      });

      // Act
      const result = await service.analyzeClauseRisk(
        'contract-1',
        'user-1',
        clauseText,
        clauseNumber,
        clauseType
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.riskLevel);
      expect(result.riskFactors).toBeInstanceOf(Array);
      expect(result.relatedLawArticleIds).toBeInstanceOf(Array);
      expect(result.conflictRelations).toBeInstanceOf(Array);

      expect(mockPrisma.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
      });

      expect(mockPrisma.contractClauseRisk.create).toHaveBeenCalled();
    });

    it('当合同不存在时应抛出错误', async () => {
      // Arrange
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.analyzeClauseRisk('invalid-id', 'user-1', '测试条款')
      ).rejects.toThrow('合同不存在');
    });

    it('应该检测到高风险条款', async () => {
      // Arrange
      const clauseText = '本合同签署后不可撤销，任何情况下均不允许变更';
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.lawArticle.findMany.mockResolvedValue([mockLawArticle1]);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([]);
      mockPrisma.contractClauseRisk.create.mockResolvedValue({
        id: 'risk-1',
      });

      // Act
      const result = await service.analyzeClauseRisk(
        'contract-1',
        'user-1',
        clauseText,
        '2.1',
        '变更条款'
      );

      // Assert
      expect(result.riskLevel).toBe('HIGH' as any);
      expect(
        result.riskFactors.some(
          (factor: any) =>
            factor.type === 'fairness' && factor.severity === 'high'
        )
      ).toBe(true);
    });

    it('应该检测到法条冲突关系', async () => {
      // Arrange
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.lawArticle.findMany.mockResolvedValue([
        mockLawArticle1,
        mockLawArticle2,
      ]);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([
        mockConflictRelation,
      ]);
      mockPrisma.contractClauseRisk.create.mockResolvedValue({
        id: 'risk-1',
      });

      // Act
      const result = await service.analyzeClauseRisk(
        'contract-1',
        'user-1',
        '测试条款',
        '1.1',
        '普通条款'
      );

      // Assert
      expect(result.conflictRelations).toContain('relation-1');
    });

    it('应该检测到已过时的法条关联', async () => {
      // Arrange
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.lawArticle.findMany.mockResolvedValue([mockLawArticle1]);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([
        mockObsoleteRelation,
      ]);
      mockPrisma.contractClauseRisk.create.mockResolvedValue({
        id: 'risk-1',
      });

      // Act
      const result = await service.analyzeClauseRisk(
        'contract-1',
        'user-1',
        '测试条款',
        '1.1',
        '普通条款'
      );

      // Assert
      expect(result.obsoleteRelations).toContain('relation-2');
    });
  });

  describe('getContractRiskSummary', () => {
    it('应该获取合同风险摘要', async () => {
      // Arrange
      const mockRisks: any[] = [
        {
          id: 'risk-1',
          riskLevel: 'LOW',
          clauseNumber: '1.1',
          riskDescription: '低风险',
        },
        {
          id: 'risk-2',
          riskLevel: 'HIGH',
          clauseNumber: '2.1',
          riskDescription: '高风险',
        },
        {
          id: 'risk-3',
          riskLevel: 'MEDIUM',
          clauseNumber: '3.1',
          riskDescription: '中等风险',
        },
      ];

      mockPrisma.contractClauseRisk.findMany.mockResolvedValue(mockRisks);
      mockPrisma.contractClauseRisk.groupBy.mockResolvedValue([
        { riskLevel: 'LOW', _count: 1 },
        { riskLevel: 'MEDIUM', _count: 1 },
        { riskLevel: 'HIGH', _count: 1 },
      ] as any);

      // Act
      const summary = await service.getContractRiskSummary('contract-1');

      // Assert
      expect(summary).toBeDefined();
      expect(summary.totalClauses).toBe(3);
      expect(summary.riskDistribution).toEqual({
        low: 1,
        medium: 1,
        high: 1,
        critical: 0,
      });
      expect(summary.overallRiskLevel).toBe('HIGH');
      expect(summary.topRisks).toHaveLength(3);
    });

    it('当没有风险记录时应返回空摘要', async () => {
      // Arrange
      mockPrisma.contractClauseRisk.findMany.mockResolvedValue([]);
      mockPrisma.contractClauseRisk.groupBy.mockResolvedValue([]);

      // Act
      const summary = await service.getContractRiskSummary('contract-1');

      // Assert
      expect(summary.totalClauses).toBe(0);
      expect(summary.riskDistribution).toEqual({
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      });
      expect(summary.overallRiskLevel).toBe('LOW');
      expect(summary.topRisks).toHaveLength(0);
    });
  });

  describe('getContractRisksByLevel', () => {
    it('应该按风险级别筛选合同风险', async () => {
      // Arrange
      const mockRisks: any[] = [
        {
          id: 'risk-1',
          riskLevel: 'HIGH',
          clauseNumber: '2.1',
          riskDescription: '高风险',
        },
        {
          id: 'risk-2',
          riskLevel: 'HIGH',
          clauseNumber: '5.1',
          riskDescription: '高风险',
        },
      ];

      mockPrisma.contractClauseRisk.findMany.mockResolvedValue(mockRisks);

      // Act
      const risks = await service.getContractRisksByLevel(
        'contract-1',
        'HIGH' as any
      );

      // Assert
      expect(risks).toHaveLength(2);
      expect(risks.every(r => r.riskLevel === 'HIGH')).toBe(true);
      expect(mockPrisma.contractClauseRisk.findMany).toHaveBeenCalledWith({
        where: {
          contractId: 'contract-1',
          riskLevel: 'HIGH',
        },
        orderBy: { riskLevel: 'desc' as const },
      });
    });
  });

  describe('updateClauseRisk', () => {
    it('应该更新条款风险记录', async () => {
      // Arrange
      const updateData: any = {
        riskLevel: 'CRITICAL',
        riskDescription: '存在重大法律风险',
        riskFactors: [{ type: 'legality', severity: 'critical' }],
      };

      const mockUpdatedRisk = {
        id: 'risk-1',
        ...updateData,
      };

      mockPrisma.contractClauseRisk.update.mockResolvedValue(mockUpdatedRisk);

      // Act
      const result = await service.updateClauseRisk('risk-1', updateData);

      // Assert
      expect(result).toBeDefined();
      expect(result.riskLevel).toBe('CRITICAL');
      expect(mockPrisma.contractClauseRisk.update).toHaveBeenCalledWith({
        where: { id: 'risk-1' },
        data: {
          ...updateData,
          analyzedAt: expect.any(Date),
        },
      });
    });

    it('当风险记录不存在时应抛出错误', async () => {
      // Arrange
      mockPrisma.contractClauseRisk.update.mockRejectedValue(
        new Error('Record to update not found')
      );

      // Act & Assert
      await expect(
        service.updateClauseRisk('invalid-id', { riskLevel: 'HIGH' as any })
      ).rejects.toThrow();
    });
  });

  describe('deleteClauseRisk', () => {
    it('应该删除条款风险记录', async () => {
      // Arrange
      mockPrisma.contractClauseRisk.delete.mockResolvedValue({
        id: 'risk-1',
      });

      // Act
      await service.deleteClauseRisk('risk-1');

      // Assert
      expect(mockPrisma.contractClauseRisk.delete).toHaveBeenCalledWith({
        where: { id: 'risk-1' },
      });
    });
  });
});
