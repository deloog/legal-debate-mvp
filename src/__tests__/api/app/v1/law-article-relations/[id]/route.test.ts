/**
 * 法条关系验证和删除API测试
 * 测试权限验证和审核日志记录
 */

import { POST, DELETE } from '@/app/api/v1/law-article-relations/[id]/route';
import { prisma } from '@/lib/db/prisma';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';
import { NextRequest } from 'next/server';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    actionLog: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock LawArticleRelationService
jest.mock('@/lib/law-article/relation-service', () => ({
  LawArticleRelationService: {
    verifyRelation: jest.fn(),
    deleteRelation: jest.fn(),
  },
}));

describe('Law Article Relations [id] API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/law-article-relations/[id] - 验证关系', () => {
    it('应该成功验证关系（通过）', async () => {
      const mockRelation = {
        id: 'relation123',
        sourceId: 'source1',
        targetId: 'target1',
        relationType: 'CITES',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'user123',
        verifiedAt: new Date(),
      };

      (LawArticleRelationService.verifyRelation as jest.Mock).mockResolvedValue(
        mockRelation
      );

      const mockRequest = {
        json: async () => ({
          verifiedBy: 'user123',
          isApproved: true,
        }),
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'x-forwarded-for') return '127.0.0.1';
            if (name === 'user-agent') return 'test-agent';
            return null;
          }),
        },
        cookies: {} as any,
        nextUrl: {} as any,
        page: {} as any,
        ua: {} as any,
      } as unknown as NextRequest;

      const mockParams = { id: 'relation123' };

      // Mock prisma.user.findUnique for permission check
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'ADMIN',
        deletedAt: null,
      });

      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('relation123');
      expect(LawArticleRelationService.verifyRelation).toHaveBeenCalledWith(
        'relation123',
        'user123',
        true
      );
      expect(prisma.actionLog.create).toHaveBeenCalled();
    });

    it('应该成功验证关系（拒绝）', async () => {
      const mockRelation = {
        id: 'relation123',
        sourceId: 'source1',
        targetId: 'target1',
        relationType: 'CITES',
        verificationStatus: 'REJECTED',
        verifiedBy: 'user123',
        verifiedAt: new Date(),
      };

      (LawArticleRelationService.verifyRelation as jest.Mock).mockResolvedValue(
        mockRelation
      );

      const mockRequest = {
        json: async () => ({
          verifiedBy: 'user123',
          isApproved: false,
        }),
        headers: {
          get: jest.fn(),
        },
        cookies: {} as any,
        nextUrl: {} as any,
        page: {} as any,
        ua: {} as any,
      } as unknown as NextRequest;

      const mockParams = { id: 'relation123' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'ADMIN',
        deletedAt: null,
      });

      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verificationStatus).toBe('REJECTED');
    });

    it('应该拒绝缺少 verifiedBy 的请求', async () => {
      const mockRequest = {
        json: async () => ({
          isApproved: true,
        }),
        headers: {
          get: jest.fn(),
        },
        cookies: {} as any,
        nextUrl: {} as any,
        page: {} as any,
        ua: {} as any,
      } as unknown as NextRequest;

      const mockParams = { id: 'relation123' };

      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需字段: verifiedBy');
    });

    it('应该拒绝缺少 isApproved 的请求', async () => {
      const mockRequest = {
        json: async () => ({
          verifiedBy: 'user123',
        }),
        headers: {
          get: jest.fn(),
        },
        cookies: {} as any,
        nextUrl: {} as any,
        page: {} as any,
        ua: {} as any,
      } as unknown as NextRequest;

      const mockParams = { id: 'relation123' };

      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需字段: isApproved');
    });

    it('应该拒绝普通用户的验证请求', async () => {
      const mockRequest = {
        json: async () => ({
          verifiedBy: 'user123',
          isApproved: true,
        }),
        headers: {
          get: jest.fn(),
        },
        cookies: {} as any,
        nextUrl: {} as any,
        page: {} as any,
        ua: {} as any,
      } as unknown as NextRequest;

      const mockParams = { id: 'relation123' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'USER',
        deletedAt: null,
      });

      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('需要管理员权限');
    });
  });

  describe('DELETE /api/v1/law-article-relations/[id] - 删除关系', () => {
    it('应该成功删除关系', async () => {
      (LawArticleRelationService.deleteRelation as jest.Mock).mockResolvedValue(
        undefined
      );

      const mockRequest = {
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'x-verified-by') return 'user123';
            if (name === 'x-forwarded-for') return '127.0.0.1';
            if (name === 'user-agent') return 'test-agent';
            return null;
          }),
        },
        cookies: {} as any,
        nextUrl: {} as any,
        page: {} as any,
        ua: {} as any,
      } as unknown as NextRequest;

      const mockParams = { id: 'relation123' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'ADMIN',
        deletedAt: null,
      });

      const response = await DELETE(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('成功删除关系');
      expect(data.id).toBe('relation123');
      expect(LawArticleRelationService.deleteRelation).toHaveBeenCalledWith(
        'relation123'
      );
      expect(prisma.actionLog.create).toHaveBeenCalled();
    });

    it('应该拒绝缺少 x-verified-by 的请求', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn(() => null),
        },
        cookies: {} as any,
        nextUrl: {} as any,
        page: {} as any,
        ua: {} as any,
      } as unknown as NextRequest;

      const mockParams = { id: 'relation123' };

      const response = await DELETE(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需字段: x-verified-by');
    });

    it('应该拒绝普通用户的删除请求', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn((name: string) => {
            if (name === 'x-verified-by') return 'user123';
            return null;
          }),
        },
        cookies: {} as any,
        nextUrl: {} as any,
        page: {} as any,
        ua: {} as any,
      } as unknown as NextRequest;

      const mockParams = { id: 'relation123' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'USER',
        deletedAt: null,
      });

      const response = await DELETE(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('需要管理员权限');
    });
  });
});
