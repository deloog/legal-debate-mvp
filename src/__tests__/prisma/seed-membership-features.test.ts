/**
 * 功能特性测试
 */

import { prisma, runSeedScript } from './seed-membership-setup';

describe('功能特性', () => {
  beforeAll(async () => {
    // 运行seed脚本初始化会员等级配置
    await runSeedScript();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('免费版应该有5个功能特性', async () => {
    const freeTier = await prisma.membershipTier.findUnique({
      where: { name: 'free' },
    });

    expect(freeTier?.features).toHaveLength(5);
  });

  it('基础版应该有6个功能特性', async () => {
    const basicTier = await prisma.membershipTier.findUnique({
      where: { name: 'basic' },
    });

    expect(basicTier?.features).toHaveLength(6);
  });

  it('专业版应该有8个功能特性', async () => {
    const professionalTier = await prisma.membershipTier.findUnique({
      where: { name: 'professional' },
    });

    expect(professionalTier?.features).toHaveLength(8);
  });

  it('企业版应该有8个功能特性', async () => {
    const enterpriseTier = await prisma.membershipTier.findUnique({
      where: { name: 'enterprise' },
    });

    expect(enterpriseTier?.features).toHaveLength(8);
  });

  it('免费版不应该包含数据导出功能', async () => {
    const freeTier = await prisma.membershipTier.findUnique({
      where: { name: 'free' },
    });

    expect(freeTier?.features).not.toContain('数据导出功能');
  });

  it('基础版应该包含数据导出功能', async () => {
    const basicTier = await prisma.membershipTier.findUnique({
      where: { name: 'basic' },
    });

    expect(basicTier?.features).toContain('数据导出功能');
  });
});
