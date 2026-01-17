/**
 * 等级限制配置测试
 */

import { LimitType } from '@/types/membership';
import { prisma, runSeedScript } from './seed-membership-setup';

describe('等级限制配置', () => {
  beforeAll(async () => {
    // 运行seed脚本初始化会员等级配置
    await runSeedScript();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('免费版应该有7个限制', async () => {
    const freeTier = await prisma.membershipTier.findUnique({
      where: { name: 'free' },
      include: { tierLimits: true },
    });

    expect(freeTier?.tierLimits).toHaveLength(7);
  });

  it('免费版限制值应该正确', async () => {
    const freeTier = await prisma.membershipTier.findUnique({
      where: { name: 'free' },
      include: { tierLimits: true },
    });

    const maxCasesLimit = freeTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_CASES
    );
    expect(maxCasesLimit?.limitValue).toBe(3);

    const maxDebatesLimit = freeTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_DEBATES
    );
    expect(maxDebatesLimit?.limitValue).toBe(0);

    const maxAiTokensLimit = freeTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_AI_TOKENS_MONTHLY
    );
    expect(maxAiTokensLimit?.limitValue).toBe(10000);
  });

  it('基础版应该有7个限制', async () => {
    const basicTier = await prisma.membershipTier.findUnique({
      where: { name: 'basic' },
      include: { tierLimits: true },
    });

    expect(basicTier?.tierLimits).toHaveLength(7);
  });

  it('基础版限制值应该正确', async () => {
    const basicTier = await prisma.membershipTier.findUnique({
      where: { name: 'basic' },
      include: { tierLimits: true },
    });

    const maxCasesLimit = basicTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_CASES
    );
    expect(maxCasesLimit?.limitValue).toBe(50);

    const maxDebatesLimit = basicTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_DEBATES
    );
    expect(maxDebatesLimit?.limitValue).toBe(20);

    const maxLawArticleSearchesLimit = basicTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_LAW_ARTICLE_SEARCHES
    );
    expect(maxLawArticleSearchesLimit?.limitValue).toBeNull();
  });

  it('专业版应该有7个限制', async () => {
    const professionalTier = await prisma.membershipTier.findUnique({
      where: { name: 'professional' },
      include: { tierLimits: true },
    });

    expect(professionalTier?.tierLimits).toHaveLength(7);
  });

  it('专业版应该有无限的资源使用', async () => {
    const professionalTier = await prisma.membershipTier.findUnique({
      where: { name: 'professional' },
      include: { tierLimits: true },
    });

    const maxCasesLimit = professionalTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_CASES
    );
    expect(maxCasesLimit?.limitValue).toBeNull();

    const maxDebatesLimit = professionalTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_DEBATES
    );
    expect(maxDebatesLimit?.limitValue).toBeNull();

    const maxDocumentsLimit = professionalTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_DOCUMENTS
    );
    expect(maxDocumentsLimit?.limitValue).toBeNull();
  });

  it('企业版应该有7个限制', async () => {
    const enterpriseTier = await prisma.membershipTier.findUnique({
      where: { name: 'enterprise' },
      include: { tierLimits: true },
    });

    expect(enterpriseTier?.tierLimits).toHaveLength(7);
  });

  it('企业版应该有无限的资源使用', async () => {
    const enterpriseTier = await prisma.membershipTier.findUnique({
      where: { name: 'enterprise' },
      include: { tierLimits: true },
    });

    const maxCasesLimit = enterpriseTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_CASES
    );
    expect(maxCasesLimit?.limitValue).toBeNull();

    const maxAiTokensLimit = enterpriseTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_AI_TOKENS_MONTHLY
    );
    expect(maxAiTokensLimit?.limitValue).toBeNull();

    const maxStorageLimit = enterpriseTier?.tierLimits.find(
      l => l.limitType === LimitType.MAX_STORAGE_MB
    );
    expect(maxStorageLimit?.limitValue).toBeNull();
  });
});
