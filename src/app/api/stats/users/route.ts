/**
 * GET /api/stats/users
 * Dashboard 用户汇总统计：总数、活跃、律师、企业用户及环比增长
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未认证，请先登录' },
      { status: 401 }
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
