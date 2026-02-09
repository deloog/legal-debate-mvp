/**
 * 证人统计API测试
 * 测试 /api/witnesses/statistics 端点
 */

import { GET } from '@/app/api/witnesses/statistics/route';
import { prisma } from '@/lib/db/prisma';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { type NextRequest } from 'next/server';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    witness: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    case: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock getAuthUser
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { getAuthUser } from '@/lib/middleware/auth';

describe('Witness Statistics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/witnesses/statistics', () => {
    it('应该返回401当用户未认证', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/witnesses/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });

    it('应该返回所有证人的统计信息', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.count as jest.Mock).mockResolvedValue(5);
      (prisma.witness.groupBy as jest.Mock).mockResolvedValue([
        { status: 'NEED_CONTACT', _count: { id: 2 } },
        { status: 'CONTACTED', _count: { id: 1 } },
        { status: 'CONFIRMED', _count: { id: 1 } },
        { status: 'DECLINED', _count: { id: 1 } },
      ]);
      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT', testimony: '证词1' },
        { id: 'w2', name: '证人2', status: 'CONTACTED', testimony: '证词2' },
        { id: 'w3', name: '证人3', status: 'CONFIRMED', testimony: '证词3' },
        { id: 'w4', name: '证人4', status: 'DECLINED', testimony: null },
        { id: 'w5', name: '证人5', status: 'NEED_CONTACT', testimony: '证词5' },
      ]);

      const request = new Request(
        'http://localhost:3000/api/witnesses/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.totalWitnesses).toBe(5);
      expect(data.data.witnessesByStatus.NEED_CONTACT).toBe(2);
      expect(data.data.witnessesByStatus.CONTACTED).toBe(1);
      expect(data.data.witnessesByStatus.CONFIRMED).toBe(1);
      expect(data.data.witnessesByStatus.DECLINED).toBe(1);
      expect(data.data.confirmedWitnesses).toBe(1);
      expect(data.data.pendingWitnesses).toBe(3);
    });

    it('应该支持按案件ID过滤', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.count as jest.Mock).mockResolvedValue(2);
      (prisma.witness.groupBy as jest.Mock).mockResolvedValue([
        { status: 'NEED_CONTACT', _count: { id: 1 } },
        { status: 'CONFIRMED', _count: { id: 1 } },
      ]);
      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT', testimony: '证词1' },
        { id: 'w3', name: '证人3', status: 'CONFIRMED', testimony: '证词3' },
      ]);

      const request = new Request(
        'http://localhost:3000/api/witnesses/statistics?caseId=case-123'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.totalWitnesses).toBe(2);

      expect(prisma.witness.count).toHaveBeenCalledWith({
        where: {
          case: {
            userId: 'user123',
            id: 'case-123',
          },
        },
      });
    });

    it('应该正确计算平均证词长度', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.count as jest.Mock).mockResolvedValue(3);
      (prisma.witness.groupBy as jest.Mock).mockResolvedValue([
        { status: 'CONFIRMED', _count: { id: 3 } },
      ]);
      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', status: 'CONFIRMED', testimony: '短' },
        { id: 'w2', status: 'CONFIRMED', testimony: '中等长度证词' },
        { id: 'w3', status: 'CONFIRMED', testimony: '很长的证词内容' },
      ]);

      const request = new Request(
        'http://localhost:3000/api/witnesses/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.averageTestimonyLength).toBe(5);
    });

    it('当没有证词时应该返回0平均长度', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.count as jest.Mock).mockResolvedValue(2);
      (prisma.witness.groupBy as jest.Mock).mockResolvedValue([
        { status: 'NEED_CONTACT', _count: { id: 2 } },
      ]);
      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', status: 'NEED_CONTACT', testimony: null },
        { id: 'w2', status: 'NEED_CONTACT', testimony: '' },
      ]);

      const request = new Request(
        'http://localhost:3000/api/witnesses/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.averageTestimonyLength).toBe(0);
    });

    it('应该返回正确的状态标签', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.count as jest.Mock).mockResolvedValue(0);
      (prisma.witness.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.witness.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/witnesses/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.meta.labels).toEqual({
        NEED_CONTACT: '待联系',
        CONTACTED: '已联系',
        CONFIRMED: '已确认出庭',
        DECLINED: '拒绝出庭',
        CANCELLED: '已取消',
      });
    });

    it('应该处理空结果', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.count as jest.Mock).mockResolvedValue(0);
      (prisma.witness.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.witness.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/witnesses/statistics'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.totalWitnesses).toBe(0);
      expect(data.data.witnessesByStatus).toEqual({
        NEED_CONTACT: 0,
        CONTACTED: 0,
        CONFIRMED: 0,
        DECLINED: 0,
        CANCELLED: 0,
      });
      expect(data.data.confirmedWitnesses).toBe(0);
      expect(data.data.pendingWitnesses).toBe(0);
    });
  });
});
