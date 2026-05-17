jest.mock('next/server', () => {
  class MockNextRequest extends globalThis.Request {
    constructor(input: string, init: RequestInit = {}) {
      super(input, init);
    }

    get nextUrl() {
      return new URL(this.url);
    }

    get cookies() {
      return {
        get: (name: string) => {
          const cookieHeader = this.headers.get('cookie') || '';
          const value = cookieHeader
            .split(';')
            .map(part => part.trim())
            .find(part => part.startsWith(`${name}=`))
            ?.slice(name.length + 1);
          return value ? { value } : undefined;
        },
      };
    }
  }

  class MockNextResponse extends globalThis.Response {
    cookies: {
      set: (
        name: string,
        value: string,
        options?: {
          maxAge?: number;
          path?: string;
          httpOnly?: boolean;
          secure?: boolean;
          sameSite?: string;
        }
      ) => void;
    };

    constructor(body?: BodyInit | null, init: ResponseInit = {}) {
      super(body, init);
      this.cookies = {
        set: (name, value, options = {}) => {
          const attributes = [`${name}=${value}`];
          if (options.maxAge !== undefined) {
            attributes.push(`Max-Age=${options.maxAge}`);
          }
          if (options.path) {
            attributes.push(`Path=${options.path}`);
          }
          if (options.httpOnly) {
            attributes.push('HttpOnly');
          }
          if (options.secure) {
            attributes.push('Secure');
          }
          if (options.sameSite) {
            attributes.push(`SameSite=${options.sameSite}`);
          }
          const previous = this.headers.get('set-cookie');
          this.headers.set(
            'set-cookie',
            previous
              ? `${previous}, ${attributes.join('; ')}`
              : attributes.join('; ')
          );
        },
      };
    }

    static json(data: unknown, init: ResponseInit = {}) {
      return new MockNextResponse(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string> | undefined),
        },
      });
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  };
});

import { NextRequest } from 'next/server';
import type { UserRole } from '@prisma/client';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as refresh } from '@/app/api/auth/refresh/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { generateRefreshToken } from '@/lib/auth/jwt';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/rate-limit', () => ({
  strictRateLimiter: {},
  moderateRateLimiter: {},
  withRateLimit: (_limiter: unknown, handler: unknown) => handler,
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  session: {
    create: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    deleteMany: jest.Mock;
  };
};
function makeRequest(
  url: string,
  body?: object,
  headers?: Record<string, string>
): NextRequest {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  );

  return new NextRequest(url, {
    method: 'POST',
    headers: {
      ...(body && { 'content-type': 'application/json' }),
      ...normalizedHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('auth register/login flow regressions', () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      configurable: true,
    });
    process.env.JWT_SECRET = 'test-jwt-secret-for-auth-flow-regression';
  });

  afterAll(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: oldNodeEnv,
      configurable: true,
    });
    process.env.JWT_SECRET = oldJwtSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.session.create.mockResolvedValue({
      id: 'session-1',
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    mockPrisma.session.update.mockResolvedValue({});
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  });

  it('register stores selected workspace role and returns matching token TTL', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'lawyer@example.com',
      username: null,
      name: '律师用户',
      role: 'LAWYER' satisfies UserRole,
      createdAt: new Date('2026-05-17T00:00:00.000Z'),
    });

    const response = await register(
      makeRequest('http://localhost/api/auth/register', {
        email: 'lawyer@example.com',
        password: 'Pass123',
        name: '律师用户',
        role: 'LAWYER',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.user.role).toBe('LAWYER');
    expect(data.data.expiresIn).toBe(7 * 24 * 60 * 60);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'LAWYER',
          preferences: {
            onboarding: {
              intendedRole: 'LAWYER',
            },
          },
        }),
      })
    );
  });

  it('login promotes legacy USER with onboarding role before issuing tokens', async () => {
    const hashedPassword = await hashPassword('Pass123');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'legacy@example.com',
      username: null,
      name: '旧用户',
      role: 'USER',
      status: 'ACTIVE',
      password: hashedPassword,
      preferences: { onboarding: { intendedRole: 'ENTERPRISE' } },
      loginCount: 0,
      createdAt: new Date('2026-05-17T00:00:00.000Z'),
    });
    mockPrisma.user.update.mockResolvedValue({});

    const response = await login(
      makeRequest('http://localhost/api/auth/login', {
        email: 'legacy@example.com',
        password: 'Pass123',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.user.role).toBe('ENTERPRISE');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-2' },
        data: expect.objectContaining({
          role: 'ENTERPRISE',
          loginCount: 1,
        }),
      })
    );
  });

  it('refresh uses current effective database role instead of stale token role', async () => {
    const staleRefreshToken = generateRefreshToken({
      userId: 'user-3',
      email: 'refresh@example.com',
      role: 'USER',
      jti: 'session-3',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-3',
      email: 'refresh@example.com',
      username: null,
      name: '刷新用户',
      role: 'USER',
      status: 'ACTIVE',
      preferences: { onboarding: { intendedRole: 'LAWYER' } },
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.session.findFirst.mockResolvedValue({
      id: 'session-3',
      userId: 'user-3',
      sessionToken: staleRefreshToken,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const response = await refresh(
      makeRequest('http://localhost/api/auth/refresh', {
        refreshToken: staleRefreshToken,
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.expiresIn).toBe(7 * 24 * 60 * 60);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-3' },
      data: { role: 'LAWYER' },
    });
  });

  it('logout clears both custom JWT and NextAuth session cookies', async () => {
    const refreshToken = generateRefreshToken({
      userId: 'user-4',
      email: 'logout@example.com',
      role: 'LAWYER',
      jti: 'session-4',
    });
    const accessToken = generateRefreshToken({
      userId: 'user-4',
      email: 'logout@example.com',
      role: 'LAWYER',
      jti: 'session-1',
    });
    mockPrisma.session.findFirst.mockResolvedValue({
      id: 'session-4',
      userId: 'user-4',
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-4',
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

    const response = await logout(
      makeRequest(
        'http://localhost/api/auth/logout',
        { allDevices: false },
        {
          Authorization: `Bearer ${accessToken}`,
          Cookie: `accessToken=${accessToken}; refreshToken=${refreshToken}; next-auth.session-token=legacy`,
        }
      )
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie') || '';
    expect(setCookie).toContain('accessToken=');
    expect(setCookie).toContain('refreshToken=');
    expect(setCookie).toContain('next-auth.session-token=');
    expect(setCookie).toContain('__Secure-next-auth.session-token=');
  });
});
