/**
 * 知识图谱快照API
 *
 * 提供版本控制的REST API接口：
 * - GET /api/v1/knowledge-graph/snapshots - 获取快照列表
 * - POST /api/v1/knowledge-graph/snapshots - 创建快照
 * - GET /api/v1/knowledge-graph/snapshots/latest - 获取最新快照
 * - GET /api/v1/knowledge-graph/snapshots/[snapshotId] - 获取快照详情
 * - GET /api/v1/knowledge-graph/snapshots/[snapshotId]/compare - 比较快照
 * - DELETE /api/v1/knowledge-graph/snapshots - 清理过期快照
 */
import { NextRequest, NextResponse } from 'next/server';
import { snapshotService } from '@/lib/knowledge-graph/version-control';
import { SnapshotVersion } from '@/lib/knowledge-graph/version-control/types';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';

// 创建快照输入验证
const CreateSnapshotSchema = z.object({
  version: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL']),
  includeFullData: z.boolean().optional(),
  includeChanges: z.boolean().optional(),
  description: z.string().optional(),
});

// 查询参数验证
const QuerySchema = z.object({
  version: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL']).optional(),
  status: z.enum(['COMPLETED', 'IN_PROGRESS', 'FAILED']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 20)),
});

function optionalSearchParam(value: string | null): string | undefined {
  return value ?? undefined;
}

/**
 * GET /api/v1/knowledge-graph/snapshots
 * 获取快照列表
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.VIEW_STATS,
      KnowledgeGraphResource.GRAPH
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: '权限不足' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = QuerySchema.parse({
      version: optionalSearchParam(searchParams.get('version')),
      status: optionalSearchParam(searchParams.get('status')),
      startDate: optionalSearchParam(searchParams.get('startDate')),
      endDate: optionalSearchParam(searchParams.get('endDate')),
      page: optionalSearchParam(searchParams.get('page')),
      pageSize: optionalSearchParam(searchParams.get('pageSize')),
    });

    const result = await snapshotService.getSnapshots({
      version: queryParams.version as SnapshotVersion | undefined,
      status: queryParams.status as
        | 'COMPLETED'
        | 'IN_PROGRESS'
        | 'FAILED'
        | undefined,
      startDate: queryParams.startDate
        ? new Date(queryParams.startDate)
        : undefined,
      endDate: queryParams.endDate ? new Date(queryParams.endDate) : undefined,
      page: queryParams.page,
      pageSize: queryParams.pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result.snapshots,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            details: error.format(),
          },
        },
        { status: 400 }
      );
    }

    logger.error('获取快照列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取快照列表失败',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/knowledge-graph/snapshots
 * 创建新快照
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    // 权限检查 - 创建快照需要管理权限
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.MANAGE_RELATIONS,
      KnowledgeGraphResource.GRAPH
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '需要管理员权限' },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const input = CreateSnapshotSchema.parse(body);

    const snapshot = await snapshotService.createSnapshot(
      input,
      authUser.userId
    );

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: authUser.userId,
      action: KnowledgeGraphAction.MANAGE_RELATIONS,
      resource: KnowledgeGraphResource.GRAPH,
      resourceId: snapshot.id,
      description: `创建知识图谱快照: ${snapshot.versionLabel}`,
      metadata: {
        version: input.version,
        includeFullData: input.includeFullData,
        includeChanges: input.includeChanges,
      },
    });

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            details: error.format(),
          },
        },
        { status: 400 }
      );
    }

    logger.error('创建快照失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '创建快照失败' },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/knowledge-graph/snapshots
 * 清理过期快照
 */
export async function DELETE(request: NextRequest) {
  try {
    // 认证检查
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    // 权限检查 - 清理快照需要管理权限
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.MANAGE_RELATIONS,
      KnowledgeGraphResource.GRAPH
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '需要管理员权限' },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const retentionDays = searchParams.get('retentionDays');
    const days = retentionDays ? parseInt(retentionDays, 10) : undefined;

    // 验证保留天数
    if (days !== undefined && (isNaN(days) || days < 1 || days > 3650)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'retentionDays必须在1-3650之间',
          },
        },
        { status: 400 }
      );
    }

    const deletedCount = await snapshotService.cleanupOldSnapshots(days);

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: authUser.userId,
      action: KnowledgeGraphAction.MANAGE_RELATIONS,
      resource: KnowledgeGraphResource.GRAPH,
      description: `清理过期快照: ${deletedCount}个`,
      metadata: {
        retentionDays: days,
        deletedCount,
      },
    });

    return NextResponse.json({
      success: true,
      data: { deletedCount },
    });
  } catch (error) {
    logger.error('清理过期快照失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '清理过期快照失败' },
      },
      { status: 500 }
    );
  }
}
