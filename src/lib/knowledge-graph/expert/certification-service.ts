import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { expertService } from './expert-service';
import type {
  ExpertLevel,
  CertifyExpertRequest,
  PromoteExpertRequest,
  ExpertAccuracyRate,
  ExpertContributionStats,
} from './types';

/**
 * 专家认证服务
 * 处理专家认证流程、等级升级、资格验证等功能
 */
export class CertificationService {
  /**
   * 认证专家
   */
  async certifyExpert(request: CertifyExpertRequest): Promise<void> {
    try {
      const { expertId, adminId, notes } = request;

      // 获取专家信息
      const expert = await prisma.knowledgeGraphExpert.findUnique({
        where: { id: expertId },
        include: {
          user: true,
        },
      });

      if (!expert) {
        throw new Error('专家不存在');
      }

      // 检查专家是否已认证
      if (expert.certifiedAt) {
        throw new Error('专家已认证，无需重复认证');
      }

      // 验证管理员权限（这里简化处理，实际应检查用户角色）
      const admin = await prisma.user.findUnique({
        where: { id: adminId },
      });

      if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
        throw new Error('无权限进行专家认证');
      }

      // 更新专家认证状态
      await prisma.knowledgeGraphExpert.update({
        where: { id: expertId },
        data: {
          certifiedBy: adminId,
          certifiedAt: new Date(),
        },
      });

      logger.info('Expert certified successfully', {
        expertId,
        adminId,
        expertUserId: expert.userId,
        notes,
      });
    } catch (error) {
      logger.error('Failed to certify expert', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(error instanceof Error ? error.message : '认证专家失败');
    }
  }

  /**
   * 升级专家等级
   */
  async promoteExpert(request: PromoteExpertRequest): Promise<void> {
    try {
      const { expertId, newLevel, reason } = request;

      // 获取专家信息
      const expert = await prisma.knowledgeGraphExpert.findUnique({
        where: { id: expertId },
        include: {
          user: true,
        },
      });

      if (!expert) {
        throw new Error('专家不存在');
      }

      // 检查专家是否已认证
      if (!expert.certifiedAt) {
        throw new Error('专家未认证，无法升级等级');
      }

      // 验证等级是否合理（不能降级）
      const levelOrder = ['JUNIOR', 'SENIOR', 'MASTER'];
      const currentLevelIndex = levelOrder.indexOf(expert.expertLevel);
      const newLevelIndex = levelOrder.indexOf(newLevel);

      if (newLevelIndex <= currentLevelIndex) {
        throw new Error('只能升级专家等级，不能降级');
      }

      // 验证升级条件
      await this.validatePromotionRequirements(expert.userId, newLevel);

      // 更新专家等级
      await prisma.knowledgeGraphExpert.update({
        where: { id: expertId },
        data: {
          expertLevel: newLevel,
        },
      });

      // 记录升级历史（这里简化处理，可以扩展为专门的历史表）
      logger.info('Expert promoted successfully', {
        expertId,
        oldLevel: expert.expertLevel,
        newLevel,
        reason,
      });
    } catch (error) {
      logger.error('Failed to promote expert', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        error instanceof Error ? error.message : '升级专家等级失败'
      );
    }
  }

  /**
   * 验证升级条件
   */
  private async validatePromotionRequirements(
    userId: string,
    targetLevel: ExpertLevel
  ): Promise<void> {
    // 获取专家的准确率和贡献统计
    const [accuracyRate, contributionStats] = await Promise.all([
      expertService.calculateExpertAccuracyRate(userId),
      expertService.getExpertContributionStats(userId),
    ]);

    // 定义升级条件
    const requirements: Record<
      ExpertLevel,
      { minAccuracyRate: number; minVerifiedRelations: number }
    > = {
      JUNIOR: {
        minAccuracyRate: 0.6,
        minVerifiedRelations: 10,
      },
      SENIOR: {
        minAccuracyRate: 0.8,
        minVerifiedRelations: 50,
      },
      MASTER: {
        minAccuracyRate: 0.9,
        minVerifiedRelations: 100,
      },
    };

    const required = requirements[targetLevel];

    if (accuracyRate.accuracyRate < required.minAccuracyRate) {
      throw new Error(
        `准确率不足：当前 ${(accuracyRate.accuracyRate * 100).toFixed(
          1
        )}%，要求 ≥ ${(required.minAccuracyRate * 100).toFixed(1)}%`
      );
    }

    if (
      contributionStats.totalRelationsVerified < required.minVerifiedRelations
    ) {
      throw new Error(
        `验证关系数不足：当前 ${contributionStats.totalRelationsVerified}，要求 ≥ ${required.minVerifiedRelations}`
      );
    }

    // SENIOR和MASTER要求置信度为HIGH
    if (targetLevel !== 'JUNIOR' && accuracyRate.confidenceLevel !== 'HIGH') {
      throw new Error(
        `置信度不足：当前 ${accuracyRate.confidenceLevel}，要求 HIGH`
      );
    }
  }

