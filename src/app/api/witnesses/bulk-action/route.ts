import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { WitnessBulkActionResponse } from '@/types/witness';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 批量操作验证模式
const bulkActionSchema = z.object({
  witnessIds: z.array(z.string().min(1)).min(1, '至少需要一个证人ID'),
  action: z.enum(['updateStatus', 'delete']),
  status: z
    .enum(['NEED_CONTACT', 'CONTACTED', 'CONFIRMED', 'DECLINED', 'CANCELLED'])
    .optional(),
  reason: z.string().max(500).optional(),
});

// 批量更新状态验证模式
const bulkUpdateStatusSchema = z.object({
  witnessIds: z.array(z.string().min(1)).min(1),
  status: z.enum([
    'NEED_CONTACT',
    'CONTACTED',
    'CONFIRMED',
    'DECLINED',
    'CANCELLED',
  ]),
  reason: z.string().max(500).optional(),
});

// 批量删除验证模式
const bulkDeleteSchema = z.object({
  witnessIds: z.array(z.string().min(1)).min(1),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/witnesses/bulk-action - 证人批量操作
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const validatedData = bulkActionSchema.parse(body);

  const { witnessIds, action, status, reason } = validatedData;

  // 验证所有证人是否存在且属于当前用户
  const existingWitnesses = await prisma.witness.findMany({
    where: {
      id: { in: witnessIds },
      case: {
        userId: authUser.userId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  const existingIds = new Set(existingWitnesses.map(w => w.id));
  const nonExistentIds = witnessIds.filter(id => !existingIds.has(id));

  if (nonExistentIds.length > 0) {
    return NextResponse.json(
      {
        error: '部分证人不存在或无权限',
        message: `以下证人不存在或您没有权限：${nonExistentIds.join(', ')}`,
      },
      { status: 404 }
    );
  }

  const succeeded: string[] = [];
  const failed: Array<{ witnessId: string; reason: string }> = [];

  if (action === 'updateStatus') {
    // 批量更新状态
    if (!status) {
      return NextResponse.json(
        { error: '缺少状态参数', message: '更新状态操作必须提供status参数' },
        { status: 400 }
      );
    }

    // 验证状态转换是否合法
    for (const witness of existingWitnesses) {
      try {
        await prisma.witness.update({
          where: { id: witness.id },
          data: {
            status,
            metadata: {
              updatedBy: 'bulk-action',
              updatedAt: new Date().toISOString(),
              reason: reason || '',
            },
          },
        });
        succeeded.push(witness.id);
      } catch (error) {
        failed.push({
          witnessId: witness.id,
          reason: `状态更新失败: ${error instanceof Error ? error.message : '未知错误'}`,
        });
      }
    }
  } else if (action === 'delete') {
    // 批量删除
    for (const witness of existingWitnesses) {
      try {
        await prisma.witness.delete({
          where: { id: witness.id },
        });
        succeeded.push(witness.id);
      } catch (error) {
        failed.push({
          witnessId: witness.id,
          reason: `删除失败: ${error instanceof Error ? error.message : '未知错误'}`,
        });
      }
    }
  }

  const response: WitnessBulkActionResponse = {
    success: failed.length === 0,
    succeeded,
    failed,
    message:
      failed.length === 0
        ? `成功处理 ${succeeded.length} 个证人`
        : `成功处理 ${succeeded.length} 个证人，${failed.length} 个失败`,
  };

  return createSuccessResponse(response);
});

/**
 * POST /api/witnesses/bulk-action/update-status - 批量更新状态
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const validatedData = bulkUpdateStatusSchema.parse(body);

  const { witnessIds, status, reason } = validatedData;

  // 验证所有证人是否存在且属于当前用户
  const existingWitnesses = await prisma.witness.findMany({
    where: {
      id: { in: witnessIds },
      case: {
        userId: authUser.userId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  const existingIds = new Set(existingWitnesses.map(w => w.id));
  const nonExistentIds = witnessIds.filter(id => !existingIds.has(id));

  if (nonExistentIds.length > 0) {
    return NextResponse.json(
      {
        error: '部分证人不存在或无权限',
        message: `以下证人不存在或您没有权限：${nonExistentIds.join(', ')}`,
      },
      { status: 404 }
    );
  }

  const succeeded: string[] = [];
  const failed: Array<{ witnessId: string; reason: string }> = [];

  for (const witness of existingWitnesses) {
    try {
      await prisma.witness.update({
        where: { id: witness.id },
        data: {
          status,
          metadata: {
            updatedBy: 'bulk-action',
            updatedAt: new Date().toISOString(),
            reason: reason || '',
          },
        },
      });
      succeeded.push(witness.id);
    } catch (error) {
      failed.push({
        witnessId: witness.id,
        reason: `状态更新失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    }
  }

  const response: WitnessBulkActionResponse = {
    success: failed.length === 0,
    succeeded,
    failed,
    message:
      failed.length === 0
        ? `成功更新 ${succeeded.length} 个证人的状态`
        : `成功更新 ${succeeded.length} 个证人，${failed.length} 个失败`,
  };

  return createSuccessResponse(response);
});

/**
 * DELETE /api/witnesses/bulk-action - 批量删除证人
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const validatedData = bulkDeleteSchema.parse(body);

  const { witnessIds } = validatedData;

  // 验证所有证人是否存在且属于当前用户
  const existingWitnesses = await prisma.witness.findMany({
    where: {
      id: { in: witnessIds },
      case: {
        userId: authUser.userId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  const existingIds = new Set(existingWitnesses.map(w => w.id));
  const nonExistentIds = witnessIds.filter(id => !existingIds.has(id));

  if (nonExistentIds.length > 0) {
    return NextResponse.json(
      {
        error: '部分证人不存在或无权限',
        message: `以下证人不存在或您没有权限：${nonExistentIds.join(', ')}`,
      },
      { status: 404 }
    );
  }

  const succeeded: string[] = [];
  const failed: Array<{ witnessId: string; reason: string }> = [];

  for (const witness of existingWitnesses) {
    // 不允许删除已确认的证人
    if (witness.status === 'CONFIRMED') {
      failed.push({
        witnessId: witness.id,
        reason: '不能删除已确认出庭的证人',
      });
      continue;
    }

    try {
      await prisma.witness.delete({
        where: { id: witness.id },
      });
      succeeded.push(witness.id);
    } catch (error) {
      failed.push({
        witnessId: witness.id,
        reason: `删除失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    }
  }

  const response: WitnessBulkActionResponse = {
    success: failed.length === 0,
    succeeded,
    failed,
    message:
      failed.length === 0
        ? `成功删除 ${succeeded.length} 个证人`
        : `成功删除 ${succeeded.length} 个证人，${failed.length} 个失败`,
  };

  return createSuccessResponse(response);
});

/**
 * OPTIONS /api/witnesses/bulk-action - CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
