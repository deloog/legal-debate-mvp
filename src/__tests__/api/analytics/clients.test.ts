/**
 * 客户分析API单元测试
 * 测试路径: src/app/api/analytics/clients/route.ts
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/analytics/clients/route';
import { prisma } from '@/lib/db/prisma';
import { ClientStatus, ClientValueLevel } from '@/types/client';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    client: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    case: {
      findMany: jest.fn(),
    },
    communicationRecord: {
      count: jest.fn(),
    },
    followUpTask: {
      findMany: jest.fn(),
    },
  },
}));

// Mock getAuthUser
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { getAuthUser } from '@/lib/middleware/auth';

const mockUserId = 'user-123';

describe('GET /api/analytics/clients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockResolvedValue({ userId: mockUserId });
  });

  describe('身份验证', () => {
    it('未认证用户应返回401', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients'
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });
  });

  describe('参数解析', () => {
    it('默认时间范围为90天', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(1);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 1 },
      ]);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'client-1',
          name: 'Client 1',
          userId: mockUserId,
          createdAt: new Date(),
          _count: { cases: 1 },
          cases: [{ amount: 100000 }],
        },
      ]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'case-1',
          amount: 100000,
          createdAt: new Date(),
          status: 'COMPLETED',
        },
      ]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(10);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('支持自定义时间范围', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(1);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 1 },
      ]);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients?timeRange=LAST_30_DAYS'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('支持自定义topClientsLimit', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(1);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 1 },
      ]);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients?topClientsLimit=20'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('支持includeLifecycle参数', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(1);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 1 },
      ]);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'client-1',
          name: 'Client 1',
          userId: mockUserId,
          createdAt: new Date(),
          _count: { cases: 1 },
          cases: [{ amount: 100000 }],
        },
      ]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients?includeLifecycle=true'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.lifecycle).toBeDefined();
    });

    it('支持includeSatisfaction参数', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(1);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 1 },
      ]);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(10);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients?includeSatisfaction=true'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.satisfaction).toBeDefined();
    });

    it('支持includeRiskAnalysis参数', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(1);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 1 },
      ]);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients?includeRiskAnalysis=true'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.riskAnalysis).toBeDefined();
    });
  });

  describe('客户转化漏斗分析', () => {
    it('正确返回转化漏斗数据', async () => {
      const mockGroupData = [
        { status: ClientStatus.ACTIVE, _count: 10 },
        { status: ClientStatus.INACTIVE, _count: 5 },
        { status: ClientStatus.LOST, _count: 3 },
        { status: ClientStatus.BLACKLISTED, _count: 1 },
      ];

      (prisma.client.groupBy as jest.Mock).mockResolvedValue(mockGroupData);
      (prisma.client.count as jest.Mock).mockResolvedValue(19);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.conversionFunnel).toBeDefined();
      expect(data.conversionFunnel).toHaveLength(4);
      expect(data.conversionFunnel[0].stage).toBe(ClientStatus.ACTIVE);
      expect(data.conversionFunnel[0].count).toBe(10);
    });
  });

  describe('客户价值分析', () => {
    it('正确返回价值分析数据', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(1);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 1 },
      ]);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'client-1',
          name: 'Client 1',
          userId: mockUserId,
          createdAt: new Date(),
          _count: { cases: 5 },
          cases: [
            { amount: 50000 },
            { amount: 50000 },
            { amount: 50000 },
            { amount: 50000 },
            { amount: 50000 },
          ],
        },
      ]);
      // 为calculateClientValue中的prisma.case.findMany调用提供5个案件
      (prisma.case.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'case-1',
          amount: 50000,
          createdAt: new Date(),
          status: 'COMPLETED',
        },
        {
          id: 'case-2',
          amount: 50000,
          createdAt: new Date(),
          status: 'COMPLETED',
        },
        {
          id: 'case-3',
          amount: 50000,
          createdAt: new Date(),
          status: 'COMPLETED',
        },
        {
          id: 'case-4',
          amount: 50000,
          createdAt: new Date(),
          status: 'COMPLETED',
        },
        {
          id: 'case-5',
          amount: 50000,
          createdAt: new Date(),
          status: 'COMPLETED',
        },
      ]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(20);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.valueAnalysis).toBeDefined();
      expect(data.valueAnalysis.totalValue).toBe(250000);
      expect(data.valueAnalysis.averageValueScore).toBeGreaterThan(0);
    });
  });

  describe('Top客户列表', () => {
    it('正确返回Top客户列表', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(2);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 2 },
      ]);
      (prisma.client.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: 'client-1',
            name: 'Client 1',
            userId: mockUserId,
            createdAt: new Date(),
            _count: { cases: 2 },
            cases: [{ amount: 100000 }, { amount: 100000 }],
          },
          {
            id: 'client-2',
            name: 'Client 2',
            userId: mockUserId,
            createdAt: new Date(),
            _count: { cases: 1 },
            cases: [{ amount: 50000 }],
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'client-1',
            name: 'Client 1',
            userId: mockUserId,
            createdAt: new Date(),
            _count: { cases: 2 },
            cases: [{ amount: 100000 }, { amount: 100000 }],
          },
          {
            id: 'client-2',
            name: 'Client 2',
            userId: mockUserId,
            createdAt: new Date(),
            _count: { cases: 1 },
            cases: [{ amount: 50000 }],
          },
        ]);
      (prisma.case.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: 'case-1',
            amount: 100000,
            createdAt: new Date(),
            status: 'COMPLETED',
          },
          {
            id: 'case-2',
            amount: 100000,
            createdAt: new Date(),
            status: 'COMPLETED',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'case-3',
            amount: 50000,
            createdAt: new Date(),
            status: 'COMPLETED',
          },
        ]);
      (prisma.client.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'client-1',
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'client-2',
          createdAt: new Date(),
        });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(20);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.topClients).toBeDefined();
      expect(data.topClients).toHaveLength(2);
    });
  });

  describe('客户生命周期分析', () => {
    it('正确返回生命周期数据', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(2);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 2 },
      ]);
      (prisma.client.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'client-1',
            createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
            status: ClientStatus.ACTIVE,
          },
          {
            id: 'client-2',
            createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
            status: ClientStatus.INACTIVE,
          },
        ]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients?includeLifecycle=true'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.lifecycle).toBeDefined();
      expect(data.lifecycle.avgDuration).toBe(75);
      expect(data.lifecycle.longestDuration).toBe(100);
      expect(data.lifecycle.shortestDuration).toBe(50);
      expect(data.lifecycle.retentionRate).toBe(50);
    });
  });

  describe('客户满意度分析', () => {
    it('正确返回满意度数据', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(20);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 20 },
      ]);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(100);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([
        {
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
        {
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients?includeSatisfaction=true'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.satisfaction).toBeDefined();
      expect(data.satisfaction.avgCommunicationFrequency).toBe(5);
      expect(data.satisfaction.avgResponseTime).toBe(2.5);
      expect(data.satisfaction.satisfactionScore).toBeGreaterThan(0);
    });
  });

  describe('风险客户分析', () => {
    it('正确返回风险分析数据', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(1);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 1 },
      ]);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
      // 提供包含ARCHIVED状态的案件数据
      (prisma.case.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { status: 'COMPLETED', clientId: 'client-1' },
          { status: 'ARCHIVED', clientId: 'client-1' },
          { status: 'COMPLETED', clientId: 'client-1' },
        ]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients?includeRiskAnalysis=true'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.riskAnalysis).toBeDefined();
      expect(data.riskAnalysis.highRisk).toBeGreaterThanOrEqual(0);
      expect(data.riskAnalysis.mediumRisk).toBeGreaterThanOrEqual(0);
      expect(data.riskAnalysis.lowRisk).toBeGreaterThanOrEqual(0);
      expect(data.riskAnalysis.totalRisk).toBeGreaterThanOrEqual(0);
    });
  });

  describe('元数据', () => {
    it('返回正确的元数据', async () => {
      (prisma.client.count as jest.Mock).mockResolvedValue(1);
      (prisma.client.groupBy as jest.Mock).mockResolvedValue([
        { status: ClientStatus.ACTIVE, _count: 1 },
      ]);
      (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        createdAt: new Date(),
      });
      (prisma.communicationRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.metadata).toBeDefined();
      expect(data.metadata.generatedAt).toBeDefined();
      expect(data.metadata.timeRange).toBe('LAST_90_DAYS');
      expect(data.metadata.totalClients).toBe(1);
    });
  });

  describe('错误处理', () => {
    it('数据库错误返回500', async () => {
      (prisma.client.groupBy as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/clients'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('获取分析数据失败');
    });
  });
});
