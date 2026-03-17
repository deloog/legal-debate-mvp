import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';

/**
 * 从请求中解析 JWT，返回 userId 或 null
 * 同时支持 Authorization header（API 调用）和 httpOnly Cookie（浏览器请求）
 */
export function resolveContractUserId(request: NextRequest): string | null {
  // 1. 优先从 Authorization header 读取
  const authHeader = request.headers.get('authorization');
  let token = extractTokenFromHeader(authHeader ?? '');

  // 2. 回退到 cookie（浏览器请求）
  if (!token) {
    token = request.cookies.get('accessToken')?.value || null;
  }

  if (!token) return null;

  const result = verifyToken(token);
  return result.valid && result.payload ? result.payload.userId : null;
}

/** 统一 401 响应 */
export function unauthorizedResponse(message = '请先登录'): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message } },
    { status: 401 }
  );
}

/** 统一 403 响应 */
export function forbiddenResponse(message = '无权操作此合同'): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message } },
    { status: 403 }
  );
}
