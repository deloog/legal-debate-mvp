import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import type {
  ExpertProfile,
  ExpertContributionStats,
  ExpertAccuracyRate,
  ExpertListFilters,
  ExpertListResult,
} from './types';

/**
 * 专家协作服务
 * 提供知识图谱专家认证、贡献统计、准确率计算等功能
 */
export class ExpertService {
  /**
   * 获取或创建专家档案
   */
  async getOrCreateExpertProfile(userId: string): Promise<ExpertProfile> {
    try {
      let expert = await prisma.knowledgeGraphExpert.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!expert) {
        expert = await prisma.knowledgeGraphExpert.create({
          data: {
            userId,
            expertLevel: 'JUNIOR',
            expertiseAreas: [],
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        logger.info('Created new expert profile', {
          userId,
          expertId: expert.id,
        });
      }

      return this.mapToExpertProfile(expert);
    } catch (error) {
      logger.error('Failed to get or create expert profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('获取或创建专家档案失败');
    }
  }

  /**
   * 更新专家档案
   */
  async updateExpertProfile(
    userId: string,
    data: {
      expertiseAreas?: string[];
      notes?: string;
    }
  ): Promise<ExpertProfile> {
    try {
      const expert = await prisma.knowledgeGraphExpert.update({
        where: { userId },
        data: {
          ...data,
          expertiseAreas: data.expertiseAreas
            ? { set: data.expertiseAreas }
            : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      logger.info('Updated expert profile', { userId, expertId: expert.id });
      return this.mapToExpertProfile(expert);
    } catch (error) {
      logger.error('Failed to update expert profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('更新专家档案失败');
    }
  }

  /**
   * 获取专家贡献统计
   */
  async getExpertContributionStats(
    userId: string
  ): Promise<ExpertContributionStats> {
    try {
      // 首先获取expert记录（因为关系表中的外键指向expert.id而不是userId）
      const expert = await prisma.knowledgeGraphExpert.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!expert) {
        return {
          userId,
          totalRelationsAdded: 0,
          totalRelationsVerified: 0,
          averageQualityScore: 0,
          lastUpdated: new Date(),
        };
      }

      const [addedRelations, verifiedRelations, qualityScore] =
        await Promise.all([
          // 统计专家添加的关系数量
          prisma.lawArticleRelation.count({
            where: {
              addedByExpertId: expert.id,
            },
          }),

          // 统计专家验证的关系数量
          prisma.lawArticleRelation.count({
            where: {
              verifiedBy: expert.id,
            },
          }),

          // 获取专家验证的关系的平均质量分
          prisma.lawArticleRelation.aggregate({
            where: {
              verifiedBy: expert.id,
              qualityScore: {
                isNot: null,
              },
            },
            _avg: {
              strength: true,
              confidence: true,
            },
          }),
        ]);

      const stats: ExpertContributionStats = {
        userId,
        totalRelationsAdded: addedRelations,
        totalRelationsVerified: verifiedRelations,
        averageQualityScore: qualityScore._avg.confidence ?? 0,
        lastUpdated: new Date(),
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get expert contribution stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('获取专家贡献统计失败');
    }
  }

  /**
   * 计算专家准确率
   */
  async calculateExpertAccuracyRate(
    userId: string
  ): Promise<ExpertAccuracyRate> {
    try {
      // 首先获取expert记录
      const expert = await prisma.knowledgeGraphExpert.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!expert) {
        return {
          userId,
          totalVerified: 0,
          correctCount: 0,
          accuracyRate: 0,
          confidenceLevel: 'LOW',
          lastUpdated: new Date(),
        };
      }

      // 获取专家验证的所有关系
      const verifiedRelations = await prisma.lawArticleRelation.findMany({
        where: {
          verifiedBy: expert.id,
        },
        include: {
          qualityScore: true,
        },
      });

      if (verifiedRelations.length === 0) {
        return {
          userId,
          totalVerified: 0,
          correctCount: 0,
          accuracyRate: 0,
          confidenceLevel: 'LOW',
          lastUpdated: new Date(),
        };
      }

      // 计算准确率：质量分 >= 0.8 的视为正确
      const correctCount = verifiedRelations.filter(
        r => r.qualityScore?.qualityScore >= 0.8
      ).length;

      const accuracyRate = correctCount / verifiedRelations.length;

      // 确定置信度水平
      let confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (verifiedRelations.length >= 50) {
        confidenceLevel = accuracyRate >= 0.9 ? 'HIGH' : 'MEDIUM';
      } else if (verifiedRelations.length >= 20) {
        confidenceLevel = 'MEDIUM';
      }

      const result: ExpertAccuracyRate = {
        userId,
        totalVerified: verifiedRelations.length,
        correctCount,
        accuracyRate,
        confidenceLevel,
        lastUpdated: new Date(),
      };

      return result;
    } catch (error) {
      logger.error('Failed to calculate expert accuracy rate', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('计算专家准确率失败');
    }
  }

  /**
   * 获取专家列表
   */
  async getExpertList(filters: ExpertListFilters): Promise<ExpertListResult> {
    try {
      const { expertLevel, expertiseArea, page = 1, pageSize = 20 } = filters;

      const where: Prisma.KnowledgeGraphExpertWhereInput = {};

      if (expertLevel) {
        where.expertLevel = expertLevel;
      }

      if (expertiseArea) {
        where.expertiseAreas = {
          has: expertiseArea,
        };
      }

      const [experts, total] = await Promise.all([
        prisma.knowledgeGraphExpert.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        prisma.knowledgeGraphExpert.count({ where }),
      ]);

      const expertProfiles = experts.map(this.mapToExpertProfile);

      return {
        experts: expertProfiles,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      logger.error('Failed to get expert list', {
        filters,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('获取专家列表失败');
    }
  }

  /**
   * 删除专家档案
   */
  async deleteExpertProfile(userId: string): Promise<void> {
    try {
      await prisma.knowledgeGraphExpert.delete({
        where: { userId },
      });

      logger.info('Deleted expert profile', { userId });
    } catch (error) {
      logger.error('Failed to delete expert profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('删除专家档案失败');
    }
  }

  /**
   * 验证专家等级是否满足要求
   */
  async verifyExpertLevel(
    userId: string,
    requiredLevel: string
  ): Promise<boolean> {
    try {
      const expert = await prisma.knowledgeGraphExpert.findUnique({
        where: { userId },
      });

      if (!expert) {
        return false;
      }

      const levelOrder = ['JUNIOR', 'SENIOR', 'MASTER'];
      const expertLevelIndex = levelOrder.indexOf(expert.expertLevel);
      const requiredLevelIndex = levelOrder.indexOf(requiredLevel);

      return expertLevelIndex >= requiredLevelIndex;
    } catch (error) {
      logger.error('Failed to verify expert level', {
        userId,
        requiredLevel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('验证专家等级失败');
    }
  }

  /**
   * 映射数据库模型到专家档案DTO
   */
  private mapToExpertProfile(
    expert: Prisma.KnowledgeGraphExpertGetPayload<{
      include: {
        user: {
          select: {
            id: true;
            name: true;
            email: true;
          };
        };
      };
    }>
  ): ExpertProfile {
    return {
      id: expert.id,
      userId: expert.userId,
      userName: expert.user.name ?? '未知',
      userEmail: expert.user.email,
      expertiseAreas: expert.expertiseAreas,
      expertLevel: expert.expertLevel,
      certifiedBy: expert.certifiedBy,
      certifiedAt: expert.certifiedAt,
      notes: expert.notes,
      createdAt: expert.createdAt,
      updatedAt: expert.updatedAt,
    };
  }
}

// 导出单例
export const expertService = new ExpertService();
