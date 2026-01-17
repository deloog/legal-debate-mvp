/**
 * 会员等级创建测试
 */

import { MembershipTier, BillingCycle } from '@/types/membership';
import { prisma, runSeedScript } from './seed-membership-setup';

describe('会员等级创建', () => {
  beforeAll(async () => {
    // 运行seed脚本初始化会员等级配置
    await runSeedScript();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('应该创建四个会员等级', async () => {
    const tiers = await prisma.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    expect(tiers).toHaveLength(4);
  });

  it('免费版应该有正确的配置', async () => {
    const freeTier = await prisma.membershipTier.findUnique({
      where: { name: 'free' },
    });

    expect(freeTier).not.toBeNull();
    expect(freeTier?.displayName).toBe('免费版');
    expect(freeTier?.tier).toBe(MembershipTier.FREE);
    expect(freeTier?.price.toNumber()).toBe(0);
    expect(freeTier?.billingCycle).toBe(BillingCycle.MONTHLY);
    expect(freeTier?.sortOrder).toBe(1);
  });

  it('基础版应该有正确的配置', async () => {
    const basicTier = await prisma.membershipTier.findUnique({
      where: { name: 'basic' },
    });

    expect(basicTier).not.toBeNull();
    expect(basicTier?.displayName).toBe('基础版');
    expect(basicTier?.tier).toBe(MembershipTier.BASIC);
    expect(basicTier?.price.toNumber()).toBe(99);
    expect(basicTier?.billingCycle).toBe(BillingCycle.MONTHLY);
    expect(basicTier?.sortOrder).toBe(2);
  });

  it('专业版应该有正确的配置', async () => {
    const professionalTier = await prisma.membershipTier.findUnique({
      where: { name: 'professional' },
    });

    expect(professionalTier).not.toBeNull();
    expect(professionalTier?.displayName).toBe('专业版');
    expect(professionalTier?.tier).toBe(MembershipTier.PROFESSIONAL);
    expect(professionalTier?.price.toNumber()).toBe(299);
    expect(professionalTier?.billingCycle).toBe(BillingCycle.MONTHLY);
    expect(professionalTier?.sortOrder).toBe(3);
  });

  it('企业版应该有正确的配置', async () => {
    const enterpriseTier = await prisma.membershipTier.findUnique({
      where: { name: 'enterprise' },
    });

    expect(enterpriseTier).not.toBeNull();
    expect(enterpriseTier?.displayName).toBe('企业版');
    expect(enterpriseTier?.tier).toBe(MembershipTier.ENTERPRISE);
    expect(enterpriseTier?.price.toNumber()).toBe(999);
    expect(enterpriseTier?.billingCycle).toBe(BillingCycle.MONTHLY);
    expect(enterpriseTier?.sortOrder).toBe(4);
  });
});
