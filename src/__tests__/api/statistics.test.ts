/**
 * 客户统计API测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GET, OPTIONS } from '@/app/api/clients/statistics/route';
import { prisma } from '@/lib/db/prisma';
import { type NextRequest } from 'next/server';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    client: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock getAuthUser
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { getAuthUser } from '@/lib/middleware/auth';

describe('Statistics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/clients/statistics', () => {
    it('应该返回401状态码当用户未认证时', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/clients/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });

    it('应该成功返回统计数据', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      const mockTotalClients = 100;
      const mockActiveClients = 60;
      const mockInactiveClients = 20;
      const mockLostClients = 10;
      const mockBlacklistedClients = 5;
      const _mockClientsByType = {
        INDIVIDUAL: 50,
        ENTERPRISE: 30,
        POTENTIAL: 20,
      };
      const _mockClientsBySource = {
        REFERRAL: 30,
        ONLINE: 40,
        EVENT: 20,
        ADVERTISING: 10,
      };
      const _mockClientsByTags = {
        VIP: 15,
        普通: 50,
        新客户: 35,
      };
      const _mockMonthlyGrowth = [
        { month: '2025-02', count: 10 },
        { month: '2025-03', count: 15 },
        { month: '2025-04', count: 20 },
      ];
      const mockRecentClients = [
        {
          id: 'client1',
          userId: 'user123',
          clientType: 'INDIVIDUAL',
          name: '张三',
          gender: '男',
          age: 30,
          profession: '律师',
          phone: '13800138000',
          email: 'zhangsan@example.com',
          address: '北京市朝阳区',
          idCardNumber: '110101199001011234',
          company: null,
          creditCode: null,
          legalRep: null,
          source: 'REFERRAL',
          tags: ['VIP'],
          status: 'ACTIVE',
          notes: null,
          metadata: null,
          createdAt: new Date('2025-04-01'),
          updatedAt: new Date('2025-04-01'),
          deletedAt: null,
          _count: {
            cases: 5,
            communications: 10,
          },
        },
      ];

      // Mock所有prisma调用
      (prisma.client.count as jest.Mock)
        .mockResolvedValueOnce(mockTotalClients)
        .mockResolvedValueOnce(mockActiveClients)
        .mockResolvedValueOnce(mockInactiveClients)
        .mockResolvedValueOnce(mockLostClients)
        .mockResolvedValueOnce(mockBlacklistedClients);

      (prisma.client.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { clientType: 'INDIVIDUAL', _count: 50 },
          { clientType: 'ENTERPRISE', _count: 30 },
          { clientType: 'POTENTIAL', _count: 20 },
        ])
        .mockResolvedValueOnce([
          { source: 'REFERRAL', _count: 30 },
          { source: 'ONLINE', _count: 40 },
          { source: 'EVENT', _count: 20 },
          { source: 'ADVERTISING', _count: 10 },
        ]);

      (prisma.client.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { tags: ['VIP', '普通'] },
          { tags: ['普通', '新客户'] },
          { tags: ['VIP'] },
        ])
        .mockResolvedValueOnce([
          { createdAt: new Date('2025-04-01') },
          { createdAt: new Date('2025-03-01') },
          { createdAt: new Date('2025-02-01') },
        ])
        .mockResolvedValueOnce(mockRecentClients);

      const request = new Request(
        'http://localhost:3000/api/clients/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('totalClients');
      expect(data).toHaveProperty('activeClients');
      expect(data).toHaveProperty('inactiveClients');
      expect(data).toHaveProperty('lostClients');
      expect(data).toHaveProperty('blacklistedClients');
      expect(data).toHaveProperty('clientsByType');
      expect(data).toHaveProperty('clientsBySource');
      expect(data).toHaveProperty('clientsByTags');
      expect(data).toHaveProperty('monthlyGrowth');
      expect(data).toHaveProperty('recentClients');
    });

    it('应该正确统计客户类型分布', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.client.count as jest.Mock).mockResolvedValue(0);
      (prisma.client.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { clientType: 'INDIVIDUAL', _count: 50 },
          { clientType: 'ENTERPRISE', _count: 30 },
        ])
        .mockResolvedValueOnce([]);
      (prisma.client.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const request = new Request(
        'http://localhost:3000/api/clients/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      const data = await response.json();
      expect(data.clientsByType.INDIVIDUAL).toBe(50);
      expect(data.clientsByType.ENTERPRISE).toBe(30);
      expect(data.clientsByType.POTENTIAL).toBe(0);
    });

    it('应该正确统计客户来源分布', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.client.count as jest.Mock).mockResolvedValue(0);
      (prisma.client.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { source: 'REFERRAL', _count: 30 },
          { source: 'ONLINE', _count: 40 },
        ]);
      (prisma.client.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const request = new Request(
        'http://localhost:3000/api/clients/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      const data = await response.json();
      expect(data.clientsBySource.REFERRAL).toBe(30);
      expect(data.clientsBySource.ONLINE).toBe(40);
    });

    it('应该正确统计标签分布', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.client.count as jest.Mock).mockResolvedValue(0);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.client.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { tags: ['VIP', '普通'] },
          { tags: ['普通', '新客户'] },
          { tags: ['VIP', '新客户'] },
          { tags: [] },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const request = new Request(
        'http://localhost:3000/api/clients/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      const data = await response.json();
      expect(data.clientsByTags.VIP).toBe(2);
      expect(data.clientsByTags.普通).toBe(2);
      expect(data.clientsByTags.新客户).toBe(2);
    });

    it('应该正确统计月度增长趋势', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.client.count as jest.Mock).mockResolvedValue(0);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.client.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { createdAt: new Date('2025-03-15') },
          { createdAt: new Date('2025-03-20') },
          { createdAt: new Date('2025-04-10') },
        ])
        .mockResolvedValueOnce([]);

      const request = new Request(
        'http://localhost:3000/api/clients/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      const data = await response.json();
      const aprilData = data.monthlyGrowth.find((item: { month: string }) =>
        item.month.startsWith('2025-04')
      );
      expect(aprilData).toBeDefined();
      expect(aprilData.count).toBeGreaterThan(0);
    });

    it('应该返回最近创建的客户列表', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.client.count as jest.Mock).mockResolvedValue(0);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.client.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'client1',
            userId: 'user123',
            clientType: 'INDIVIDUAL',
            name: '张三',
            gender: '男',
            age: 30,
            profession: '律师',
            phone: '13800138000',
            email: 'zhangsan@example.com',
            address: '北京市朝阳区',
            idCardNumber: '110101199001011234',
            company: null,
            creditCode: null,
            legalRep: null,
            source: 'REFERRAL',
            tags: ['VIP'],
            status: 'ACTIVE',
            notes: null,
            metadata: null,
            createdAt: new Date('2025-04-01'),
            updatedAt: new Date('2025-04-01'),
            deletedAt: null,
            _count: {
              cases: 5,
              communications: 10,
            },
          },
          {
            id: 'client2',
            userId: 'user123',
            clientType: 'ENTERPRISE',
            name: '某某科技有限公司',
            gender: null,
            age: null,
            profession: null,
            phone: '13900139000',
            email: 'company@example.com',
            address: '上海市浦东新区',
            idCardNumber: null,
            company: '某某科技有限公司',
            creditCode: '91310000MA1FLXXXXX',
            legalRep: '李四',
            source: 'ONLINE',
            tags: ['普通'],
            status: 'ACTIVE',
            notes: null,
            metadata: null,
            createdAt: new Date('2025-03-01'),
            updatedAt: new Date('2025-03-01'),
            deletedAt: null,
            _count: {
              cases: 2,
              communications: 5,
            },
          },
        ]);

      const request = new Request(
        'http://localhost:3000/api/clients/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      const data = await response.json();
      expect(data.recentClients).toHaveLength(2);
      expect(data.recentClients[0].name).toBe('张三');
      expect(data.recentClients[0].cases).toBe(15);
      expect(data.recentClients[1].name).toBe('某某科技有限公司');
      expect(data.recentClients[1].cases).toBe(7);
    });

    it('应该在数据库查询失败时返回500错误', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.client.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new Request(
        'http://localhost:3000/api/clients/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('获取统计数据失败');
    });
  });

  describe('OPTIONS /api/clients/statistics', () => {
    it('应该返回204状态码和CORS头', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization'
      );
    });
  });
});
