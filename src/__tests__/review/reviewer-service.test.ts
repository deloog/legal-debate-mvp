/**
 * 审核员服务单元测试
 *
 * 测试审核员管理的核心功能
 */

import { prisma } from '@/lib/db/prisma';
import { reviewerService } from '@/lib/review/reviewer-service';
import { ReviewerLevel } from '@prisma/client';

// Mock Prisma client
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    reviewer: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
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

describe('ReviewerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReviewer', () => {
    it('should create a new reviewer', async () => {
      const mockReviewer = {
        id: 'reviewer-1',
        userId: 'user-1',
        reviewerLevel: ReviewerLevel.JUNIOR,
        specialty: ['合同法'],
        maxConcurrentReviews: 10,
        isActive: true,
        totalReviews: 0,
        approvedCount: 0,
        rejectedCount: 0,
        revisionCount: 0,
        averageReviewTime: null,
        accuracyRate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      (prisma.reviewer.create as jest.Mock).mockResolvedValue(mockReviewer);

      const result = await reviewerService.createReviewer({
        userId: 'user-1',
        reviewerLevel: ReviewerLevel.JUNIOR,
        specialty: ['合同法'],
      });

      expect(result).toEqual(mockReviewer);
      expect(prisma.reviewer.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          reviewerLevel: ReviewerLevel.JUNIOR,
          specialty: ['合同法'],
          maxConcurrentReviews: 10,
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
    });

    it('should throw error when creation fails', async () => {
      (prisma.reviewer.create as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        reviewerService.createReviewer({
          userId: 'user-1',
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('getReviewerByUserId', () => {
    it('should return reviewer by userId', async () => {
      const mockReviewer = {
        id: 'reviewer-1',
        userId: 'user-1',
        reviewerLevel: ReviewerLevel.SENIOR,
      };

      (prisma.reviewer.findUnique as jest.Mock).mockResolvedValue(mockReviewer);

      const result = await reviewerService.getReviewerByUserId('user-1');

      expect(result).toEqual(mockReviewer);
      expect(prisma.reviewer.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
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
    });

    it('should return null when reviewer not found', async () => {
      (prisma.reviewer.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await reviewerService.getReviewerByUserId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getActiveReviewers', () => {
    it('should return active reviewers', async () => {
      const mockReviewers = [
        { id: 'reviewer-1', reviewerLevel: ReviewerLevel.EXPERT },
        { id: 'reviewer-2', reviewerLevel: ReviewerLevel.SENIOR },
      ];

      (prisma.reviewer.findMany as jest.Mock).mockResolvedValue(mockReviewers);

      const result = await reviewerService.getActiveReviewers();

      expect(result).toEqual(mockReviewers);
      expect(prisma.reviewer.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
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
    });

    it('should filter by reviewer level when provided', async () => {
      const mockReviewers = [
        { id: 'reviewer-1', reviewerLevel: ReviewerLevel.SENIOR },
      ];

      (prisma.reviewer.findMany as jest.Mock).mockResolvedValue(mockReviewers);

      await reviewerService.getActiveReviewers(ReviewerLevel.SENIOR);

      expect(prisma.reviewer.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          reviewerLevel: ReviewerLevel.SENIOR,
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
        orderBy: {
          reviewerLevel: 'desc',
        },
      });
    });
  });

  describe('updateReviewer', () => {
    it('should update reviewer information', async () => {
      const mockUpdatedReviewer = {
        id: 'reviewer-1',
        reviewerLevel: ReviewerLevel.SENIOR,
        specialty: ['合同法', '知识产权'],
      };

      (prisma.reviewer.update as jest.Mock).mockResolvedValue(
        mockUpdatedReviewer
      );

      const result = await reviewerService.updateReviewer('reviewer-1', {
        reviewerLevel: ReviewerLevel.SENIOR,
        specialty: ['合同法', '知识产权'],
      });

      expect(result).toEqual(mockUpdatedReviewer);
      expect(prisma.reviewer.update).toHaveBeenCalledWith({
        where: { id: 'reviewer-1' },
        data: {
          reviewerLevel: ReviewerLevel.SENIOR,
          specialty: ['合同法', '知识产权'],
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
    });
  });

  describe('deactivateReviewer', () => {
    it('should deactivate a reviewer', async () => {
      const mockReviewer = {
        id: 'reviewer-1',
        isActive: false,
      };

      (prisma.reviewer.update as jest.Mock).mockResolvedValue(mockReviewer);

      const result = await reviewerService.deactivateReviewer('reviewer-1');

      expect(result).toEqual(mockReviewer);
      expect(prisma.reviewer.update).toHaveBeenCalledWith({
        where: { id: 'reviewer-1' },
        data: { isActive: false },
      });
    });
  });

  describe('activateReviewer', () => {
    it('should activate a reviewer', async () => {
      const mockReviewer = {
        id: 'reviewer-1',
        isActive: true,
      };

      (prisma.reviewer.update as jest.Mock).mockResolvedValue(mockReviewer);

      const result = await reviewerService.activateReviewer('reviewer-1');

      expect(result).toEqual(mockReviewer);
      expect(prisma.reviewer.update).toHaveBeenCalledWith({
        where: { id: 'reviewer-1' },
        data: { isActive: true },
      });
    });
  });

  describe('getReviewerStats', () => {
    it('should return reviewer statistics', async () => {
      const mockStats = {
        totalReviews: 100,
        approvedCount: 80,
        rejectedCount: 15,
        revisionCount: 5,
        averageReviewTime: 120.5,
        accuracyRate: 0.85,
      };

      (prisma.reviewer.findUnique as jest.Mock).mockResolvedValue(mockStats);

      const result = await reviewerService.getReviewerStats('reviewer-1');

      expect(result).toEqual(mockStats);
    });

    it('should throw error when reviewer not found', async () => {
      (prisma.reviewer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        reviewerService.getReviewerStats('non-existent')
      ).rejects.toThrow('审核员不存在');
    });
  });

  describe('updateReviewerStats', () => {
    it('should update reviewer stats after approval', async () => {
      const mockReviewer = {
        totalReviews: 10,
        approvedCount: 8,
        rejectedCount: 2,
        revisionCount: 0,
        averageReviewTime: 100,
      };

      (prisma.reviewer.findUnique as jest.Mock).mockResolvedValue(mockReviewer);
      (prisma.reviewer.update as jest.Mock).mockResolvedValue({});

      await reviewerService.updateReviewerStats('reviewer-1', 'approve', 120);

      expect(prisma.reviewer.update).toHaveBeenCalledWith({
        where: { id: 'reviewer-1' },
        data: {
          totalReviews: 11,
          approvedCount: 9,
          averageReviewTime: 101.81818181818181,
        },
      });
    });

    it('should update reviewer stats after rejection', async () => {
      const mockReviewer = {
        totalReviews: 10,
        approvedCount: 8,
        rejectedCount: 2,
        revisionCount: 0,
        averageReviewTime: 100,
      };

      (prisma.reviewer.findUnique as jest.Mock).mockResolvedValue(mockReviewer);
      (prisma.reviewer.update as jest.Mock).mockResolvedValue({});

      await reviewerService.updateReviewerStats('reviewer-1', 'reject', 150);

      expect(prisma.reviewer.update).toHaveBeenCalledWith({
        where: { id: 'reviewer-1' },
        data: {
          totalReviews: 11,
          rejectedCount: 3,
          averageReviewTime: 104.54545454545455,
        },
      });
    });

    it('should handle first review correctly', async () => {
      const mockReviewer = {
        totalReviews: 0,
        approvedCount: 0,
        rejectedCount: 0,
        revisionCount: 0,
        averageReviewTime: null,
      };

      (prisma.reviewer.findUnique as jest.Mock).mockResolvedValue(mockReviewer);
      (prisma.reviewer.update as jest.Mock).mockResolvedValue({});

      await reviewerService.updateReviewerStats('reviewer-1', 'approve', 60);

      expect(prisma.reviewer.update).toHaveBeenCalledWith({
        where: { id: 'reviewer-1' },
        data: {
          totalReviews: 1,
          approvedCount: 1,
          averageReviewTime: 60,
        },
      });
    });
  });
});
