/**
 * GET /api/stats/cases
 * Dashboard 案件汇总统计：总数、待处理(DRAFT)、处理中(ACTIVE)、已完成(COMPLETED)及环比增长
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

    const [total, pending, processing, completed, currentMonth, lastMonth] =
      await prisma.$transaction([
        // 总案件数（排除软删除）
        prisma.case.count({ where: { deletedAt: null } }),
        // 待处理（草稿）
        prisma.case.count({ where: { deletedAt: null, status: 'DRAFT' } }),
        // 处理中（活跃）
        prisma.case.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
        // 已完成
        prisma.case.count({ where: { deletedAt: null, status: 'COMPLETED' } }),
        // 本月新增
        prisma.case.count({
          where: { deletedAt: null, createdAt: { gte: thisMonthStart } },
        }),
        // 上月新增
        prisma.case.count({
          where: {
            deletedAt: null,
            createdAt: { gte: lastMonthStart, lt: thisMonthStart },
          },
        }),
      ]);

    // 环比增长率
    const growth =
      lastMonth > 0
        ? Math.round(((currentMonth - lastMonth) / lastMonth) * 10000) / 100
        : 0;

    return NextResponse.json({
      success: true,
      message: '获取案件统计成功',
      data: { total, pending, processing, completed, growth },
    });
  } catch (error) {
    logger.error('获取案件统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取案件统计失败' },
      { status: 500 }
    );
  }
}
