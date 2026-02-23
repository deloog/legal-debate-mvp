/**
 * 订单创建API测试
 * POST /api/orders/create
 */

import { POST } from '@/app/api/orders/create/route';
import {
  createMockRequest,
  createTestResponse,
  assertions,
  mockData,
} from '../test-utils';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('@/lib/order/order-service', () => ({
  createOrder: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    membershipTier: {
      findUnique: jest.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db/prisma';
import { createOrder } from '@/lib/order/order-service';

// Get reference to mocked prisma
const getMockPrisma = () => prisma as any;

describe('POST /api/orders/create', () => {
  describe('认证测试', () => {
    it('未登录用户应返回401', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {},
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(401);
      expect(testResponse.success).toBe(false);
      expect(testResponse.error).toBe('UNAUTHORIZED');
    });

    it('无session.user.id应返回401', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {},
      });

      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {},
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(401);
      expect(testResponse.success).toBe(false);
    });
  });

  describe('输入验证测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    beforeEach(() => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    });

    it('缺少membershipTierId应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            paymentMethod: 'WECHAT',
          },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('MISSING_TIER_ID');
    });

    it('membershipTierId类型错误应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: 123,
            paymentMethod: 'WECHAT',
          },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
    });

    it('缺少paymentMethod应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
          },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('INVALID_PAYMENT_METHOD');
    });

    it('无效的paymentMethod应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'INVALID',
          },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('INVALID_PAYMENT_METHOD');
    });

    it('无效的billingCycle应返回400', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'WECHAT',
            billingCycle: 'INVALID',
          },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('INVALID_BILLING_CYCLE');
    });
  });

  describe('会员等级验证测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    beforeEach(() => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (getMockPrisma().membershipTier.findUnique as jest.Mock).mockReset();
    });

    it('会员等级不存在应返回404', async () => {
      (
        getMockPrisma().membershipTier.findUnique as jest.Mock
      ).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'WECHAT',
          },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(404);
      expect(testResponse.error).toBe('TIER_NOT_FOUND');
    });

    it('会员等级未激活应返回400', async () => {
      (
        getMockPrisma().membershipTier.findUnique as jest.Mock
      ).mockResolvedValue({
        id: mockData.uuid(),
        displayName: '测试会员',
        isActive: false,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'WECHAT',
          },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(400);
      expect(testResponse.error).toBe('TIER_INACTIVE');
    });
  });

  describe('订单创建成功测试', () => {
    const mockSession = {
      user: {
        id: mockData.uuid(),
      },
    };

    const mockOrder = {
      id: mockData.uuid(),
      orderNo: 'ORD20240101001',
      amount: { toNumber: () => 99.0, valueOf: () => 99.0 },
      currency: 'CNY',
      status: 'PENDING',
      expiredAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    beforeEach(() => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      (
        getMockPrisma().membershipTier.findUnique as jest.Mock
      ).mockResolvedValue({
        id: mockData.uuid(),
        displayName: '专业会员',
        isActive: true,
      });

      (createOrder as jest.Mock).mockReset();
      (createOrder as jest.Mock).mockResolvedValue(mockOrder);
    });

    it('应成功创建订单', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'WECHAT',
          },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.data.orderId).toBeDefined();
      expect(testResponse.data.data.orderNo).toBeDefined();
      expect(testResponse.data.data.amount).toBe(99.0);
      expect(testResponse.data.data.currency).toBe('CNY');
      expect(testResponse.data.data.status).toBe('PENDING');
    });

    it('应使用自定义description', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'WECHAT',
            description: '自定义订单描述',
          },
        }
      );

      const _response = await POST(request);

      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '自定义订单描述',
        })
      );
    });

    it('应处理autoRenew参数', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'WECHAT',
            autoRenew: true,
          },
        }
      );

      const _response = await POST(request);

      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          autoRenew: true,
        })
      );
    });

    it('应处理metadata参数', async () => {
      const customMetadata = {
        source: 'web',
        campaign: 'promotion',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'WECHAT',
            metadata: customMetadata,
          },
        }
      );

      const _response = await POST(request);

      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining(customMetadata),
        })
      );
    });

    it('应支持微信支付', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'WECHAT',
          },
        }
      );

      const _response = await POST(request);

      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'WECHAT',
        })
      );
    });

    it('应支持支付宝', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'ALIPAY',
          },
        }
      );

      const _response = await POST(request);

      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'ALIPAY',
        })
      );
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

      (
        getMockPrisma().membershipTier.findUnique as jest.Mock
      ).mockResolvedValue({
        id: mockData.uuid(),
        displayName: '测试会员',
        isActive: true,
      });
    });

    it('订单创建失败应返回500', async () => {
      (createOrder as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest(
        'http://localhost:3000/api/orders/create',
        {
          method: 'POST',
          body: {
            membershipTierId: mockData.uuid(),
            paymentMethod: 'WECHAT',
          },
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(500);
      expect(testResponse.success).toBe(false);
      expect(testResponse.error).toBe('INTERNAL_ERROR');
    });
  });
});
