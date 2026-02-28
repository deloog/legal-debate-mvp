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

/**
 * GET /api/v1/knowledge-graph/snapshots
 * 获取快照列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = QuerySchema.parse({
      version: searchParams.get('version'),
      status: searchParams.get('status'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
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
    console.error('获取快照列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取快照列表失败' },
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
    const body = await request.json();
    const input = CreateSnapshotSchema.parse(body);

    const userId = request.headers.get('x-user-id') ?? undefined;
    const snapshot = await snapshotService.createSnapshot(input, userId);

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '参数验证失败', details: error.format() },
        { status: 400 }
      );
    }

    console.error('创建快照失败:', error);
    return NextResponse.json(
      { success: false, error: '创建快照失败' },
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
    const { searchParams } = new URL(request.url);
    const retentionDays = searchParams.get('retentionDays');
    const days = retentionDays ? parseInt(retentionDays, 10) : undefined;

    const deletedCount = await snapshotService.cleanupOldSnapshots(days);

    return NextResponse.json({
      success: true,
      data: { deletedCount },
    });
  } catch (error) {
    console.error('清理过期快照失败:', error);
    return NextResponse.json(
      { success: false, error: '清理过期快照失败' },
      { status: 500 }
    );
  }
}
