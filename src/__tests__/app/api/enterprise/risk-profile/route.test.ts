import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/enterprise/risk-profile/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

const mockGenerateEnterpriseRiskProfile = jest.fn();
const mockGetEnterpriseRiskProfile = jest.fn();

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    enterpriseAccount: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock(
  '@/services/enterprise/legal/enterprise-risk-profile.service',
  () => ({
    EnterpriseRiskProfileService: jest.fn().mockImplementation(() => ({
      generateEnterpriseRiskProfile: mockGenerateEnterpriseRiskProfile,
      getEnterpriseRiskProfile: mockGetEnterpriseRiskProfile,
    })),
  })
);

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('GET/POST /api/enterprise/risk-profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user-1' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'USER' });
  });

  it('POST 未登录时返回401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValueOnce(null);

    const request = new NextRequest(
      'http://localhost:3000/api/enterprise/risk-profile',
      {
        method: 'POST',
        body: JSON.stringify({ enterpriseId: 'enterprise-1' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('POST 企业未审核通过时返回403', async () => {
    (prisma.enterpriseAccount.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'user-1',
      status: 'PENDING',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/enterprise/risk-profile',
      {
        method: 'POST',
        body: JSON.stringify({ enterpriseId: 'enterprise-1' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('企业认证尚未通过，暂不可生成风险画像');
    expect(mockGenerateEnterpriseRiskProfile).not.toHaveBeenCalled();
  });

  it('POST 非所有者且非管理员时返回403', async () => {
    (prisma.enterpriseAccount.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'another-user',
      status: 'APPROVED',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/enterprise/risk-profile',
      {
        method: 'POST',
        body: JSON.stringify({ enterpriseId: 'enterprise-1' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('无权访问此企业账号');
    expect(mockGenerateEnterpriseRiskProfile).not.toHaveBeenCalled();
  });

  it('POST 审核通过的所有者可以生成画像，并使用认证用户ID', async () => {
    (prisma.enterpriseAccount.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'user-1',
      status: 'APPROVED',
    });
    mockGenerateEnterpriseRiskProfile.mockResolvedValueOnce({
      enterpriseId: 'enterprise-1',
      overallRiskScore: 42,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/enterprise/risk-profile',
      {
        method: 'POST',
        body: JSON.stringify({ enterpriseId: 'enterprise-1' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGenerateEnterpriseRiskProfile).toHaveBeenCalledWith(
      'enterprise-1',
      'user-1'
    );
  });

  it('GET 审核通过的所有者在无画像时返回404', async () => {
    (prisma.enterpriseAccount.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'user-1',
      status: 'APPROVED',
    });
    mockGetEnterpriseRiskProfile.mockResolvedValueOnce(null);

    const request = new NextRequest(
      'http://localhost:3000/api/enterprise/risk-profile?enterpriseId=enterprise-1'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('未找到风险画像');
  });
});
