/**
 * 认证中间件
 */

import type { NextRequest } from "next/server";
import { verifyToken, extractTokenFromHeader } from "../auth/jwt";
import type { JwtPayload } from "@/types/auth";

/**
 * 获取认证用户信息
 */
export async function getAuthUser(
  request: NextRequest,
): Promise<JwtPayload | null> {
  const authHeader = request.headers.get("authorization");
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return null;
  }

  const verificationResult = verifyToken(token);

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
  allowedRoles: string[],
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
  return await hasRole(request, ["ADMIN", "SUPER_ADMIN"]);
}

/**
 * 验证用户是否为超级管理员
 */
export async function isSuperAdmin(request: NextRequest): Promise<boolean> {
  return await hasRole(request, ["SUPER_ADMIN"]);
}
