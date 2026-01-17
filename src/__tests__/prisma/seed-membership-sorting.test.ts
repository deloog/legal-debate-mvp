/**
 * 等级排序测试
 */

import { prisma, runSeedScript } from './seed-membership-setup';

describe('等级排序', () => {
  beforeAll(async () => {
    // 运行seed脚本初始化会员等级配置
    await runSeedScript();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('等级应该按sortOrder排序', async () => {
    const tiers = await prisma.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    expect(tiers[0]?.name).toBe('free');
    expect(tiers[1]?.name).toBe('basic');
    expect(tiers[2]?.name).toBe('professional');
    expect(tiers[3]?.name).toBe('enterprise');
  });

  it('价格应该随等级提升而增加', async () => {
    const tiers = await prisma.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const prices = tiers.map(t => t.price.toNumber());
    expect(prices).toEqual([0, 99, 299, 999]);
  });
});
