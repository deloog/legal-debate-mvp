/**
 * 合规服务单元测试
 *
 * 测试合规规则和合规检查功能。
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock logger
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
  },
}));

// Mock Prisma - 使用 any 类型避免类型推断问题
const mockPrisma: any = {
  complianceRule: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  enterpriseComplianceCheck: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  enterpriseAccount: {
    findUnique: jest.fn(),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

import {
  complianceService,
  CreateComplianceRuleInput,
  CreateComplianceCheckInput,
} from '@/lib/enterprise/compliance-service';

describe('ComplianceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createComplianceRule', () => {
    it('应该成功创建合规规则', async () => {
      const mockInput: CreateComplianceRuleInput = {
        ruleCode: 'RULE-001',
        ruleName: '数据保护合规',
        ruleType: 'REGULATORY',
        source: 'NPC',
        description: '数据保护相关法规要求',
        effectiveDate: new Date('2026-01-01'),
        businessProcesses: ['数据收集', '数据存储'],
        controlPoints: ['加密存储', '访问控制'],
        checklistItems: [
          { name: '是否加密存储', status: 'pending' },
        ],
      };

      const mockRule = {
        id: 'rule-1',
        ...mockInput,
        sourceUrl: null,
        expiryDate: null,
        status: 'active',
        version: '1.0',
        lastUpdated: new Date(),
      };

      mockPrisma.complianceRule.create.mockResolvedValue(mockRule);

      const result = await complianceService.createComplianceRule(mockInput);

      expect(result.ruleName).toBe('数据保护合规');
      expect(mockPrisma.complianceRule.create).toHaveBeenCalled();
    });
  });

  describe('createComplianceCheck', () => {
    it('应该成功创建合规检查记录', async () => {
      const mockInput: CreateComplianceCheckInput = {
        enterpriseId: 'ent-1',
        ruleId: 'rule-1',
        checkDate: new Date(),
        checkResult: 'COMPLIANT',
        checklistResults: [{ name: '加密存储', passed: true }],
      };

      const mockEnterprise = {
        id: 'ent-1',
        enterpriseName: '测试企业',
      };

      const mockRule = {
        id: 'rule-1',
        ruleName: '数据保护合规',
      };

      const mockCheck = {
        id: 'check-1',
        ...mockInput,
        nonCompliances: [],
        remediationPlan: null,
        remediationDeadline: null,
        remediationStatus: 'pending',
        reviewerId: null,
        reviewerNotes: null,
      };

      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(mockEnterprise);
      mockPrisma.complianceRule.findUnique.mockResolvedValue(mockRule);
      mockPrisma.enterpriseComplianceCheck.create.mockResolvedValue(mockCheck);

      const result = await complianceService.createComplianceCheck(mockInput);

      expect(result.checkResult).toBe('COMPLIANT');
    });

    it('应该抛出错误当企业不存在时', async () => {
      const mockInput: CreateComplianceCheckInput = {
        enterpriseId: 'non-existent',
        ruleId: 'rule-1',
        checkDate: new Date(),
        checkResult: 'COMPLIANT',
        checklistResults: [],
      };

      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(null);

      await expect(
        complianceService.createComplianceCheck(mockInput)
      ).rejects.toThrow('企业不存在');
    });
  });

  describe('getComplianceRules', () => {
    it('应该成功获取合规规则列表', async () => {
      const mockRules = [
        { id: 'rule-1', ruleName: '规则1', ruleType: 'REGULATORY' },
        { id: 'rule-2', ruleName: '规则2', ruleType: 'INTERNAL' },
      ];

      mockPrisma.complianceRule.findMany.mockResolvedValue(mockRules);

      const result = await complianceService.getComplianceRules({});

      expect(result.length).toBe(2);
    });
  });

  describe('getEnterpriseComplianceChecks', () => {
    it('应该成功获取企业合规检查记录', async () => {
      const mockChecks = [
        { id: 'check-1', checkResult: 'COMPLIANT' },
        { id: 'check-2', checkResult: 'NON_COMPLIANT' },
      ];

      mockPrisma.enterpriseComplianceCheck.findMany.mockResolvedValue(mockChecks);

      const result = await complianceService.getEnterpriseComplianceChecks('ent-1');

      expect(result.length).toBe(2);
    });
  });

  describe('getComplianceStatistics', () => {
    it('应该成功获取合规统计数据', async () => {
      mockPrisma.enterpriseComplianceCheck.count.mockResolvedValueOnce(10); // total
      mockPrisma.enterpriseComplianceCheck.count.mockResolvedValueOnce(7); // compliant
      mockPrisma.enterpriseComplianceCheck.count.mockResolvedValueOnce(2); // partial
      mockPrisma.enterpriseComplianceCheck.count.mockResolvedValueOnce(1); // non-compliant

      const result = await complianceService.getComplianceStatistics('ent-1');

      expect(result.total).toBe(10);
      expect(result.compliant).toBe(7);
      expect(result.nonCompliant).toBe(1);
    });
  });
});
