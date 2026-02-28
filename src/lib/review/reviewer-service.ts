/**
 * 审核员管理服务
 *
 * 负责审核员的注册、资质管理、统计等功能。
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { ReviewerLevel } from '@prisma/client';

export interface CreateReviewerInput {
  userId: string;
  reviewerLevel?: ReviewerLevel;
  specialty?: string[];
  maxConcurrentReviews?: number;
}

export interface UpdateReviewerInput {
  reviewerLevel?: ReviewerLevel;
  specialty?: string[];
  maxConcurrentReviews?: number;
  isActive?: boolean;
}

export interface ReviewerStats {
  totalReviews: number;
  approvedCount: number;
  rejectedCount: number;
  revisionCount: number;
  averageReviewTime: number | null;
  accuracyRate: number | null;
}

class ReviewerService {
  /**
   * 创建审核员
   */
  async createReviewer(input: CreateReviewerInput): Promise<unknown> {
    try {
      const reviewer = await prisma.reviewer.create({
        data: {
          userId: input.userId,
          reviewerLevel: input.reviewerLevel || ReviewerLevel.JUNIOR,
          specialty: input.specialty || [],
          maxConcurrentReviews: input.maxConcurrentReviews || 10,
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

      logger.info('审核员创建成功', {
        reviewerId: reviewer.id,
        userId: reviewer.userId,
      });

      return reviewer;
    } catch (error) {
      logger.error('创建审核员失败', error as Error);
      throw error;
    }
  }

  /**
   * 根据用户ID获取审核员
   */
  async getReviewerByUserId(userId: string): Promise<unknown | null> {
    try {
      return await prisma.reviewer.findUnique({
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
    } catch (error) {
      logger.error('获取审核员失败', error as Error);
      throw error;
    }
  }

  /**
   * 根据ID获取审核员
   */
  async getReviewerById(id: string): Promise<unknown | null> {
    try {
      return await prisma.reviewer.findUnique({
        where: { id },
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
    } catch (error) {
      logger.error('获取审核员失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取活跃的审核员列表
   */
  async getActiveReviewers(reviewerLevel?: ReviewerLevel): Promise<unknown[]> {
    try {
      const where: Record<string, unknown> = { isActive: true };

      if (reviewerLevel) {
        where.reviewerLevel = reviewerLevel;
      }

      return await prisma.reviewer.findMany({
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
        orderBy: {
          reviewerLevel: 'desc',
        },
      });
    } catch (error) {
      logger.error('获取活跃审核员列表失败', error as Error);
      throw error;
    }
  }

  /**
   * 更新审核员信息
   */
  async updateReviewer(id: string, input: UpdateReviewerInput): Promise<unknown> {
    try {
      const reviewer = await prisma.reviewer.update({
        where: { id },
        data: input,
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

      logger.info('审核员信息更新成功', {
        reviewerId: reviewer.id,
      });

      return reviewer;
    } catch (error) {
      logger.error('更新审核员信息失败', error as Error);
      throw error;
    }
  }

  /**
   * 停用审核员
   */
  async deactivateReviewer(id: string): Promise<unknown> {
    try {
      const reviewer = await prisma.reviewer.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info('审核员已停用', {
        reviewerId: reviewer.id,
      });

      return reviewer;
    } catch (error) {
      logger.error('停用审核员失败', error as Error);
      throw error;
    }
  }

  /**
   * 激活审核员
   */
  async activateReviewer(id: string): Promise<unknown> {
    try {
      const reviewer = await prisma.reviewer.update({
        where: { id },
        data: { isActive: true },
      });

      logger.info('审核员已激活', {
        reviewerId: reviewer.id,
      });

      return reviewer;
    } catch (error) {
      logger.error('激活审核员失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取审核员统计信息
   */
  async getReviewerStats(id: string): Promise<ReviewerStats> {
    try {
      const reviewer = await prisma.reviewer.findUnique({
        where: { id },
        select: {
          totalReviews: true,
          approvedCount: true,
          rejectedCount: true,
          revisionCount: true,
          averageReviewTime: true,
          accuracyRate: true,
        },
      });

      if (!reviewer) {
        throw new Error('审核员不存在');
      }

      return reviewer as ReviewerStats;
    } catch (error) {
      logger.error('获取审核员统计信息失败', error as Error);
      throw error;
    }
  }

  /**
   * 更新审核员统计信息
   */
  async updateReviewerStats(
    id: string,
    action: 'approve' | 'reject' | 'revision',
    reviewTime: number
  ): Promise<void> {
    try {
      const reviewer = await prisma.reviewer.findUnique({
        where: { id },
        select: {
          totalReviews: true,
          approvedCount: true,
          rejectedCount: true,
          revisionCount: true,
          averageReviewTime: true,
        },
      });

      if (!reviewer) {
        throw new Error('审核员不存在');
      }

      const newTotalReviews = reviewer.totalReviews + 1;
      let newAverageReviewTime: number | null = null;

      if (reviewer.averageReviewTime) {
        // 计算新的平均审核时间
        newAverageReviewTime =
          (reviewer.averageReviewTime * reviewer.totalReviews + reviewTime) /
          newTotalReviews;
      } else {
        newAverageReviewTime = reviewTime;
      }

      const updateData: Record<string, unknown> = {
        totalReviews: newTotalReviews,
        averageReviewTime: newAverageReviewTime,
      };

      switch (action) {
        case 'approve':
          updateData.approvedCount = reviewer.approvedCount + 1;
          break;
        case 'reject':
          updateData.rejectedCount = reviewer.rejectedCount + 1;
          break;
        case 'revision':
          updateData.revisionCount = reviewer.revisionCount + 1;
          break;
      }

      await prisma.reviewer.update({
        where: { id },
        data: updateData,
      });

      logger.debug('审核员统计信息已更新', {
        reviewerId: id,
        action,
        reviewTime,
      });
    } catch (error) {
      logger.error('更新审核员统计信息失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取可用审核员（考虑并发限制）
   */
  async getAvailableReviewer(
    specialty?: string[]
  ): Promise<unknown | null> {
    try {
      // 查找当前待处理数量未达到上限的活跃审核员
      const reviewers = await prisma.reviewer.findMany({
        where: {
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              reviews: {
                where: {
                  status: 'IN_REVIEW',
                },
              },
            },
          },
        },
        orderBy: {
          reviewerLevel: 'desc',
        },
      });

      // 过滤出未达到并发上限的审核员
      const availableReviewers = reviewers.filter(
        (r) => r._count.reviews < r.maxConcurrentReviews
      );

      if (availableReviewers.length === 0) {
        return null;
      }

      // 如果指定了专业领域，优先选择匹配的审核员
      if (specialty && specialty.length > 0) {
        const matchedReviewers = availableReviewers.filter((r) =>
          r.specialty.some((s) => specialty.includes(s))
        );

        if (matchedReviewers.length > 0) {
          return matchedReviewers[0];
        }
      }

      // 返回最高等级的可用审核员
      return availableReviewers[0];
    } catch (error) {
      logger.error('获取可用审核员失败', error as Error);
      throw error;
    }
  }
}

// 导出单例
export const reviewerService = new ReviewerService();
