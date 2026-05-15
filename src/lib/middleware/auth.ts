/**
 * 认证中间件
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import type { JwtPayload } from '@/types/auth';
import type { NextRequest } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '../auth/jwt';

/**
 * 获取认证用户信息
 * 支持 Authorization header（API 调用）和 httpOnly Cookie（浏览器请求）两种来源。
 * 安全说明：不信任任何客户端可伪造的请求头（如 x-user-id / x-user-role）。
 */
export async function getAuthUser(
  request: NextRequest
): Promise<JwtPayload | null> {
  // 1. 优先从 Authorization header 读取（API 调用）
  const authHeader = request.headers.get('authorization');
  let token = extractTokenFromHeader(authHeader);

  // 2. 回退到 httpOnly Cookie（浏览器请求）
  if (!token) {
    token = request.cookies.get('accessToken')?.value || null;
  }

  if (!token) {
    return null;
  }

  // 3. 验证 token
  const verificationResult = verifyToken(token);

  if (process.env.NODE_ENV === 'development') {
    logger.debug('[getAuthUser] Token验证结果:', {
      valid: verificationResult.valid,
      error: verificationResult.error,
    });
  }

  if (!verificationResult.valid || !verificationResult.payload) {
    return null;
  }

  const payload = verificationResult.payload;

  // 新版本 accessToken 通过 jti 绑定 session.id。
  // 若会话已删除（如 logout）或过期，则旧 accessToken 立即失效。
  if (payload.jti) {
    try {
      const session = await prisma.session.findUnique({
        where: { id: payload.jti },
        select: { id: true, userId: true, expires: true },
      });

      if (!session) return null;
      if (session.userId !== payload.userId) return null;
      if (session.expires.getTime() <= Date.now()) return null;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('[getAuthUser] Session 绑定校验失败，拒绝认证:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return null;
    }
  }

  return payload;
}

/**
 * 验证用户是否已认证
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const user = await getAuthUser(request);
  return user !== null;
}

/**
 * 验证用户是否有指定角色
 */
export async function hasRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<boolean> {
  const user = await getAuthUser(request);

  if (!user) {
    return false;
  }

  return allowedRoles.includes(user.role);
}

/**
 * 验证用户是否为管理员
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  return await hasRole(request, ['ADMIN', 'SUPER_ADMIN']);
}

/**
 * 验证用户是否为超级管理员
 */
export async function isSuperAdmin(request: NextRequest): Promise<boolean> {
  return await hasRole(request, ['SUPER_ADMIN']);
}
