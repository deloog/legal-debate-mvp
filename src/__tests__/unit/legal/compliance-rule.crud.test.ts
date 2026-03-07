import {
  PrismaClient,
  ComplianceRuleType,
  ComplianceRuleSource,
} from '@prisma/client';
import { beforeEach, describe, expect, it, afterEach } from '@jest/globals';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

describe('ComplianceRule CRUD Operations', () => {
  let testRuleId: string;
  let testRuleCode: string;

  beforeEach(async () => {
    // 清理测试数据
    await prisma.complianceRule.deleteMany({
      where: {
        ruleCode: {
          startsWith: 'TEST-',
        },
      },
    });

    // 创建测试规则
    testRuleCode = `TEST-${Date.now()}`;
    const rule = await prisma.complianceRule.create({
      data: {
        ruleCode: testRuleCode,
        ruleName: '测试合规规则',
        ruleType: ComplianceRuleType.REGULATORY,
        source: ComplianceRuleSource.NPC,
        effectiveDate: new Date(),
        businessProcesses: ['合同管理', '采购管理'],
        controlPoints: ['审批流程', '文档管理'],
        checklistItems: [
          { item: '检查1', description: '描述1', required: true },
        ],
        status: 'active',
      },
    });
    testRuleId = rule.id;
  });

  afterEach(async () => {
    // 清理测试数据
    if (testRuleId) {
      await prisma.complianceRule
        .delete({
          where: { id: testRuleId },
        })
        .catch(() => {});
    }
  });

  describe('Basic ComplianceRule Creation', () => {
    it('should create a compliance rule with basic fields', async () => {
      const rule = await prisma.complianceRule.findUnique({
        where: { id: testRuleId },
      });

      expect(rule).toBeDefined();
      expect(rule?.ruleCode).toBe(testRuleCode);
      expect(rule?.ruleName).toBe('测试合规规则');
      expect(rule?.ruleType).toBe(ComplianceRuleType.REGULATORY);
      expect(rule?.source).toBe(ComplianceRuleSource.NPC);
      expect(rule?.status).toBe('active');
    });

    it('should have default version and status', async () => {
      const rule = await prisma.complianceRule.findUnique({
        where: { id: testRuleId },
      });

      expect(rule?.version).toBe('1.0');
      expect(rule?.businessProcesses).toContain('合同管理');
    });
  });

  describe('ComplianceRule Query Operations', () => {
    it('should find rule by code', async () => {
      const rule = await prisma.complianceRule.findUnique({
        where: { ruleCode: testRuleCode },
      });

      expect(rule).toBeDefined();
      expect(rule?.id).toBe(testRuleId);
    });

    it('should query rules by type', async () => {
      const rules = await prisma.complianceRule.findMany({
        where: { ruleType: ComplianceRuleType.REGULATORY },
      });

      expect(rules.length).toBeGreaterThan(0);
      rules.forEach(rule => {
        expect(rule.ruleType).toBe(ComplianceRuleType.REGULATORY);
      });
    });

    it('should query rules by source', async () => {
      const rules = await prisma.complianceRule.findMany({
        where: { source: ComplianceRuleSource.NPC },
      });

      expect(rules.length).toBeGreaterThan(0);
      rules.forEach(rule => {
        expect(rule.source).toBe(ComplianceRuleSource.NPC);
      });
    });

    it('should query active rules', async () => {
      const rules = await prisma.complianceRule.findMany({
        where: { status: 'active' },
      });

      expect(rules.length).toBeGreaterThan(0);
      rules.forEach(rule => {
        expect(rule.status).toBe('active');
      });
    });

    it('should query rules by business process', async () => {
      const rules = await prisma.complianceRule.findMany({
        where: {
          businessProcesses: {
            has: '合同管理',
          },
        },
      });

      expect(rules.length).toBeGreaterThan(0);
    });
  });

  describe('ComplianceRule Update Operations', () => {
    it('should update rule name', async () => {
      const updated = await prisma.complianceRule.update({
        where: { id: testRuleId },
        data: {
          ruleName: '更新后的规则名称',
        },
      });

      expect(updated.ruleName).toBe('更新后的规则名称');
    });

    it('should update rule status', async () => {
      const updated = await prisma.complianceRule.update({
        where: { id: testRuleId },
        data: {
          status: 'amended',
        },
      });

      expect(updated.status).toBe('amended');
    });

    it('should update business processes', async () => {
      const updated = await prisma.complianceRule.update({
        where: { id: testRuleId },
        data: {
          businessProcesses: {
            set: ['财务管理', '人力资源'],
          },
        },
      });

      expect(updated.businessProcesses).toEqual(['财务管理', '人力资源']);
    });
  });

  describe('ComplianceRule Delete Operations', () => {
    it('should delete rule by id', async () => {
      await prisma.complianceRule.delete({
        where: { id: testRuleId },
      });

      const rule = await prisma.complianceRule.findUnique({
        where: { id: testRuleId },
      });

      expect(rule).toBeNull();
    });
  });
});

describe('ComplianceRule Statistics', () => {
  it('should count total rules', async () => {
    const count = await prisma.complianceRule.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should count active rules', async () => {
    const count = await prisma.complianceRule.count({
      where: { status: 'active' },
    });
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