  /**
   * 自动评估专家等级建议
   */
  async evaluateExpertLevelSuggestion(userId: string): Promise<{
    currentLevel: ExpertLevel;
    suggestedLevel: ExpertLevel;
    reasons: string[];
    readyForPromotion: boolean;
  }> {
    try {
      const [accuracyRate, contributionStats] = await Promise.all([
        expertService.calculateExpertAccuracyRate(userId),
        expertService.getExpertContributionStats(userId),
      ]);

      // 获取当前等级
      const expert = await prisma.knowledgeGraphExpert.findUnique({
        where: { userId },
      });

      if (!expert) {
        throw new Error('专家不存在');
      }

      const currentLevel = expert.expertLevel;
      const suggestedLevel = this.calculateSuggestedLevel(
        accuracyRate,
        contributionStats
      );

      // 生成升级理由
      const reasons = this.generatePromotionReasons(
        accuracyRate,
        contributionStats,
        suggestedLevel
      );

      // 判断是否可以升级
      const levelOrder = ['JUNIOR', 'SENIOR', 'MASTER'];
      const currentIndex = levelOrder.indexOf(currentLevel);
      const suggestedIndex = levelOrder.indexOf(suggestedLevel);
      const readyForPromotion = suggestedIndex > currentIndex;

      return {
        currentLevel,
        suggestedLevel,
        reasons,
        readyForPromotion,
      };
    } catch (error) {
      logger.error('Failed to evaluate expert level suggestion', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('评估专家等级建议失败');
    }
  }

  /**
   * 计算建议等级
   */
  private calculateSuggestedLevel(
    accuracyRate: ExpertAccuracyRate,
    contributionStats: ExpertContributionStats
  ): ExpertLevel {
    const { accuracyRate: rate, totalVerified } = accuracyRate;
    // averageQualityScore保留以备未来使用
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { averageQualityScore } = contributionStats;

    // MASTER等级
    if (rate >= 0.9 && totalVerified >= 100) {
      return 'MASTER';
    }

    // SENIOR等级
    if (rate >= 0.8 && totalVerified >= 50) {
      return 'SENIOR';
    }

    // JUNIOR等级（默认）
    return 'JUNIOR';
  }

  /**
   * 生成升级理由
   */
  private generatePromotionReasons(
    accuracyRate: ExpertAccuracyRate,
    contributionStats: ExpertContributionStats,
    suggestedLevel: ExpertLevel
  ): string[] {
    const reasons: string[] = [];

    reasons.push(`准确率：${(accuracyRate.accuracyRate * 100).toFixed(1)}%`);
    reasons.push(`验证关系数：${accuracyRate.totalVerified}`);
    reasons.push(
      `平均质量分：${(contributionStats.averageQualityScore * 100).toFixed(1)}`
    );
    reasons.push(`置信度：${accuracyRate.confidenceLevel}`);

    if (suggestedLevel === 'MASTER') {
      reasons.push('满足MASTER等级的所有要求');
    } else if (suggestedLevel === 'SENIOR') {
      reasons.push('满足SENIOR等级的基本要求');
    }

    return reasons;
  }

  /**
   * 获取专家认证历史（简化版）
   */
  async getExpertCertificationHistory(expertId: string): Promise<{
    certifiedAt: Date | null;
    certifiedBy: string | null;
    levelHistory: {
      from: string;
      to: string;
      changedAt: Date;
    }[];
  }> {
    try {
      const expert = await prisma.knowledgeGraphExpert.findUnique({
        where: { id: expertId },
      });

      if (!expert) {
        const error = new Error('专家不存在');
        logger.error('Expert not found for certification history', {
          expertId,
        });
        throw error;
      }

      // 简化版：只返回当前认证信息
      // 实际项目中应该有专门的等级变更历史表
      return {
        certifiedAt: expert.certifiedAt,
        certifiedBy: expert.certifiedBy,
        levelHistory: [],
      };
    } catch (error) {
      // 如果是我们主动抛出的专家不存在错误，直接重新抛出
      if (error instanceof Error && error.message === '专家不存在') {
        throw error;
      }

      logger.error('Failed to get expert certification history', {
        expertId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('获取专家认证历史失败');
    }
  }

  /**
   * 撤销专家认证（仅管理员）
   */
  async revokeExpertCertification(
    expertId: string,
    adminId: string,
    reason: string
  ): Promise<void> {
    try {
      // 验证管理员权限
      const admin = await prisma.user.findUnique({
        where: { id: adminId },
      });

      if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
        const error = new Error('无权限撤销专家认证');
        logger.error('No permission to revoke expert certification', {
          expertId,
          adminId,
        });
        throw error;
      }

      // 更新专家认证状态
      await prisma.knowledgeGraphExpert.update({
        where: { id: expertId },
        data: {
          certifiedBy: null,
          certifiedAt: null,
          notes: `认证撤销：${reason}`,
        },
      });

      logger.info('Expert certification revoked', {
        expertId,
        adminId,
        reason,
      });
    } catch (error) {
      // 如果是我们主动抛出的权限错误，直接重新抛出
      if (error instanceof Error && error.message === '无权限撤销专家认证') {
        throw error;
      }

      logger.error('Failed to revoke expert certification', {
        expertId,
        adminId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('撤销专家认证失败');
    }
  }
}

// 导出单例
export const certificationService = new CertificationService();
