/**
 * 统一支付API测试
 */

import { POST } from '@/app/api/payments/create/route';
import { GET } from '@/app/api/payments/query/route';
import { PaymentMethod, _CreateOrderResponse } from '@/types/payment';

// Mock dependencies
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  authOptions: {},
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    membershipTier: {
      findUnique: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    paymentRecord: {
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/order/order-service', () => ({
  createOrder: jest.fn(),
}));

jest.mock('@/lib/payment/payment-service', () => ({
  paymentService: {
    createOrder: jest.fn(),
    queryOrder: jest.fn(),
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db/prisma';
import { createOrder } from '@/lib/order/order-service';
import { paymentService } from '@/lib/payment/payment-service';

// Mock NextRequest and NextResponse
const mockRequest = (body: Record<string, unknown>) =>
  ({
    json: jest.fn().mockResolvedValue(body),
    url: 'http://localhost:3000/api/payments/create',
  }) as unknown as Request;

const mockQueryRequest = (url: string) =>
  ({
    url,
  }) as unknown as Request;

describe('统一支付创建接口', () => {
  let mockSession: { user: { id: string } };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = {
      user: { id: 'mock-user-id' },
    };
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('POST /api/payments/create', () => {
    it('应该成功创建微信支付订单', async () => {
      const requestBody = {
        membershipTierId: 'mock-tier-id',
        paymentMethod: PaymentMethod.WECHAT,
        billingCycle: 'MONTHLY',
        autoRenew: false,
      };

      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue({
        id: 'mock-tier-id',
        name: 'basic',
        displayName: '基础会员',
        price: 99.0,
        currency: 'CNY',
        isActive: true,
      });

      (createOrder as jest.Mock).mockResolvedValue({
        id: 'mock-order-id',
        orderNo: 'ORD1234567890ABCDEF',
        userId: 'mock-user-id',
        membershipTierId: 'mock-tier-id',
        paymentMethod: PaymentMethod.WECHAT,
        status: 'PENDING',
        amount: 99.0,
        currency: 'CNY',
        description: '开通基础会员',
        expiredAt: new Date(Date.now() + 7200000),
      });

      (paymentService.createOrder as jest.Mock).mockResolvedValue({
        code_url: 'weixin://wxpay/bizpayurl?pr=xxxx',
        prepay_id: 'wx1234567890abcdef',
      });

      const request = mockRequest(requestBody);
      const response = await POST(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('订单创建成功');
      expect(responseData.data).toBeDefined();
      expect(responseData.data?.orderId).toBe('mock-order-id');
      expect(responseData.data?.paymentMethod).toBe(PaymentMethod.WECHAT);
      expect(responseData.data?.codeUrl).toBeDefined();
      expect(responseData.data?.prepayId).toBeDefined();
    });

    it('应该成功创建支付宝支付订单', async () => {
      const requestBody = {
        membershipTierId: 'mock-tier-id',
        paymentMethod: PaymentMethod.ALIPAY,
        billingCycle: 'MONTHLY',
        autoRenew: false,
      };

      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue({
        id: 'mock-tier-id',
        name: 'basic',
        displayName: '基础会员',
        price: 99.0,
        currency: 'CNY',
        isActive: true,
      });

      (createOrder as jest.Mock).mockResolvedValue({
        id: 'mock-order-id',
        orderNo: 'ORD1234567890ABCDEF',
        userId: 'mock-user-id',
        membershipTierId: 'mock-tier-id',
        paymentMethod: PaymentMethod.ALIPAY,
        status: 'PENDING',
        amount: 99.0,
        currency: 'CNY',
        description: '开通基础会员',
        expiredAt: new Date(Date.now() + 7200000),
      });

      (paymentService.createOrder as jest.Mock).mockResolvedValue({
        code: '10000',
        msg: 'Success',
        qrCode: 'https://qr.alipay.com/baxxxxx',
        tradeNo: '2024011622001456789012345678',
      });

      const request = mockRequest(requestBody);
      const response = await POST(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('订单创建成功');
      expect(responseData.data).toBeDefined();
      expect(responseData.data?.orderId).toBe('mock-order-id');
      expect(responseData.data?.paymentMethod).toBe(PaymentMethod.ALIPAY);
      expect(responseData.data?.qrCode).toBeDefined();
      expect(responseData.data?.tradeNo).toBeDefined();
    });

    it('应该拒绝未授权的请求', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const requestBody = {
        membershipTierId: 'mock-tier-id',
        paymentMethod: PaymentMethod.WECHAT,
      };

      const request = mockRequest(requestBody);
      const response = await POST(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('UNAUTHORIZED');
    });

    it('应该拒绝缺少会员等级ID的请求', async () => {
      const requestBody = {
        paymentMethod: PaymentMethod.WECHAT,
      };

      const request = mockRequest(requestBody);
      const response = await POST(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('MISSING_TIER_ID');
    });

    it('应该拒绝无效的支付方式', async () => {
      const requestBody = {
        membershipTierId: 'mock-tier-id',
        paymentMethod: 'INVALID' as PaymentMethod,
      };

      const request = mockRequest(requestBody);
      const response = await POST(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('INVALID_PAYMENT_METHOD');
    });

    it('应该拒绝无效的计费周期', async () => {
      const requestBody = {
        membershipTierId: 'mock-tier-id',
        paymentMethod: PaymentMethod.WECHAT,
        billingCycle: 'INVALID_CYCLE',
      };

      const request = mockRequest(requestBody);
      const response = await POST(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('INVALID_BILLING_CYCLE');
    });

    it('应该拒绝不存在的会员等级', async () => {
      const requestBody = {
        membershipTierId: 'non-existent-tier-id',
        paymentMethod: PaymentMethod.WECHAT,
      };

      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue(null);

      const request = mockRequest(requestBody);
      const response = await POST(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('TIER_NOT_FOUND');
    });

    it('应该拒绝不活跃的会员等级', async () => {
      const requestBody = {
        membershipTierId: 'mock-tier-id',
        paymentMethod: PaymentMethod.WECHAT,
      };

      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue({
        id: 'mock-tier-id',
        name: 'basic',
        displayName: '基础会员',
        isActive: false,
      });

      const request = mockRequest(requestBody);
      const response = await POST(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('TIER_INACTIVE');
    });

    it('应该处理支付服务错误', async () => {
      const requestBody = {
        membershipTierId: 'mock-tier-id',
        paymentMethod: PaymentMethod.WECHAT,
      };

      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue({
        id: 'mock-tier-id',
        name: 'basic',
        displayName: '基础会员',
        price: 99.0,
        currency: 'CNY',
        isActive: true,
      });

      (createOrder as jest.Mock).mockResolvedValue({
        id: 'mock-order-id',
        orderNo: 'ORD1234567890ABCDEF',
        userId: 'mock-user-id',
        membershipTierId: 'mock-tier-id',
        paymentMethod: PaymentMethod.WECHAT,
        status: 'PENDING',
        amount: 99.0,
        currency: 'CNY',
        description: '开通基础会员',
        expiredAt: new Date(Date.now() + 7200000),
      });

      (paymentService.createOrder as jest.Mock).mockRejectedValue(
        new Error('支付服务错误')
      );

      const request = mockRequest(requestBody);
      const response = await POST(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('PAYMENT_SERVICE_ERROR');
    });
  });
});

describe('统一支付查询接口', () => {
  let mockSession: { user: { id: string } };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = {
      user: { id: 'mock-user-id' },
    };
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('GET /api/payments/query', () => {
    it('应该成功查询订单信息', async () => {
      const mockOrder = {
        id: 'mock-order-id',
        orderNo: 'ORD1234567890ABCDEF',
        userId: 'mock-user-id',
        membershipTierId: 'mock-tier-id',
        paymentMethod: PaymentMethod.WECHAT,
        status: 'PENDING',
        amount: { toNumber: () => 99.0 },
        currency: 'CNY',
        description: '开通基础会员',
        expiredAt: new Date(Date.now() + 7200000),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 'mock-user-id',
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        membershipTier: {
          id: 'mock-tier-id',
          name: 'basic',
          displayName: '基础会员',
          tier: 'BASIC',
        },
        paymentRecords: [
          {
            id: 'mock-payment-id',
            orderId: 'mock-order-id',
            userId: 'mock-user-id',
            paymentMethod: PaymentMethod.WECHAT,
            status: 'PENDING',
            amount: { toNumber: () => 99.0 },
            currency: 'CNY',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);

      const request = mockQueryRequest(
        'http://localhost:3000/api/payments/query?orderId=mock-order-id'
      );
      const response = await GET(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('查询成功');
      expect(responseData.data).toBeDefined();
      expect(responseData.data?.order).toBeDefined();
      expect(responseData.data?.order.id).toBe('mock-order-id');
      expect(responseData.data?.paymentStatus).toBe('PENDING');
    });

    it('应该拒绝未授权的请求', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = mockQueryRequest(
        'http://localhost:3000/api/payments/query?orderId=mock-order-id'
      );
      const response = await GET(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('UNAUTHORIZED');
    });

    it('应该拒绝缺少查询参数的请求', async () => {
      const request = mockQueryRequest(
        'http://localhost:3000/api/payments/query'
      );
      const response = await GET(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('MISSING_PARAMETER');
    });

    it('应该返回订单不存在错误', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const request = mockQueryRequest(
        'http://localhost:3000/api/payments/query?orderId=non-existent-order-id'
      );
      const response = await GET(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('ORDER_NOT_FOUND');
    });

    it('应该支持通过orderNo查询订单', async () => {
      const mockOrder = {
        id: 'mock-order-id',
        orderNo: 'ORD1234567890ABCDEF',
        userId: 'mock-user-id',
        paymentMethod: PaymentMethod.WECHAT,
        status: 'PENDING',
        amount: { toNumber: () => 99.0 },
        currency: 'CNY',
        description: '开通基础会员',
        expiredAt: new Date(Date.now() + 7200000),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 'mock-user-id', email: 'test@example.com' },
        membershipTier: {
          id: 'mock-tier-id',
          name: 'basic',
          displayName: '基础会员',
          tier: 'BASIC',
        },
        paymentRecords: [
          {
            id: 'mock-payment-id',
            orderId: 'mock-order-id',
            userId: 'mock-user-id',
            paymentMethod: PaymentMethod.WECHAT,
            status: 'PENDING',
            amount: { toNumber: () => 99.0 },
            currency: 'CNY',
            createdAt: new Date(),
            updatedAt: new Date(),
            thirdPartyOrderNo: '4200001234567890',
          },
        ],
      };

      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);

      const request = mockQueryRequest(
        'http://localhost:3000/api/payments/query?orderNo=ORD1234567890ABCDEF'
      );
      const response = await GET(request as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data?.order.orderNo).toBe('ORD1234567890ABCDEF');
    });

    it('应该处理同步失败的情况', async () => {
      const mockOrder = {
        id: 'mock-order-id',
        orderNo: 'ORD1234567890ABCDEF',
        userId: 'mock-user-id',
        paymentMethod: PaymentMethod.WECHAT,
        status: 'PENDING',
        amount: { toNumber: () => 99.0 },
        currency: 'CNY',
        description: '开通基础会员',
        expiredAt: new Date(Date.now() + 7200000),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 'mock-user-id', email: 'test@example.com' },
        membershipTier: {
          id: 'mock-tier-id',
          name: 'basic',
          displayName: '基础会员',
          tier: 'BASIC',
        },
        paymentRecords: [
          {
            id: 'mock-payment-id',
            orderId: 'mock-order-id',
            userId: 'mock-user-id',
            paymentMethod: PaymentMethod.WECHAT,
            status: 'PENDING',
            amount: { toNumber: () => 99.0 },
            currency: 'CNY',
            createdAt: new Date(),
            updatedAt: new Date(),
            thirdPartyOrderNo: '4200001234567890',
          },
        ],
      };

      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (paymentService.queryOrder as jest.Mock).mockRejectedValue(
        new Error('网络错误')
      );

      const request = mockQueryRequest(
        'http://localhost:3000/api/payments/query?orderId=mock-order-id&syncFromPayment=true'
      );
      const response = await GET(request as any);
      const responseData = await response.json();

      // 即使同步失败，也应该返回本地数据
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data?.order.id).toBe('mock-order-id');
    });
  });
});
