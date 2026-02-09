/**
 * 证人搜索API测试
 * 测试 /api/witnesses/search 端点
 */

import { GET, POST } from '@/app/api/witnesses/search/route';
import { prisma } from '@/lib/db/prisma';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { type NextRequest } from 'next/server';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    witness: {
      findMany: jest.fn(),
      count: jest.fn(),
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

describe('Witness Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockWitnesses = [
    {
      id: 'w1',
      caseId: 'case-123',
      name: '张三',
      phone: '13800138000',
      address: '北京市',
      relationship: '朋友',
      testimony: '事发时我在场',
      status: 'CONFIRMED',
      createdAt: new Date(),
      updatedAt: new Date(),
      case: { id: 'case-123', title: '测试案件' },
      courtSchedule: null,
    },
    {
      id: 'w2',
      caseId: 'case-123',
      name: '李四',
      phone: '13900139000',
      address: '上海市',
      relationship: '同事',
      testimony: '我是目击者',
      status: 'CONTACTED',
      createdAt: new Date(),
      updatedAt: new Date(),
      case: { id: 'case-123', title: '测试案件' },
      courtSchedule: { id: 'cs1', title: '庭审安排' },
    },
  ];

  describe('GET /api/witnesses/search', () => {
    it('应该返回401当用户未认证', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/witnesses/search?caseId=case-123&query=张'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });

    it('应该返回400当缺少案件ID', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });

      const request = new Request(
        'http://localhost:3000/api/witnesses/search?query=张'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('缺少案件ID');
    });

    it('应该返回400当缺少搜索关键词', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });

      const request = new Request(
        'http://localhost:3000/api/witnesses/search?caseId=case-123'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('缺少搜索关键词');
    });

    it('应该返回404当案件不存在', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });
      (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/witnesses/search?caseId=case-123&query=张'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('案件不存在或无权限');
    });

    it('应该搜索证人并返回结果', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });
      (prisma.case.findFirst as jest.Mock).mockResolvedValue({
        id: 'case-123',
        title: '测试案件',
      });
      (prisma.witness.findMany as jest.Mock).mockResolvedValue(mockWitnesses);
      (prisma.witness.count as jest.Mock).mockResolvedValue(2);

      const request = new Request(
        'http://localhost:3000/api/witnesses/search?caseId=case-123&query=张'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.witnesses).toHaveLength(2);
      expect(data.data.total).toBe(2);
      expect(data.data.query).toBe('张');
    });

    it('应该支持分页', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });
      (prisma.case.findFirst as jest.Mock).mockResolvedValue({
        id: 'case-123',
        title: '测试案件',
      });
      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        mockWitnesses[0],
      ]);
      (prisma.witness.count as jest.Mock).mockResolvedValue(10);

      const request = new Request(
        'http://localhost:3000/api/witnesses/search?caseId=case-123&query=张&page=1&limit=1'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.meta.pagination.page).toBe(1);
      expect(data.meta.pagination.limit).toBe(1);
      expect(data.meta.pagination.total).toBe(10);
      expect(data.meta.pagination.totalPages).toBe(10);
      expect(data.meta.pagination.hasNext).toBe(true);
      expect(data.meta.pagination.hasPrevious).toBe(false);
    });

    it('应该正确包含案件信息', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });
      (prisma.case.findFirst as jest.Mock).mockResolvedValue({
        id: 'case-123',
        title: '测试案件',
      });
      (prisma.witness.findMany as jest.Mock).mockResolvedValue(mockWitnesses);
      (prisma.witness.count as jest.Mock).mockResolvedValue(2);

      const request = new Request(
        'http://localhost:3000/api/witnesses/search?caseId=case-123&query=张'
      ) as unknown as NextRequest;
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      const witness = data.data.witnesses[0];
      expect(witness.case).toBeDefined();
      expect(witness.case.title).toBe('测试案件');
    });
  });

  describe('POST /api/witnesses/search', () => {
    it('应该返回401当用户未认证', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/witnesses/search',
        {
          method: 'POST',
          body: JSON.stringify({ caseId: 'case-123', query: '张' }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('应该返回400当请求体为空', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });

      const request = new Request(
        'http://localhost:3000/api/witnesses/search',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该返回400当缺少案件ID', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });

      const request = new Request(
        'http://localhost:3000/api/witnesses/search',
        {
          method: 'POST',
          body: JSON.stringify({ query: '张' }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该返回400当缺少搜索关键词', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });

      const request = new Request(
        'http://localhost:3000/api/witnesses/search',
        {
          method: 'POST',
          body: JSON.stringify({ caseId: 'case-123' }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该返回404当案件不存在', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });
      (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/witnesses/search',
        {
          method: 'POST',
          body: JSON.stringify({ caseId: 'case-123', query: '张' }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(404);
    });

    it('应该高级搜索证人并返回结果', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });
      (prisma.case.findFirst as jest.Mock).mockResolvedValue({
        id: 'case-123',
        title: '测试案件',
      });
      (prisma.witness.findMany as jest.Mock).mockResolvedValue(mockWitnesses);
      (prisma.witness.count as jest.Mock).mockResolvedValue(2);

      const request = new Request(
        'http://localhost:3000/api/witnesses/search',
        {
          method: 'POST',
          body: JSON.stringify({
            caseId: 'case-123',
            query: '张',
            searchFields: ['name', 'phone', 'address', 'relationship'],
            page: 1,
            limit: 20,
          }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.witnesses).toHaveLength(2);
      expect(data.data.total).toBe(2);
      expect(data.data.searchFields).toContain('name');
    });

    it('应该处理空结果', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user123' });
      (prisma.case.findFirst as jest.Mock).mockResolvedValue({
        id: 'case-123',
        title: '测试案件',
      });
      (prisma.witness.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.witness.count as jest.Mock).mockResolvedValue(0);

      const request = new Request(
        'http://localhost:3000/api/witnesses/search',
        {
          method: 'POST',
          body: JSON.stringify({ caseId: 'case-123', query: '不存在的证人' }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.witnesses).toHaveLength(0);
      expect(data.data.total).toBe(0);
    });
  });
});
