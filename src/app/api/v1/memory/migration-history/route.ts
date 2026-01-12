/**
 * 记忆迁移历史API
 * GET /api/v1/memory/migration-history - 获取迁移历史记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/v1/memory/migration-history
 * 获取迁移历史记录
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '20'))
    );
    const actionType = searchParams.get('actionType');
    const status = searchParams.get('status');
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: Record<string, unknown> = {
      agentName: 'MemoryAgent',
      actionType: {
        in: ['MIGRATE_WORKING_TO_HOT', 'MIGRATE_HOT_TO_COLD'],
      },
    };

    if (actionType && actionType !== 'all') {
      where.actionType = actionType;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    // 查询迁移历史
    const [actions, total] = await Promise.all([
      prisma.agentAction.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          actionType: true,
          actionName: true,
          status: true,
          executionTime: true,
          createdAt: true,
          parameters: true,
          metadata: true,
        },
      }),
      prisma.agentAction.count({ where }),
    ]);

    // 格式化返回数据
    const formattedActions = actions.map(action => ({
      id: action.id,
      actionType: action.actionType,
      actionName: action.actionName,
      status: action.status,
      executionTime: action.executionTime,
      createdAt: action.createdAt,
      memoryId: (action.parameters as Record<string, unknown>)
        ?.memoryId as string,
      memoryKey: (action.parameters as Record<string, unknown>)
        ?.memoryKey as string,
      originalType: (action.parameters as Record<string, unknown>)
        ?.originalType as string,
      targetType: (action.parameters as Record<string, unknown>)
        ?.targetType as string,
      importance: (action.parameters as Record<string, unknown>)
        ?.importance as number,
      accessCount: (action.parameters as Record<string, unknown>)
        ?.accessCount as number,
      compressionRatio: (action.parameters as Record<string, unknown>)
        ?.compressionRatio as number | undefined,
      error: (action.parameters as Record<string, unknown>)?.error as
        | string
        | undefined,
      memoryType: (action.metadata as Record<string, unknown>)
        ?.memoryType as string,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: formattedActions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching migration history:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取迁移历史失败',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
