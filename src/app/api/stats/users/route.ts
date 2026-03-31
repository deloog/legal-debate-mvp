/**
 * GET /api/stats/users
 * Dashboard 用户汇总统计：总数、活跃、律师、企业用户及环比增长
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未认证，请先登录' },
      { status: 401 }
    );
  }

  // 用户汇总统计为管理员 Dashboard，需要管理员权限
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: '无权限访问' },
      { status: 403 }
    );
  }

  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [total, active, lawyers, enterprises, currentMonth, lastMonth] =
      await prisma.$transaction([
        // 总用户数（排除软删除）
        prisma.user.count({ where: { deletedAt: null } }),
        // 活跃用户
        prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
        // 律师用户
        prisma.user.count({ where: { deletedAt: null, role: 'LAWYER' } }),
        // 企业用户
        prisma.user.count({ where: { deletedAt: null, role: 'ENTERPRISE' } }),
        // 本月新增
        prisma.user.count({
          where: { deletedAt: null, createdAt: { gte: thisMonthStart } },
        }),
        // 上月新增
        prisma.user.count({
          where: {
            deletedAt: null,
            createdAt: { gte: lastMonthStart, lt: thisMonthStart },
          },
        }),
      ]);

    // 环比增长率（百分比，保留两位小数）
    const growth =
      lastMonth > 0
        ? Math.round(((currentMonth - lastMonth) / lastMonth) * 10000) / 100
        : 0;

    return NextResponse.json({
      success: true,
      message: '获取用户统计成功',
      data: { total, active, lawyers, enterprises, growth },
    });
  } catch (error) {
    logger.error('获取用户统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户统计失败' },
      { status: 500 }
    );
  }
}
