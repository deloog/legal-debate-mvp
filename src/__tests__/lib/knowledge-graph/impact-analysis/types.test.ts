/**
 * 知识图谱动态更新 - 类型定义测试
 */

import {
  ChangeType,
  ImpactStatus,
  RecommendationAction,
  ImpactAnalysisConfig,
  type ImpactedRelation,
  type ImpactRecommendation,
  type ImpactAnalysisInput,
  type ImpactAnalysisResult,
  type ImpactStatistics,
  type RelationUpdateInput,
  type BatchUpdateResult,
} from '@/lib/knowledge-graph/impact-analysis/types';
import { RelationType, VerificationStatus } from '@prisma/client';

describe('Impact Analysis Types', () => {
  describe('ChangeType', () => {
    it('应该包含AMENDED和REPEALED枚举值', () => {
      expect(ChangeType.AMENDED).toBe('amended');
      expect(ChangeType.REPEALED).toBe('repealed');
    });

    it('应该包含所有必需的变更类型', () => {
      const changeTypes = Object.values(ChangeType);
      expect(changeTypes).toHaveLength(2);
      expect(changeTypes).toContain('amended');
      expect(changeTypes).toContain('repealed');
    });
  });

  describe('ImpactStatus', () => {
    it('应该包含所有影响状态枚举值', () => {
      expect(ImpactStatus.NONE).toBe('none');
      expect(ImpactStatus.POTENTIALLY_INVALID).toBe('potentially_invalid');
      expect(ImpactStatus.NEEDS_REVIEW).toBe('needs_review');
      expect(ImpactStatus.AFFECTED).toBe('affected');
    });

    it('应该包含所有必需的影响状态', () => {
      const impactStatuses = Object.values(ImpactStatus);
      expect(impactStatuses).toHaveLength(4);
    });
  });

  describe('RecommendationAction', () => {
    it('应该包含所有建议操作类型', () => {
      expect(RecommendationAction.MARK_AS_INVALID).toBe('mark_as_invalid');
      expect(RecommendationAction.REQUEST_REVIEW).toBe('request_review');
      expect(RecommendationAction.AUTO_VERIFY).toBe('auto_verify');
      expect(RecommendationAction.NO_ACTION).toBe('no_action');
    });

    it('应该包含所有必需的操作类型', () => {
      const actions = Object.values(RecommendationAction);
      expect(actions).toHaveLength(4);
    });
  });

  describe('ImpactedRelation', () => {
    it('应该正确构建受影响的关系对象', () => {
      const relation: ImpactedRelation = {
        relationId: 'rel123',
        sourceId: 'article1',
        sourceLawName: '《民法典》',
        sourceArticleNumber: '第123条',
        targetId: 'article2',
        targetLawName: '《合同法》',
        targetArticleNumber: '第45条',
        relationType: RelationType.CITES,
        impactStatus: ImpactStatus.POTENTIALLY_INVALID,
        verificationStatus: VerificationStatus.PENDING,
        strength: 0.8,
        confidence: 0.9,
        discoveryMethod: 'AI_DETECTED',
      };

      expect(relation.relationId).toBe('rel123');
      expect(relation.sourceId).toBe('article1');
      expect(relation.targetId).toBe('article2');
      expect(relation.relationType).toBe(RelationType.CITES);
      expect(relation.impactStatus).toBe(ImpactStatus.POTENTIALLY_INVALID);
    });

    it('应该支持所有关系类型', () => {
      const relation: ImpactedRelation = {
        relationId: 'rel123',
        sourceId: 'article1',
        sourceLawName: '《民法典》',
        sourceArticleNumber: '第123条',
        targetId: 'article2',
        targetLawName: '《合同法》',
        targetArticleNumber: '第45条',
        relationType: RelationType.CONFLICTS,
        impactStatus: ImpactStatus.NEEDS_REVIEW,
        verificationStatus: VerificationStatus.VERIFIED,
        strength: 0.7,
        confidence: 0.85,
        discoveryMethod: 'MANUAL',
      };

      expect(relation.relationType).toBe(RelationType.CONFLICTS);
      expect(relation.impactStatus).toBe(ImpactStatus.NEEDS_REVIEW);
    });

    it('应该支持所有影响状态', () => {
      const statuses = [
        ImpactStatus.NONE,
        ImpactStatus.POTENTIALLY_INVALID,
        ImpactStatus.NEEDS_REVIEW,
        ImpactStatus.AFFECTED,
      ];

      statuses.forEach(status => {
        const relation: ImpactedRelation = {
          relationId: 'rel123',
          sourceId: 'article1',
          sourceLawName: '《民法典》',
          sourceArticleNumber: '第123条',
          targetId: 'article2',
          targetLawName: '《合同法》',
          targetArticleNumber: '第45条',
          relationType: RelationType.CITES,
          impactStatus: status,
          verificationStatus: VerificationStatus.PENDING,
          strength: 0.8,
          confidence: 0.9,
          discoveryMethod: 'AI_DETECTED',
        };

        expect(relation.impactStatus).toBe(status);
      });
    });
  });

  describe('ImpactRecommendation', () => {
    it('应该正确构建建议对象', () => {
      const recommendation: ImpactRecommendation = {
        recommendationId: 'rec123',
        relationId: 'rel123',
        action: RecommendationAction.MARK_AS_INVALID,
        reason: '目标法条已被废止',
        priority: 'high',
        impactScope: '直接影响',
        requiresHumanConfirmation: true,
      };

      expect(recommendation.recommendationId).toBe('rec123');
      expect(recommendation.relationId).toBe('rel123');
      expect(recommendation.action).toBe(RecommendationAction.MARK_AS_INVALID);
      expect(recommendation.priority).toBe('high');
      expect(recommendation.requiresHumanConfirmation).toBe(true);
    });

    it('应该支持所有优先级', () => {
      const priorities: Array<'high' | 'medium' | 'low'> = [
        'high',
        'medium',
        'low',
      ];

      priorities.forEach(priority => {
        const recommendation: ImpactRecommendation = {
          recommendationId: 'rec123',
          relationId: 'rel123',
          action: RecommendationAction.REQUEST_REVIEW,
          reason: '需要重新审查',
          priority,
          impactScope: '间接影响',
          requiresHumanConfirmation: priority === 'high',
        };

        expect(recommendation.priority).toBe(priority);
      });
    });

    it('应该支持所有建议操作', () => {
      const actions = Object.values(RecommendationAction);

      actions.forEach(action => {
        const recommendation: ImpactRecommendation = {
          recommendationId: 'rec123',
          relationId: 'rel123',
          action,
          reason: '测试建议',
          priority: 'medium',
          impactScope: '直接影响',
          requiresHumanConfirmation:
            action !== RecommendationAction.AUTO_VERIFY,
        };

        expect(recommendation.action).toBe(action);
      });
    });
  });

  describe('ImpactAnalysisInput', () => {
    it('应该正确构建分析输入', () => {
      const input: ImpactAnalysisInput = {
        lawArticleId: 'article123',
        changeType: ChangeType.REPEALED,
        depth: 2,
        includeIndirect: true,
      };

      expect(input.lawArticleId).toBe('article123');
      expect(input.changeType).toBe(ChangeType.REPEALED);
      expect(input.depth).toBe(2);
      expect(input.includeIndirect).toBe(true);
    });

    it('应该允许可选参数为空', () => {
      const input: ImpactAnalysisInput = {
        lawArticleId: 'article123',
        changeType: ChangeType.AMENDED,
      };

      expect(input.lawArticleId).toBe('article123');
      expect(input.changeType).toBe(ChangeType.AMENDED);
      expect(input.depth).toBeUndefined();
      expect(input.includeIndirect).toBeUndefined();
    });

    it('应该支持所有变更类型', () => {
      const input1: ImpactAnalysisInput = {
        lawArticleId: 'article123',
        changeType: ChangeType.AMENDED,
      };

      const input2: ImpactAnalysisInput = {
        lawArticleId: 'article123',
        changeType: ChangeType.REPEALED,
      };

      expect(input1.changeType).toBe(ChangeType.AMENDED);
      expect(input2.changeType).toBe(ChangeType.REPEALED);
    });
  });

  describe('ImpactAnalysisResult', () => {
    it('应该正确构建分析结果', () => {
      const statistics: ImpactStatistics = {
        totalImpacted: 10,
        byImpactStatus: {
          [ImpactStatus.POTENTIALLY_INVALID]: 5,
          [ImpactStatus.NEEDS_REVIEW]: 3,
        },
        byRelationType: {
          [RelationType.CITES]: 6,
          [RelationType.CONFLICTS]: 2,
        },
        highPriorityCount: 3,
        mediumPriorityCount: 4,
        lowPriorityCount: 3,
      };

      const result: ImpactAnalysisResult = {
        articleId: 'article123',
        articleName: '《民法典》第123条',
        articleNumber: '第123条',
        changeType: ChangeType.REPEALED,
        impactedRelations: [],
        recommendations: [],
        statistics,
        analyzedAt: new Date().toISOString(),
      };

      expect(result.articleId).toBe('article123');
      expect(result.changeType).toBe(ChangeType.REPEALED);
      expect(result.statistics.totalImpacted).toBe(10);
      expect(result.statistics.highPriorityCount).toBe(3);
    });

    it('应该允许空的关系和建议列表', () => {
      const statistics: ImpactStatistics = {
        totalImpacted: 0,
        byImpactStatus: {},
        byRelationType: {},
        highPriorityCount: 0,
        mediumPriorityCount: 0,
        lowPriorityCount: 0,
      };

      const result: ImpactAnalysisResult = {
        articleId: 'article123',
        articleName: '《民法典》第123条',
        articleNumber: '第123条',
        changeType: ChangeType.AMENDED,
        impactedRelations: [],
        recommendations: [],
        statistics,
        analyzedAt: new Date().toISOString(),
      };

      expect(result.impactedRelations).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
      expect(result.statistics.totalImpacted).toBe(0);
    });
  });

  describe('ImpactStatistics', () => {
    it('应该正确构建统计对象', () => {
      const statistics: ImpactStatistics = {
        totalImpacted: 15,
        byImpactStatus: {
          [ImpactStatus.POTENTIALLY_INVALID]: 8,
          [ImpactStatus.NEEDS_REVIEW]: 4,
          [ImpactStatus.AFFECTED]: 3,
        },
        byRelationType: {
          [RelationType.CITES]: 7,
          [RelationType.COMPLETES]: 3,
          [RelationType.CONFLICTS]: 2,
          [RelationType.RELATED]: 3,
        },
        highPriorityCount: 5,
        mediumPriorityCount: 6,
        lowPriorityCount: 4,
      };

      expect(statistics.totalImpacted).toBe(15);
      expect(statistics.byImpactStatus[ImpactStatus.POTENTIALLY_INVALID]).toBe(
        8
      );
      expect(statistics.highPriorityCount).toBe(5);
    });

    it('应该允许部分字段为空', () => {
      const statistics: ImpactStatistics = {
        totalImpacted: 0,
        byImpactStatus: {},
        byRelationType: {},
        highPriorityCount: 0,
        mediumPriorityCount: 0,
        lowPriorityCount: 0,
      };

      expect(statistics.totalImpacted).toBe(0);
      expect(Object.keys(statistics.byImpactStatus)).toHaveLength(0);
    });

    it('应该正确计算总数', () => {
      const statistics: ImpactStatistics = {
        totalImpacted: 10,
        byImpactStatus: {
          [ImpactStatus.POTENTIALLY_INVALID]: 5,
          [ImpactStatus.NEEDS_REVIEW]: 3,
          [ImpactStatus.AFFECTED]: 2,
        },
        byRelationType: {},
        highPriorityCount: 5,
        mediumPriorityCount: 3,
        lowPriorityCount: 2,
      };

      const sum =
        statistics.highPriorityCount +
        statistics.mediumPriorityCount +
        statistics.lowPriorityCount;
      expect(sum).toBe(10);
      expect(statistics.totalImpacted).toBe(sum);
    });
  });

  describe('RelationUpdateInput', () => {
    it('应该正确构建更新输入', () => {
      const update: RelationUpdateInput = {
        relationId: 'rel123',
        verificationStatus: VerificationStatus.REJECTED,
        rejectionReason: '目标法条已废止',
        verifiedBy: 'user123',
        reviewComment: '审核备注',
      };

      expect(update.relationId).toBe('rel123');
      expect(update.verificationStatus).toBe(VerificationStatus.REJECTED);
      expect(update.rejectionReason).toBe('目标法条已废止');
      expect(update.verifiedBy).toBe('user123');
    });

    it('应该允许部分字段为空', () => {
      const update: RelationUpdateInput = {
        relationId: 'rel123',
        verificationStatus: VerificationStatus.VERIFIED,
      };

      expect(update.relationId).toBe('rel123');
      expect(update.verificationStatus).toBe(VerificationStatus.VERIFIED);
      expect(update.rejectionReason).toBeUndefined();
      expect(update.verifiedBy).toBeUndefined();
    });

    it('应该支持所有验证状态', () => {
      const statuses = [
        VerificationStatus.PENDING,
        VerificationStatus.VERIFIED,
        VerificationStatus.REJECTED,
      ];

      statuses.forEach(status => {
        const update: RelationUpdateInput = {
          relationId: 'rel123',
          verificationStatus: status,
        };

        expect(update.verificationStatus).toBe(status);
      });
    });
  });

  describe('BatchUpdateResult', () => {
    it('应该正确构建批量更新结果', () => {
      const result: BatchUpdateResult = {
        successCount: 8,
        failedCount: 2,
        results: [
          { relationId: 'rel1', success: true },
          { relationId: 'rel2', success: true },
          { relationId: 'rel3', success: false, error: '关系不存在' },
        ],
      };

      expect(result.successCount).toBe(8);
      expect(result.failedCount).toBe(2);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].success).toBe(true);
      expect(result.results[2].success).toBe(false);
      expect(result.results[2].error).toBe('关系不存在');
    });

    it('应该允许所有更新都成功', () => {
      const result: BatchUpdateResult = {
        successCount: 3,
        failedCount: 0,
        results: [
          { relationId: 'rel1', success: true },
          { relationId: 'rel2', success: true },
          { relationId: 'rel3', success: true },
        ],
      };

      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      result.results.forEach(r => expect(r.success).toBe(true));
    });

    it('应该允许所有更新都失败', () => {
      const result: BatchUpdateResult = {
        successCount: 0,
        failedCount: 3,
        results: [
          { relationId: 'rel1', success: false, error: '错误1' },
          { relationId: 'rel2', success: false, error: '错误2' },
          { relationId: 'rel3', success: false, error: '错误3' },
        ],
      };

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(3);
      result.results.forEach(r => {
        expect(r.success).toBe(false);
        expect(r.error).toBeDefined();
      });
    });
  });

  describe('ImpactAnalysisConfig', () => {
    it('应该正确构建配置对象', () => {
      const config: ImpactAnalysisConfig = {
        defaultDepth: 2,
        highImpactThreshold: 10,
        mediumImpactThreshold: 5,
        enableAutoVerify: true,
        autoVerifyConditions: {
          minConfidence: 0.8,
          minStrength: 0.7,
          mustBeVerified: true,
        },
      };

      expect(config.defaultDepth).toBe(2);
      expect(config.highImpactThreshold).toBe(10);
      expect(config.enableAutoVerify).toBe(true);
      expect(config.autoVerifyConditions.minConfidence).toBe(0.8);
    });

    it('应该允许禁用自动验证', () => {
      const config: ImpactAnalysisConfig = {
        defaultDepth: 2,
        highImpactThreshold: 10,
        mediumImpactThreshold: 5,
        enableAutoVerify: false,
        autoVerifyConditions: {
          minConfidence: 0.8,
          minStrength: 0.7,
          mustBeVerified: true,
        },
      };

      expect(config.enableAutoVerify).toBe(false);
    });

    it('应该支持灵活的阈值配置', () => {
      const config: ImpactAnalysisConfig = {
        defaultDepth: 3,
        highImpactThreshold: 20,
        mediumImpactThreshold: 10,
        enableAutoVerify: true,
        autoVerifyConditions: {
          minConfidence: 0.9,
          minStrength: 0.8,
          mustBeVerified: false,
        },
      };

      expect(config.defaultDepth).toBe(3);
      expect(config.highImpactThreshold).toBe(20);
      expect(config.autoVerifyConditions.minConfidence).toBe(0.9);
      expect(config.autoVerifyConditions.mustBeVerified).toBe(false);
    });
  });
});
