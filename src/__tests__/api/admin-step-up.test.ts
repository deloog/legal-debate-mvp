import { NextRequest } from 'next/server';
import { DELETE, POST } from '@/app/api/admin/security/step-up/route';

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/admin/step-up', () => ({
  ADMIN_STEP_UP_COOKIE: 'adminStepUpToken',
  attachAdminStepUpCookie: jest.fn((response: Response) => response),
  clearAdminStepUpCookie: jest.fn((response: Response) => response),
  createAdminStepUpToken: jest.fn(() => 'step-up-token'),
  verifyAdminStepUpPassword: jest.fn(),
}));

jest.mock('@/lib/audit/logger', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { getAuthUser } from '@/lib/middleware/auth';
import {
  attachAdminStepUpCookie,
  clearAdminStepUpCookie,
  verifyAdminStepUpPassword,
} from '@/lib/admin/step-up';

describe('POST/DELETE /api/admin/security/step-up', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('未登录时返回401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/admin/security/step-up',
      {
        method: 'POST',
        body: JSON.stringify({ password: 'secret123' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    const errorCode =
      typeof data.error === 'string' ? data.error : data.error?.code;
    expect(errorCode).toBe('UNAUTHORIZED');
  });

  it('缺少密码时返回400', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'admin-1',
      role: 'ADMIN',
      email: 'admin@example.com',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/admin/security/step-up',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    const errorCode =
      typeof data.error === 'string' ? data.error : data.error?.code;
    expect(errorCode).toBe('INVALID_INPUT');
  });

  it('密码错误时返回403', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'admin-1',
      role: 'ADMIN',
      email: 'admin@example.com',
    });
    (verifyAdminStepUpPassword as jest.Mock).mockResolvedValue(false);

    const request = new NextRequest(
      'http://localhost:3000/api/admin/security/step-up',
      {
        method: 'POST',
        body: JSON.stringify({ password: 'wrong-pass' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error?.code ?? data.error).toBe('INVALID_PASSWORD');
  });

  it('验证成功时设置二次认证 cookie', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'admin-1',
      role: 'ADMIN',
      email: 'admin@example.com',
    });
    (verifyAdminStepUpPassword as jest.Mock).mockResolvedValue(true);

    const request = new NextRequest(
      'http://localhost:3000/api/admin/security/step-up',
      {
        method: 'POST',
        body: JSON.stringify({ password: 'correct-pass' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(attachAdminStepUpCookie).toHaveBeenCalled();
  });

  it('DELETE 会清除二次认证 cookie', async () => {
    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(clearAdminStepUpCookie).toHaveBeenCalled();
  });
});
