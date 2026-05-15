/**
 * 订单列表API测试
 * GET /api/orders
 */

import { GET } from '@/app/api/orders/route';
import {
  createMockRequest,
  createTestResponse,
  assertions,
  mockData,
} from '../test-utils';
import { getUserOrders } from '@/lib/order/order-service';
import { getAuthUser } from '@/lib/middleware/auth';

jest.mock('@/lib/order/order-service', () => ({
  getUserOrders: jest.fn(),
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

describe('GET /api/orders', () => {
  describe('认证测试', () => {
    it('未登录用户应返回401', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/orders');

      const response = await GET(request);
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
      jest.clearAllMocks();
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: mockSession.user.id,
      });
    });

    it('无效的status应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?status=INVALID'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('INVALID_STATUS');
    });

    it('page参数小于1应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?page=0'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('INVALID_PAGE');
    });

    it('page参数大于1000应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?page=1001'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('INVALID_PAGE');
    });

    it('limit参数小于1应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?limit=0'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('INVALID_LIMIT');
    });

    it('limit参数大于100应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?limit=101'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('INVALID_LIMIT');
    });

    it('无效的sortBy应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?sortBy=invalid'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('INVALID_SORT_FIELD');
    });

    it('无效的sortOrder应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?sortOrder=invalid'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('INVALID_SORT_ORDER');
    });
  });

  describe('订单列表查询测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    const mockOrders = [
      {
        id: mockData.uuid(),
        orderNo: 'ORD20240101001',
        userId: mockSession.user.id,
        amount: 99.0,
        currency: 'CNY',
        status: 'PAID',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        paidAt: new Date('2024-01-01'),
      },
      {
        id: mockData.uuid(),
        orderNo: 'ORD20240102001',
        userId: mockSession.user.id,
        amount: 199.0,
        currency: 'CNY',
        status: 'PENDING',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        paidAt: null,
      },
    ];

    beforeEach(() => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: mockSession.user.id,
      });
      (getUserOrders as jest.Mock).mockReset();
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: mockOrders,
        total: 2,
      });
    });

    it('应返回订单列表', async () => {
      const request = createMockRequest('http://localhost:3000/api/orders');

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.orders).toBeDefined();
      expect(Array.isArray(testResponse.data.orders)).toBe(true);
      expect(testResponse.data.pagination).toBeDefined();
    });

    it('应使用默认分页参数', async () => {
      const request = createMockRequest('http://localhost:3000/api/orders');

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.pagination.page).toBe(1);
      expect(testResponse.data.pagination.limit).toBe(20);
    });

    it('应支持状态筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?status=PAID'
      );

      const __response = await GET(request);

      expect(getUserOrders as jest.Mock).toHaveBeenCalledWith(
        mockSession.user.id,
        expect.objectContaining({
          status: 'PAID',
        })
      );
    });

    it('应支持自定义分页', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?page=2&limit=10'
      );

      const __response = await GET(request);

      expect(getUserOrders as jest.Mock).toHaveBeenCalledWith(
        mockSession.user.id,
        expect.objectContaining({
          page: 2,
          limit: 10,
        })
      );
    });

    it('应包含正确的分页信息', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?page=1'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.pagination.total).toBe(2);
      expect(testResponse.data.pagination.totalPages).toBe(1);
    });

    it('应支持按createdAt升序排序', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?sortBy=createdAt&sortOrder=asc'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.orders[0].orderNo).toBe('ORD20240101001');
    });

    it('应支持按createdAt降序排序', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?sortBy=createdAt&sortOrder=desc'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.orders[0].orderNo).toBe('ORD20240102001');
    });

    it('应支持按amount排序', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?sortBy=amount&sortOrder=asc'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.orders[0].amount).toBe(99.0);
    });

    it('应支持按paidAt排序', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders?sortBy=paidAt&sortOrder=desc'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.orders[0].paidAt).toBeDefined();
    });
  });

  describe('错误处理测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: mockSession.user.id,
      });
    });

    it('查询失败应返回500', async () => {
      (getUserOrders as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = createMockRequest('http://localhost:3000/api/orders');

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(500);
      expect(testResponse.success).toBe(false);
      expect(testResponse.error).toBe('INTERNAL_ERROR');
    });
  });
});
