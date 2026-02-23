/**
 * 使用量记录模块测试
 *
 * 测试使用量记录、查询和限制检查功能
 */

import {
  recordUsage,
  batchRecordUsage,
  getUsageStats,
  checkUsageLimit,
} from '@/lib/usage/record-usage';
import { PrismaClient, MembershipStatus, LimitType } from '@prisma/client';
import type { UsageType } from '@/types/membership';

const prisma = new PrismaClient();

describe('使用量记录模块测试', () => {
  let testUserId: string;
  let _testMembershipId: string;
  let testTierId: string;

  beforeAll(async () => {
    // 创建测试等级
    const tier = await prisma.membershipTier.upsert({
      where: { name: 'test-free' },
      update: {},
      create: {
        name: 'test-free',
        displayName: '测试免费版',
        description: '测试用的免费版会员',
        tier: 'FREE',
        price: 0,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
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
    });
    testTierId = tier.id;

    // 创建会员等级限制
    const limits = [
      { limitType: 'MAX_CASES', limitValue: 3 },
      { limitType: 'MAX_DEBATES', limitValue: 0 },
      { limitType: 'MAX_DOCUMENTS', limitValue: 5 },
      { limitType: 'MAX_LAW_ARTICLE_SEARCHES', limitValue: 50 },
      { limitType: 'MAX_AI_TOKENS_MONTHLY', limitValue: 10000 },
      { limitType: 'MAX_STORAGE_MB', limitValue: 100 },
    ];

    for (const limit of limits) {
      await prisma.tierLimit.upsert({
        where: {
          tierId_limitType: {
            tierId: testTierId,
            limitType: limit.limitType as LimitType,
          },
        },
        update: { limitValue: limit.limitValue },
        create: {
          tierId: testTierId,
          limitType: limit.limitType as LimitType,
          limitValue: limit.limitValue,
        },
      });
    }

    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: `usage-test-${Date.now()}@example.com`,
        username: `usageuser-${Date.now()}`,
        password: 'hashedpassword',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    testUserId = user.id;

    // 创建测试会员
    const membership = await prisma.userMembership.create({
      data: {
        userId: testUserId,
        tierId: testTierId,
        status: MembershipStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: false,
      },
    });
    testMembershipId = membership.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.usageRecord.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.userMembership.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('recordUsage 函数', () => {
    it('应该能够记录使用量', async () => {
      const usageId = await recordUsage({
        userId: testUserId,
        usageType: 'CASE_CREATED' as UsageType,
        quantity: 1,
        unit: '个',
        description: '创建测试案件',
      });

      expect(typeof usageId).toBe('string');

      // 验证记录是否创建
      const record = await prisma.usageRecord.findUnique({
        where: { id: usageId },
      });

      expect(record).toBeDefined();
      expect(record?.userId).toBe(testUserId);
      expect(record?.usageType).toBe('CASE_CREATED');
      expect(record?.quantity).toBe(1);
    });

    it('应该能够记录不同类型的使用量', async () => {
      const usageTypes: UsageType[] = [
        'DEBATE_GENERATED' as UsageType,
        'DOCUMENT_ANALYZED' as UsageType,
        'LAW_ARTICLE_SEARCHED' as UsageType,
        'AI_TOKEN_USED' as UsageType,
        'STORAGE_USED' as UsageType,
      ];

      for (const type of usageTypes) {
        const usageId = await recordUsage({
          userId: testUserId,
          usageType: type,
          quantity: 10,
        });

        expect(typeof usageId).toBe('string');
      }

      // 验证所有记录都已创建
      const records = await prisma.usageRecord.findMany({
        where: { userId: testUserId },
      });

      expect(records.length).toBeGreaterThanOrEqual(usageTypes.length);
    });

    it('应该能够记录带资源信息的使用量', async () => {
      const usageId = await recordUsage({
        userId: testUserId,
        usageType: 'DOCUMENT_ANALYZED' as UsageType,
        quantity: 1,
        resourceId: 'test-doc-id',
        resourceType: 'DOCUMENT',
        metadata: { fileName: 'test.pdf' },
      });

      const record = await prisma.usageRecord.findUnique({
        where: { id: usageId },
      });

      expect(record).toBeDefined();
      expect(record?.resourceId).toBe('test-doc-id');
      expect(record?.resourceType).toBe('DOCUMENT');
      expect(record?.metadata).toBeDefined();
    });

    it('应该在用户没有活跃会员时抛出错误', async () => {
      const inactiveUserId = `inactive-${Date.now()}`;
      let testUserCreated = false;

      try {
        await prisma.user.create({
          data: {
            email: `${inactiveUserId}@example.com`,
            password: 'hashedpassword',
            role: 'USER',
            status: 'ACTIVE',
          },
        });
        testUserCreated = true;

        await expect(
          recordUsage({
            userId: inactiveUserId,
            usageType: 'CASE_CREATED' as UsageType,
            quantity: 1,
          })
        ).rejects.toThrow();
      } finally {
        // 清理
        if (testUserCreated) {
          try {
            await prisma.user.delete({ where: { id: inactiveUserId } });
          } catch (error) {
            // 忽略删除错误
          }
        }
      }
    });

    it('应该使用月度周期', async () => {
      const now = new Date();
      const expectedPeriodStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );
      const expectedPeriodEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      const usageId = await recordUsage({
        userId: testUserId,
        usageType: 'CASE_CREATED' as UsageType,
        quantity: 1,
      });

      const record = await prisma.usageRecord.findUnique({
        where: { id: usageId },
      });

      expect(record).toBeDefined();
      expect(record?.periodStart.toISOString()).toBe(
        expectedPeriodStart.toISOString()
      );
      expect(record?.periodEnd.toISOString()).toBe(
        expectedPeriodEnd.toISOString()
      );
    });
  });

  describe('batchRecordUsage 函数', () => {
    it('应该能够批量记录使用量', async () => {
      const records = [
        {
          userId: testUserId,
          usageType: 'CASE_CREATED' as UsageType,
          quantity: 1,
        },
        {
          userId: testUserId,
          usageType: 'DEBATE_GENERATED' as UsageType,
          quantity: 2,
        },
        {
          userId: testUserId,
          usageType: 'DOCUMENT_ANALYZED' as UsageType,
          quantity: 3,
        },
      ];

      const count = await batchRecordUsage(records);

      expect(count).toBe(3);

      // 验证所有记录都已创建
      const userRecords = await prisma.usageRecord.findMany({
        where: { userId: testUserId },
      });

      expect(userRecords.length).toBeGreaterThanOrEqual(3);
    });

    it('应该在部分记录失败时抛出错误', async () => {
      const invalidUserId = `invalid-${Date.now()}`;
      const records = [
        {
          userId: testUserId,
          usageType: 'CASE_CREATED' as UsageType,
          quantity: 1,
        },
        {
          userId: invalidUserId,
          usageType: 'DEBATE_GENERATED' as UsageType,
          quantity: 2,
        },
      ];

      await expect(batchRecordUsage(records)).rejects.toThrow();
    });
  });

  describe('getUsageStats 函数', () => {
    beforeEach(async () => {
      // 清理之前的使用记录
      await prisma.usageRecord.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('应该能够获取使用量统计', async () => {
      // 创建测试使用记录
      await recordUsage({
        userId: testUserId,
        usageType: 'CASE_CREATED' as UsageType,
        quantity: 3,
      });

      await recordUsage({
        userId: testUserId,
        usageType: 'DEBATE_GENERATED' as UsageType,
        quantity: 2,
      });

      await recordUsage({
        userId: testUserId,
        usageType: 'DOCUMENT_ANALYZED' as UsageType,
        quantity: 5,
      });

      await recordUsage({
        userId: testUserId,
        usageType: 'LAW_ARTICLE_SEARCHED' as UsageType,
        quantity: 10,
      });

      await recordUsage({
        userId: testUserId,
        usageType: 'AI_TOKEN_USED' as UsageType,
        quantity: 1000,
      });

      await recordUsage({
        userId: testUserId,
        usageType: 'STORAGE_USED' as UsageType,
        quantity: 50,
      });

      const stats = await getUsageStats(testUserId);

      expect(stats).toBeDefined();
      expect(stats.userId).toBe(testUserId);
      expect(stats.casesCreated).toBeGreaterThanOrEqual(3);
      expect(stats.debatesGenerated).toBeGreaterThanOrEqual(2);
      expect(stats.documentsAnalyzed).toBeGreaterThanOrEqual(5);
      expect(stats.lawArticleSearches).toBeGreaterThanOrEqual(10);
      expect(stats.aiTokensUsed).toBeGreaterThanOrEqual(1000);
      expect(stats.storageUsedMB).toBeGreaterThanOrEqual(50);
      expect(stats.limits).toBeDefined();
      expect(stats.remaining).toBeDefined();
    });

    it('应该能够使用自定义时间范围', async () => {
      const customStart = new Date('2024-01-01');
      const customEnd = new Date('2024-01-31');

      const stats = await getUsageStats(testUserId, customStart, customEnd);

      expect(stats).toBeDefined();
      expect(stats.periodStart.toISOString()).toBe(customStart.toISOString());
      expect(stats.periodEnd.toISOString()).toBe(customEnd.toISOString());
    });

    it('应该在用户没有活跃会员时抛出错误', async () => {
      const inactiveUserId = `inactive-stats-${Date.now()}`;
      let testUserCreated = false;

      try {
        await prisma.user.create({
          data: {
            email: `${inactiveUserId}@example.com`,
            password: 'hashedpassword',
            role: 'USER',
            status: 'ACTIVE',
          },
        });
        testUserCreated = true;

        await expect(getUsageStats(inactiveUserId)).rejects.toThrow();
      } finally {
        // 清理
        if (testUserCreated) {
          try {
            await prisma.user.delete({ where: { id: inactiveUserId } });
          } catch (error) {
            // 忽略删除错误
          }
        }
      }
    });

    it('应该正确计算剩余额度', async () => {
      // 创建测试使用记录
      await recordUsage({
        userId: testUserId,
        usageType: 'CASE_CREATED' as UsageType,
        quantity: 2,
      });

      await recordUsage({
        userId: testUserId,
        usageType: 'DOCUMENT_ANALYZED' as UsageType,
        quantity: 3,
      });

      const stats = await getUsageStats(testUserId);

      expect(stats.remaining).toBeDefined();

      // 根据FREE会员的限制验证
      // FREE: 3 cases/month, 0 debates (禁用), 5 docs, 50 searches, 10000 tokens, 100MB storage
      expect(stats.remaining.cases).toBeGreaterThanOrEqual(1); // 3-2=1
      expect(stats.remaining.debates).toBe(0); // 0表示禁用，没有剩余
      expect(stats.remaining.documents).toBeGreaterThanOrEqual(2); // 5-3=2
    });
  });

  describe('checkUsageLimit 函数', () => {
    beforeEach(async () => {
      // 清理之前的使用记录
      await prisma.usageRecord.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('应该能够检查使用量限制', async () => {
      // 创建测试使用记录
      await recordUsage({
        userId: testUserId,
        usageType: 'CASE_CREATED' as UsageType,
        quantity: 1,
      });

      const result = await checkUsageLimit(
        testUserId,
        'CASE_CREATED' as UsageType,
        1
      );

      expect(result).toBeDefined();
      expect(typeof result.exceeded).toBe('boolean');
      expect(typeof result.currentUsage).toBe('number');
      expect(result.limit).toBeGreaterThanOrEqual(0);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it('应该正确判断未超过限制', async () => {
      // 创建测试使用记录
      await recordUsage({
        userId: testUserId,
        usageType: 'CASE_CREATED' as UsageType,
        quantity: 1,
      });

      const result = await checkUsageLimit(
        testUserId,
        'CASE_CREATED' as UsageType,
        1
      );

      // FREE会员: 3 cases/month，当前已用1个，再用1个应该不超过
      expect(result.exceeded).toBe(false);
      expect(result.currentUsage).toBe(1);
      expect(result.remaining).toBe(1); // 3-1-1=1
    });

    it('应该正确判断超过限制', async () => {
      // 创建更多使用记录，接近限制
      await recordUsage({
        userId: testUserId,
        usageType: 'CASE_CREATED' as UsageType,
        quantity: 3,
      });

      const result = await checkUsageLimit(
        testUserId,
        'CASE_CREATED' as UsageType,
        1
      );

      // FREE会员: 3 cases/month，当前已用3个，再用1个应该超过
      expect(result.exceeded).toBe(true);
      expect(result.currentUsage).toBe(3);
      expect(result.remaining).toBe(0);
    });

    it('应该支持检查不同类型的使用量', async () => {
      const caseResult = await checkUsageLimit(
        testUserId,
        'CASE_CREATED' as UsageType
      );

      const docResult = await checkUsageLimit(
        testUserId,
        'DOCUMENT_ANALYZED' as UsageType
      );

      expect(caseResult).toBeDefined();
      expect(docResult).toBeDefined();
    });

    it('应该正确处理无限制的类型', async () => {
      // 需要创建一个无限制的会员等级
      const unlimitedTier = await prisma.membershipTier.upsert({
        where: { name: 'test-unlimited' },
        update: {},
        create: {
          name: 'test-unlimited',
          displayName: '测试无限版',
          description: '测试用的无限版会员',
          tier: 'ENTERPRISE',
          price: 0,
          currency: 'CNY',
          billingCycle: 'MONTHLY',
          features: ['无限功能'],
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
          sortOrder: 2,
        },
      });

      // 创建无限制的AI令牌限制（limitValue为null表示无限制）
      await prisma.tierLimit.upsert({
        where: {
          tierId_limitType: {
            tierId: unlimitedTier.id,
            limitType: 'MAX_AI_TOKENS_MONTHLY' as LimitType,
          },
        },
        update: { limitValue: null },
        create: {
          tierId: unlimitedTier.id,
          limitType: 'MAX_AI_TOKENS_MONTHLY' as LimitType,
          limitValue: null,
        },
      });

      // 创建测试用户和会员
      const unlimitedUser = await prisma.user.create({
        data: {
          email: `unlimited-${Date.now()}@example.com`,
          password: 'hashedpassword',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      await prisma.userMembership.create({
        data: {
          userId: unlimitedUser.id,
          tierId: unlimitedTier.id,
          status: MembershipStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: false,
        },
      });

      try {
        const result = await checkUsageLimit(
          unlimitedUser.id,
          'AI_TOKEN_USED' as UsageType,
          10000
        );

        // 如果限制是null，应该返回remaining为null
        expect(result.exceeded).toBe(false);
        expect(result.limit).toBeNull();
        expect(result.remaining).toBeNull();
      } finally {
        // 清理
        await prisma.userMembership.deleteMany({
          where: { userId: unlimitedUser.id },
        });
        await prisma.user.delete({ where: { id: unlimitedUser.id } });
      }
    });
  });
});
