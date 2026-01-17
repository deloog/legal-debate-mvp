/**
 * 数据完整性和描述信息测试
 */

import type { MembershipPermissionConfig } from '@/types/membership';
import { prisma, runSeedScript } from './seed-membership-setup';

describe('描述信息', () => {
  beforeAll(async () => {
    // 运行seed脚本初始化会员等级配置
    await runSeedScript();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('所有等级都应该有描述', async () => {
    const tiers = await prisma.membershipTier.findMany({
      where: { isActive: true },
    });

    for (const tier of tiers) {
      expect(tier.description).not.toBe('');
      expect(tier.description).toBeDefined();
    }
  });

  it('所有限制都应该有描述', async () => {
    const limits = await prisma.tierLimit.findMany();

    for (const limit of limits) {
      expect(limit.description).not.toBe('');
      expect(limit.description).toBeDefined();
    }
  });
});

describe('数据完整性', () => {
  beforeAll(async () => {
    // 运行seed脚本初始化会员等级配置
    await runSeedScript();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('所有等级都应该有对应的限制', async () => {
    const tiers = await prisma.membershipTier.findMany({
      where: { isActive: true },
      include: { tierLimits: true },
    });

    for (const tier of tiers) {
      expect(tier.tierLimits.length).toBeGreaterThan(0);
    }
  });

  it('限制应该关联到正确的等级', async () => {
    const tiers = await prisma.membershipTier.findMany({
      where: { isActive: true },
      include: { tierLimits: true },
    });

    for (const tier of tiers) {
      for (const limit of tier.tierLimits) {
        expect(limit.tierId).toBe(tier.id);
      }
    }
  });

  it('所有等级的权限都应该完整', async () => {
    const tiers = await prisma.membershipTier.findMany({
      where: { isActive: true },
    });

    for (const tier of tiers) {
      const permissions =
        tier.permissions as unknown as MembershipPermissionConfig;
      expect(permissions?.canCreateCase).toBeDefined();
      expect(permissions?.canCreateDebate).toBeDefined();
      expect(permissions?.canAnalyzeDocument).toBeDefined();
      expect(permissions?.canSearchLawArticle).toBeDefined();
      expect(permissions?.canUseAdvancedFeatures).toBeDefined();
      expect(permissions?.canExportData).toBeDefined();
      expect(permissions?.canUseBatchProcessing).toBeDefined();
      expect(permissions?.canUseDeepSeek).toBeDefined();
      expect(permissions?.canUseZhipuAI).toBeDefined();
      expect(permissions?.canUseCustomModel).toBeDefined();
      expect(permissions?.prioritySupport).toBeDefined();
      expect(permissions?.dedicatedSupport).toBeDefined();
    }
  });
});
