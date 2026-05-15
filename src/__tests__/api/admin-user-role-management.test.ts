import { NextRequest } from 'next/server';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn(),
}));

jest.mock('@/lib/audit/logger', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { PUT } from '@/app/api/admin/users/[id]/role/route';
import { POST } from '@/app/api/admin/users/batch-role/route';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

describe('Admin user role management security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'admin-1',
      role: 'ADMIN',
    });
    (validatePermissions as jest.Mock).mockResolvedValue(null);
  });

  it('普通管理员不能通过专用接口授予 ADMIN 角色', async () => {
    (prisma.user.findUnique as jest.Mock).mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === 'admin-1') return { role: 'ADMIN' };
        return { id: 'user-2', role: 'USER' };
      }
    );

    const request = new NextRequest(
      'http://localhost:3000/api/admin/users/user-2/role',
      {
        method: 'PUT',
        body: JSON.stringify({ role: 'ADMIN' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'user-2' }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('只有超级管理员可以管理管理员或超级管理员角色');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('超级管理员可以通过专用接口授予 ADMIN 角色', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'super-admin-1',
      role: 'SUPER_ADMIN',
    });
    (prisma.user.findUnique as jest.Mock).mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === 'super-admin-1') return { role: 'SUPER_ADMIN' };
        return { id: 'user-2', role: 'USER' };
      }
    );
    (prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'user-2',
      email: 'user2@example.com',
      username: 'user2',
      name: '用户2',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest(
      'http://localhost:3000/api/admin/users/user-2/role',
      {
        method: 'PUT',
        body: JSON.stringify({ role: 'ADMIN' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'user-2' }),
    });

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-2' },
        data: { role: 'ADMIN' },
      })
    );
  });

  it('批量接口不允许包含当前登录账号', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN' });

    const request = new NextRequest(
      'http://localhost:3000/api/admin/users/batch-role',
      {
        method: 'POST',
        body: JSON.stringify({
          userIds: ['admin-1', 'user-2'],
          role: 'LAWYER',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('批量角色调整不能包含当前登录账号');
  });

  it('普通管理员不能批量调整管理员角色', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN' });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'user-2', email: 'user2@example.com', role: 'USER' },
      { id: 'admin-2', email: 'admin2@example.com', role: 'ADMIN' },
    ]);

    const request = new NextRequest(
      'http://localhost:3000/api/admin/users/batch-role',
      {
        method: 'POST',
        body: JSON.stringify({
          userIds: ['user-2', 'admin-2'],
          role: 'LAWYER',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe(
      '只有超级管理员可以批量管理管理员或超级管理员角色'
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
