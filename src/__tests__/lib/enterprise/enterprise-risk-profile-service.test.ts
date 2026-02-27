/**
 * 企业风险画像服务单元测试
 *
 * 测试企业风险画像的创建、更新、查询和分析功能。
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock logger
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
  },
}));

// Mock Prisma - 使用 any 类型避免类型推断问题
const mockPrisma: any = {
  enterpriseRiskProfile: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  enterpriseAccount: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  contract: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  contractClauseRisk: {
    count: jest.fn(),
  },
  case: {
    count: jest.fn(),
  },
  industryRiskFeature: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  enterpriseComplianceCheck: {
    count: jest.fn(),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// 现在导入服务
import {
  enterpriseRiskProfileService,
  CreateRiskProfileInput,
  RiskAnalysisResult,
} from '@/lib/enterprise/enterprise-risk-profile-service';

describe('EnterpriseRiskProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRiskProfile', () => {
    it('应该成功创建企业风险画像', async () => {
      const mockInput: CreateRiskProfileInput = {
        enterpriseId: 'ent-1',
        industryType: 'finance_banking',
      };

      const mockEnterprise = {
        id: 'ent-1',
        enterpriseName: '测试企业',
        creditCode: '91110000XXXXXXXX',
        legalPerson: '张三',
        industryType: 'finance_banking',
        status: 'ACTIVE',
      };

      const mockRiskProfile = {
        id: 'profile-1',
        enterpriseId: 'ent-1',
        industryType: 'finance_banking',
        assessedAt: new Date(),
        legalRiskScore: 0,
        contractRiskScore: 0,
        complianceRiskScore: 0,
        overallRiskScore: 0,
        riskLevel: 'LOW',
        riskFactors: {},
        topRisks: [],
        recommendations: [],
        totalContractsAnalyzed: 0,
        highRiskContracts: 0,
        mediumRiskContracts: 0,
        lowRiskContracts: 0,
      };

      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(mockEnterprise);
      mockPrisma.enterpriseRiskProfile.create.mockResolvedValue(mockRiskProfile);

      const result = await enterpriseRiskProfileService.createRiskProfile(mockInput);

      expect(result).toEqual(mockRiskProfile);
      expect(mockPrisma.enterpriseRiskProfile.create).toHaveBeenCalled();
    });

    it('应该抛出错误当企业不存在时', async () => {
      const mockInput: CreateRiskProfileInput = {
        enterpriseId: 'non-existent',
        industryType: 'finance_banking',
      };

      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(null);

      await expect(
        enterpriseRiskProfileService.createRiskProfile(mockInput)
      ).rejects.toThrow('企业不存在');
    });
  });

  describe('analyzeRisk', () => {
    it('应该成功分析企业风险', async () => {
      const mockEnterprise = {
        id: 'ent-1',
        enterpriseName: '测试企业',
        industryType: 'finance_banking',
      };

      const mockIndustryFeature = {
        id: 'feature-1',
        industryCode: 'finance_banking',
        riskCategories: ['contract', 'compliance', 'litigation'],
        commonRisks: [
          { name: '合同违约风险', weight: 0.3 },
          { name: '合规风险', weight: 0.3 },
          { name: '诉讼风险', weight: 0.2 },
        ],
        riskThresholds: {
          LOW: 30,
          MEDIUM: 60,
          HIGH: 80,
        },
      };

      const mockContracts = [
        { id: 'contract-1', status: 'ACTIVE' },
        { id: 'contract-2', status: 'ACTIVE' },
      ];

      const mockHighRiskCount = 1;
      const mockMediumRiskCount = 1;
      const mockLowRiskCount = 0;

      const mockRiskProfile = {
        id: 'profile-1',
        enterpriseId: 'ent-1',
        industryType: 'finance_banking',
        legalRiskScore: 45,
        contractRiskScore: 55,
        complianceRiskScore: 30,
        overallRiskScore: 43,
        riskLevel: 'MEDIUM',
      };

      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(mockEnterprise);
      mockPrisma.industryRiskFeature.findUnique.mockResolvedValue(mockIndustryFeature);
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);
      mockPrisma.contract.count.mockResolvedValue(2);
      mockPrisma.contractClauseRisk.count.mockResolvedValueOnce(1); // high
      mockPrisma.contractClauseRisk.count.mockResolvedValueOnce(1); // medium
      mockPrisma.contractClauseRisk.count.mockResolvedValueOnce(0); // low
      mockPrisma.case.count.mockResolvedValue(1);
      mockPrisma.enterpriseRiskProfile.create.mockResolvedValue(mockRiskProfile);

      const result = await enterpriseRiskProfileService.analyzeRisk('ent-1');

      expect(result.overallRiskScore).toBe(43);
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.industryType).toBe('finance_banking');
    });

    it('应该抛出错误当企业不存在时', async () => {
      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(null);

      await expect(
        enterpriseRiskProfileService.analyzeRisk('non-existent')
      ).rejects.toThrow('企业不存在');
    });
  });

  describe('getRiskProfile', () => {
    it('应该成功获取企业风险画像', async () => {
      const mockRiskProfile = {
        id: 'profile-1',
        enterpriseId: 'ent-1',
        industryType: 'finance_banking',
        overallRiskScore: 45,
        riskLevel: 'MEDIUM',
      };

      mockPrisma.enterpriseRiskProfile.findFirst.mockResolvedValue(mockRiskProfile);

      const result = await enterpriseRiskProfileService.getRiskProfile('ent-1');

      expect(result).toEqual(mockRiskProfile);
      expect(mockPrisma.enterpriseRiskProfile.findFirst).toHaveBeenCalledWith({
        where: { enterpriseId: 'ent-1' },
        orderBy: { assessedAt: 'desc' },
      });
    });

    it('应该返回null当风险画像不存在时', async () => {
      mockPrisma.enterpriseRiskProfile.findFirst.mockResolvedValue(null);

      const result = await enterpriseRiskProfileService.getRiskProfile('ent-1');

      expect(result).toBeNull();
    });
  });

  describe('getRiskTrend', () => {
    it('应该成功获取风险趋势', async () => {
      const mockProfiles = [
        { assessedAt: new Date('2026-02-01'), overallRiskScore: 50 },
        { assessedAt: new Date('2026-01-15'), overallRiskScore: 45 },
        { assessedAt: new Date('2026-01-01'), overallRiskScore: 40 },
      ];

      mockPrisma.enterpriseRiskProfile.findMany.mockResolvedValue(mockProfiles);

      const result = await enterpriseRiskProfileService.getRiskTrend('ent-1', 3);

      expect(result.length).toBe(3);
      expect(result[0].overallRiskScore).toBe(50);
    });
  });

  describe('updateRiskProfile', () => {
    it('应该成功更新风险画像', async () => {
      const mockUpdated = {
        id: 'profile-1',
        industryType: 'manufacturing',
      };

      mockPrisma.enterpriseRiskProfile.update.mockResolvedValue(mockUpdated);

      const result = await enterpriseRiskProfileService.updateRiskProfile('profile-1', {
        industryType: 'manufacturing',
      });

      expect(result.industryType).toBe('manufacturing');
    });
  });

  describe('deleteRiskProfile', () => {
    it('应该成功删除风险画像', async () => {
      const mockDeleted = {
        id: 'profile-1',
      };

      mockPrisma.enterpriseRiskProfile.delete.mockResolvedValue(mockDeleted);

      const result = await enterpriseRiskProfileService.deleteRiskProfile('profile-1');

      expect(result.id).toBe('profile-1');
    });
  });

  describe('batchAnalyzeRisk', () => {
    it('应该批量分析企业风险', async () => {
      const mockEnterprise = {
        id: 'ent-1',
        enterpriseName: '测试企业',
        industryType: 'finance_banking',
      };

      const mockRiskProfile = {
        id: 'profile-1',
        enterpriseId: 'ent-1',
        overallRiskScore: 45,
        riskLevel: 'MEDIUM',
      };

      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(mockEnterprise);
      mockPrisma.industryRiskFeature.findUnique.mockResolvedValue(null);
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.case.count.mockResolvedValue(0);
      mockPrisma.enterpriseComplianceCheck.count.mockResolvedValue(0);
      mockPrisma.enterpriseRiskProfile.create.mockResolvedValue(mockRiskProfile);

      const result = await enterpriseRiskProfileService.batchAnalyzeRisk(['ent-1']);

      expect(result.length).toBe(1);
    });

    it('应该处理批量分析中的错误', async () => {
      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(null);

      const result = await enterpriseRiskProfileService.batchAnalyzeRisk(['non-existent']);

      expect(result.length).toBe(0);
    });
  });
});
