import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';

/**
 * 从请求 Authorization 头中解析 JWT，返回 userId 或 null
 * 使用与 legal-analysis/applicability 路由相同的 JWT 验证模式
 */
export function resolveContractUserId(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader ?? '');
  const result = verifyToken(token ?? '');
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
