import { GET } from '@/app/api/refunds/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    refundRecord: {
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/refunds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应在未授权时返回 401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);
    const request = new Request('http://localhost/api/refunds');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('应返回当前用户退款记录列表', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user-123' });
    (prisma.refundRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'refund-1',
        orderId: 'order-1',
        amount: 99,
        refundAmount: 99,
        status: 'SUCCESS',
        reason: 'USER_REQUEST',
        appliedAt: new Date('2026-05-12T00:00:00.000Z'),
        currency: 'CNY',
      },
    ]);

    const request = new Request('http://localhost/api/refunds');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.refundRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123' },
      })
    );
    expect(data.success).toBe(true);
    expect(data.data.refunds).toHaveLength(1);
    expect(data.data.refunds[0]).toMatchObject({
      id: 'refund-1',
      orderId: 'order-1',
      amount: 99,
      refundAmount: 99,
      status: 'SUCCESS',
    });
  });
});
