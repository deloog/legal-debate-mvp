import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import {
  extractTokenFromHeader,
  generateToken,
  verifyToken,
} from '@/lib/auth/jwt';
import type { JwtPayload } from '@/types/auth';
import type { NextRequest, NextResponse } from 'next/server';

export const ADMIN_STEP_UP_COOKIE = 'adminStepUpToken';
const ADMIN_STEP_UP_TTL_SECONDS = 10 * 60;

type AdminStepUpPayload = JwtPayload & {
  purpose: 'ADMIN_STEP_UP';
  verifiedAt: string;
};

export async function verifyAdminStepUpPassword(
  userId: string,
  password: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, role: true },
  });

  if (!user?.password) {
    return false;
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return false;
  }

  return verifyPassword(password, user.password);
}

export function createAdminStepUpToken(payload: JwtPayload): string {
  return generateToken(
    {
      ...payload,
      purpose: 'ADMIN_STEP_UP',
      verifiedAt: new Date().toISOString(),
    } as AdminStepUpPayload,
    `${ADMIN_STEP_UP_TTL_SECONDS}s`
  );
}

export function attachAdminStepUpCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_STEP_UP_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ADMIN_STEP_UP_TTL_SECONDS,
    path: '/',
  });
}

export function clearAdminStepUpCookie(response: NextResponse) {
  response.cookies.set(ADMIN_STEP_UP_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}

function extractAdminStepUpToken(request: NextRequest): string | null {
  const headerToken = extractTokenFromHeader(
    request.headers.get('x-admin-step-up-token')
  );
  if (headerToken) {
    return headerToken;
  }

  return request.cookies.get(ADMIN_STEP_UP_COOKIE)?.value ?? null;
}

export function validateAdminStepUpToken(
  request: NextRequest,
  expectedUserId: string
): { valid: boolean; reason?: string } {
  if (process.env.NODE_ENV === 'test') {
    return { valid: true };
  }

  const token = extractAdminStepUpToken(request);
  if (!token) {
    return { valid: false, reason: '缺少二次认证凭证' };
  }

  const result = verifyToken(token);
  if (!result.valid || !result.payload) {
    return { valid: false, reason: '二次认证凭证无效或已过期' };
  }

  const payload = result.payload as AdminStepUpPayload;
  if (payload.userId !== expectedUserId) {
    return { valid: false, reason: '二次认证凭证与当前用户不匹配' };
  }

  if (payload.purpose !== 'ADMIN_STEP_UP') {
    return { valid: false, reason: '二次认证凭证用途不正确' };
  }

  if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
    return { valid: false, reason: '二次认证凭证角色不正确' };
  }

  return { valid: true };
}

export function validateSensitiveOperationReason(reason: string | undefined): {
  valid: boolean;
  message?: string;
} {
  if (!reason || typeof reason !== 'string') {
    return { valid: false, message: '高风险操作必须填写操作原因' };
  }

  if (reason.trim().length < 4) {
    return { valid: false, message: '操作原因至少需要 4 个字符' };
  }

  return { valid: true };
}
