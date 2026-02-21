/**
 * GET /api/stats/performance
 * Dashboard 性能汇总统计：平均响应时间、错误率、系统可用性
 * 数据来源：ai_interactions 表（最近 30 天）
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
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [totalAgg, failedCount] = await prisma.$transaction([
      // 最近 30 天 AI 交互的总数及平均响应时间
      prisma.aIInteraction.aggregate({
        where: { createdAt: { gte: since } },
        _count: { id: true },
        _avg: { duration: true },
      }),
      // 最近 30 天失败的交互数
      prisma.aIInteraction.count({
        where: { createdAt: { gte: since }, success: false },
      }),
    ]);

    const totalRequests = totalAgg._count.id ?? 0;
    const avgResponseTime =
      Math.round((totalAgg._avg.duration ?? 0) * 100) / 100;
    const errorRate =
      totalRequests > 0
        ? Math.round((failedCount / totalRequests) * 10000) / 100
        : 0;
    // 可用性 = 100% - 错误率（简化计算）
    const uptime = Math.round((100 - errorRate) * 100) / 100;

    return NextResponse.json({
      success: true,
      message: '获取性能统计成功',
      data: { avgResponseTime, errorRate, uptime },
    });
  } catch (error) {
    logger.error('获取性能统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取性能统计失败' },
      { status: 500 }
    );
  }
}
