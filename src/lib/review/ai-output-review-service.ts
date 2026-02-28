/**
 * AI输出审核服务
 *
 * 负责人工复核工作流的实现，包括：
 * - AI输出入队
 * - 审核队列管理
 * - 审核操作（通过/拒绝/修改）
 * - 审核历史记录
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { AIOutputReviewStatus, AIOutputType } from '@prisma/client';
import { reviewerService } from './reviewer-service';

export interface CreateAIOutputReviewInput {
  outputType: AIOutputType;
  outputId?: string;
  content: string;
  aiProvider?: string;
  aiModel?: string;
  caseId?: string;
  documentId?: string;
  consultationId?: string;
  confidenceScore?: number;
  priority?: number;
}

export interface UpdateAIOutputReviewInput {
  status?: AIOutputReviewStatus;
  reviewerId?: string;
  verifiedComment?: string;
  sourceValidated?: boolean;
  sourceUrl?: string;
  validationError?: string;
}

export interface ReviewQueueQuery {
  status?: AIOutputReviewStatus;
  outputType?: AIOutputType;
  reviewerId?: string;
  caseId?: string;
  priority?: number;
  page?: number;
  pageSize?: number;
}

export interface ReviewStatistics {
  totalPending: number;
  totalInReview: number;
  totalApproved: number;
  totalRejected: number;
  totalRevisionRequired: number;
  averageReviewTime: number | null;
}

class AIOutputReviewService {
  /**
   * 创建AI输出审核记录（入队）
   */
  async createReview(input: CreateAIOutputReviewInput): Promise<unknown> {
    try {
      const review = await prisma.aIOutputReview.create({
        data: {
          outputType: input.outputType,
          outputId: input.outputId,
          content: input.content,
          aiProvider: input.aiProvider,
          aiModel: input.aiModel,
          caseId: input.caseId,
          documentId: input.documentId,
          consultationId: input.consultationId,
          confidenceScore: input.confidenceScore,
          priority: input.priority || 0,
          status: AIOutputReviewStatus.PENDING,
        },
      });

      logger.info('AI输出已加入审核队列', {
        reviewId: review.id,
        outputType: review.outputType,
      });

      return review;
    } catch (error) {
      logger.error('创建AI输出审核记录失败', error as Error);
      throw error;
    }
  }

  /**
   * 批量创建AI输出审核记录
   */
  async batchCreateReview(inputs: CreateAIOutputReviewInput[]): Promise<number> {
    try {
      const reviews = await prisma.aIOutputReview.createMany({
        data: inputs.map((input) => ({
          outputType: input.outputType,
          outputId: input.outputId,
          content: input.content,
          aiProvider: input.aiProvider,
          aiModel: input.aiModel,
          caseId: input.caseId,
          documentId: input.documentId,
          consultationId: input.consultationId,
          confidenceScore: input.confidenceScore,
          priority: input.priority || 0,
          status: AIOutputReviewStatus.PENDING,
        })),
      });

      logger.info('批量创建AI输出审核记录完成', {
        count: reviews.count,
      });

      return reviews.count;
    } catch (error) {
      logger.error('批量创建AI输出审核记录失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取审核队列列表
   */
  async getReviewQueue(query: ReviewQueueQuery): Promise<{
    items: unknown[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {};

      if (query.status) {
        where.status = query.status;
      }

      if (query.outputType) {
        where.outputType = query.outputType;
      }

      if (query.reviewerId) {
        where.reviewerId = query.reviewerId;
      }

      if (query.caseId) {
        where.caseId = query.caseId;
      }

      const [items, total] = await Promise.all([
        prisma.aIOutputReview.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' },
          ],
          include: {
            reviewer: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        }),
        prisma.aIOutputReview.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error('获取审核队列列表失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取待审核的项目
   */
  async getPendingReviews(
    outputType?: AIOutputType,
    limit: number = 10
  ): Promise<unknown[]> {
    try {
      return await prisma.aIOutputReview.findMany({
        where: {
          status: AIOutputReviewStatus.PENDING,
          ...(outputType && { outputType }),
        },
        take: limit,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });
    } catch (error) {
      logger.error('获取待审核项目失败', error as Error);
      throw error;
    }
  }

  /**
   * 认领审核任务（分配给审核员）
   */
  async claimReview(
    reviewId: string,
    reviewerId: string
  ): Promise<unknown> {
    try {
      const review = await prisma.aIOutputReview.update({
        where: { id: reviewId },
        data: {
          status: AIOutputReviewStatus.IN_REVIEW,
          reviewerId,
          verifiedBy: reviewerId,
        },
        include: {
          reviewer: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      logger.info('审核任务已认领', {
        reviewId,
        reviewerId,
      });

      return review;
    } catch (error) {
      logger.error('认领审核任务失败', error as Error);
      throw error;
    }
  }

  /**
   * 自动分配审核任务
   */
  async autoAssignReview(reviewId: string): Promise<unknown | null> {
    try {
      const review = await prisma.aIOutputReview.findUnique({
        where: { id: reviewId },
        select: {
          outputType: true,
        },
      });

      if (!review) {
        throw new Error('审核记录不存在');
      }

      // 获取可用审核员
      const reviewer = await reviewerService.getAvailableReviewer();

      if (!reviewer) {
        logger.warn('没有可用的审核员', { reviewId });
        return null;
      }

      // 分配审核任务
      return await this.claimReview(reviewId, (reviewer as { id: string }).id);
    } catch (error) {
      logger.error('自动分配审核任务失败', error as Error);
      throw error;
    }
  }

  /**
   * 审核通过
   */
  async approveReview(
    reviewId: string,
    reviewerId: string,
    comment?: string
  ): Promise<unknown> {
    try {
      const startTime = Date.now();

      const review = await prisma.aIOutputReview.update({
        where: { id: reviewId },
        data: {
          status: AIOutputReviewStatus.APPROVED,
          verifiedAt: new Date(),
          verifiedComment: comment,
        },
        include: {
          reviewer: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // 更新审核员统计
      const reviewDuration = Math.floor((Date.now() - startTime) / 1000);
      await reviewerService.updateReviewerStats(
        review.reviewerId!,
        'approve',
        reviewDuration
      );

      logger.info('审核通过', {
        reviewId,
        reviewerId,
        reviewDuration,
      });

      return review;
    } catch (error) {
      logger.error('审核通过操作失败', error as Error);
      throw error;
    }
  }

  /**
   * 审核拒绝
   */
  async rejectReview(
    reviewId: string,
    reviewerId: string,
    comment: string
  ): Promise<unknown> {
    try {
      const startTime = Date.now();

      const review = await prisma.aIOutputReview.update({
        where: { id: reviewId },
        data: {
          status: AIOutputReviewStatus.REJECTED,
          verifiedAt: new Date(),
          verifiedComment: comment,
        },
        include: {
          reviewer: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // 更新审核员统计
      const reviewDuration = Math.floor((Date.now() - startTime) / 1000);
      await reviewerService.updateReviewerStats(
        review.reviewerId!,
        'reject',
        reviewDuration
      );

      logger.info('审核拒绝', {
        reviewId,
        reviewerId,
        reviewDuration,
      });

      return review;
    } catch (error) {
      logger.error('审核拒绝操作失败', error as Error);
      throw error;
    }
  }

  /**
   * 要求修改
   */
  async requestRevision(
    reviewId: string,
    reviewerId: string,
    comment: string
  ): Promise<unknown> {
    try {
      const startTime = Date.now();

      const review = await prisma.aIOutputReview.update({
        where: { id: reviewId },
        data: {
          status: AIOutputReviewStatus.REVISION_REQUIRED,
          verifiedAt: new Date(),
          verifiedComment: comment,
        },
        include: {
          reviewer: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // 更新审核员统计
      const reviewDuration = Math.floor((Date.now() - startTime) / 1000);
      await reviewerService.updateReviewerStats(
        review.reviewerId!,
        'revision',
        reviewDuration
      );

      logger.info('审核要求修改', {
        reviewId,
        reviewerId,
        reviewDuration,
      });

      return review;
    } catch (error) {
      logger.error('审核要求修改操作失败', error as Error);
      throw error;
    }
  }

  /**
   * 重新提交审核（从PENDING状态开始）
   */
  async resubmitReview(
    reviewId: string,
    newContent?: string
  ): Promise<unknown> {
    try {
      const updateData: Record<string, unknown> = {
        status: AIOutputReviewStatus.PENDING,
        reviewerId: null,
        verifiedBy: null,
        verifiedAt: null,
        verifiedComment: null,
      };

      if (newContent) {
        updateData.content = newContent;
      }

      const review = await prisma.aIOutputReview.update({
        where: { id: reviewId },
        data: updateData,
      });

      logger.info('审核已重新提交', {
        reviewId,
      });

      return review;
    } catch (error) {
      logger.error('重新提交审核失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取审核详情
   */
  async getReviewById(id: string): Promise<unknown | null> {
    try {
      return await prisma.aIOutputReview.findUnique({
        where: { id },
        include: {
          reviewer: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      logger.error('获取审核详情失败', error as Error);
      throw error;
    }
  }

  /**
   * 更新审核优先级
   */
  async updatePriority(id: string, priority: number): Promise<unknown> {
    try {
      const review = await prisma.aIOutputReview.update({
        where: { id },
        data: { priority },
      });

      logger.debug('审核优先级已更新', {
        reviewId: id,
        priority,
      });

      return review;
    } catch (error) {
      logger.error('更新审核优先级失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取审核统计信息
   */
  async getReviewStatistics(): Promise<ReviewStatistics> {
    try {
      const [stats, avgResult] = await Promise.all([
        prisma.aIOutputReview.groupBy({
          by: ['status'],
          _count: {
            status: true,
          },
        }),
        prisma.aIOutputReview.aggregate({
          _avg: {
            reviewDuration: true,
          },
          where: {
            verifiedAt: { not: null },
          },
        }),
      ]);

      const result: ReviewStatistics = {
        totalPending: 0,
        totalInReview: 0,
        totalApproved: 0,
        totalRejected: 0,
        totalRevisionRequired: 0,
        averageReviewTime: avgResult._avg.reviewDuration || null,
      };

      for (const s of stats) {
        switch (s.status) {
          case AIOutputReviewStatus.PENDING:
            result.totalPending = s._count.status;
            break;
          case AIOutputReviewStatus.IN_REVIEW:
            result.totalInReview = s._count.status;
            break;
          case AIOutputReviewStatus.APPROVED:
            result.totalApproved = s._count.status;
            break;
          case AIOutputReviewStatus.REJECTED:
            result.totalRejected = s._count.status;
            break;
          case AIOutputReviewStatus.REVISION_REQUIRED:
            result.totalRevisionRequired = s._count.status;
            break;
        }
      }

      return result;
    } catch (error) {
      logger.error('获取审核统计信息失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取特定输出的审核状态
   */
  async getReviewByOutputId(
    outputType: AIOutputType,
    outputId: string
  ): Promise<unknown | null> {
    try {
      return await prisma.aIOutputReview.findFirst({
        where: {
          outputType,
          outputId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      logger.error('获取输出审核状态失败', error as Error);
      throw error;
    }
  }

  /**
   * 删除审核记录
   */
  async deleteReview(id: string): Promise<void> {
    try {
      await prisma.aIOutputReview.delete({
        where: { id },
      });

      logger.info('审核记录已删除', {
        reviewId: id,
      });
    } catch (error) {
      logger.error('删除审核记录失败', error as Error);
      throw error;
    }
  }
}

// 导出单例
export const aiOutputReviewService = new AIOutputReviewService();
