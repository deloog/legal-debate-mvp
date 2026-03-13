/**
 * LawArticleRelation Schema 测试
 *
 * 测试 LawArticleRelation 模型的扩展字段
 * - rejectionReason: 审核拒绝原因
 * - aiProvider: AI服务提供商
 * - aiModel: AI模型版本
 * - aiConfidence: AI置信度
 * - aiReasoning: AI推理过程
 * - reviewHistory: 审核历史记录
 * - aiCreatedAt: AI创建时间
 */

import { PrismaClient } from '@prisma/client';
import { testPrisma, resetDatabase } from '@/test-utils/database';

const prisma = testPrisma;

describe('LawArticleRelation Schema - 扩展字段', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  describe('rejectionReason 字段', () => {
    it('应该能够存储审核拒绝原因', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          verificationStatus: 'REJECTED',
          rejectionReason: '引用关系不成立',
          createdBy: 'user-123',
        },
      });

      expect(relation.rejectionReason).toBe('引用关系不成立');
    });

    it('应该允许 rejectionReason 为 null', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          verificationStatus: 'PENDING',
          createdBy: 'user-123',
        },
      });

      expect(relation.rejectionReason).toBeNull();
    });

    it('应该支持长文本的拒绝原因', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const longReason =
        '引用关系不成立。经过仔细审查法条内容，发现两条法条之间不存在实质性的引用关系。第一条法条主要论述的是合同解除的条件，而第二条法条涉及的是违约责任，两者在法律适用范围上没有直接关联。因此，建议撤销该关系。';

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          verificationStatus: 'REJECTED',
          rejectionReason: longReason,
          createdBy: 'user-123',
        },
      });

      expect(relation.rejectionReason).toBe(longReason);
    });
  });

  describe('aiProvider 字段', () => {
    it('应该能够存储 AI 服务提供商', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'AI_DETECTED',
          aiProvider: 'deepseek',
          createdBy: 'user-123',
        },
      });

      expect(relation.aiProvider).toBe('deepseek');
    });

    it('应该支持不同的 AI 提供商', async () => {
      const providers = ['deepseek', 'zhipu', 'custom'];

      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      for (const provider of providers) {
        const relation = await prisma.lawArticleRelation.create({
          data: {
            sourceId: article1.id,
            targetId: article2.id,
            relationType: 'CITES',
            discoveryMethod: 'AI_DETECTED',
            aiProvider: provider,
            createdBy: 'user-123',
          },
        });

        expect(relation.aiProvider).toBe(provider);
      }
    });

    it('应该允许 aiProvider 为 null', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'MANUAL',
          createdBy: 'user-123',
        },
      });

      expect(relation.aiProvider).toBeNull();
    });
  });

  describe('aiModel 字段', () => {
    it('应该能够存储 AI 模型版本', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'AI_DETECTED',
          aiProvider: 'deepseek',
          aiModel: 'deepseek-chat-v3',
          createdBy: 'user-123',
        },
      });

      expect(relation.aiModel).toBe('deepseek-chat-v3');
    });

    it('应该允许 aiModel 为 null', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'MANUAL',
          createdBy: 'user-123',
        },
      });

      expect(relation.aiModel).toBeNull();
    });
  });

  describe('aiConfidence 字段', () => {
    it('应该能够存储 AI 置信度', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'AI_DETECTED',
          aiProvider: 'deepseek',
          aiModel: 'deepseek-chat-v3',
          aiConfidence: 0.95,
          createdBy: 'user-123',
        },
      });

      expect(relation.aiConfidence).toBe(0.95);
    });

    it('应该允许 aiConfidence 为 null', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'MANUAL',
          createdBy: 'user-123',
        },
      });

      expect(relation.aiConfidence).toBeNull();
    });

    it('应该支持 0-1 范围的置信度', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const testCases = [0.0, 0.5, 0.99, 1.0];

      for (const confidence of testCases) {
        const relation = await prisma.lawArticleRelation.create({
          data: {
            sourceId: article1.id,
            targetId: article2.id,
            relationType: 'CITES',
            discoveryMethod: 'AI_DETECTED',
            aiProvider: 'deepseek',
            aiConfidence: confidence,
            createdBy: 'user-123',
          },
        });

        expect(relation.aiConfidence).toBe(confidence);
      }
    });
  });

  describe('aiReasoning 字段', () => {
    it('应该能够存储 AI 推理过程', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const reasoning =
        '通过分析法条1的第三条和法条2的第一条，发现两者在合同解除条件上存在明确的引用关系。法条1第三条规定了合同解除的具体条件，而法条2第一条对此进行了补充说明。';

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'AI_DETECTED',
          aiProvider: 'deepseek',
          aiModel: 'deepseek-chat-v3',
          aiConfidence: 0.92,
          aiReasoning: reasoning,
          createdBy: 'user-123',
        },
      });

      expect(relation.aiReasoning).toBe(reasoning);
    });

    it('应该允许 aiReasoning 为 null', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'MANUAL',
          createdBy: 'user-123',
        },
      });

      expect(relation.aiReasoning).toBeNull();
    });
  });

  describe('aiCreatedAt 字段', () => {
    it('应该能够存储 AI 创建时间', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const aiCreatedAt = new Date('2024-01-15T10:30:00.000Z');

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'AI_DETECTED',
          aiProvider: 'deepseek',
          aiModel: 'deepseek-chat-v3',
          aiConfidence: 0.92,
          aiCreatedAt,
          createdBy: 'user-123',
        },
      });

      expect(relation.aiCreatedAt).toEqual(aiCreatedAt);
    });

    it('应该允许 aiCreatedAt 为 null', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'MANUAL',
          createdBy: 'user-123',
        },
      });

      expect(relation.aiCreatedAt).toBeNull();
    });
  });

  describe('reviewHistory 字段', () => {
    it('应该能够存储审核历史记录', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const reviewHistory = [
        {
          userId: 'user-1',
          action: 'VERIFIED',
          comment: '关系准确',
          timestamp: '2024-01-15T10:00:00.000Z',
        },
        {
          userId: 'user-2',
          action: 'REJECTED',
          comment: '引用关系不成立',
          timestamp: '2024-01-16T14:30:00.000Z',
        },
      ];

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          reviewHistory: reviewHistory as any,
          createdBy: 'user-123',
        },
      });

      expect(relation.reviewHistory).toEqual(reviewHistory);
    });

    it('应该允许 reviewHistory 为 null', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          createdBy: 'user-123',
        },
      });

      expect(relation.reviewHistory).toBeNull();
    });
  });

  describe('字段组合测试', () => {
    it('应该能够同时存储所有新增字段', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法1',
          articleNumber: '1',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '测试法2',
          articleNumber: '2',
          fullText: '测试内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
          issuingAuthority: '全国人民代表大会',
          searchableText: '测试内容2',
        },
      });

      const aiCreatedAt = new Date('2024-01-15T10:30:00.000Z');
      const reasoning =
        '通过分析法条内容，发现两者存在明确的引用关系。法条1第三条规定了合同解除的具体条件，而法条2第一条对此进行了补充说明。';
      const reviewHistory = [
        {
          userId: 'user-1',
          action: 'VERIFIED',
          comment: '关系准确',
          timestamp: '2024-01-15T10:00:00.000Z',
        },
      ];

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: article1.id,
          targetId: article2.id,
          relationType: 'CITES',
          discoveryMethod: 'AI_DETECTED',
          aiProvider: 'deepseek',
          aiModel: 'deepseek-chat-v3',
          aiConfidence: 0.92,
          aiReasoning: reasoning,
          aiCreatedAt,
          rejectionReason: '引用关系不成立',

          verifiedAt: new Date(),
          verificationStatus: 'REJECTED',
          reviewHistory: reviewHistory as any,
          createdBy: 'user-123',
        },
      });

      expect(relation.aiProvider).toBe('deepseek');
      expect(relation.aiModel).toBe('deepseek-chat-v3');
      expect(relation.aiConfidence).toBe(0.92);
      expect(relation.aiReasoning).toBe(reasoning);
      expect(relation.aiCreatedAt).toEqual(aiCreatedAt);
      expect(relation.rejectionReason).toBe('引用关系不成立');
      expect(relation.reviewHistory).toEqual(reviewHistory);
    });
  });
});
