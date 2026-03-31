/**
 * Memory Search API
 * GET /api/v1/memory/search - 按关键词搜索记忆
 *
 * 查询参数:
 * - type: MemoryType (WORKING/HOT/COLD)
 * - keyword: 搜索关键词（匹配 memoryKey）
 * - expired: 'true' 只返回已过期的记忆
 * - page: 页码 (默认 1)
 * - pageSize: 每页数量 (默认 20, 最大 100)
 * - sortBy: 排序字段 (默认 'lastAccessedAt')
 * - sortOrder: 排序方向 ('asc' | 'desc', 默认 'desc')
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
 * 构建查询条件
 */
function buildWhereClause(
  type?: string,
  keyword?: string,
  expired?: string
): Prisma.AgentMemoryWhereInput {
  const where: Prisma.AgentMemoryWhereInput = {};

  // 按类型筛选
  if (type && isValidMemoryType(type)) {
    where.memoryType = type;
  }

  // 按关键词搜索 memoryKey
  if (keyword) {
    where.memoryKey = {
      contains: keyword,
      mode: 'insensitive',
    };
  }

  // 只返回已过期的记忆
  if (expired === 'true') {
    where.expiresAt = {
      lt: new Date(),
    };
  }

  return where;
}

/**
 * 构建排序条件
 */
function buildOrderBy(
  sortBy: string,
  sortOrder: string
): Prisma.AgentMemoryOrderByWithRelationInput {
  const validSortFields = [
    'createdAt',
    'updatedAt',
    'lastAccessedAt',
    'importance',
    'accessCount',
    'memoryKey',
  ];

  const field = validSortFields.includes(sortBy) ? sortBy : 'lastAccessedAt';
  const order = sortOrder === 'asc' ? 'asc' : 'desc';

  return { [field]: order };
}

/**
 * GET /api/v1/memory/search
 * 搜索记忆
 */
export async function GET(request: NextRequest) {
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
    // 3. 解析查询参数
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type') || undefined;
    const keyword = searchParams.get('keyword') || undefined;
    const expired = searchParams.get('expired') || undefined;

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
    );

    const sortBy = searchParams.get('sortBy') || 'lastAccessedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // 4. 验证 type 参数
    if (type && !isValidMemoryType(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid memory type',
          details: 'Type must be one of: WORKING, HOT, COLD',
        },
        { status: 400 }
      );
    }

    // 5. 构建查询条件
    const where = buildWhereClause(type, keyword, expired);
    const orderBy = buildOrderBy(sortBy, sortOrder);

    // 6. 并行执行查询和计数
    const [memories, total] = await Promise.all([
      prisma.agentMemory.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          memoryType: true,
          memoryKey: true,
          memoryValue: true,
          importance: true,
          accessCount: true,
          lastAccessedAt: true,
          expiresAt: true,
          compressed: true,
          compressionRatio: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.agentMemory.count({ where }),
    ]);

    // 7. 格式化响应
    const formattedMemories = memories.map(memory => ({
      ...memory,
      memoryValue:
        typeof memory.memoryValue === 'string'
          ? JSON.parse(memory.memoryValue)
          : memory.memoryValue,
    }));

    logger.info('Memory search completed', {
      userId: authUser.userId,
      filters: { type, keyword, expired },
      resultsCount: memories.length,
      total,
    });

    return NextResponse.json({
      success: true,
      data: {
        memories: formattedMemories,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        filters: {
          type,
          keyword,
          expired,
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    logger.error('Memory search failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: authUser.userId,
    });

    return NextResponse.json(
      {
        success: false,
        error: '搜索记忆失败',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
