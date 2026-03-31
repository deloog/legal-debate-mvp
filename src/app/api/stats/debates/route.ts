/**
 * GET /api/stats/debates
 * Dashboard 辩论汇总统计：总数、已生成、进行中、已完成及平均质量分
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
    const [total, inProgress, completed, generatedRounds, qualityAgg] =
      await prisma.$transaction([
        // 总辩论数（含草稿）
        prisma.debate.count({ where: { deletedAt: null } }),
        // 进行中
        prisma.debate.count({
          where: { deletedAt: null, status: 'IN_PROGRESS' },
        }),
        // 已完成
        prisma.debate.count({
          where: { deletedAt: null, status: 'COMPLETED' },
        }),
        // "已生成"：有至少一个已完成轮次的辩论数
        prisma.debate.count({
          where: {
            deletedAt: null,
            rounds: { some: { status: 'COMPLETED' } },
          },
        }),
        // 论点综合质量分的平均值
        prisma.argument.aggregate({
          _avg: { overallScore: true },
        }),
      ]);

    const avgQuality =
      Math.round((qualityAgg._avg.overallScore ?? 0) * 100) / 100;

    return NextResponse.json({
      success: true,
      message: '获取辩论统计成功',
      data: {
        total,
        generated: generatedRounds,
        inProgress,
        completed,
        avgQuality,
        avgRounds: 0,
        trend: [],
      },
    });
  } catch (error) {
    logger.error('获取辩论统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取辩论统计失败' },
      { status: 500 }
    );
  }
}
