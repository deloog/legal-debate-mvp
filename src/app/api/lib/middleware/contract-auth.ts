import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';

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

export interface ContractAccessResult {
  exists: boolean;
  isAdmin: boolean;
  isLawyer: boolean;
  isClient: boolean;
  canRead: boolean;
  canManage: boolean;
}

/**
 * 校验当前用户对合同的访问级别。
 * - `canRead`: 管理员 / 合同归属律师 / 关联案件委托方
 * - `canManage`: 管理员 / 合同归属律师
 */
export async function getContractAccess(
  contractId: string,
  userId: string
): Promise<ContractAccessResult> {
  const [contract, user] = await Promise.all([
    prisma.contract.findUnique({
      where: { id: contractId },
      select: { lawyerId: true, case: { select: { userId: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  ]);

  if (!contract) {
    return {
      exists: false,
      isAdmin: false,
      isLawyer: false,
      isClient: false,
      canRead: false,
      canManage: false,
    };
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isLawyer = contract.lawyerId === userId;
  const isClient = contract.case?.userId === userId;

  return {
    exists: true,
    isAdmin,
    isLawyer,
    isClient,
    canRead: isAdmin || isLawyer || isClient,
    canManage: isAdmin || isLawyer,
  };
}
