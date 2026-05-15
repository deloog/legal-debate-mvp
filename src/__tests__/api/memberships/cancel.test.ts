import { POST } from '@/app/api/memberships/cancel/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { cancelMembership } from '@/lib/membership/membership-service';

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/membership/membership-service', () => ({
  cancelMembership: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    userMembership: {
      findFirst: jest.fn(),
    },
  },
}));

describe('POST /api/memberships/cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应在未授权时返回 401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);
    const request = new Request('http://localhost/api/memberships/cancel', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it('应仅取消续费，不立即失效', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user-123' });
    (prisma.userMembership.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'membership-1',
        userId: 'user-123',
        status: 'ACTIVE',
        endDate: new Date('2026-06-12T00:00:00.000Z'),
        tier: {
          tier: 'PROFESSIONAL',
          displayName: '专业版',
        },
      })
      .mockResolvedValueOnce({
        id: 'membership-1',
        status: 'ACTIVE',
        startDate: new Date('2026-05-01T00:00:00.000Z'),
        endDate: new Date('2026-06-12T00:00:00.000Z'),
        cancelledAt: null,
        cancelledReason: null,
        autoRenew: false,
        tier: {
          tier: 'PROFESSIONAL',
          displayName: '专业版',
          price: 199,
          billingCycle: 'MONTHLY',
          features: [],
          permissions: {},
        },
      });
    (cancelMembership as jest.Mock).mockResolvedValue({
      id: 'membership-1',
      status: 'ACTIVE',
      autoRenew: false,
    });

    const request = new Request('http://localhost/api/memberships/cancel', {
      method: 'POST',
      body: JSON.stringify({ reason: '不再续费' }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(cancelMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        immediate: false,
        reason: '不再续费',
      })
    );
    expect(data.success).toBe(true);
    expect(data.data.membership.status).toBe('ACTIVE');
    expect(data.data.membership.autoRenew).toBe(false);
    expect(data.message).toContain('取消自动续费');
  });
});
