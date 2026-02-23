/**
 * 案件数据导出API测试
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/export/cases/route';
import { _unauthorizedResponse, forbiddenResponse } from '@/lib/api-response';

// =============================================================================
// Mock依赖
// =============================================================================

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/export/excel-generator', () => {
  const originalModule = jest.requireActual('@/lib/export/excel-generator');
  return {
    ...originalModule,
    ExcelGenerator: {
      fromArray: jest.fn(() => ({
        toBlob: jest.fn(() => new Blob(['test'], { type: 'text/csv' })),
      })),
    },
    generateExportFilename: jest.fn(() => 'test.csv'),
  };
});

import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { prisma } from '@/lib/db/prisma';

// =============================================================================
// 测试
// =============================================================================

describe('GET /api/admin/export/cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('身份验证', () => {
    it('未登录应该返回401', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases')
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('已登录用户可以访问', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases?format=CSV')
      );
      await GET(request);

      expect(validatePermissions).toHaveBeenCalled();
    });
  });

  describe('权限验证', () => {
    it('无权限应该返回403', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'user@example.com',
        role: 'USER',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(
        forbiddenResponse('无权限导出数据')
      );

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases?format=CSV')
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.message).toContain('无权限');
    });
  });

  describe('参数验证', () => {
    it('无效的format应该返回400', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases?format=INVALID')
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('无效的查询参数');
    });

    it('有效的format应该接受请求', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases?format=CSV')
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('默认format为CSV', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases')
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('数据查询', () => {
    it('应该调用prisma.case.findMany', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases?format=CSV')
      );
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalled();
    });

    it('应该支持按案件类型筛选', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        new URL(
          'http://localhost/api/admin/export/cases?format=CSV&caseType=CIVIL'
        )
      );
      await GET(request);

      const callArgs = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.type).toBe('CIVIL');
    });

    it('应该支持按状态筛选', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        new URL(
          'http://localhost/api/admin/export/cases?format=CSV&status=ACTIVE'
        )
      );
      await GET(request);

      const callArgs = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.status).toBe('ACTIVE');
    });

    it('应该包含debate和document计数', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases?format=CSV')
      );
      await GET(request);

      const callArgs = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.include._count).toEqual({
        select: {
          debates: true,
          documents: true,
        },
      });
    });
  });

  describe('响应格式', () => {
    it('应该返回正确的响应', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases?format=CSV')
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toContain(
        'attachment'
      );
    });

    it('应该包含正确的文件名', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases?format=CSV')
      );
      const response = await GET(request);

      const disposition = response.headers.get('Content-Disposition');
      expect(disposition).toContain('test.csv');
    });
  });

  describe('错误处理', () => {
    it('数据库错误应该返回500', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.case.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        new URL('http://localhost/api/admin/export/cases?format=CSV')
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.message).toContain('导出案件数据失败');
    });
  });
});
