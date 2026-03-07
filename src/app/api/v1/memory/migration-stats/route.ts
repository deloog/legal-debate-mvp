/**
 * 记忆迁移统计API
 * GET /api/v1/memory/migration-stats - 获取迁移统计数据
 */

import { NextResponse } from 'next/server';
import { PrismaClient, ActionType } from '@prisma/client';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

/**
 * GET /api/v1/memory/migration-stats
 * 获取迁移统计数据
 */
export async function GET() {
  try {
    // 查询最近7天的迁移统计
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 查询Working→Hot迁移统计
    const workingToHotActions = await prisma.agentAction.findMany({
      where: {
        agentName: 'MemoryAgent',
        actionType: ActionType.MIGRATE_WORKING_TO_HOT,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    const workingToHotCompleted = workingToHotActions.filter(
      action => action.status === 'COMPLETED'
    ).length;
    const workingToHotFailed = workingToHotActions.filter(
      action => action.status === 'FAILED'
    ).length;
    const workingToHotTotalTime = workingToHotActions.reduce(
      (sum, action) => sum + (action.executionTime || 0),
      0
    );
    const workingToHotAvgTime =
      workingToHotCompleted > 0
        ? Math.round(workingToHotTotalTime / workingToHotCompleted)
        : 0;

    // 查询Hot→Cold迁移统计
    const hotToColdActions = await prisma.agentAction.findMany({
      where: {
        agentName: 'MemoryAgent',
        actionType: ActionType.MIGRATE_HOT_TO_COLD,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    const hotToColdCompleted = hotToColdActions.filter(
      action => action.status === 'COMPLETED'
    ).length;
    const hotToColdFailed = hotToColdActions.filter(
      action => action.status === 'FAILED'
    ).length;
    const hotToColdTotalTime = hotToColdActions.reduce(
      (sum, action) => sum + (action.executionTime || 0),
      0
    );
    const hotToColdAvgTime =
      hotToColdCompleted > 0
        ? Math.round(hotToColdTotalTime / hotToColdCompleted)
        : 0;

    // 计算压缩比统计
    const compressionRatios = hotToColdActions
      .filter(action => action.status === 'COMPLETED')
      .map(action => {
        const ratio = (action.parameters as Record<string, unknown>)
          ?.compressionRatio as number;
        return ratio && ratio > 0 ? ratio : null;
      })
      .filter((ratio): ratio is number => ratio !== null);

    const avgCompressionRatio =
      compressionRatios.length > 0
        ? compressionRatios.reduce((sum, ratio) => sum + ratio, 0) /
          compressionRatios.length
        : 0;

    const maxCompressionRatio =
      compressionRatios.length > 0 ? Math.max(...compressionRatios) : 0;

    const minCompressionRatio =
      compressionRatios.length > 0 ? Math.min(...compressionRatios) : 0;

    // 查询最近迁移记录（最近10条）
    const recentMigrations = await prisma.agentAction.findMany({
      where: {
        agentName: 'MemoryAgent',
        actionType: {
          in: [
            ActionType.MIGRATE_WORKING_TO_HOT,
            ActionType.MIGRATE_HOT_TO_COLD,
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        actionType: true,
        actionName: true,
        status: true,
        executionTime: true,
        createdAt: true,
        parameters: true,
      },
    });

    const formattedRecentMigrations = recentMigrations.map(action => ({
      id: action.id,
      actionType: action.actionType,
      actionName: action.actionName,
      status: action.status,
      executionTime: action.executionTime,
      createdAt: action.createdAt,
      memoryId: (action.parameters as Record<string, unknown>)
        ?.memoryId as string,
      compressionRatio: (action.parameters as Record<string, unknown>)
        ?.compressionRatio as number | undefined,
    }));

    // 计算每日迁移量趋势
    const dailyTrend: Record<string, number> = {};
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayStart = new Date(dateStr + 'T00:00:00Z');
      const dayEnd = new Date(dateStr + 'T23:59:59Z');

      const dayCount = await prisma.agentAction.count({
        where: {
          agentName: 'MemoryAgent',
          actionType: {
            in: [
              ActionType.MIGRATE_WORKING_TO_HOT,
              ActionType.MIGRATE_HOT_TO_COLD,
            ],
          },
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      dailyTrend[dateStr] = dayCount;
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          workingToHot: {
            completed: workingToHotCompleted,
            failed: workingToHotFailed,
            avgExecutionTime: workingToHotAvgTime,
            totalExecutionTime: workingToHotTotalTime,
          },
          hotToCold: {
            completed: hotToColdCompleted,
            failed: hotToColdFailed,
            avgExecutionTime: hotToColdAvgTime,
            totalExecutionTime: hotToColdTotalTime,
          },
          compression: {
            avgRatio: parseFloat(avgCompressionRatio.toFixed(2)),
            maxRatio: parseFloat(maxCompressionRatio.toFixed(2)),
            minRatio: parseFloat(minCompressionRatio.toFixed(2)),
          },
        },
        recentMigrations: formattedRecentMigrations,
        dailyTrend,
        period: 'last7days',
      },
    });
  } catch (error) {
    logger.error('Error fetching migration stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取迁移统计失败',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
