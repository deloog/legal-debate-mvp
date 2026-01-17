/**
 * 订单详情API测试
 * GET /api/orders/[id] - 获取订单详情
 * PUT /api/orders/[id] - 更新订单
 */

import { GET, PUT } from '@/app/api/orders/[id]/route';
import { createMockRequest, createTestResponse, mockData } from '../test-utils';
import { getServerSession } from 'next-auth';
import { getOrder, cancelOrder } from '@/lib/order/order-service';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/order/order-service', () => ({
  getOrder: jest.fn(),
  cancelOrder: jest.fn(),
}));

describe('GET /api/orders/[id]', () => {
  describe('认证测试', () => {
    it('未登录用户应返回401', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id'
      );

      const response = await GET(request, { params: { id: 'test-id' } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(401);
      expect(testResponse.success).toBe(false);
      expect(testResponse.error).toBe('UNAUTHORIZED');
    });
  });

  describe('参数验证测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    beforeEach(() => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    });

    it('缺少订单ID应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id'
      );

      const response = await GET(request, { params: { id: '' } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('MISSING_ORDER_ID');
    });
  });

  describe('订单查询测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    const mockOrder = {
      id: mockData.uuid(),
      orderNo: 'ORD20240101001',
      userId: mockSession.user.id,
      membershipTierId: mockData.uuid(),
      amount: 99.0,
      currency: 'CNY',
      status: 'PAID',
      paymentMethod: 'WECHAT',
      description: '测试订单',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      paidAt: new Date('2024-01-01'),
      expiredAt: new Date('2024-01-31'),
    };

    beforeEach(() => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (getOrder as jest.Mock).mockReset();
      (getOrder as jest.Mock).mockResolvedValue(mockOrder);
    });

    it('应返回订单详情', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id'
      );

      const response = await GET(request, { params: { id: mockOrder.id } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.data).toBeDefined();
      expect(testResponse.data.data.id).toBe(mockOrder.id);
      expect(testResponse.data.data.orderNo).toBe(mockOrder.orderNo);
    });

    it('订单不存在应返回404', async () => {
      (getOrder as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id'
      );

      const response = await GET(request, { params: { id: mockData.uuid() } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(404);
      expect(testResponse.error).toBe('ORDER_NOT_FOUND');
    });

    it('无权访问他人订单应返回403', async () => {
      const otherUserId = '00000000-0000-0000-0000-000000000000'; // 确保是不同的ID
      const otherOrder = {
        ...mockOrder,
        userId: otherUserId,
      };

      (getOrder as jest.Mock).mockResolvedValue(otherOrder);

      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id'
      );

      const response = await GET(request, { params: { id: otherOrder.id } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(403);
      expect(testResponse.error).toBe('FORBIDDEN');
    });
  });

  describe('错误处理测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    beforeEach(() => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    });

    it('查询失败应返回500', async () => {
      (getOrder as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id'
      );

      const response = await GET(request, { params: { id: mockData.uuid() } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(500);
      expect(testResponse.success).toBe(false);
      expect(testResponse.error).toBe('INTERNAL_ERROR');
    });
  });
});

describe('PUT /api/orders/[id]', () => {
  describe('认证测试', () => {
    it('未登录用户应返回401', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id',
        {
          method: 'PUT',
          body: { action: 'cancel' },
        }
      );

      const response = await PUT(request, { params: { id: 'test-id' } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(401);
      expect(testResponse.success).toBe(false);
      expect(testResponse.error).toBe('UNAUTHORIZED');
    });
  });

  describe('参数验证测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    beforeEach(() => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    });

    it('缺少订单ID应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id',
        {
          method: 'PUT',
          body: { action: 'cancel' },
        }
      );

      const response = await PUT(request, { params: { id: '' } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('MISSING_ORDER_ID');
    });

    it('不支持的action应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id',
        {
          method: 'PUT',
          body: { action: 'invalid' },
        }
      );

      const response = await PUT(request, { params: { id: mockData.uuid() } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('UNSUPPORTED_ACTION');
    });
  });

  describe('订单取消测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    const mockOrder = {
      id: mockData.uuid(),
      orderNo: 'ORD20240101001',
      userId: mockSession.user.id,
      status: 'PENDING',
    };

    beforeEach(() => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (getOrder as jest.Mock).mockReset();
      (getOrder as jest.Mock).mockResolvedValue(mockOrder);
      (cancelOrder as jest.Mock).mockReset();
    });

    it('应成功取消订单', async () => {
      const updatedOrder = {
        ...mockOrder,
        status: 'CANCELLED',
      };
      (cancelOrder as jest.Mock).mockResolvedValue(updatedOrder);

      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id',
        {
          method: 'PUT',
          body: { action: 'cancel', reason: '测试取消' },
        }
      );

      const response = await PUT(request, { params: { id: mockOrder.id } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(cancelOrder as jest.Mock).toHaveBeenCalledWith(
        mockOrder.id,
        '测试取消'
      );
    });

    it('订单不存在应返回404', async () => {
      (getOrder as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id',
        {
          method: 'PUT',
          body: { action: 'cancel' },
        }
      );

      const response = await PUT(request, { params: { id: mockData.uuid() } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(404);
      expect(testResponse.error).toBe('ORDER_NOT_FOUND');
    });

    it('无权取消他人订单应返回403', async () => {
      const otherUserId = '00000000-0000-0000-0000-000000000000'; // 确保是不同的ID
      const otherOrder = {
        ...mockOrder,
        userId: otherUserId,
      };

      (getOrder as jest.Mock).mockResolvedValue(otherOrder);

      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id',
        {
          method: 'PUT',
          body: { action: 'cancel' },
        }
      );

      const response = await PUT(request, { params: { id: otherOrder.id } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(403);
      expect(testResponse.error).toBe('FORBIDDEN');
    });
  });

  describe('错误处理测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    beforeEach(() => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (getOrder as jest.Mock).mockResolvedValue({
        id: mockData.uuid(),
        userId: mockSession.user.id,
        status: 'PENDING',
      });
    });

    it('取消订单失败应返回500', async () => {
      (cancelOrder as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest(
        'http://localhost:3000/api/orders/test-id',
        {
          method: 'PUT',
          body: { action: 'cancel' },
        }
      );

      const response = await PUT(request, { params: { id: mockData.uuid() } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(500);
      expect(testResponse.success).toBe(false);
      expect(testResponse.error).toBe('INTERNAL_ERROR');
    });
  });
});
