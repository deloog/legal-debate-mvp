/**
 * 用户搜索API - 用于案件团队成员选择
 * 根据姓名或邮箱搜索用户
 */

import {
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { SearchResponse } from '@/types/admin-user';
import { UserStatus } from '@/types/auth';
import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 解析搜索查询
 */
function parseSearchQuery(request: NextRequest): string {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  return query ? query.trim() : '';
}

/**
 * 构建搜索条件
 */
function buildSearchQuery(searchTerm: string) {
  if (!searchTerm) {
    return {};
  }

  return {
    OR: [
      { name: { contains: searchTerm, mode: 'insensitive' as const } },
      { email: { contains: searchTerm, mode: 'insensitive' as const } },
      { username: { contains: searchTerm, mode: 'insensitive' as const } },
    ],
    status: UserStatus.ACTIVE,
  };
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/users/search
 * 根据姓名或邮箱搜索用户
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    // 解析搜索查询
    const searchTerm = parseSearchQuery(request);

    // 搜索词不能为空
    if (!searchTerm) {
      return successResponse({ users: [] }, '搜索成功');
    }

    // 构建查询条件
    const where = buildSearchQuery(searchTerm);

    // 查询用户
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        status: true,
      },
      orderBy: { name: 'asc', email: 'asc' },
      take: 20, // 限制返回结果数量
    });

    // 构建响应数据
    const responseData: SearchResponse = {
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        username: u.username,
        name: u.name,
        role: u.role,
        status: u.status,
      })),
      total: users.length,
    };

    return successResponse(responseData, '搜索成功');
  } catch (error) {
    console.error('搜索用户失败:', error);
    return serverErrorResponse('搜索用户失败');
  }
}
