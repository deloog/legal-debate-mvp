/**
 * 管理员订单列表API测试
 * GET /api/admin/orders
 */

import { GET } from '@/app/api/admin/orders/route';
import {
  createMockRequest,
  createTestResponse,
  assertions,
  mockData,
} from '../test-utils';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    order: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn(),
}));

describe('GET /api/admin/orders', () => {
  const mockUser = {
    userId: mockData.uuid(),
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  const mockOrders = [
    {
      id: mockData.uuid(),
      orderNo: 'ORD20240101001',
      userId: mockData.uuid(),
      userEmail: 'user1@example.com',
      userName: 'User 1',
      membershipTierId: mockData.uuid(),
      membershipTierName: 'Professional',
      paymentMethod: 'WECHAT',
      status: 'PAID',
      amount: { toNumber: () => 99.0 },
      currency: 'CNY',
      description: 'Professional Membership',
      expiredAt: new Date('2024-12-31'),
      paidAt: new Date('2024-01-01'),
      failedReason: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      user: {
        id: mockData.uuid(),
        email: 'user1@example.com',
        name: 'User 1',
      },
      membershipTier: {
        id: mockData.uuid(),
        name: 'PROFESSIONAL',
        displayName: 'Professional',
      },
      paymentRecords: [],
    },
    {
      id: mockData.uuid(),
      orderNo: 'ORD20240102001',
      userId: mockData.uuid(),
      userEmail: 'user2@example.com',
      userName: 'User 2',
      membershipTierId: mockData.uuid(),
      membershipTierName: 'Basic',
      paymentMethod: 'ALIPAY',
      status: 'PENDING',
      amount: { toNumber: () => 29.0 },
      currency: 'CNY',
      description: 'Basic Membership',
      expiredAt: new Date('2024-12-31'),
      paidAt: null,
      failedReason: null,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      user: {
        id: mockData.uuid(),
        email: 'user2@example.com',
        name: 'User 2',
      },
      membershipTier: {
        id: mockData.uuid(),
        name: 'BASIC',
        displayName: 'Basic',
      },
      paymentRecords: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('认证测试', () => {
    it('未登录用户应返回401', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(401);
      expect(testResponse.success).toBe(false);
    });
  });

  describe('权限测试', () => {
    beforeEach(() => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
    });

    it('无order:read权限应返回403', async () => {
      (validatePermissions as jest.Mock).mockResolvedValue(
        Response.json(
          { success: false, message: 'Forbidden', error: 'FORBIDDEN' },
          { status: 403 }
        )
      );

      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(403);
      expect(testResponse.error).toBe('FORBIDDEN');
    });
  });

  describe('订单列表查询测试', () => {
    beforeEach(() => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.order.count as jest.Mock).mockResolvedValue(2);
      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: { toNumber: () => 99 } },
      });
    });

    it('应返回订单列表', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.data.orders).toBeDefined();
      expect(Array.isArray(testResponse.data.data.orders)).toBe(true);
      expect(testResponse.data.data.pagination).toBeDefined();
    });

    it('应返回统计摘要', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.summary).toBeDefined();
      expect(testResponse.data.data.summary.total).toBeDefined();
      expect(testResponse.data.data.summary.paidCount).toBeDefined();
      expect(testResponse.data.data.summary.paidAmount).toBeDefined();
      expect(testResponse.data.data.summary.pendingCount).toBeDefined();
      expect(testResponse.data.data.summary.pendingAmount).toBeDefined();
      expect(testResponse.data.data.summary.failedCount).toBeDefined();
      expect(testResponse.data.data.summary.failedAmount).toBeDefined();
    });

    it('应使用默认分页参数', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.pagination.page).toBe(1);
      expect(testResponse.data.data.pagination.limit).toBe(20);
    });

    it('应支持自定义分页', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?page=2&limit=10'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.pagination.page).toBe(2);
      expect(testResponse.data.data.pagination.limit).toBe(10);
    });

    it('limit超过100应自动限制为100', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?limit=200'
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it('应支持按状态筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?status=PAID'
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PAID',
          }),
        })
      );
    });

    it('应支持按支付方式筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?paymentMethod=WECHAT'
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paymentMethod: 'WECHAT',
          }),
        })
      );
    });

    it('应支持按用户ID筛选', async () => {
      const userId = mockData.uuid();
      const request = createMockRequest(
        `http://localhost:3000/api/admin/orders?userId=${userId}`
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
          }),
        })
      );
    });

    it('应支持按会员等级筛选', async () => {
      const tierId = mockData.uuid();
      const request = createMockRequest(
        `http://localhost:3000/api/admin/orders?membershipTierId=${tierId}`
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            membershipTierId: tierId,
          }),
        })
      );
    });

    it('应支持时间范围筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?startDate=2024-01-01&endDate=2024-01-31'
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      );
    });

    it('应支持搜索订单号', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?search=ORD20240101001'
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                orderNo: {
                  contains: 'ORD20240101001',
                  mode: 'insensitive',
                },
              }),
            ]),
          }),
        })
      );
    });

    it('应支持搜索用户邮箱', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?search=user1@example.com'
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                user: expect.objectContaining({
                  email: {
                    contains: 'user1@example.com',
                    mode: 'insensitive',
                  },
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('应支持按createdAt降序排序', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?sortBy=createdAt&sortOrder=desc'
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
    });

    it('应支持按amount排序', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?sortBy=amount&sortOrder=asc'
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            amount: 'asc',
          },
        })
      );
    });

    it('无效的sortBy应使用默认值createdAt', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?sortBy=invalid'
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
    });

    it('无效的sortOrder应使用默认值desc', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?sortOrder=invalid'
      );

      const __response = await GET(request);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
    });
  });

  describe('数据格式测试', () => {
    beforeEach(() => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.order.count as jest.Mock).mockResolvedValue(2);
      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: { toNumber: () => 99 } },
      });
    });

    it('订单数据应包含正确的字段', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      const order = testResponse.data.data.orders[0];
      expect(order.id).toBeDefined();
      expect(order.orderNo).toBeDefined();
      expect(order.userId).toBeDefined();
      expect(order.userEmail).toBeDefined();
      expect(order.userName).toBeDefined();
      expect(order.membershipTierName).toBeDefined();
      expect(order.paymentMethod).toBeDefined();
      expect(order.status).toBeDefined();
      expect(order.amount).toBeDefined();
      expect(order.currency).toBeDefined();
      expect(order.description).toBeDefined();
      expect(order.expiredAt).toBeDefined();
      expect(order.paidAt).toBeDefined();
      expect(order.failedReason).toBeDefined();
      expect(order.createdAt).toBeDefined();
      expect(order.updatedAt).toBeDefined();
    });

    it('金额应转换为数字', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      const order = testResponse.data.data.orders[0];
      expect(typeof order.amount).toBe('number');
    });

    it('分页信息应正确', async () => {
      (prisma.order.count as jest.Mock).mockResolvedValue(25);

      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders?page=2&limit=10'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.pagination.total).toBe(25);
      expect(testResponse.data.data.pagination.page).toBe(2);
      expect(testResponse.data.data.pagination.limit).toBe(10);
      expect(testResponse.data.data.pagination.totalPages).toBe(3);
    });
  });

  describe('错误处理测试', () => {
    beforeEach(() => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
    });

    it('数据库错误应返回500', async () => {
      (prisma.order.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(500);
      expect(testResponse.success).toBe(false);
    });

    it('查询错误应返回500', async () => {
      (prisma.order.count as jest.Mock).mockResolvedValue(2);
      (prisma.order.findMany as jest.Mock).mockRejectedValue(
        new Error('Query error')
      );

      const request = createMockRequest(
        'http://localhost:3000/api/admin/orders'
      );

      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(500);
      expect(testResponse.success).toBe(false);
    });
  });
});
