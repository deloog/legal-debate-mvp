/**
 * AI关系验证器测试
 *
 * 测试覆盖：
 * 1. 强制审核机制验证
 * 2. 低置信度关系自动拒绝
 * 3. 高置信度关系正确标记为待审核
 * 4. 阈值验证
 * 5. AI元数据记录
 */

import { AIDetector } from '@/lib/law-article/relation-discovery/ai-detector';
import { AIRelationValidator } from '@/lib/law-article/relation-discovery/ai-relation-validator';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';
import { LawArticle, RelationType, VerificationStatus } from '@prisma/client';

// Mock dependencies
jest.mock('@/lib/law-article/relation-service', () => ({
  LawArticleRelationService: {
    createRelation: jest.fn(),
  },
}));

jest.mock('@/lib/law-article/relation-discovery/ai-detector', () => ({
  AIDetector: {
    detectRelations: jest.fn(),
  },
}));

describe('AIRelationValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAndCreateRelation', () => {
    it('应该拒绝低于最小置信度的关系', async () => {
      // 准备测试数据
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '测试内容A',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '2',
        fullText: '测试内容B',
        category: 'CIVIL',
      } as LawArticle;

      // Mock AI检测结果 - 低置信度
      (AIDetector.detectRelations as jest.Mock).mockResolvedValue({
        relations: [
          {
            type: RelationType.RELATED,
            confidence: 0.3, // 低于最小阈值0.6
            reason: '可能相关',
            evidence: '某些相似之处',
          },
        ],
      });

      // 执行测试
      const result = await AIRelationValidator.validateAndCreateRelation({
        sourceArticle: article1,
        targetArticle: article2,
        relationType: RelationType.RELATED,
        userId: 'user-123',
        aiProvider: 'deepseek',
        aiModel: 'deepseek-chat-v3',
      });

      // 验证结果 - 应该被拒绝
      expect(result.success).toBe(false);
      expect(result.reason).toContain('置信度过低');
      expect(LawArticleRelationService.createRelation).not.toHaveBeenCalled();
    });

    it('应该将AI发现的关系标记为待审核状态', async () => {
      // 准备测试数据
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '测试内容A',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '2',
        fullText: '测试内容B',
        category: 'CIVIL',
      } as LawArticle;

      // Mock AI检测结果 - 高置信度
      (AIDetector.detectRelations as jest.Mock).mockResolvedValue({
        relations: [
          {
            type: RelationType.CITES,
            confidence: 0.95, // 高于最小阈值0.6
            reason: '民法典明确引用了宪法第5条',
            evidence: '根据宪法第5条的规定',
          },
        ],
      });

      // Mock创建关系
      (LawArticleRelationService.createRelation as jest.Mock).mockResolvedValue(
        {
          id: 'relation-1',
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: RelationType.CITES,
          verificationStatus: VerificationStatus.PENDING,
        }
      );

      // 执行测试
      const result = await AIRelationValidator.validateAndCreateRelation({
        sourceArticle: article1,
        targetArticle: article2,
        relationType: RelationType.CITES,
        userId: 'user-123',
        aiProvider: 'deepseek',
        aiModel: 'deepseek-chat-v3',
      });

      // 验证结果 - 应该被创建且标记为待审核
      expect(result.success).toBe(true);
      expect(LawArticleRelationService.createRelation).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: RelationType.CITES,
          verificationStatus: VerificationStatus.PENDING,
          aiProvider: 'deepseek',
          aiModel: 'deepseek-chat-v3',
          aiConfidence: 0.95,
          aiReasoning: '民法典明确引用了宪法第5条',
        })
      );
    });

    it('应该记录完整的AI元数据', async () => {
      // 准备测试数据
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '测试内容A',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '2',
        fullText: '测试内容B',
        category: 'CIVIL',
      } as LawArticle;

      // Mock AI检测结果
      (AIDetector.detectRelations as jest.Mock).mockResolvedValue({
        relations: [
          {
            type: RelationType.CONFLICTS,
            confidence: 0.88,
            reason: '两个法条对吸烟的规定存在冲突',
            evidence: '禁止 vs 允许',
          },
        ],
      });

      // Mock创建关系
      (LawArticleRelationService.createRelation as jest.Mock).mockResolvedValue(
        {
          id: 'relation-1',
        }
      );

      // 执行测试
      const result = await AIRelationValidator.validateAndCreateRelation({
        sourceArticle: article1,
        targetArticle: article2,
        relationType: RelationType.CONFLICTS,
        userId: 'user-123',
        aiProvider: 'deepseek',
        aiModel: 'deepseek-chat-v3',
        aiReasoning: '基于文本相似度和语义分析',
      });

      // 验证AI元数据
      expect(LawArticleRelationService.createRelation).toHaveBeenCalledWith(
        expect.objectContaining({
          aiProvider: 'deepseek',
          aiModel: 'deepseek-chat-v3',
          aiConfidence: 0.88,
          aiReasoning: expect.stringContaining('冲突'),
          aiCreatedAt: expect.any(Date),
        })
      );
    });
  });

  describe('validateBatchRelations', () => {
    it('应该批量验证关系', async () => {
      // 准备测试数据
      const sourceArticle: LawArticle = {
        id: 'source',
        lawName: '源法律',
        articleNumber: '1',
        fullText: '源内容',
        category: 'CIVIL',
      } as LawArticle;

      const targetArticles: LawArticle[] = [
        {
          id: 'target-1',
          lawName: '目标法律1',
          articleNumber: '1',
          fullText: '目标内容1',
          category: 'CIVIL',
        } as LawArticle,
        {
          id: 'target-2',
          lawName: '目标法律2',
          articleNumber: '2',
          fullText: '目标内容2',
          category: 'CIVIL',
        } as LawArticle,
      ];

      // Mock AI检测结果
      (AIDetector.detectRelations as jest.Mock).mockResolvedValue({
        relations: [
          {
            type: RelationType.RELATED,
            confidence: 0.8,
            reason: '相关',
            evidence: '证据',
          },
        ],
      });

      // Mock创建关系
      (LawArticleRelationService.createRelation as jest.Mock).mockResolvedValue(
        {
          id: 'relation-1',
        }
      );

      // 执行测试
      const results = await AIRelationValidator.validateBatchRelations({
        sourceArticle,
        targetArticles,
        relationType: RelationType.RELATED,
        userId: 'user-123',
        aiProvider: 'deepseek',
        aiModel: 'deepseek-chat-v3',
      });

      // 验证结果
      expect(results.created).toHaveLength(2);
      expect(results.rejected).toHaveLength(0);
      expect(LawArticleRelationService.createRelation).toHaveBeenCalledTimes(2);
    });

    it('应该统计被拒绝的关系', async () => {
      // 准备测试数据
      const sourceArticle: LawArticle = {
        id: 'source',
        lawName: '源法律',
        articleNumber: '1',
        fullText: '源内容',
        category: 'CIVIL',
      } as LawArticle;

      const targetArticles: LawArticle[] = [
        {
          id: 'target-1',
          lawName: '目标法律1',
          articleNumber: '1',
          fullText: '目标内容1',
          category: 'CIVIL',
        } as LawArticle,
      ];

      // Mock AI检测结果 - 低置信度
      (AIDetector.detectRelations as jest.Mock).mockResolvedValue({
        relations: [
          {
            type: RelationType.RELATED,
            confidence: 0.4, // 低于阈值
            reason: '可能相关',
            evidence: '证据',
          },
        ],
      });

      // 执行测试
      const results = await AIRelationValidator.validateBatchRelations({
        sourceArticle,
        targetArticles,
        relationType: RelationType.RELATED,
        userId: 'user-123',
        aiProvider: 'deepseek',
        aiModel: 'deepseek-chat-v3',
      });

      // 验证结果
      expect(results.created).toHaveLength(0);
      expect(results.rejected).toHaveLength(1);
      expect(results.rejected[0].reason).toContain('置信度过低');
    });
  });

  describe('validateConfidence', () => {
    it('应该接受高于最小阈值的置信度', () => {
      const result = AIRelationValidator.validateConfidence(
        0.8,
        RelationType.CITES
      );
      expect(result.valid).toBe(true);
    });

    it('应该拒绝低于最小阈值的置信度', () => {
      const result = AIRelationValidator.validateConfidence(
        0.4,
        RelationType.CITES
      );
      expect(result.valid).toBe(false);
    });

    it('应该使用不同关系类型的阈值', () => {
      const conflictResult = AIRelationValidator.validateConfidence(
        0.7,
        RelationType.CONFLICTS
      );
      const relatedResult = AIRelationValidator.validateConfidence(
        0.7,
        RelationType.RELATED
      );

      // 冲突关系需要更高置信度
      expect(conflictResult.valid).toBe(false);
      expect(relatedResult.valid).toBe(true);
    });
  });

  describe('强制审核机制', () => {
    it('应该强制AI关系为待审核状态', async () => {
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '测试内容A',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '2',
        fullText: '测试内容B',
        category: 'CIVIL',
      } as LawArticle;

      (AIDetector.detectRelations as jest.Mock).mockResolvedValue({
        relations: [
          {
            type: RelationType.CITES,
            confidence: 0.9,
            reason: '引用关系',
            evidence: '证据',
          },
        ],
      });

      (LawArticleRelationService.createRelation as jest.Mock).mockResolvedValue(
        {
          id: 'relation-1',
          verificationStatus: VerificationStatus.PENDING,
        }
      );

      await AIRelationValidator.validateAndCreateRelation({
        sourceArticle: article1,
        targetArticle: article2,
        relationType: RelationType.CITES,
        userId: 'user-123',
        aiProvider: 'deepseek',
        aiModel: 'deepseek-chat-v3',
      });

      // 验证verificationStatus强制为PENDING
      expect(
        (LawArticleRelationService.createRelation as jest.Mock).mock.calls[0][0]
          .verificationStatus
      ).toBe(VerificationStatus.PENDING);
    });

    it('不应该允许直接设置为已验证状态', async () => {
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '测试内容A',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '2',
        fullText: '测试内容B',
        category: 'CIVIL',
      } as LawArticle;

      (AIDetector.detectRelations as jest.Mock).mockResolvedValue({
        relations: [
          {
            type: RelationType.CITES,
            confidence: 0.95,
            reason: '引用关系',
            evidence: '证据',
          },
        ],
      });

      (LawArticleRelationService.createRelation as jest.Mock).mockResolvedValue(
        {
          id: 'relation-1',
        }
      );

      await AIRelationValidator.validateAndCreateRelation({
        sourceArticle: article1,
        targetArticle: article2,
        relationType: RelationType.CITES,
        userId: 'user-123',
        aiProvider: 'deepseek',
        aiModel: 'deepseek-chat-v3',
      });

      // 即使置信度很高，也应该强制为PENDING
      expect(
        (LawArticleRelationService.createRelation as jest.Mock).mock.calls[0][0]
          .verificationStatus
      ).toBe(VerificationStatus.PENDING);
    });
  });
});
