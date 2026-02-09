/**
 * 证人批量操作API测试
 * 测试 /api/witnesses/bulk-action 端点
 */

import { DELETE, POST, PUT } from '@/app/api/witnesses/bulk-action/route';
import { prisma } from '@/lib/db/prisma';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { type NextRequest } from 'next/server';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    witness: {
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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

describe('Witness Bulk Action API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/witnesses/bulk-action', () => {
    it('应该返回401当用户未认证', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'POST',
          body: JSON.stringify({
            witnessIds: ['w1'],
            action: 'updateStatus',
            status: 'CONTACTED',
          }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });

    it('应该批量更新证人状态', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT' },
        { id: 'w2', name: '证人2', status: 'NEED_CONTACT' },
      ]);
      (prisma.witness.update as jest.Mock).mockResolvedValue({});

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'POST',
          body: JSON.stringify({
            witnessIds: ['w1', 'w2'],
            action: 'updateStatus',
            status: 'CONTACTED',
          }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.succeeded).toHaveLength(2);
      expect(data.data.failed).toHaveLength(0);
    });

    it('应该批量删除证人', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT' },
        { id: 'w2', name: '证人2', status: 'CONTACTED' },
      ]);
      (prisma.witness.delete as jest.Mock).mockResolvedValue({});

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'POST',
          body: JSON.stringify({ witnessIds: ['w1', 'w2'], action: 'delete' }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.succeeded).toHaveLength(2);
    });

    it('应该返回404当证人不存在', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT' },
      ]);

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'POST',
          body: JSON.stringify({
            witnessIds: ['w1', 'w2'],
            action: 'updateStatus',
            status: 'CONTACTED',
          }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('部分证人不存在或无权限');
    });

    it('应该返回400当更新状态时缺少status参数', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT' },
      ]);

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'POST',
          body: JSON.stringify({ witnessIds: ['w1'], action: 'updateStatus' }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('缺少状态参数');
    });

    it('应该处理部分成功的情况', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT' },
        { id: 'w2', name: '证人2', status: 'NEED_CONTACT' },
      ]);
      // 第一个更新成功，第二个更新失败
      (prisma.witness.update as jest.Mock)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('数据库错误'));

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'POST',
          body: JSON.stringify({
            witnessIds: ['w1', 'w2'],
            action: 'updateStatus',
            status: 'CONTACTED',
          }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      // 当有失败时，API 返回 200 但 success 为 false
      expect(response.status).toBe(200);
      const data = await response.json();
      // 验证结果
      expect(data.data.succeeded).toHaveLength(1);
      expect(data.data.failed).toHaveLength(1);
      expect(data.data.failed[0].witnessId).toBe('w2');
    });

    it('应该验证输入参数', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'POST',
          body: JSON.stringify({ witnessIds: [], action: 'updateStatus' }),
        }
      ) as unknown as NextRequest;
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/witnesses/bulk-action', () => {
    it('应该批量更新证人状态', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT' },
        { id: 'w2', name: '证人2', status: 'CONTACTED' },
      ]);
      (prisma.witness.update as jest.Mock).mockResolvedValue({});

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'PUT',
          body: JSON.stringify({
            witnessIds: ['w1', 'w2'],
            status: 'CONFIRMED',
            reason: '批量确认',
          }),
        }
      ) as unknown as NextRequest;
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('成功更新');
    });

    it('应该验证证人是否存在且属于当前用户', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT' },
      ]);

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'PUT',
          body: JSON.stringify({
            witnessIds: ['w1', 'w2'],
            status: 'CONFIRMED',
          }),
        }
      ) as unknown as NextRequest;
      const response = await PUT(request);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/witnesses/bulk-action', () => {
    it('应该批量删除证人', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT' },
        { id: 'w2', name: '证人2', status: 'CONTACTED' },
      ]);
      (prisma.witness.delete as jest.Mock).mockResolvedValue({});

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'DELETE',
          body: JSON.stringify({ witnessIds: ['w1', 'w2'] }),
        }
      ) as unknown as NextRequest;
      const response = await DELETE(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('不应该删除已确认出庭的证人', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT' },
        { id: 'w3', name: '证人3', status: 'CONFIRMED' },
      ]);
      (prisma.witness.delete as jest.Mock).mockResolvedValue({});

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'DELETE',
          body: JSON.stringify({ witnessIds: ['w1', 'w3'] }),
        }
      ) as unknown as NextRequest;
      const response = await DELETE(request);

      // 验证 w1 被删除，w3 因为状态问题被跳过
      expect(response.status).toBe(200);
      const data = await response.json();
      // 验证结果
      expect(data.data.succeeded).toHaveLength(1);
      expect(data.data.succeeded[0]).toBe('w1');
      expect(data.data.failed).toHaveLength(1);
      expect(data.data.failed[0].witnessId).toBe('w3');
      expect(data.data.failed[0].reason).toBe('不能删除已确认出庭的证人');
    });

    it('应该验证证人是否存在', async () => {
      const mockAuthUser = { userId: 'user123' };
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.witness.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', name: '证人1', status: 'NEED_CONTACT' },
      ]);

      const request = new Request(
        'http://localhost:3000/api/witnesses/bulk-action',
        {
          method: 'DELETE',
          body: JSON.stringify({ witnessIds: ['w1', 'w2'] }),
        }
      ) as unknown as NextRequest;
      const response = await DELETE(request);

      expect(response.status).toBe(404);
    });
  });
});
