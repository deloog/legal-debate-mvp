/**
 * 会员等级数据模型测试
 *
 * 测试会员等级系统的数据模型，包括：
 * - MembershipTier（会员等级定义）
 * - UserMembership（用户会员关系）
 * - UsageRecord（使用量记录）
 * - TierLimit（等级限制配置）
 * - MembershipHistory（会员变更历史）
 */

import {
  PrismaClient,
  MembershipTierType,
  MembershipStatus,
  BillingCycle,
  Prisma,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Decimal utility for Prisma
 */
const Decimal = {
  from: (value: number) => {
    return new Prisma.Decimal(value);
  },
};

describe('会员等级数据模型测试', () => {
  beforeAll(async () => {
    // 清理测试数据
    await cleanupAllTestData();
  });

  afterAll(async () => {
    // 清理测试数据
    await cleanupAllTestData();
    await prisma.$disconnect();
  });

  describe('MembershipTier 模型', () => {
    it('应该能够创建会员等级定义', async () => {
      const uniqueName = `test-free-${Date.now()}`;
      const tier = await prisma.membershipTier.create({
        data: {
          name: uniqueName,
          displayName: '测试免费版',
          description: '测试用的免费版会员',
          tier: MembershipTierType.FREE,
          price: Decimal.from(0),
          currency: 'CNY',
          billingCycle: BillingCycle.MONTHLY,
          features: ['基础功能', '案件创建'],
          permissions: {
            canCreateCase: true,
            canCreateDebate: false,
            canAnalyzeDocument: true,
            canSearchLawArticle: true,
            canUseAdvancedFeatures: false,
            canExportData: false,
            canUseBatchProcessing: false,
            canUseDeepSeek: true,
            canUseZhipuAI: true,
            canUseCustomModel: false,
            prioritySupport: false,
            dedicatedSupport: false,
            customPermissions: {},
          },
          isActive: true,
          sortOrder: 1,
        },
      });

      expect(tier).toBeDefined();
      expect(tier.id).toBeDefined();
      expect(tier.name).toBe(uniqueName);
      expect(tier.tier).toBe(MembershipTierType.FREE);
      expect(tier.price.toNumber()).toBe(0);
      expect(tier.isActive).toBe(true);

      // 清理
      await prisma.membershipTier.delete({
        where: { id: tier.id },
      });
    });

    it('应该能够查询会员等级列表', async () => {
      // 创建测试数据
      await createTestTiers();

      const tiers = await prisma.membershipTier.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });

      expect(Array.isArray(tiers)).toBe(true);
      expect(tiers.length).toBeGreaterThanOrEqual(4);
      expect(tiers[0].sortOrder).toBeLessThanOrEqual(
        tiers[tiers.length - 1].sortOrder
      );
    });

    it('应该能够根据等级类型查询', async () => {
      const tier = await prisma.membershipTier.findUnique({
        where: { tier: MembershipTierType.FREE },
      });

      expect(tier).toBeDefined();
      expect(tier?.tier).toBe(MembershipTierType.FREE);
    });

    it('应该能够更新会员等级', async () => {
      // 查询现有的BASIC等级
      const tier = await prisma.membershipTier.findUnique({
        where: { tier: MembershipTierType.BASIC },
      });

      if (!tier) {
        throw new Error(
          'BASIC tier not found. Please run createTestTiers first.'
        );
      }

      // 更新等级信息
      const updated = await prisma.membershipTier.update({
        where: { id: tier.id },
        data: {
          displayName: '测试更新版-已更新',
          price: Decimal.from(199),
        },
      });

      expect(updated.displayName).toBe('测试更新版-已更新');
      expect(updated.price.toNumber()).toBe(199);

      // 恢复原始值
      await prisma.membershipTier.update({
        where: { id: tier.id },
        data: {
          displayName: '基础版',
          price: Decimal.from(99),
        },
      });
    });
  });

  describe('UserMembership 模型', () => {
    let testUser: any;
    let testTier: any;

    beforeEach(async () => {
      // 创建测试用户
      testUser = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          username: `testuser-${Date.now()}`,
          password: 'hashedpassword',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      // 获取或创建测试等级
      testTier = await prisma.membershipTier.findUnique({
        where: { tier: MembershipTierType.FREE },
      });
      if (!testTier) {
        testTier = await createTestTiers();
        testTier = await prisma.membershipTier.findUnique({
          where: { tier: MembershipTierType.FREE },
        });
      }
    });

    afterEach(async () => {
      // 清理测试数据
      if (testUser) {
        await prisma.user.delete({ where: { id: testUser.id } });
      }
    });

    it('应该能够创建用户会员', async () => {
      const membership = await prisma.userMembership.create({
        data: {
          userId: testUser.id,
          tierId: testTier.id,
          status: MembershipStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
          autoRenew: false,
        },
      });

      expect(membership).toBeDefined();
      expect(membership.userId).toBe(testUser.id);
      expect(membership.tierId).toBe(testTier.id);
      expect(membership.status).toBe(MembershipStatus.ACTIVE);
      expect(membership.autoRenew).toBe(false);

      // 清理
      await prisma.userMembership.delete({
        where: { id: membership.id },
      });
    });

    it('应该能够查询用户当前会员', async () => {
      // 创建会员
      await prisma.userMembership.create({
        data: {
          userId: testUser.id,
          tierId: testTier.id,
          status: MembershipStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: false,
        },
      });

      const membership = await prisma.userMembership.findFirst({
        where: {
          userId: testUser.id,
          status: MembershipStatus.ACTIVE,
        },
        include: {
          tier: true,
          user: true,
        },
      });

      expect(membership).toBeDefined();
      expect(membership?.userId).toBe(testUser.id);
      expect(membership?.tier).toBeDefined();
      expect(membership?.user).toBeDefined();

      // 清理
      await prisma.userMembership.deleteMany({
        where: { userId: testUser.id },
      });
    });

    it('应该能够更新会员状态', async () => {
      const membership = await prisma.userMembership.create({
        data: {
          userId: testUser.id,
          tierId: testTier.id,
          status: MembershipStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: false,
        },
      });

      const updated = await prisma.userMembership.update({
        where: { id: membership.id },
        data: {
          status: MembershipStatus.EXPIRED,
          cancelledAt: new Date(),
          cancelledReason: '测试取消',
        },
      });

      expect(updated.status).toBe(MembershipStatus.EXPIRED);
      expect(updated.cancelledAt).toBeDefined();
      expect(updated.cancelledReason).toBe('测试取消');

      // 清理
      await prisma.userMembership.delete({
        where: { id: membership.id },
      });
    });
  });

  describe('UsageRecord 模型', () => {
    let testUser: any;
    let testMembership: any;

    beforeEach(async () => {
      // 创建测试用户和会员
      testUser = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          username: `testuser-${Date.now()}`,
          password: 'hashedpassword',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const testTier = await prisma.membershipTier.findUnique({
        where: { tier: MembershipTierType.FREE },
      });
      if (!testTier) {
        await createTestTiers();
      }
      const tier = (await prisma.membershipTier.findUnique({
        where: { tier: MembershipTierType.FREE },
      })) as any;

      testMembership = await prisma.userMembership.create({
        data: {
          userId: testUser.id,
          tierId: tier.id,
          status: MembershipStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: false,
        },
      });
    });

    afterEach(async () => {
      // 清理测试数据
      await prisma.usageRecord.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.userMembership.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({ where: { id: testUser.id } });
    });

    it('应该能够创建使用量记录', async () => {
      const record = await prisma.usageRecord.create({
        data: {
          userId: testUser.id,
          membershipId: testMembership.id,
          usageType: 'CASE_CREATED',
          quantity: 1,
          unit: '个',
          resourceId: 'test-case-id',
          resourceType: 'CASE',
          description: '创建测试案件',
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      expect(record).toBeDefined();
      expect(record.userId).toBe(testUser.id);
      expect(record.membershipId).toBe(testMembership.id);
      expect(record.usageType).toBe('CASE_CREATED');
      expect(record.quantity).toBe(1);
    });

    it('应该能够查询用户使用量', async () => {
      // 创建多个使用记录
      await prisma.usageRecord.createMany({
        data: [
          {
            userId: testUser.id,
            membershipId: testMembership.id,
            usageType: 'CASE_CREATED',
            quantity: 1,
            unit: '个',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          {
            userId: testUser.id,
            membershipId: testMembership.id,
            usageType: 'DEBATE_GENERATED',
            quantity: 2,
            unit: '次',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          {
            userId: testUser.id,
            membershipId: testMembership.id,
            usageType: 'DOCUMENT_ANALYZED',
            quantity: 5,
            unit: '个',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        ],
      });

      const records = await prisma.usageRecord.findMany({
        where: {
          userId: testUser.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(records.length).toBeGreaterThanOrEqual(3);
      expect(records[0].usageType).toBeDefined();
    });

    it('应该能够按使用类型统计', async () => {
      // 创建使用记录
      await prisma.usageRecord.createMany({
        data: [
          {
            userId: testUser.id,
            membershipId: testMembership.id,
            usageType: 'CASE_CREATED',
            quantity: 1,
            unit: '个',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          {
            userId: testUser.id,
            membershipId: testMembership.id,
            usageType: 'CASE_CREATED',
            quantity: 2,
            unit: '个',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        ],
      });

      const result = await prisma.usageRecord.aggregate({
        where: {
          userId: testUser.id,
          usageType: 'CASE_CREATED',
        },
        _sum: {
          quantity: true,
        },
      });

      expect(result._sum.quantity).toBe(3);
    });
  });

  describe('TierLimit 模型', () => {
    let testTier: any;

    beforeEach(async () => {
      // 创建测试等级
      testTier = await prisma.membershipTier.findUnique({
        where: { tier: MembershipTierType.FREE },
      });
      if (!testTier) {
        await createTestTiers();
        testTier = await prisma.membershipTier.findUnique({
          where: { tier: MembershipTierType.FREE },
        });
      }
    });

    afterEach(async () => {
      // 清理测试数据
      if (testTier) {
        await prisma.tierLimit.deleteMany({
          where: { tierId: testTier.id },
        });
      }
    });

    it('应该能够创建等级限制', async () => {
      const limit = await prisma.tierLimit.create({
        data: {
          tierId: testTier.id,
          limitType: 'MAX_CASES',
          limitValue: 10,
          period: 'monthly',
          description: '每月最多创建10个案件',
        },
      });

      expect(limit).toBeDefined();
      expect(limit.tierId).toBe(testTier.id);
      expect(limit.limitType).toBe('MAX_CASES');
      expect(limit.limitValue).toBe(10);
    });

    it('应该能够查询等级限制', async () => {
      // 创建多个限制
      await prisma.tierLimit.createMany({
        data: [
          {
            tierId: testTier.id,
            limitType: 'MAX_CASES',
            limitValue: 10,
            period: 'monthly',
          },
          {
            tierId: testTier.id,
            limitType: 'MAX_DEBATES',
            limitValue: 5,
            period: 'monthly',
          },
        ],
      });

      const limits = await prisma.tierLimit.findMany({
        where: { tierId: testTier.id },
      });

      expect(limits.length).toBeGreaterThanOrEqual(2);
    });

    it('应该能够创建无限制（null）', async () => {
      const limit = await prisma.tierLimit.create({
        data: {
          tierId: testTier.id,
          limitType: 'MAX_AI_TOKENS_MONTHLY',
          limitValue: null, // 无限制
          description: 'AI令牌无限制',
        },
      });

      expect(limit).toBeDefined();
      expect(limit.limitValue).toBeNull();
    });
  });

  describe('MembershipHistory 模型', () => {
    let testUser: any;
    let testMembership: any;

    beforeEach(async () => {
      // 创建测试用户和会员
      testUser = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          username: `testuser-${Date.now()}`,
          password: 'hashedpassword',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const testTier = await prisma.membershipTier.findUnique({
        where: { tier: MembershipTierType.FREE },
      });
      if (!testTier) {
        await createTestTiers();
      }
      const tier = (await prisma.membershipTier.findUnique({
        where: { tier: MembershipTierType.FREE },
      })) as any;

      testMembership = await prisma.userMembership.create({
        data: {
          userId: testUser.id,
          tierId: tier.id,
          status: MembershipStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: false,
        },
      });
    });

    afterEach(async () => {
      // 清理测试数据
      await prisma.membershipHistory.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.userMembership.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({ where: { id: testUser.id } });
    });

    it('应该能够创建会员变更历史', async () => {
      const history = await prisma.membershipHistory.create({
        data: {
          userId: testUser.id,
          membershipId: testMembership.id,
          changeType: 'UPGRADE',
          fromTier: MembershipTierType.FREE,
          toTier: MembershipTierType.BASIC,
          fromStatus: MembershipStatus.ACTIVE,
          toStatus: MembershipStatus.ACTIVE,
          performedBy: 'system',
          reason: '用户升级会员',
        },
      });

      expect(history).toBeDefined();
      expect(history.userId).toBe(testUser.id);
      expect(history.membershipId).toBe(testMembership.id);
      expect(history.changeType).toBe('UPGRADE');
      expect(history.fromTier).toBe(MembershipTierType.FREE);
      expect(history.toTier).toBe(MembershipTierType.BASIC);
    });

    it('应该能够查询会员变更历史', async () => {
      // 创建多个历史记录
      await prisma.membershipHistory.createMany({
        data: [
          {
            userId: testUser.id,
            membershipId: testMembership.id,
            changeType: 'UPGRADE',
            fromTier: MembershipTierType.FREE,
            toTier: MembershipTierType.BASIC,
            fromStatus: MembershipStatus.ACTIVE,
            toStatus: MembershipStatus.ACTIVE,
            performedBy: 'system',
          },
          {
            userId: testUser.id,
            membershipId: testMembership.id,
            changeType: 'RENEW',
            fromStatus: MembershipStatus.ACTIVE,
            toStatus: MembershipStatus.ACTIVE,
            performedBy: 'system',
            reason: '会员续费',
          },
        ],
      });

      const history = await prisma.membershipHistory.findMany({
        where: {
          userId: testUser.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].changeType).toBeDefined();
    });
  });

  describe('关联关系测试', () => {
    let testUser: any;
    let testMembership: any;

    beforeEach(async () => {
      // 创建测试数据
      testUser = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          username: `testuser-${Date.now()}`,
          password: 'hashedpassword',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const testTier = await prisma.membershipTier.findUnique({
        where: { tier: MembershipTierType.FREE },
      });
      if (!testTier) {
        await createTestTiers();
      }
      const tier = (await prisma.membershipTier.findUnique({
        where: { tier: MembershipTierType.FREE },
      })) as any;

      testMembership = await prisma.userMembership.create({
        data: {
          userId: testUser.id,
          tierId: tier.id,
          status: MembershipStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: false,
        },
      });

      // 创建使用记录
      await prisma.usageRecord.create({
        data: {
          userId: testUser.id,
          membershipId: testMembership.id,
          usageType: 'CASE_CREATED',
          quantity: 1,
          unit: '个',
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // 创建历史记录
      await prisma.membershipHistory.create({
        data: {
          userId: testUser.id,
          membershipId: testMembership.id,
          changeType: 'UPGRADE',
          fromTier: MembershipTierType.FREE,
          toTier: MembershipTierType.BASIC,
          fromStatus: MembershipStatus.ACTIVE,
          toStatus: MembershipStatus.ACTIVE,
          performedBy: 'system',
        },
      });
    });

    afterEach(async () => {
      // 清理测试数据
      await prisma.membershipHistory.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.usageRecord.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.userMembership.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({ where: { id: testUser.id } });
    });

    it('应该能够通过会员关联查询使用记录', async () => {
      const membership = await prisma.userMembership.findUnique({
        where: { id: testMembership.id },
        include: {
          usageRecords: true,
          historyRecords: true,
          user: true,
          tier: true,
        },
      });

      expect(membership).toBeDefined();
      expect(membership?.usageRecords).toBeDefined();
      expect(membership?.usageRecords.length).toBeGreaterThan(0);
      expect(membership?.historyRecords).toBeDefined();
      expect(membership?.historyRecords.length).toBeGreaterThan(0);
      expect(membership?.user).toBeDefined();
      expect(membership?.tier).toBeDefined();
    });

    it('应该能够通过用户关联查询会员信息', async () => {
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: {
          userMemberships: {
            where: { status: MembershipStatus.ACTIVE },
            include: {
              tier: true,
            },
          },
          usageRecords: true,
          membershipHistoryRecords: true,
        },
      });

      expect(user).toBeDefined();
      expect(user?.userMemberships).toBeDefined();
      expect(user?.userMemberships.length).toBeGreaterThan(0);
      expect(user?.usageRecords).toBeDefined();
      expect(user?.membershipHistoryRecords).toBeDefined();
    });
  });
});

/**
 * 辅助函数：创建测试会员等级
 */
async function createTestTiers() {
  const tiers = [
    {
      name: 'free',
      displayName: '免费版',
      description: '基础免费会员',
      tier: MembershipTierType.FREE,
      price: Decimal.from(0),
      currency: 'CNY',
      billingCycle: BillingCycle.MONTHLY,
      features: ['基础功能', '案件创建', '法条检索'],
      permissions: {
        canCreateCase: true,
        canCreateDebate: false,
        canAnalyzeDocument: true,
        canSearchLawArticle: true,
        canUseAdvancedFeatures: false,
        canExportData: false,
        canUseBatchProcessing: false,
        canUseDeepSeek: true,
        canUseZhipuAI: true,
        canUseCustomModel: false,
        prioritySupport: false,
        dedicatedSupport: false,
        customPermissions: {},
      },
      isActive: true,
      sortOrder: 1,
    },
    {
      name: 'basic',
      displayName: '基础版',
      description: '基础付费会员',
      tier: MembershipTierType.BASIC,
      price: Decimal.from(99),
      currency: 'CNY',
      billingCycle: BillingCycle.MONTHLY,
      features: ['基础功能', '案件创建', '辩论生成', '文档分析'],
      permissions: {
        canCreateCase: true,
        canCreateDebate: true,
        canAnalyzeDocument: true,
        canSearchLawArticle: true,
        canUseAdvancedFeatures: true,
        canExportData: true,
        canUseBatchProcessing: false,
        canUseDeepSeek: true,
        canUseZhipuAI: true,
        canUseCustomModel: false,
        prioritySupport: true,
        dedicatedSupport: false,
        customPermissions: {},
      },
      isActive: true,
      sortOrder: 2,
    },
    {
      name: 'professional',
      displayName: '专业版',
      description: '专业付费会员',
      tier: MembershipTierType.PROFESSIONAL,
      price: Decimal.from(299),
      currency: 'CNY',
      billingCycle: BillingCycle.MONTHLY,
      features: ['全部功能', '无限案件', '无限辩论', 'AI高级分析'],
      permissions: {
        canCreateCase: true,
        canCreateDebate: true,
        canAnalyzeDocument: true,
        canSearchLawArticle: true,
        canUseAdvancedFeatures: true,
        canExportData: true,
        canUseBatchProcessing: true,
        canUseDeepSeek: true,
        canUseZhipuAI: true,
        canUseCustomModel: true,
        prioritySupport: true,
        dedicatedSupport: false,
        customPermissions: {},
      },
      isActive: true,
      sortOrder: 3,
    },
    {
      name: 'enterprise',
      displayName: '企业版',
      description: '企业付费会员',
      tier: MembershipTierType.ENTERPRISE,
      price: Decimal.from(999),
      currency: 'CNY',
      billingCycle: BillingCycle.MONTHLY,
      features: ['全部功能', '无限使用', '专属客服', 'API访问'],
      permissions: {
        canCreateCase: true,
        canCreateDebate: true,
        canAnalyzeDocument: true,
        canSearchLawArticle: true,
        canUseAdvancedFeatures: true,
        canExportData: true,
        canUseBatchProcessing: true,
        canUseDeepSeek: true,
        canUseZhipuAI: true,
        canUseCustomModel: true,
        prioritySupport: true,
        dedicatedSupport: true,
        customPermissions: {},
      },
      isActive: true,
      sortOrder: 4,
    },
  ];

  for (const tier of tiers) {
    await prisma.membershipTier.upsert({
      where: { name: tier.name },
      update: {},
      create: tier,
    });
  }
}

/**
 * 辅助函数：清理测试数据
 */
async function cleanupAllTestData() {
  // 删除所有测试数据（以test-开头的）
  await prisma.membershipTier.deleteMany({
    where: {
      name: {
        startsWith: 'test-',
      },
    },
  });

  // 删除createTestTiers创建的测试数据（free、basic等）
  const tierNamesToDelete = ['free', 'basic', 'professional', 'enterprise'];
  await prisma.membershipTier.deleteMany({
    where: {
      name: {
        in: tierNamesToDelete,
      },
    },
  });
}
