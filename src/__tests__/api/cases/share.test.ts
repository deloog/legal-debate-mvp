/**
 * 案件共享API测试
 */

import { POST, GET, OPTIONS } from '@/app/api/cases/[id]/share/route';
import { NextRequest } from 'next/server';

// Mock依赖
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/case/share-permission-validator', () => ({
  canShareCase: jest.fn(),
  canAccessSharedCase: jest.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  canShareCase,
  canAccessSharedCase,
} from '@/lib/case/share-permission-validator';

describe('案件共享API - POST /api/cases/[id]/share', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该返回401未认证错误', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/cases/test-id/share',
      {
        method: 'POST',
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(401);
  });

  it('应该返回403无权限错误', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
    });
    (canShareCase as jest.Mock).mockResolvedValue({
      hasPermission: false,
      isOwner: false,
      reason: '只有案件所有者可以共享案件',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/cases/test-id/share',
      {
        method: 'POST',
        body: JSON.stringify({ sharedWithTeam: true }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(403);
  });

  it('应该返回404案件不存在错误', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
    });
    (canShareCase as jest.Mock).mockResolvedValue({
      hasPermission: true,
      isOwner: true,
    });
    (prisma.case.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/cases/test-id/share',
      {
        method: 'POST',
        body: JSON.stringify({ sharedWithTeam: true }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(404);
  });

  it('应该成功共享案件', async () => {
    const mockCase = {
      id: 'case-123',
      title: '测试案件',
      ownerType: 'USER',
      sharedWithTeam: false,
    };

    const updatedCase = {
      ...mockCase,
      sharedWithTeam: true,
      updatedAt: new Date(),
    };

    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
    });
    (canShareCase as jest.Mock).mockResolvedValue({
      hasPermission: true,
      isOwner: true,
    });
    (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
    (prisma.case.update as jest.Mock).mockResolvedValue(updatedCase);

    const request = new NextRequest(
      'http://localhost:3000/api/cases/test-id/share',
      {
        method: 'POST',
        body: JSON.stringify({
          sharedWithTeam: true,
          notes: '共享说明',
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.case.sharedWithTeam).toBe(true);
  });

  it('应该成功取消共享案件', async () => {
    const mockCase = {
      id: 'case-123',
      title: '测试案件',
      ownerType: 'USER',
      sharedWithTeam: true,
    };

    const updatedCase = {
      ...mockCase,
      sharedWithTeam: false,
      updatedAt: new Date(),
    };

    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
    });
    (canShareCase as jest.Mock).mockResolvedValue({
      hasPermission: true,
      isOwner: true,
    });
    (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
    (prisma.case.update as jest.Mock).mockResolvedValue(updatedCase);

    const request = new NextRequest(
      'http://localhost:3000/api/cases/test-id/share',
      {
        method: 'POST',
        body: JSON.stringify({
          sharedWithTeam: false,
          notes: '',
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.case.sharedWithTeam).toBe(false);
  });
});

describe('案件共享API - GET /api/cases/[id]/share', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该返回401未认证错误', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/cases/test-id/share',
      {
        method: 'GET',
      }
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(401);
  });

  it('应该返回403无权限错误', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
    });
    (canAccessSharedCase as jest.Mock).mockResolvedValue({
      hasAccess: false,
      isOwner: false,
      reason: '无权访问此案件',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/cases/test-id/share',
      {
        method: 'GET',
      }
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(403);
  });

  it('应该成功获取共享信息', async () => {
    const mockCase = {
      id: 'case-123',
      title: '测试案件',
      ownerType: 'USER',
      sharedWithTeam: true,
      userId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        sharedAt: new Date().toISOString(),
        sharedBy: 'user-123',
        sharedNotes: '共享说明',
      },
    };

    const mockSharedByUser = {
      id: 'user-123',
      name: '测试用户',
      email: 'test@example.com',
      avatar: null,
    };

    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
    });
    (canAccessSharedCase as jest.Mock).mockResolvedValue({
      hasAccess: true,
      isOwner: true,
      accessType: 'owner',
      permissions: ['VIEW_CASE', 'EDIT_CASE'],
    });
    (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSharedByUser);

    const request = new NextRequest(
      'http://localhost:3000/api/cases/test-id/share',
      {
        method: 'GET',
      }
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.case.sharedWithTeam).toBe(true);
    expect(data.data.isOwner).toBe(true);
    expect(data.data.permissions).toBeDefined();
  });

  it('应该返回404案件不存在错误', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
    });
    (canAccessSharedCase as jest.Mock).mockResolvedValue({
      hasAccess: true,
      isOwner: true,
    });
    (prisma.case.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/cases/test-id/share',
      {
        method: 'GET',
      }
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(404);
  });
});

describe('案件共享API - OPTIONS /api/cases/[id]/share', () => {
  it('应该返回CORS预检响应', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/cases/test-id/share',
      {
        method: 'OPTIONS',
      }
    );
    const response = await OPTIONS(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET, POST, OPTIONS'
    );
  });
});
