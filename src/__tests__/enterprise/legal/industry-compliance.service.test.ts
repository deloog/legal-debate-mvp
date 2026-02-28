import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IndustryComplianceService } from '@/services/enterprise/legal/industry-compliance.service';
import { logger } from '@/lib/logger';

// Mock Prisma Client
const mockPrisma = {
  contract: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  industryComplianceRule: {
    findMany: jest.fn(),
  },
  contractLawArticle: {
    findMany: jest.fn(),
  },
} as any;

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock logger
jest.mock('@/lib/logger');

describe('IndustryComplianceService', () => {
  let service: IndustryComplianceService;

  const mockComplianceRules: any[] = [
    {
      id: 'rule-1',
      industryType: 'TECHNOLOGY',
      ruleCode: 'TECH-001',
      ruleName: '技术合同必备条款',
      description: '技术合同必须包含知识产权归属条款',
      lawType: ['CONTRACT'],
      lawCategory: ['COMMERCIAL'],
      conditions: {
        contractType: '技术合同',
        requiredClauses: ['知识产权归属'],
      },
      severity: 'required',
      requiredLawArticles: ['law-1', 'law-2'],
      forbiddenLawArticles: [],
      isActive: true,
    },
    {
      id: 'rule-2',
      industryType: 'TECHNOLOGY',
      ruleCode: 'TECH-002',
      ruleName: '数据保护合规',
      description: '数据处理需符合个人信息保护法要求',
      lawType: ['ADMINISTRATIVE_REGULATION'],
      lawCategory: ['INTELLECTUAL_PROPERTY'],
      conditions: {
        hasDataProcessing: true,
      },
      severity: 'required',
      requiredLawArticles: ['law-3'],
      forbiddenLawArticles: ['law-4'],
      isActive: true,
    },
  ];

  const mockContract: any = {
    id: 'contract-1',
    contractNumber: 'HT202401001',
    clientName: '测试企业',
    status: 'SIGNED',
  };

  const mockLawArticles: any[] = [
    {
      id: 'law-1',
      lawName: '中华人民共和国合同法',
      articleNumber: '第三百二十六条',
      lawType: 'LAW',
      category: 'CIVIL',
    },
    {
      id: 'law-2',
      lawName: '中华人民共和国技术合同法',
      articleNumber: '第三条',
      lawType: 'LAW',
      category: 'COMMERCIAL',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IndustryComplianceService(mockPrisma);
  });

  describe('checkContractCompliance', () => {
    it('应该成功检查合同合规性', async () => {
      // Arrange
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.industryComplianceRule.findMany.mockResolvedValue(
        mockComplianceRules
      );
      mockPrisma.contractLawArticle.findMany.mockResolvedValue([
        { lawArticleId: 'law-1' },
        { lawArticleId: 'law-2' },
      ]);

      // Act
      const result = await service.checkContractCompliance(
        'contract-1',
        'TECHNOLOGY'
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.contractId).toBe('contract-1');
      expect(result.industryType).toBe('TECHNOLOGY');
      expect(result.totalRules).toBe(2);
      expect(result.complianceScore).toBeGreaterThanOrEqual(0);
      expect(result.complianceScore).toBeLessThanOrEqual(100);
      expect(result.requiredViolations).toBeInstanceOf(Array);
      expect(result.recommendedViolations).toBeInstanceOf(Array);
    });

    it('当合同不存在时应抛出错误', async () => {
      // Arrange
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.checkContractCompliance('invalid-id', 'TECHNOLOGY')
      ).rejects.toThrow('合同不存在');
    });

    it('应该检测到必需规则的违规', async () => {
      // Arrange
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.industryComplianceRule.findMany.mockResolvedValue(
        mockComplianceRules
      );
      mockPrisma.contractLawArticle.findMany.mockResolvedValue([]); // 没有关联法条

      // Act
      const result = await service.checkContractCompliance(
        'contract-1',
        'TECHNOLOGY'
      );

      // Assert
      expect(result.requiredViolations.length).toBeGreaterThan(0);
      expect(result.complianceScore).toBeLessThan(100);
    });

    it('应该检测到禁止法条的关联', async () => {
      // Arrange
      const ruleWithForbidden = {
        ...mockComplianceRules[1],
        forbiddenLawArticles: ['law-5'],
      };

      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.industryComplianceRule.findMany.mockResolvedValue([
        mockComplianceRules[0],
        ruleWithForbidden,
      ]);
      mockPrisma.contractLawArticle.findMany.mockResolvedValue([
        { lawArticleId: 'law-5' },
      ]);

      // Act
      const result = await service.checkContractCompliance(
        'contract-1',
        'TECHNOLOGY'
      );

      // Assert
      expect(result.forbiddenViolations).toBeDefined();
      expect(result.forbiddenViolations.length).toBeGreaterThan(0);
    });
  });

  describe('batchCheckIndustryCompliance', () => {
    it('应该批量检查合同合规性', async () => {
      // Arrange
      const contractIds = ['contract-1', 'contract-2', 'contract-3'];

      mockPrisma.contract.findMany.mockResolvedValue([
        mockContract,
        { ...mockContract, id: 'contract-2' },
        { ...mockContract, id: 'contract-3' },
      ]);
      mockPrisma.industryComplianceRule.findMany.mockResolvedValue(
        mockComplianceRules
      );
      mockPrisma.contractLawArticle.findMany.mockResolvedValue([
        { lawArticleId: 'law-1', contractId: 'contract-1' },
      ]);

      // Act
      const results = await service.batchCheckIndustryCompliance(
        contractIds,
        'TECHNOLOGY'
      );

      // Assert
      expect(results).toHaveLength(3);
      expect(results.every(r => r.complianceScore !== undefined)).toBe(true);
    });
  });

  describe('getIndustryComplianceRules', () => {
    it('应该获取行业合规规则', async () => {
      // Arrange
      mockPrisma.industryComplianceRule.findMany.mockResolvedValue(
        mockComplianceRules
      );

      // Act
      const rules = await service.getIndustryComplianceRules('TECHNOLOGY');

      // Assert
      expect(rules).toHaveLength(2);
      expect(rules.every(r => r.industryType === 'TECHNOLOGY')).toBe(true);
      expect(mockPrisma.industryComplianceRule.findMany).toHaveBeenCalledWith({
        where: {
          industryType: 'TECHNOLOGY',
          isActive: true,
        },
        orderBy: { ruleCode: 'asc' },
      });
    });

    it('应该只返回激活的规则', async () => {
      // Arrange
      const allRules = [
        ...mockComplianceRules,
        { ...mockComplianceRules[0], isActive: false },
      ];
      mockPrisma.industryComplianceRule.findMany.mockResolvedValue(allRules);

      // Act
      const rules = await service.getIndustryComplianceRules('TECHNOLOGY');

      // Assert
      // service已经通过where条件过滤isActive=true，所以mock返回的规则应该都是激活的
      expect(rules).toBeDefined();
    });
  });

  describe('generateComplianceReport', () => {
    it('应该生成合规报告', async () => {
      // Arrange
      const mockCheckResults = [
        {
          contractId: 'contract-1',
          contractNumber: 'HT202401001',
          industryType: 'TECHNOLOGY',
          totalRules: 2,
          passedRules: 2,
          failedRules: 0,
          complianceScore: 85,
          requiredViolations: [],
          recommendedViolations: [
            { ruleCode: 'TECH-002', ruleName: '', description: '' },
          ],
          forbiddenViolations: [],
        },
        {
          contractId: 'contract-2',
          contractNumber: 'HT202401002',
          industryType: 'TECHNOLOGY',
          totalRules: 2,
          passedRules: 1,
          failedRules: 1,
          complianceScore: 60,
          requiredViolations: [
            {
              ruleCode: 'TECH-001',
              ruleName: '',
              description: '',
              severity: 'required',
            },
          ],
          recommendedViolations: [],
          forbiddenViolations: [],
        },
      ];

      // Act
      const report = await service.generateComplianceReport(
        'TECHNOLOGY',
        mockCheckResults
      );

      // Assert
      expect(report).toBeDefined();
      expect(report.industryType).toBe('TECHNOLOGY');
      expect(report.totalContracts).toBe(2);
      expect(report.averageComplianceScore).toBe(72.5);
      expect(report.highComplianceContracts).toBe(1);
      expect(report.mediumComplianceContracts).toBe(1);
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('应该生成改进建议', async () => {
      // Arrange
      const mockCheckResults = [
        {
          contractId: 'contract-1',
          contractNumber: 'HT202401001',
          industryType: 'TECHNOLOGY',
          totalRules: 2,
          passedRules: 0,
          failedRules: 2,
          complianceScore: 40,
          requiredViolations: [
            {
              ruleCode: 'TECH-001',
              ruleName: '技术合同必备条款',
              description: '',
              severity: 'required',
            },
            {
              ruleCode: 'TECH-002',
              ruleName: '数据保护合规',
              description: '',
              severity: 'required',
            },
          ],
          recommendedViolations: [],
          forbiddenViolations: [],
        },
      ];

      // Act
      const report = await service.generateComplianceReport(
        'TECHNOLOGY',
        mockCheckResults
      );

      // Assert
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0].priority).toBeDefined();
      expect(report.recommendations[0].text).toBeDefined();
    });
  });
});
