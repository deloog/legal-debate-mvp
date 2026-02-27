/**
 * AI输出审核服务单元测试
 *
 * 测试AI输出审核工作流的核心功能
 */

import { prisma } from '@/lib/db/prisma';
import { aiOutputReviewService } from '@/lib/review/ai-output-review-service';
import { AIOutputReviewStatus, AIOutputType } from '@prisma/client';

// Mock Prisma client
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    aIOutputReview: {
      create: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

// Mock reviewerService
jest.mock('@/lib/review/reviewer-service', () => ({
  reviewerService: {
    getAvailableReviewer: jest.fn(),
    updateReviewerStats: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AIOutputReviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    it('should create a new AI output review', async () => {
      const mockReview = {
        id: 'review-1',
        outputType: AIOutputType.LEGAL_REFERENCE,
        content: 'Test content',
        status: AIOutputReviewStatus.PENDING,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.aIOutputReview.create as jest.Mock).mockResolvedValue(mockReview);

      const result = await aiOutputReviewService.createReview({
        outputType: AIOutputType.LEGAL_REFERENCE,
        content: 'Test content',
      });

      expect(result).toEqual(mockReview);
      expect(prisma.aIOutputReview.create).toHaveBeenCalledWith({
        data: {
          outputType: AIOutputType.LEGAL_REFERENCE,
          content: 'Test content',
          priority: 0,
          status: AIOutputReviewStatus.PENDING,
        },
      });
    });
  });

  describe('batchCreateReview', () => {
    it('should batch create reviews', async () => {
      (prisma.aIOutputReview.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const result = await aiOutputReviewService.batchCreateReview([
        {
          outputType: AIOutputType.LEGAL_REFERENCE,
          content: 'Content 1',
        },
        {
          outputType: AIOutputType.ARGUMENT,
          content: 'Content 2',
        },
        {
          outputType: AIOutputType.DOCUMENT,
          content: 'Content 3',
        },
      ]);

      expect(result).toBe(3);
      expect(prisma.aIOutputReview.createMany).toHaveBeenCalled();
    });
  });

  describe('getReviewQueue', () => {
    it('should return paginated review queue', async () => {
      const mockItems = [
        { id: 'review-1', status: AIOutputReviewStatus.PENDING },
        { id: 'review-2', status: AIOutputReviewStatus.PENDING },
      ];

      (prisma.aIOutputReview.findMany as jest.Mock).mockResolvedValue(mockItems);
      (prisma.aIOutputReview.count as jest.Mock).mockResolvedValue(2);

      const result = await aiOutputReviewService.getReviewQueue({
        status: AIOutputReviewStatus.PENDING,
        page: 1,
        pageSize: 10,
      });

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('getPendingReviews', () => {
    it('should return pending reviews', async () => {
      const mockReviews = [
        { id: 'review-1', status: AIOutputReviewStatus.PENDING },
      ];

      (prisma.aIOutputReview.findMany as jest.Mock).mockResolvedValue(mockReviews);

      const result = await aiOutputReviewService.getPendingReviews();

      expect(result).toEqual(mockReviews);
      expect(prisma.aIOutputReview.findMany).toHaveBeenCalledWith({
        where: {
          status: AIOutputReviewStatus.PENDING,
        },
        take: 10,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('claimReview', () => {
    it('should claim a review for a reviewer', async () => {
      const mockReview = {
        id: 'review-1',
        status: AIOutputReviewStatus.IN_REVIEW,
        reviewerId: 'reviewer-1',
      };

      (prisma.aIOutputReview.update as jest.Mock).mockResolvedValue(mockReview);

      const result = await aiOutputReviewService.claimReview(
        'review-1',
        'reviewer-1'
      );

      expect(result).toEqual(mockReview);
      expect(prisma.aIOutputReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          status: AIOutputReviewStatus.IN_REVIEW,
          reviewerId: 'reviewer-1',
          verifiedBy: 'reviewer-1',
        },
        include: {
          reviewer: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    });
  });

  describe('approveReview', () => {
    it('should approve a review', async () => {
      const mockReview = {
        id: 'review-1',
        status: AIOutputReviewStatus.APPROVED,
        reviewerId: 'reviewer-1',
      };

      (prisma.aIOutputReview.update as jest.Mock).mockResolvedValue(mockReview);

      const result = await aiOutputReviewService.approveReview(
        'review-1',
        'reviewer-1',
        'Looks good'
      );

      expect(result).toEqual(mockReview);
      expect(prisma.aIOutputReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          status: AIOutputReviewStatus.APPROVED,
          verifiedAt: expect.any(Date),
          verifiedComment: 'Looks good',
        },
        include: {
          reviewer: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    });
  });

  describe('rejectReview', () => {
    it('should reject a review', async () => {
      const mockReview = {
        id: 'review-1',
        status: AIOutputReviewStatus.REJECTED,
        reviewerId: 'reviewer-1',
      };

      (prisma.aIOutputReview.update as jest.Mock).mockResolvedValue(mockReview);

      const result = await aiOutputReviewService.rejectReview(
        'review-1',
        'reviewer-1',
        'Content has errors'
      );

      expect(result).toEqual(mockReview);
      expect(prisma.aIOutputReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          status: AIOutputReviewStatus.REJECTED,
          verifiedAt: expect.any(Date),
          verifiedComment: 'Content has errors',
        },
        include: {
          reviewer: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    });
  });

  describe('requestRevision', () => {
    it('should request revision for a review', async () => {
      const mockReview = {
        id: 'review-1',
        status: AIOutputReviewStatus.REVISION_REQUIRED,
        reviewerId: 'reviewer-1',
      };

      (prisma.aIOutputReview.update as jest.Mock).mockResolvedValue(mockReview);

      const result = await aiOutputReviewService.requestRevision(
        'review-1',
        'reviewer-1',
        'Please revise the content'
      );

      expect(result).toEqual(mockReview);
      expect(prisma.aIOutputReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          status: AIOutputReviewStatus.REVISION_REQUIRED,
          verifiedAt: expect.any(Date),
          verifiedComment: 'Please revise the content',
        },
        include: {
          reviewer: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    });
  });

  describe('resubmitReview', () => {
    it('should resubmit a review to pending', async () => {
      const mockReview = {
        id: 'review-1',
        status: AIOutputReviewStatus.PENDING,
      };

      (prisma.aIOutputReview.update as jest.Mock).mockResolvedValue(mockReview);

      const result = await aiOutputReviewService.resubmitReview('review-1');

      expect(result).toEqual(mockReview);
      expect(prisma.aIOutputReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          status: AIOutputReviewStatus.PENDING,
          reviewerId: null,
          verifiedBy: null,
          verifiedAt: null,
          verifiedComment: null,
        },
      });
    });

    it('should allow updating content when resubmitting', async () => {
      const mockReview = {
        id: 'review-1',
        status: AIOutputReviewStatus.PENDING,
      };

      (prisma.aIOutputReview.update as jest.Mock).mockResolvedValue(mockReview);

      await aiOutputReviewService.resubmitReview('review-1', 'New content');

      expect(prisma.aIOutputReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          status: AIOutputReviewStatus.PENDING,
          reviewerId: null,
          verifiedBy: null,
          verifiedAt: null,
          verifiedComment: null,
          content: 'New content',
        },
      });
    });
  });

  describe('getReviewById', () => {
    it('should return review by id', async () => {
      const mockReview = { id: 'review-1' };

      (prisma.aIOutputReview.findUnique as jest.Mock).mockResolvedValue(
        mockReview
      );

      const result = await aiOutputReviewService.getReviewById('review-1');

      expect(result).toEqual(mockReview);
    });
  });

  describe('getReviewStatistics', () => {
    it('should return review statistics', async () => {
      (prisma.aIOutputReview.groupBy as jest.Mock).mockResolvedValue([
        { status: AIOutputReviewStatus.PENDING, _count: { status: 5 } },
        { status: AIOutputReviewStatus.IN_REVIEW, _count: { status: 2 } },
        { status: AIOutputReviewStatus.APPROVED, _count: { status: 10 } },
        { status: AIOutputReviewStatus.REJECTED, _count: { status: 3 } },
      ]);

      (prisma.aIOutputReview.aggregate as jest.Mock).mockResolvedValue({
        _avg: { reviewDuration: 120.5 },
      });

      const result = await aiOutputReviewService.getReviewStatistics();

      expect(result.totalPending).toBe(5);
      expect(result.totalInReview).toBe(2);
      expect(result.totalApproved).toBe(10);
      expect(result.totalRejected).toBe(3);
      expect(result.averageReviewTime).toBe(120.5);
    });
  });

  describe('deleteReview', () => {
    it('should delete a review', async () => {
      (prisma.aIOutputReview.delete as jest.Mock).mockResolvedValue({});

      await aiOutputReviewService.deleteReview('review-1');

      expect(prisma.aIOutputReview.delete).toHaveBeenCalledWith({
        where: { id: 'review-1' },
      });
    });
  });
});
