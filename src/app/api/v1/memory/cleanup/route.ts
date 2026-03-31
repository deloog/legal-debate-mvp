/**
 * Memory Cleanup API
 * POST /api/v1/memory/cleanup - 批量清理过期记忆
 *
 * 请求体:
 * - type: MemoryType (可选，只清理指定类型的记忆)
 * - memoryIds: string[] (可选，只清理指定ID的记忆)
 * - dryRun: boolean (可选，默认false，true时只返回将要删除的记忆而不实际删除)
 */

import { NextRequest, NextResponse } from 'next/server';
import { MemoryType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 验证 MemoryType
 */
function isValidMemoryType(type: string): type is MemoryType {
  return ['WORKING', 'HOT', 'COLD'].includes(type);
}

/**
 * 清理请求体类型
 */
interface CleanupRequestBody {
  type?: string;
  memoryIds?: string[];
  dryRun?: boolean;
}

/**
 * POST /api/v1/memory/cleanup
 * 清理过期记忆
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. 认证检查
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  // 2. 权限检查（仅管理员）
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });

  if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    // 3. 解析请求体
    let body: CleanupRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: 'Request body must be valid JSON',
        },
        { status: 400 }
      );
    }

    const { type, memoryIds, dryRun = false } = body;

    // 4. 验证参数
    if (type && !isValidMemoryType(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid type',
          details: 'Type must be one of: WORKING, HOT, COLD',
        },
        { status: 400 }
      );
    }

    if (
      memoryIds !== undefined &&
      (!Array.isArray(memoryIds) || memoryIds.length === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'memoryIds cannot be empty',
          details: 'memoryIds must be a non-empty array',
        },
        { status: 400 }
      );
    }

    // 5. 构建查询条件
    const where: Prisma.AgentMemoryWhereInput = {};

    // 如果指定了 memoryIds，优先使用
    if (memoryIds && memoryIds.length > 0) {
      where.id = { in: memoryIds };
    } else {
      // 否则清理已过期的记忆
      where.expiresAt = {
        lt: new Date(),
      };

      // 可选：按类型筛选
      if (type) {
        where.memoryType = type as import('@prisma/client').MemoryType;
      }
    }

    // 6. 查询将要删除的记忆
    const memoriesToDelete = await prisma.agentMemory.findMany({
      where,
      select: {
        id: true,
        memoryKey: true,
        memoryType: true,
        expiresAt: true,
      },
    });

    // 7. 如果没有找到记忆，直接返回
    if (memoriesToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          deletedCount: 0,
          wouldDelete: 0,
          mode: memoryIds ? 'selected' : type ? type.toLowerCase() : 'expired',
          dryRun,
          deletedMemories: [],
          executionTime: Date.now() - startTime,
        },
      });
    }

    // 8. dry-run 模式：只返回将要删除的记忆，不实际删除
    if (dryRun) {
      logger.info('Memory cleanup dry-run', {
        userId: authUser.userId,
        wouldDelete: memoriesToDelete.length,
        mode: memoryIds ? 'selected' : type ? type.toLowerCase() : 'expired',
      });

      return NextResponse.json({
        success: true,
        data: {
          deletedCount: 0,
          wouldDelete: memoriesToDelete.length,
          mode: memoryIds ? 'selected' : type ? type.toLowerCase() : 'expired',
          type: type || null,
          dryRun: true,
          deletedMemories: memoriesToDelete.map(m => ({
            id: m.id,
            memoryKey: m.memoryKey,
            memoryType: m.memoryType,
            expiresAt: m.expiresAt,
          })),
          executionTime: Date.now() - startTime,
        },
      });
    }

    // 9. 执行删除
    const deleteResult = await prisma.agentMemory.deleteMany({
      where: {
        id: { in: memoriesToDelete.map(m => m.id) },
      },
    });

    const deletedCount = deleteResult.count;

    logger.info('Memory cleanup completed', {
      userId: authUser.userId,
      deletedCount,
      mode: memoryIds ? 'selected' : type ? type.toLowerCase() : 'expired',
      executionTime: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedCount,
        wouldDelete: deletedCount,
        mode: memoryIds ? 'selected' : type ? type.toLowerCase() : 'expired',
        type: type || null,
        dryRun: false,
        deletedMemories: memoriesToDelete.map(m => ({
          id: m.id,
          memoryKey: m.memoryKey,
          memoryType: m.memoryType,
          expiresAt: m.expiresAt,
        })),
        executionTime: Date.now() - startTime,
      },
    });
  } catch (error) {
    logger.error('Memory cleanup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: authUser.userId,
      executionTime: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: '清理记忆失败',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
