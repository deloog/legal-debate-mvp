/**
 * 认证中间件
 */

import type { NextRequest } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '../auth/jwt';
import type { JwtPayload } from '@/types/auth';

/**
 * 获取认证用户信息
 * 安全优化：支持从Cookie和Authorization header读取token
 */
export async function getAuthUser(
  request: NextRequest
): Promise<JwtPayload | null> {
  // 1. 优先从Authorization header读取（用于API调用）
  const authHeader = request.headers.get('authorization');
  let token = extractTokenFromHeader(authHeader);
  let tokenSource = '';

  if (token) {
    tokenSource = 'Authorization header';
  }

  // 2. 如果header没有，从Cookie读取（用于浏览器请求）
  if (!token) {
    token = request.cookies.get('accessToken')?.value || null;
    if (token) {
      tokenSource = 'Cookie';
    }
  }

  // 3. 如果还是没有，尝试从middleware传递的headers读取用户信息
  if (!token) {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    const userEmail = request.headers.get('x-user-email');

    if (userId && userRole && userEmail) {
      console.log('[getAuthUser] 从middleware headers读取用户信息:', { userId, userEmail, userRole });
      // middleware已经验证过，直接返回payload
      return {
        userId,
        role: userRole,
        email: userEmail,
      };
    }

    console.log('[getAuthUser] 未找到token，所有来源都为空');
    return null;
  }

  console.log('[getAuthUser] Token来源:', tokenSource, '预览:', token.substring(0, 30) + '...');

  // 4. 验证token
  const verificationResult = verifyToken(token);

  console.log('[getAuthUser] Token验证结果:', {
    valid: verificationResult.valid,
    hasPayload: !!verificationResult.payload,
    error: verificationResult.error,
  });

  if (!verificationResult.valid || !verificationResult.payload) {
    return null;
  }

  return verificationResult.payload;
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
