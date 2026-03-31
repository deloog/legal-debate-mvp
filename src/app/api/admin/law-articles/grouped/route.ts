/**
 * 法条分组API - 按法律名称分组，返回每部法律的条文数量汇总
 * 用于管理后台法条管理页面的分组折叠展示
 */

import {
  successResponse,
  serverErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { isAdmin } from '@/lib/middleware/permissions';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorizedResponse();
    if (!isAdmin(authUser.role)) {
      return forbiddenResponse();
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() ?? '';
    const lawType = url.searchParams.get('lawType')?.trim() ?? '';
    const status = url.searchParams.get('status')?.trim() ?? '';

    // 构建 where 条件
    const where: Record<string, unknown> = {};
    if (lawType) where.lawType = lawType;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { lawName: { contains: search, mode: 'insensitive' } },
        { fullText: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 按法律名分组统计
    const grouped = await prisma.lawArticle.groupBy({
      by: ['lawName', 'lawType', 'category', 'status'],
      where,
      _count: { id: true },
      orderBy: { lawName: 'asc' },
    });

    // 合并同一 lawName 的多个 status/type（取最多条文的那条作为代表）
    const lawMap = new Map<
      string,
      {
        lawName: string;
        lawType: string;
        category: string;
        status: string;
        count: number;
      }
    >();

    for (const row of grouped) {
      const existing = lawMap.get(row.lawName);
      if (!existing || row._count.id > existing.count) {
        lawMap.set(row.lawName, {
          lawName: row.lawName,
          lawType: row.lawType,
          category: row.category,
          status: row.status,
          count: row._count.id,
        });
      } else {
        // 累加同名法律的条文数
        existing.count += row._count.id;
      }
    }

    const laws = Array.from(lawMap.values()).sort(
      (a, b) => b.count - a.count // 按条文数降序
    );

    return successResponse({
      laws,
      total: laws.length,
    });
  } catch (error) {
    logger.error('获取法条分组失败:', error);
    return serverErrorResponse('获取法条分组失败');
  }
}
