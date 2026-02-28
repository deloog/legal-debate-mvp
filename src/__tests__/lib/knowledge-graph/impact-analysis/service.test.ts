/**
 * 知识图谱动态更新 - 影响分析服务测试
 */

import { ImpactAnalysisService } from '@/lib/knowledge-graph/impact-analysis/service';
import {
  ChangeType,
  ImpactStatus,
  RecommendationAction,
  type ImpactAnalysisInput,
  type ImpactAnalysisResult,
  type ImpactedRelation,
  type ImpactRecommendation,
  type RelationUpdateInput,
  type BatchUpdateResult,
} from '@/lib/knowledge-graph/impact-analysis/types';
import { RelationType, VerificationStatus, DiscoveryMethod, LawStatus } from '@prisma/client';

// Mock Prisma client
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lawArticleRelation: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

const mockPrisma = prisma as unknown as {
  lawArticle: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  lawArticleRelation: {
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

describe('ImpactAnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeImpact', () => {
    it('应该成功分析法条废止的影响', async () => {
      const input: ImpactAnalysisInput = {
        lawArticleId: 'article123',
        changeType: ChangeType.REPEALED,
        depth: 1,
        includeIndirect: false,
      };

      const mockArticle = {
        id: 'article123',
        lawName: '《民法典》',
        articleNumber: '第123条',
        status: LawStatus.REPEALED,
        effectiveDate: new Date('2020-01-01'),
      };

      const mockRelations = [
        {
          id: 'rel1',
          sourceId: 'article123',
          source: { lawName: '《民法典》', articleNumber: '第123条' },
          targetId: 'article2',
          target: { lawName: '《合同法》', articleNumber: '第45条' },
          relationType: RelationType.CITES,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
        },
        {
          id: 'rel2',
          sourceId: 'article2',
          source: { lawName: '《合同法》', articleNumber: '第45条' },
          targetId: 'article123',
          target: { lawName: '《民法典》', articleNumber: '第123条' },
          relationType: RelationType.COMPLETES,
          verificationStatus: VerificationStatus.PENDING,
          strength: 0.7,
          confidence: 0.85,
          discoveryMethod: DiscoveryMethod.MANUAL,
        },
      ];

      mockPrisma.lawArticle.findUnique.mockResolvedValue(mockArticle as never);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue(mockRelations as never);

      const result = await ImpactAnalysisService.analyzeImpact(input);

      expect(result).toBeDefined();
      expect(result.articleId).toBe('article123');
      expect(result.changeType).toBe(ChangeType.REPEALED);
      expect(result.impactedRelations).toHaveLength(2);
      expect(result.recommendations).toHaveLength(2);
      expect(result.statistics.totalImpacted).toBe(2);
      expect(mockPrisma.lawArticle.findUnique).toHaveBeenCalledWith({
        where: { id: 'article123' },
      });
      expect(mockPrisma.lawArticleRelation.findMany).toHaveBeenCalled();
    });

    it('应该成功分析法条修改的影响', async () => {
      const input: ImpactAnalysisInput = {
        lawArticleId: 'article123',
        changeType: ChangeType.AMENDED,
        depth: 1,
        includeIndirect: false,
      };

      const mockArticle = {
        id: 'article123',
        lawName: '《民法典》',
        articleNumber: '第123条',
        status: LawStatus.AMENDED,
        effectiveDate: new Date('2020-01-01'),
      };

      const mockRelations = [
        {
          id: 'rel1',
          sourceId: 'article123',
          source: { lawName: '《民法典》', articleNumber: '第123条' },
          targetId: 'article2',
          target: { lawName: '《合同法》', articleNumber: '第45条' },
          relationType: RelationType.CITES,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
        },
      ];

      mockPrisma.lawArticle.findUnique.mockResolvedValue(mockArticle as never);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue(mockRelations as never);

      const result = await ImpactAnalysisService.analyzeImpact(input);

      expect(result).toBeDefined();
      expect(result.changeType).toBe(ChangeType.AMENDED);
      expect(result.impactedRelations).toHaveLength(1);
      // 修改时关系应该标记为需要重新审查
      expect(result.impactedRelations[0].impactStatus).toBe(ImpactStatus.NEEDS_REVIEW);
    });

    it('当法条不存在时应该抛出错误', async () => {
      const input: ImpactAnalysisInput = {
        lawArticleId: 'article123',
        changeType: ChangeType.REPEALED,
      };

      mockPrisma.lawArticle.findUnique.mockResolvedValue(null);

      await expect(ImpactAnalysisService.analyzeImpact(input)).rejects.toThrow('法条不存在');
    });

    it('当没有受影响的关系时应该返回空结果', async () => {
      const input: ImpactAnalysisInput = {
        lawArticleId: 'article123',
        changeType: ChangeType.REPEALED,
      };

      const mockArticle = {
        id: 'article123',
        lawName: '《民法典》',
        articleNumber: '第123条',
        status: LawStatus.REPEALED,
        effectiveDate: new Date('2020-01-01'),
      };

      mockPrisma.lawArticle.findUnique.mockResolvedValue(mockArticle as never);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([]);

      const result = await ImpactAnalysisService.analyzeImpact(input);

      expect(result.impactedRelations).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
      expect(result.statistics.totalImpacted).toBe(0);
    });

    it('应该正确计算统计信息', async () => {
      const input: ImpactAnalysisInput = {
        lawArticleId: 'article123',
        changeType: ChangeType.REPEALED,
      };

      const mockArticle = {
        id: 'article123',
        lawName: '《民法典》',
        articleNumber: '第123条',
        status: LawStatus.REPEALED,
        effectiveDate: new Date('2020-01-01'),
      };

      const mockRelations = [
        {
          id: 'rel1',
          sourceId: 'article123',
          source: { lawName: '《民法典》', articleNumber: '第123条' },
          targetId: 'article2',
          target: { lawName: '《合同法》', articleNumber: '第45条' },
          relationType: RelationType.CITES,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
        },
        {
          id: 'rel2',
          sourceId: 'article2',
          source: { lawName: '《合同法》', articleNumber: '第45条' },
          targetId: 'article123',
          target: { lawName: '《民法典》', articleNumber: '第123条' },
          relationType: RelationType.COMPLETES,
          verificationStatus: VerificationStatus.PENDING,
          strength: 0.7,
          confidence: 0.85,
          discoveryMethod: DiscoveryMethod.MANUAL,
        },
        {
          id: 'rel3',
          sourceId: 'article3',
          source: { lawName: '《刑法》', articleNumber: '第78条' },
          targetId: 'article123',
          target: { lawName: '《民法典》', articleNumber: '第123条' },
          relationType: RelationType.CONFLICTS,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.9,
          confidence: 0.95,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
        },
      ];

      mockPrisma.lawArticle.findUnique.mockResolvedValue(mockArticle as never);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue(mockRelations as never);

      const result = await ImpactAnalysisService.analyzeImpact(input);

      expect(result.statistics.totalImpacted).toBe(3);
      expect(result.statistics.byRelationType[RelationType.CITES]).toBe(1);
      expect(result.statistics.byRelationType[RelationType.COMPLETES]).toBe(1);
      expect(result.statistics.byRelationType[RelationType.CONFLICTS]).toBe(1);
    });

    it('应该包含分析时间戳', async () => {
      const input: ImpactAnalysisInput = {
        lawArticleId: 'article123',
        changeType: ChangeType.REPEALED,
      };

      const mockArticle = {
        id: 'article123',
        lawName: '《民法典》',
        articleNumber: '第123条',
        status: LawStatus.REPEALED,
        effectiveDate: new Date('2020-01-01'),
      };

      mockPrisma.lawArticle.findUnique.mockResolvedValue(mockArticle as never);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([]);

      const result = await ImpactAnalysisService.analyzeImpact(input);

      expect(result.analyzedAt).toBeDefined();
      expect(new Date(result.analyzedAt).toISOString()).toBe(result.analyzedAt);
    });
  });

  describe('getImpactedRelations', () => {
    it('应该获取所有受影响的关系', async () => {
      const mockRelations = [
        {
          id: 'rel1',
          sourceId: 'article123',
          source: { lawName: '《民法典》', articleNumber: '第123条' },
          targetId: 'article2',
          target: { lawName: '《合同法》', articleNumber: '第45条' },
          relationType: RelationType.CITES,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
        },
      ];

      mockPrisma.lawArticleRelation.findMany.mockResolvedValue(mockRelations as never);

      const relations = await ImpactAnalysisService.getImpactedRelations('article123', ChangeType.REPEALED);

      expect(relations).toHaveLength(1);
      expect(relations[0].relationId).toBe('rel1');
      expect(relations[0].impactStatus).toBe(ImpactStatus.POTENTIALLY_INVALID);
      expect(mockPrisma.lawArticleRelation.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { sourceId: 'article123' },
            { targetId: 'article123' },
          ],
        },
        include: {
          source: true,
          target: true,
        },
      });
    });

    it('应该为不同变更类型设置正确的影响状态', async () => {
      const mockRelations = [
        {
          id: 'rel1',
          sourceId: 'article123',
          source: { lawName: '《民法典》', articleNumber: '第123条' },
          targetId: 'article2',
          target: { lawName: '《合同法》', articleNumber: '第45条' },
          relationType: RelationType.CITES,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
        },
      ];

      mockPrisma.lawArticleRelation.findMany.mockResolvedValue(mockRelations as never);

      // 测试废止时的影响状态
      const repealedRelations = await ImpactAnalysisService.getImpactedRelations(
        'article123',
        ChangeType.REPEALED
      );
      expect(repealedRelations[0].impactStatus).toBe(ImpactStatus.POTENTIALLY_INVALID);

      // 测试修改时的影响状态
      const amendedRelations = await ImpactAnalysisService.getImpactedRelations(
        'article123',
        ChangeType.AMENDED
      );
      expect(amendedRelations[0].impactStatus).toBe(ImpactStatus.NEEDS_REVIEW);
    });
  });

  describe('generateRecommendations', () => {
    it('应该为废止法条生成正确的建议（满足自动验证条件）', () => {
      const impactedRelations: ImpactedRelation[] = [
        {
          relationId: 'rel1',
          sourceId: 'article123',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article2',
          targetLawName: '《合同法》',
          targetArticleNumber: '第45条',
          relationType: RelationType.CITES,
          impactStatus: ImpactStatus.POTENTIALLY_INVALID,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: 'AI_DETECTED',
        },
      ];

      const recommendations = ImpactAnalysisService.generateRecommendations(
        impactedRelations,
        ChangeType.REPEALED
      );

      expect(recommendations).toHaveLength(1);
      // 满足自动验证条件：已验证、高置信度、高置信度，应该自动验证
      expect(recommendations[0].action).toBe(RecommendationAction.AUTO_VERIFY);
      expect(recommendations[0].priority).toBe('high');
    });

    it('应该为废止法条生成标记失效的建议（不满足自动验证条件）', () => {
      const impactedRelations: ImpactedRelation[] = [
        {
          relationId: 'rel1',
          sourceId: 'article123',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article2',
          targetLawName: '《合同法》',
          targetArticleNumber: '第45条',
          relationType: RelationType.CITES,
          impactStatus: ImpactStatus.POTENTIALLY_INVALID,
          verificationStatus: VerificationStatus.PENDING,
          strength: 0.6,
          confidence: 0.7,
          discoveryMethod: 'AI_DETECTED',
        },
      ];

      const recommendations = ImpactAnalysisService.generateRecommendations(
        impactedRelations,
        ChangeType.REPEALED
      );

      expect(recommendations).toHaveLength(1);
      // 不满足自动验证条件：未验证，应该标记为失效
      expect(recommendations[0].action).toBe(RecommendationAction.MARK_AS_INVALID);
      // 优先级为low，因此不需要人工确认
      expect(recommendations[0].priority).toBe('low');
      expect(recommendations[0].requiresHumanConfirmation).toBe(false);
    });

    it('应该为修改法条生成正确的建议（满足自动验证条件）', () => {
      const impactedRelations: ImpactedRelation[] = [
        {
          relationId: 'rel1',
          sourceId: 'article123',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article2',
          targetLawName: '《合同法》',
          targetArticleNumber: '第45条',
          relationType: RelationType.CITES,
          impactStatus: ImpactStatus.NEEDS_REVIEW,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: 'AI_DETECTED',
        },
      ];

      const recommendations = ImpactAnalysisService.generateRecommendations(
        impactedRelations,
        ChangeType.AMENDED
      );

      expect(recommendations).toHaveLength(1);
      // 满足自动验证条件：已验证、高置信度、高置信度，应该自动验证
      expect(recommendations[0].action).toBe(RecommendationAction.AUTO_VERIFY);
    });

    it('应该为修改法条生成请求审核的建议（不满足自动验证条件）', () => {
      const impactedRelations: ImpactedRelation[] = [
        {
          relationId: 'rel1',
          sourceId: 'article123',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article2',
          targetLawName: '《合同法》',
          targetArticleNumber: '第45条',
          relationType: RelationType.CITES,
          impactStatus: ImpactStatus.NEEDS_REVIEW,
          verificationStatus: VerificationStatus.PENDING,
          strength: 0.6,
          confidence: 0.7,
          discoveryMethod: 'AI_DETECTED',
        },
      ];

      const recommendations = ImpactAnalysisService.generateRecommendations(
        impactedRelations,
        ChangeType.AMENDED
      );

      expect(recommendations).toHaveLength(1);
      // 不满足自动验证条件：未验证，应该请求审核
      expect(recommendations[0].action).toBe(RecommendationAction.REQUEST_REVIEW);
    });

    it('应该根据关系类型和置信度确定优先级', () => {
      const impactedRelations: ImpactedRelation[] = [
        {
          relationId: 'rel1',
          sourceId: 'article123',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article2',
          targetLawName: '《合同法》',
          targetArticleNumber: '第45条',
          relationType: RelationType.CONFLICTS,
          impactStatus: ImpactStatus.POTENTIALLY_INVALID,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.9,
          confidence: 0.95,
          discoveryMethod: 'MANUAL',
        },
        {
          relationId: 'rel2',
          sourceId: 'article123',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article3',
          targetLawName: '《刑法》',
          targetArticleNumber: '第78条',
          relationType: RelationType.RELATED,
          impactStatus: ImpactStatus.POTENTIALLY_INVALID,
          verificationStatus: VerificationStatus.PENDING,
          strength: 0.5,
          confidence: 0.6,
          discoveryMethod: 'AI_DETECTED',
        },
      ];

      const recommendations = ImpactAnalysisService.generateRecommendations(
        impactedRelations,
        ChangeType.REPEALED
      );

      expect(recommendations).toHaveLength(2);
      // CONFLICTS关系应该有更高的优先级
      const conflictRec = recommendations.find((r) => r.relationId === 'rel1');
      const relatedRec = recommendations.find((r) => r.relationId === 'rel2');
      
      expect(conflictRec?.priority).toBe('high');
      expect(relatedRec?.priority).toBe('low');
    });

    it('应该为已验证的关系生成更高的优先级', () => {
      const impactedRelations: ImpactedRelation[] = [
        {
          relationId: 'rel1',
          sourceId: 'article123',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article2',
          targetLawName: '《合同法》',
          targetArticleNumber: '第45条',
          relationType: RelationType.CITES,
          impactStatus: ImpactStatus.POTENTIALLY_INVALID,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: 'MANUAL',
        },
        {
          relationId: 'rel2',
          sourceId: 'article123',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article3',
          targetLawName: '《刑法》',
          targetArticleNumber: '第78条',
          relationType: RelationType.CITES,
          impactStatus: ImpactStatus.POTENTIALLY_INVALID,
          verificationStatus: VerificationStatus.PENDING,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: 'AI_DETECTED',
        },
      ];

      const recommendations = ImpactAnalysisService.generateRecommendations(
        impactedRelations,
        ChangeType.REPEALED
      );

      const verifiedRec = recommendations.find((r) => r.relationId === 'rel1');
      const pendingRec = recommendations.find((r) => r.relationId === 'rel2');

      // 已验证的高置信度CITES关系在废止时应该是高优先级
      expect(verifiedRec?.priority).toBe('high');
      // 未验证的关系在没有其他特征的情况下应该是低优先级
      expect(pendingRec?.priority).toBe('low');
    });
  });

  describe('batchUpdateRelations', () => {
    it('应该成功批量更新关系', async () => {
      const updates: RelationUpdateInput[] = [
        {
          relationId: 'rel1',
          verificationStatus: VerificationStatus.REJECTED,
          rejectionReason: '目标法条已废止',
          verifiedBy: 'user123',
        },
        {
          relationId: 'rel2',
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedBy: 'user123',
        },
      ];

      mockPrisma.lawArticleRelation.update
        .mockResolvedValueOnce({ id: 'rel1' } as never)
        .mockResolvedValueOnce({ id: 'rel2' } as never);

      const result = await ImpactAnalysisService.batchUpdateRelations(updates);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
      expect(mockPrisma.lawArticleRelation.update).toHaveBeenCalledTimes(2);
    });

    it('应该处理部分失败的更新', async () => {
      const updates: RelationUpdateInput[] = [
        {
          relationId: 'rel1',
          verificationStatus: VerificationStatus.REJECTED,
        },
        {
          relationId: 'rel2',
          verificationStatus: VerificationStatus.VERIFIED,
        },
      ];

      mockPrisma.lawArticleRelation.update
        .mockResolvedValueOnce({ id: 'rel1' } as never)
        .mockRejectedValueOnce(new Error('关系不存在'));

      const result = await ImpactAnalysisService.batchUpdateRelations(updates);

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBeDefined();
    });

    it('应该处理所有更新都失败的情况', async () => {
      const updates: RelationUpdateInput[] = [
        {
          relationId: 'rel1',
          verificationStatus: VerificationStatus.REJECTED,
        },
        {
          relationId: 'rel2',
          verificationStatus: VerificationStatus.VERIFIED,
        },
      ];

      mockPrisma.lawArticleRelation.update
        .mockRejectedValueOnce(new Error('错误1'))
        .mockRejectedValueOnce(new Error('错误2'));

      const result = await ImpactAnalysisService.batchUpdateRelations(updates);

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(2);
      expect(result.results.every((r) => !r.success)).toBe(true);
    });

    it('应该正确更新验证状态和原因', async () => {
      const updates: RelationUpdateInput[] = [
        {
          relationId: 'rel1',
          verificationStatus: VerificationStatus.REJECTED,
          rejectionReason: '目标法条已废止',
          verifiedBy: 'user123',
          reviewComment: '审核通过',
        },
      ];

      mockPrisma.lawArticleRelation.update.mockResolvedValueOnce({ id: 'rel1' } as never);

      await ImpactAnalysisService.batchUpdateRelations(updates);

      expect(mockPrisma.lawArticleRelation.update).toHaveBeenCalledWith({
        where: { id: 'rel1' },
        data: {
          verificationStatus: VerificationStatus.REJECTED,
          rejectionReason: '目标法条已废止',
          verifiedBy: 'user123',
          verifiedAt: expect.any(Date),
        },
      });
    });
  });

  describe('calculateStatistics', () => {
    it('应该正确计算统计信息', () => {
      const impactedRelations: ImpactedRelation[] = [
        {
          relationId: 'rel1',
          sourceId: 'article123',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article2',
          targetLawName: '《合同法》',
          targetArticleNumber: '第45条',
          relationType: RelationType.CITES,
          impactStatus: ImpactStatus.POTENTIALLY_INVALID,
          verificationStatus: VerificationStatus.VERIFIED,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: 'AI_DETECTED',
        },
        {
          relationId: 'rel2',
          sourceId: 'article123',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article3',
          targetLawName: '《刑法》',
          targetArticleNumber: '第78条',
          relationType: RelationType.CONFLICTS,
          impactStatus: ImpactStatus.NEEDS_REVIEW,
          verificationStatus: VerificationStatus.PENDING,
          strength: 0.7,
          confidence: 0.85,
          discoveryMethod: 'MANUAL',
        },
      ];

      const recommendations: ImpactRecommendation[] = [
        {
          recommendationId: 'rec1',
          relationId: 'rel1',
          action: RecommendationAction.MARK_AS_INVALID,
          reason: '目标法条已废止',
          priority: 'high',
          impactScope: '直接影响',
          requiresHumanConfirmation: true,
        },
        {
          recommendationId: 'rec2',
          relationId: 'rel2',
          action: RecommendationAction.REQUEST_REVIEW,
          reason: '需要重新审查',
          priority: 'medium',
          impactScope: '间接影响',
          requiresHumanConfirmation: false,
        },
      ];

      const statistics = ImpactAnalysisService.calculateStatistics(impactedRelations, recommendations);

      expect(statistics.totalImpacted).toBe(2);
      expect(statistics.byImpactStatus[ImpactStatus.POTENTIALLY_INVALID]).toBe(1);
      expect(statistics.byImpactStatus[ImpactStatus.NEEDS_REVIEW]).toBe(1);
      expect(statistics.byRelationType[RelationType.CITES]).toBe(1);
      expect(statistics.byRelationType[RelationType.CONFLICTS]).toBe(1);
      expect(statistics.highPriorityCount).toBe(1);
      expect(statistics.mediumPriorityCount).toBe(1);
      expect(statistics.lowPriorityCount).toBe(0);
    });

    it('应该正确处理空列表', () => {
      const statistics = ImpactAnalysisService.calculateStatistics([], []);

      expect(statistics.totalImpacted).toBe(0);
      expect(statistics.highPriorityCount).toBe(0);
      expect(statistics.mediumPriorityCount).toBe(0);
      expect(statistics.lowPriorityCount).toBe(0);
    });
  });

  describe('determinePriority', () => {
    it('应该为高置信度、已验证的关系分配高优先级', () => {
      const relation: ImpactedRelation = {
        relationId: 'rel1',
        sourceId: 'article123',
        sourceLawName: '《民法典》',
        sourceArticleNumber: '第123条',
        targetId: 'article2',
        targetLawName: '《合同法》',
        targetArticleNumber: '第45条',
        relationType: RelationType.CITES,
        impactStatus: ImpactStatus.POTENTIALLY_INVALID,
        verificationStatus: VerificationStatus.VERIFIED,
        strength: 0.9,
        confidence: 0.95,
        discoveryMethod: 'MANUAL',
      };

      const priority = ImpactAnalysisService.determinePriority(relation, ChangeType.REPEALED);
      expect(priority).toBe('high');
    });

    it('应该为低置信度、未验证的关系分配低优先级', () => {
      const relation: ImpactedRelation = {
        relationId: 'rel1',
        sourceId: 'article123',
        sourceLawName: '《民法典》',
        sourceArticleNumber: '第123条',
        targetId: 'article2',
        targetLawName: '《合同法》',
        targetArticleNumber: '第45条',
        relationType: RelationType.RELATED,
        impactStatus: ImpactStatus.POTENTIALLY_INVALID,
        verificationStatus: VerificationStatus.PENDING,
        strength: 0.5,
        confidence: 0.6,
        discoveryMethod: 'AI_DETECTED',
      };

      const priority = ImpactAnalysisService.determinePriority(relation, ChangeType.REPEALED);
      expect(priority).toBe('low');
    });

    it('应该为中等条件的关系统配中优先级', () => {
      const relation: ImpactedRelation = {
        relationId: 'rel1',
        sourceId: 'article123',
        sourceLawName: '《民法典》',
        sourceArticleNumber: '第123条',
        targetId: 'article2',
        targetLawName: '《合同法》',
        targetArticleNumber: '第45条',
        relationType: RelationType.CITES,
        impactStatus: ImpactStatus.NEEDS_REVIEW,
        verificationStatus: VerificationStatus.VERIFIED,
        strength: 0.7,
        confidence: 0.8,
        discoveryMethod: 'MANUAL',
      };

      const priority = ImpactAnalysisService.determinePriority(relation, ChangeType.AMENDED);
      expect(priority).toBe('medium');
    });
  });

  describe('generateRecommendationId', () => {
    it('应该生成唯一的推荐ID', () => {
      const id1 = ImpactAnalysisService.generateRecommendationId('rel1');
      const id2 = ImpactAnalysisService.generateRecommendationId('rel2');
      const id3 = ImpactAnalysisService.generateRecommendationId('rel1');

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      // 同一关系可能生成相同的ID（如果时间戳相同）
      expect(id1).toMatch(/^rec_/);
    });
  });
});
