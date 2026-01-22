/**
 * 用户搜索API单元测试
 * 测试 GET /api/users/search 端点
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/users/search/route';
import { prisma } from '@/lib/db/prisma';
import { UserStatus } from '@/types/auth';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

// Import mocked dependencies
const mockedPrisma = prisma as unknown as {
  user: {
    findMany: jest.Mock;
  };
};
const { getAuthUser } = jest.requireMock('@/lib/middleware/auth') as {
  getAuthUser: jest.Mock;
};

describe('GET /api/users/search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('身份验证', () => {
    it('未认证用户应返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=test')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('已认证用户应继续处理请求', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      mockedPrisma.user.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=test')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('查询参数处理', () => {
    it('空搜索词应返回空数组', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.users).toEqual([]);
      expect(mockedPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('无查询参数应返回空数组', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.users).toEqual([]);
      expect(mockedPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('应去除搜索词首尾空格', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      mockedPrisma.user.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=  test  ')
      );

      await GET(request);

      expect(mockedPrisma.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
        },
        orderBy: { name: 'asc', email: 'asc' },
        take: 20,
        where: {
          OR: [
            { name: { contains: 'test', mode: 'insensitive' } },
            { email: { contains: 'test', mode: 'insensitive' } },
            { username: { contains: 'test', mode: 'insensitive' } },
          ],
          status: UserStatus.ACTIVE,
        },
      });
    });
  });

  describe('用户搜索', () => {
    it('应按姓名搜索用户', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      const mockUsers = [
        {
          id: 'user-1',
          name: '张三',
          email: 'zhangsan@example.com',
          avatar: null,
          role: 'LAWYER',
        },
      ];
      mockedPrisma.user.findMany.mockResolvedValue(mockUsers);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=张三')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.users).toEqual(mockUsers);
      expect(data.message).toBe('搜索成功');
    });

    it('应按邮箱搜索用户', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      const mockUsers = [
        {
          id: 'user-2',
          name: '李四',
          email: 'lisi@example.com',
          avatar: null,
          role: 'LAWYER',
        },
      ];
      mockedPrisma.user.findMany.mockResolvedValue(mockUsers);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=lisi@example.com')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.users).toEqual(mockUsers);
    });

    it('应按用户名搜索用户', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      const mockUsers = [
        {
          id: 'user-3',
          name: '王五',
          email: 'wangwu@example.com',
          avatar: null,
          role: 'USER',
        },
      ];
      mockedPrisma.user.findMany.mockResolvedValue(mockUsers);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=wangwu')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.users).toEqual(mockUsers);
    });

    it('搜索应不区分大小写', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      const mockUsers = [
        {
          id: 'user-1',
          name: 'Zhang San',
          email: 'zhangsan@example.com',
          avatar: null,
          role: 'LAWYER',
        },
      ];
      mockedPrisma.user.findMany.mockResolvedValue(mockUsers);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=ZHANG SAN')
      );

      await GET(request);

      expect(mockedPrisma.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
        },
        orderBy: { name: 'asc', email: 'asc' },
        take: 20,
        where: {
          OR: [
            { name: { contains: 'ZHANG SAN', mode: 'insensitive' } },
            { email: { contains: 'ZHANG SAN', mode: 'insensitive' } },
            { username: { contains: 'ZHANG SAN', mode: 'insensitive' } },
          ],
          status: UserStatus.ACTIVE,
        },
      });
    });
  });

  describe('查询条件', () => {
    it('只返回活跃状态的用户', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      mockedPrisma.user.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=test')
      );

      await GET(request);

      const whereClause = mockedPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereClause.status).toBe(UserStatus.ACTIVE);
    });

    it('应限制返回结果数量为20条', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      mockedPrisma.user.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=test')
      );

      await GET(request);

      const queryOptions = mockedPrisma.user.findMany.mock.calls[0][0];
      expect(queryOptions.take).toBe(20);
    });

    it('应按姓名和邮箱升序排序', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      mockedPrisma.user.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=test')
      );

      await GET(request);

      const queryOptions = mockedPrisma.user.findMany.mock.calls[0][0];
      expect(queryOptions.orderBy).toEqual({ name: 'asc', email: 'asc' });
    });

    it('应选择指定的字段', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      mockedPrisma.user.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=test')
      );

      await GET(request);

      const queryOptions = mockedPrisma.user.findMany.mock.calls[0][0];
      expect(queryOptions.select).toEqual({
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
      });
    });
  });

  describe('错误处理', () => {
    it('数据库错误应返回500错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      mockedPrisma.user.findMany.mockRejectedValue(new Error('数据库连接失败'));

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=test')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('搜索用户失败');
    });
  });

  describe('响应格式', () => {
    it('应返回标准API响应格式', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      const mockUsers = [
        {
          id: 'user-1',
          name: '张三',
          email: 'zhangsan@example.com',
          avatar: null,
          role: 'LAWYER',
        },
      ];
      mockedPrisma.user.findMany.mockResolvedValue(mockUsers);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/users/search?q=张三')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('users');
      expect(Array.isArray(data.data.users)).toBe(true);
    });
  });
});
