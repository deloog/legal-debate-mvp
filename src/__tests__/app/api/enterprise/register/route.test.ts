import { NextRequest } from 'next/server';
import { POST } from '@/app/api/enterprise/register/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { createEnterpriseAccount } from '@/lib/enterprise/service';

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/enterprise/service', () => ({
  createEnterpriseAccount: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('POST /api/enterprise/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user-1' });
  });

  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost:3000/api/enterprise/register', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('拒绝注册时直接携带营业执照，必须走资质上传接口', async () => {
    const response = await POST(
      makeRequest({
        enterpriseName: '北京测试科技有限公司',
        creditCode: '91110000123456789X',
        legalPerson: '张三',
        industryType: '科技',
        businessLicense: 'data:image/png;base64,AAAA',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('LICENSE_UPLOAD_REQUIRED');
    expect(createEnterpriseAccount).not.toHaveBeenCalled();
  });

  it('注册企业账号时不向服务层传递 businessLicense', async () => {
    (createEnterpriseAccount as jest.Mock).mockResolvedValue({
      id: 'enterprise-1',
      enterpriseName: '北京测试科技有限公司',
      creditCode: '91110000123456789X',
      legalPerson: '张三',
      industryType: '科技',
      businessLicense: null,
      status: 'PENDING',
      submittedAt: new Date(),
      expiresAt: null,
    });

    const response = await POST(
      makeRequest({
        enterpriseName: '北京测试科技有限公司',
        creditCode: '91110000123456789X',
        legalPerson: '张三',
        industryType: '科技',
      })
    );

    expect(response.status).toBe(201);
    expect(createEnterpriseAccount).toHaveBeenCalledWith('user-1', {
      enterpriseName: '北京测试科技有限公司',
      creditCode: '91110000123456789X',
      legalPerson: '张三',
      industryType: '科技',
    });
  });
});
