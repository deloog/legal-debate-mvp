import { PrismaClient, ComplianceRuleType, ComplianceRuleSource } from '@prisma/client';
import { beforeEach, describe, expect, it, afterEach } from '@jest/globals';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

describe('ComplianceRuleRelation Operations', () => {
  let sourceRuleId: string;
  let targetRuleId: string;
  let testRelationId: string;

  beforeEach(async () => {
    // 清理测试数据
    await prisma.complianceRuleRelation.deleteMany({
      where: {
        sourceRule: {
          ruleCode: { startsWith: 'TEST-' },
        },
      },
    });

    await prisma.complianceRule.deleteMany({
      where: {
        ruleCode: { startsWith: 'TEST-' },
      },
    });

    // 创建测试规则
    const sourceRule = await prisma.complianceRule.create({
      data: {
        ruleCode: `TEST-SOURCE-${Date.now()}`,
        ruleName: '源规则',
        ruleType: ComplianceRuleType.REGULATORY,
        source: ComplianceRuleSource.NPC,
        effectiveDate: new Date(),
        status: 'active',
      },
    });

    const targetRule = await prisma.complianceRule.create({
      data: {
        ruleCode: `TEST-TARGET-${Date.now()}`,
        ruleName: '目标规则',
        ruleType: ComplianceRuleType.INDUSTRY,
        source: ComplianceRuleSource.MINISTRY,
        effectiveDate: new Date(),
        status: 'active',
      },
    });

    sourceRuleId = sourceRule.id;
    targetRuleId = targetRule.id;

    // 创建测试关联关系
    const relation = await prisma.complianceRuleRelation.create({
      data: {
        sourceRuleId: sourceRule.id,
        targetRuleId: targetRule.id,
        relationType: 'REFERENCES',
        strength: 0.8,
        confidence: 0.9,
        description: '测试关联关系',
        status: 'pending',
      },
    });

    testRelationId = relation.id;
  });

  afterEach(async () => {
    // 清理测试数据
    await prisma.complianceRuleRelation.deleteMany({
      where: {
        sourceRule: {
          ruleCode: { startsWith: 'TEST-' },
        },
      },
    }).catch(() => {});

    await prisma.complianceRule.deleteMany({
      where: {
        ruleCode: { startsWith: 'TEST-' },
      },
    }).catch(() => {});
  });

  describe('ComplianceRuleRelation Creation', () => {
    it('should create a relation between rules', async () => {
      const relation = await prisma.complianceRuleRelation.findUnique({
        where: { id: testRelationId },
      });

      expect(relation).toBeDefined();
      expect(relation?.sourceRuleId).toBe(sourceRuleId);
      expect(relation?.targetRuleId).toBe(targetRuleId);
      expect(relation?.relationType).toBe('REFERENCES');
    });

    it('should have default values for strength and confidence', async () => {
      const newRelation = await prisma.complianceRuleRelation.create({
        data: {
          sourceRuleId,
          targetRuleId,
          relationType: 'RELATED',
        },
      });

      expect(newRelation.strength).toBe(1.0);
      expect(newRelation.confidence).toBe(1.0);
    });
  });

  describe('ComplianceRuleRelation Query Operations', () => {
    it('should find relation by source rule', async () => {
      const relations = await prisma.complianceRuleRelation.findMany({
        where: { sourceRuleId },
      });

      expect(relations.length).toBeGreaterThan(0);
      expect(relations[0].sourceRuleId).toBe(sourceRuleId);
    });

    it('should find relation by target rule', async () => {
      const relations = await prisma.complianceRuleRelation.findMany({
        where: { targetRuleId },
      });

      expect(relations.length).toBeGreaterThan(0);
      expect(relations[0].targetRuleId).toBe(targetRuleId);
    });

    it('should find relation by status', async () => {
      const relations = await prisma.complianceRuleRelation.findMany({
        where: { status: 'pending' },
      });

      expect(relations.length).toBeGreaterThan(0);
      relations.forEach(r => {
        expect(r.status).toBe('pending');
      });
    });

    it('should find relation by type', async () => {
      const relations = await prisma.complianceRuleRelation.findMany({
        where: { relationType: 'REFERENCES' },
      });

      expect(relations.length).toBeGreaterThan(0);
      relations.forEach(r => {
        expect(r.relationType).toBe('REFERENCES');
      });
    });
  });

  describe('ComplianceRuleRelation Update Operations', () => {
    it('should update relation status', async () => {
      const updated = await prisma.complianceRuleRelation.update({
        where: { id: testRelationId },
        data: { status: 'verified' },
      });

      expect(updated.status).toBe('verified');
    });

    it('should update relation strength', async () => {
      const updated = await prisma.complianceRuleRelation.update({
        where: { id: testRelationId },
        data: { strength: 0.5 },
      });

      expect(updated.strength).toBe(0.5);
    });

    it('should add verification info', async () => {
      const updated = await prisma.complianceRuleRelation.update({
        where: { id: testRelationId },
        data: {
          status: 'verified',
          verifiedBy: 'test-user',
          verifiedAt: new Date(),
        },
      });

      expect(updated.status).toBe('verified');
      expect(updated.verifiedBy).toBe('test-user');
      expect(updated.verifiedAt).toBeDefined();
    });
  });

  describe('ComplianceRuleRelation Delete Operations', () => {
    it('should delete relation by id', async () => {
      await prisma.complianceRuleRelation.delete({
        where: { id: testRelationId },
      });

      const relation = await prisma.complianceRuleRelation.findUnique({
        where: { id: testRelationId },
      });

      expect(relation).toBeNull();
    });
  });

  describe('ComplianceRuleRelation Constraints', () => {
    it('should prevent duplicate relation', async () => {
      // 尝试创建重复的关联关系
      await expect(
        prisma.complianceRuleRelation.create({
          data: {
            sourceRuleId,
            targetRuleId,
            relationType: 'REFERENCES',
          },
        })
      ).rejects.toThrow();
    });
  });
});
