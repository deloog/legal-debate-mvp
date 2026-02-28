/**
 * 准确性监控模块测试
 */

import {
  AccuracyMonitor,
  calculateAccuracyMetrics,
  identifyLowQualityRelations,
} from '@/lib/knowledge-graph/quality-monitor/accuracy-monitor';
import { testPrisma } from '@/test-utils/database';
import {
  RelationFeedbackType,
  VerificationStatus,
  DiscoveryMethod,
} from '@prisma/client';
import { setupTestDatabase, cleanupTestDatabase } from '@/test-utils/database';

describe('AccuracyMonitor', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('calculateAccuracyMetrics', () => {
    test('应该正确计算准确性指标 - 无反馈', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '001',
            fullText: '测试内容',
            searchableText: '民法典 001 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '002',
            fullText: '测试内容',
            searchableText: '民法典 002 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      const relations = await testPrisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: articles[0].id,
            targetId: articles[1].id,
            relationType: 'CITES',
            strength: 0.8,
            confidence: 0.9,
            verificationStatus: VerificationStatus.PENDING,
            discoveryMethod: DiscoveryMethod.MANUAL,
          },
          {
            sourceId: articles[1].id,
            targetId: articles[0].id,
            relationType: 'CITED_BY',
            strength: 0.7,
            confidence: 0.85,
            verificationStatus: VerificationStatus.VERIFIED,
            verifiedBy: 'admin',
            verifiedAt: new Date(),
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
          },
        ],
      });

      // 执行
      const metrics = await calculateAccuracyMetrics({});

      // 验证
      expect(metrics.totalRelations).toBe(2);
      expect(metrics.verifiedRelations).toBe(1);
      expect(metrics.userFeedbackCount).toBe(0);
      expect(metrics.positiveFeedbackCount).toBe(0);
      expect(metrics.negativeFeedbackCount).toBe(0);
      expect(metrics.positiveFeedbackRate).toBe(1); // 默认1.0
      expect(metrics.verificationRate).toBe(0.5);
    });

    test('应该正确计算准确性指标 - 有正面反馈', async () => {
      // 准备测试数据
      const user = await testPrisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed_password',
          role: 'USER',
        },
      });

      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '003',
            fullText: '测试内容',
            searchableText: '民法典 003 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '004',
            fullText: '测试内容',
            searchableText: '民法典 004 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      const relation = await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.9,
          confidence: 0.95,
          verificationStatus: VerificationStatus.VERIFIED,
          discoveryMethod: DiscoveryMethod.MANUAL,
        },
      });

      // 添加正面反馈
      await testPrisma.relationFeedback.createMany({
        data: [
          {
            userId: user.id,
            relationId: relation.id,
            feedbackType: RelationFeedbackType.ACCURATE,
          },
          {
            userId: user.id,
            relationId: relation.id,
            feedbackType: RelationFeedbackType.ACCURATE,
          },
        ],
      });

      // 执行
      const metrics = await calculateAccuracyMetrics({});

      // 验证
      expect(metrics.totalRelations).toBe(1);
      expect(metrics.userFeedbackCount).toBe(2);
      expect(metrics.positiveFeedbackCount).toBe(2);
      expect(metrics.negativeFeedbackCount).toBe(0);
      expect(metrics.positiveFeedbackRate).toBe(1);
    });

    test('应该正确计算准确性指标 - 有负面反馈', async () => {
      // 准备测试数据
      const user = await testPrisma.user.create({
        data: {
          email: 'test2@example.com',
          password: 'hashed_password',
          role: 'USER',
        },
      });

      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '005',
            fullText: '测试内容',
            searchableText: '民法典 005 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '006',
            fullText: '测试内容',
            searchableText: '民法典 006 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      const relation = await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CONFLICTS',
          strength: 0.6,
          confidence: 0.7,
          verificationStatus: VerificationStatus.VERIFIED,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
        },
      });

      // 添加负面反馈
      await testPrisma.relationFeedback.createMany({
        data: [
          {
            userId: user.id,
            relationId: relation.id,
            feedbackType: RelationFeedbackType.INACCURATE,
          },
          {
            userId: user.id,
            relationId: relation.id,
            feedbackType: RelationFeedbackType.SHOULD_REMOVE,
          },
        ],
      });

      // 执行
      const metrics = await calculateAccuracyMetrics({});

      // 验证
      expect(metrics.totalRelations).toBe(1);
      expect(metrics.userFeedbackCount).toBe(2);
      expect(metrics.positiveFeedbackCount).toBe(0);
      expect(metrics.negativeFeedbackCount).toBe(2);
      expect(metrics.positiveFeedbackRate).toBe(0);
    });

    test('应该支持按关系类型过滤', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '007',
            fullText: '测试内容',
            searchableText: '民法典 007 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '008',
            fullText: '测试内容',
            searchableText: '民法典 008 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '009',
            fullText: '测试内容',
            searchableText: '民法典 009 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      await testPrisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: articles[0].id,
            targetId: articles[1].id,
            relationType: 'CITES',
            strength: 0.8,
            confidence: 0.9,
            verificationStatus: VerificationStatus.VERIFIED,
            discoveryMethod: DiscoveryMethod.MANUAL,
          },
          {
            sourceId: articles[1].id,
            targetId: articles[2].id,
            relationType: 'CONFLICTS',
            strength: 0.7,
            confidence: 0.85,
            verificationStatus: VerificationStatus.VERIFIED,
            discoveryMethod: DiscoveryMethod.MANUAL,
          },
        ],
      });

      // 执行 - 只查询CITES类型
      const metrics = await calculateAccuracyMetrics({ relationType: 'CITES' });

      // 验证
      expect(metrics.totalRelations).toBe(1);
    });

    test('应该支持按发现方式过滤', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '010',
            fullText: '测试内容',
            searchableText: '民法典 010 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '011',
            fullText: '测试内容',
            searchableText: '民法典 011 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      await testPrisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: articles[0].id,
            targetId: articles[1].id,
            relationType: 'CITES',
            strength: 0.8,
            confidence: 0.9,
            verificationStatus: VerificationStatus.VERIFIED,
            discoveryMethod: DiscoveryMethod.MANUAL,
          },
          {
            sourceId: articles[1].id,
            targetId: articles[0].id,
            relationType: 'CITED_BY',
            strength: 0.7,
            confidence: 0.85,
            verificationStatus: VerificationStatus.VERIFIED,
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
          },
        ],
      });

      // 执行 - 只查询AI检测的关系
      const metrics = await calculateAccuracyMetrics({
        discoveryMethod: DiscoveryMethod.AI_DETECTED,
      });

      // 验证
      expect(metrics.totalRelations).toBe(1);
    });
  });

  describe('identifyLowQualityRelations', () => {
    test('应该识别高负面反馈率的关系', async () => {
      // 准备测试数据
      const user = await testPrisma.user.create({
        data: {
          email: 'test3@example.com',
          password: 'hashed_password',
          role: 'USER',
        },
      });

      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '012',
            fullText: '测试内容',
            searchableText: '民法典 012 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '013',
            fullText: '测试内容',
            searchableText: '民法典 013 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      const lowQualityRelation = await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.5,
          confidence: 0.6,
          verificationStatus: VerificationStatus.VERIFIED,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
        },
      });

      // 添加负面反馈（80%负面反馈率）
      await testPrisma.relationFeedback.createMany({
        data: [
          {
            userId: user.id,
            relationId: lowQualityRelation.id,
            feedbackType: RelationFeedbackType.INACCURATE,
          },
          {
            userId: user.id,
            relationId: lowQualityRelation.id,
            feedbackType: RelationFeedbackType.SHOULD_REMOVE,
          },
          {
            userId: user.id,
            relationId: lowQualityRelation.id,
            feedbackType: RelationFeedbackType.WRONG_TYPE,
          },
          {
            userId: user.id,
            relationId: lowQualityRelation.id,
            feedbackType: RelationFeedbackType.ACCURATE,
          },
        ],
      });

      // 执行
      const lowQualityRelations = await identifyLowQualityRelations(0.5); // 阈值0.5

      // 验证
      expect(lowQualityRelations).toHaveLength(1);
      expect(lowQualityRelations[0].relationId).toBe(lowQualityRelation.id);
      expect(lowQualityRelations[0].negativeFeedbackRate).toBe(0.75); // 3/4
      expect(lowQualityRelations[0].feedbackCount).toBe(4);
      expect(lowQualityRelations[0].negativeFeedbackCount).toBe(3);
    });

    test('应该只返回超过阈值的关系', async () => {
      // 准备测试数据
      const user = await testPrisma.user.create({
        data: {
          email: 'test4@example.com',
          password: 'hashed_password',
          role: 'USER',
        },
      });

      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '014',
            fullText: '测试内容',
            searchableText: '民法典 014 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '015',
            fullText: '测试内容',
            searchableText: '民法典 015 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '016',
            fullText: '测试内容',
            searchableText: '民法典 016 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      const relation1 = await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
          verificationStatus: VerificationStatus.VERIFIED,
          discoveryMethod: DiscoveryMethod.MANUAL,
        },
      });

      const relation2 = await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[1].id,
          targetId: articles[2].id,
          relationType: 'CONFLICTS',
          strength: 0.7,
          confidence: 0.85,
          verificationStatus: VerificationStatus.VERIFIED,
          discoveryMethod: DiscoveryMethod.MANUAL,
        },
      });

      // relation1: 50%负面反馈率
      await testPrisma.relationFeedback.createMany({
        data: [
          {
            userId: user.id,
            relationId: relation1.id,
            feedbackType: RelationFeedbackType.INACCURATE,
          },
          {
            userId: user.id,
            relationId: relation1.id,
            feedbackType: RelationFeedbackType.ACCURATE,
          },
        ],
      });

      // relation2: 25%负面反馈率
      await testPrisma.relationFeedback.createMany({
        data: [
          {
            userId: user.id,
            relationId: relation2.id,
            feedbackType: RelationFeedbackType.SHOULD_REMOVE,
          },
          {
            userId: user.id,
            relationId: relation2.id,
            feedbackType: RelationFeedbackType.ACCURATE,
          },
          {
            userId: user.id,
            relationId: relation2.id,
            feedbackType: RelationFeedbackType.ACCURATE,
          },
        ],
      });

      // 执行 - 阈值0.5
      const lowQualityRelations = await identifyLowQualityRelations(0.5);

      // 验证 - 只有relation1超过阈值
      expect(lowQualityRelations).toHaveLength(1);
      expect(lowQualityRelations[0].relationId).toBe(relation1.id);
    });

    test('应该正确处理无反馈的关系', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '017',
            fullText: '测试内容',
            searchableText: '民法典 017 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '018',
            fullText: '测试内容',
            searchableText: '民法典 018 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
          verificationStatus: VerificationStatus.VERIFIED,
          discoveryMethod: DiscoveryMethod.MANUAL,
        },
      });

      // 执行
      const lowQualityRelations = await identifyLowQualityRelations(0.5);

      // 验证 - 无反馈的关系不应被标记为低质量
      expect(lowQualityRelations).toHaveLength(0);
    });
  });

  describe('AccuracyMonitor类', () => {
    test('应该能够初始化', () => {
      const monitor = new AccuracyMonitor();
      expect(monitor).toBeDefined();
    });

    test('应该提供calculateAccuracyMetrics方法', async () => {
      const monitor = new AccuracyMonitor();
      const metrics = await monitor.calculateMetrics({});
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalRelations).toBe('number');
    });

    test('应该提供identifyLowQualityRelations方法', async () => {
      const monitor = new AccuracyMonitor();
      const lowQualityRelations =
        await monitor.identifyLowQualityRelations(0.5);
      expect(Array.isArray(lowQualityRelations)).toBe(true);
    });
  });
});
