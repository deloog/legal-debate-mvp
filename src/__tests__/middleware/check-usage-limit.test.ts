/**
 * 使用量限制检查中间件测试
 *
 * 测试使用量限制检查中间件的功能
 */

import {
  enforceUsageLimit,
  validateUsageLimit,
  checkAndRecordUsage,
  checkUsageLimitForRequest,
  createUsageLimitErrorResponse,
} from '@/lib/middleware/check-usage-limit';
import { checkUsageLimit, recordUsage } from '@/lib/usage/record-usage';
import { PrismaClient, MembershipStatus } from '@prisma/client';
import type { UsageType } from '@/types/membership';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

describe('使用量限制检查中间件测试', () => {
  let testUserId: string;
  let __testMembershipId: string;
  let testTierId: string;

  beforeAll(async () => {
    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: `middleware-test-${Date.now()}@example.com`,
        username: `middlewareuser-${Date.now()}`,
        password: 'hashedpassword',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    testUserId = user.id;

    // 创建测试等级
    const tier = await prisma.membershipTier.findFirst({
      where: { tier: 'FREE' },
    });

    if (!tier) {
      throw new Error('FREE tier not found');
    }
    testTierId = tier.id;

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

  describe('enforceUsageLimit 函数', () => {
    beforeEach(async () => {
      // 清理使用记录
      await prisma.usageRecord.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('应该能够在未超过限制时返回null', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: new Headers({
          Authorization: 'Bearer test-token',
        }),
      }) as any;

      // 设置userId属性
      Object.defineProperty(request, 'userId', {
        value: testUserId,
        writable: false,
      });

      const middleware = enforceUsageLimit(
        'CASE_CREATED' as UsageType,
        1,
        false
      );

      const result = await middleware(request, testUserId);

      expect(result).toBeNull();
    });

    it('应该在超过限制时返回429响应', async () => {
      // 创建使用记录，达到限制
      await recordUsage({
        userId: testUserId,
        usageType: 'CASE_CREATED' as UsageType,
        quantity: 3,
      });

      const request = new NextRequest('http://localhost:3000/api/test') as any;

      const middleware = enforceUsageLimit(
        'CASE_CREATED' as UsageType,
        1,
        false
      );

      const result = await middleware(request, testUserId);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
      const responseData = await result?.json();
      expect(responseData.error).toBe('使用量已超过限制');
    });

    it('应该在用户未认证时返回401响应', async () => {
      const request = new NextRequest('http://localhost:3000/api/test') as any;
      const middleware = enforceUsageLimit(
        'CASE_CREATED' as UsageType,
        1,
        false
      );

      const result = await middleware(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
      const responseData = await result?.json();
      expect(responseData.error).toBe('未认证');
    });

    it('应该支持指定userId', async () => {
      const request = new NextRequest('http://localhost:3000/api/test') as any;
      const middleware = enforceUsageLimit(
        'CASE_CREATED' as UsageType,
        1,
        false
      );

      const result = await middleware(request, testUserId);

      expect(result).toBeNull();
    });

    it('应该在recordAfterCheck为true时记录使用量', async () => {
      const request = new NextRequest('http://localhost:3000/api/test') as any;
      const middleware = enforceUsageLimit(
        'CASE_CREATED' as UsageType,
        1,
        true
      );

      const result = await middleware(request, testUserId);

      expect(result).toBeNull();

      // 验证使用量已记录
      const records = await prisma.usageRecord.findMany({
        where: {
          userId: testUserId,
          usageType: 'CASE_CREATED',
        },
      });

      expect(records.length).toBeGreaterThan(0);
    });
  });

  describe('checkUsageLimit 函数集成测试', () => {
    beforeEach(async () => {
      // 清理使用记录
      await prisma.usageRecord.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('应该能够检查使用量限制', async () => {
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

      expect(result.exceeded).toBe(false);
      expect(result.currentUsage).toBe(1);
      expect(result.remaining).toBeGreaterThanOrEqual(1); // 3-1-1=1
    });

    it('应该正确判断超过限制', async () => {
      // 创建使用记录，接近限制
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

      expect(result.exceeded).toBe(true);
      expect(result.currentUsage).toBe(3);
      expect(result.remaining).toBe(0);
    });

    it('应该支持检查不同类型的使用量', async () => {
      await recordUsage({
        userId: testUserId,
        usageType: 'CASE_CREATED' as UsageType,
        quantity: 1,
      });

      await recordUsage({
        userId: testUserId,
        usageType: 'DOCUMENT_ANALYZED' as UsageType,
        quantity: 2,
      });

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

    it('应该正确处理有限制的类型', async () => {
      const result = await checkUsageLimit(
        testUserId,
        'AI_TOKEN_USED' as UsageType,
        1000
      );

      // FREE会员的AI_TOKEN限制是10000
      expect(result.exceeded).toBe(false);
      expect(result.limit).toBeGreaterThanOrEqual(0);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recordUsage 函数集成测试', () => {
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
  });

  describe('checkUsageLimitForRequest 函数', () => {
    beforeEach(async () => {
      // 清理使用记录
      await prisma.usageRecord.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('应该在用户未认证时返回未授权结果', async () => {
      const request = new NextRequest('http://localhost:3000/api/test') as any;

      const result = await checkUsageLimitForRequest(
        request,
        'CASE_CREATED' as UsageType,
        1
      );

      expect(result).toBeDefined();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('未认证');
    });

    it('应该返回检查结果', async () => {
      const request = new NextRequest('http://localhost:3000/api/test') as any;

      // 设置userId属性
      Object.defineProperty(request, 'userId', {
        value: testUserId,
        writable: false,
      });

      const result = await checkUsageLimitForRequest(
        request,
        'CASE_CREATED' as UsageType,
        1
      );

      expect(result).toBeDefined();
      expect(typeof result.allowed).toBe('boolean');
      expect(typeof result.currentUsage).toBe('number');
    });
  });

  describe('validateUsageLimit 函数', () => {
    beforeEach(async () => {
      // 清理使用记录
      await prisma.usageRecord.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('应该返回null当检查通过时', async () => {
      const request = new NextRequest('http://localhost:3000/api/test') as any;

      const middleware = enforceUsageLimit(
        'CASE_CREATED' as UsageType,
        1,
        false
      );
      const result = await middleware(request, testUserId);

      expect(result).toBeNull();
    });

    it('应该返回429响应当超过限制时', async () => {
      const request = new NextRequest('http://localhost:3000/api/test') as any;

      // 创建使用记录，达到限制
      await recordUsage({
        userId: testUserId,
        usageType: 'CASE_CREATED' as UsageType,
        quantity: 3,
      });

      const middleware = enforceUsageLimit(
        'CASE_CREATED' as UsageType,
        1,
        false
      );
      const result = await middleware(request, testUserId);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('应该返回401响应当用户未认证时', async () => {
      const request = new NextRequest('http://localhost:3000/api/test') as any;

      const middleware = enforceUsageLimit(
        'CASE_CREATED' as UsageType,
        1,
        false
      );
      const result = await middleware(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });
  });

  describe('checkAndRecordUsage 函数', () => {
    it('应该返回401响应当用户未认证时', async () => {
      const request = new NextRequest('http://localhost:3000/api/test') as any;

      const result = await checkAndRecordUsage(
        request,
        'CASE_CREATED' as UsageType,
        1
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });
  });

  describe('createUsageLimitErrorResponse 函数', () => {
    it('应该创建429错误响应', () => {
      const limitCheck = {
        currentUsage: 3,
        limit: 3,
        remaining: 0,
      };

      const response = createUsageLimitErrorResponse(
        'CASE_CREATED' as UsageType,
        limitCheck
      );

      expect(response.status).toBe(429);
    });
  });
});
