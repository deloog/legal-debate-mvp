import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { uuidSchema } from '@/app/api/lib/validation/schemas';
import { validatePathParam } from '@/app/api/lib/validation/validator';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { createPermissionErrorResponse } from '@/lib/middleware/resource-permission';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canAccessDebateByCasePermission } from '@/lib/debate/access';
import { CasePermission } from '@/types/case-collaboration';

/**
 * 辩论状态更新请求Schema
 */
const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ARCHIVED']),
});

/**
 * 有效的状态转换
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['IN_PROGRESS', 'ARCHIVED'],
  IN_PROGRESS: ['PAUSED', 'COMPLETED'],
  PAUSED: ['IN_PROGRESS', 'COMPLETED'],
  COMPLETED: ['ARCHIVED'], // COMPLETED 是近终态，只允许归档，不允许回退
  ARCHIVED: [], // ARCHIVED 是终态，不允许任何转换
};

/**
 * 创建403响应的辅助函数
 */
function createForbiddenResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message,
        timestamp: new Date().toISOString(),
      },
    },
    { status: 403 }
  );
}

/**
 * PATCH /api/v1/debates/[id]/status
 * 更新辩论状态
 */
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const params = await context.params;
    const debateId = validatePathParam(params.id, uuidSchema);

    // 获取认证用户
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const permissionResult = await canAccessDebateByCasePermission(
      authUser.userId,
      debateId,
      CasePermission.EDIT_DEBATES
    );
    if (!permissionResult.allowed) {
      return createPermissionErrorResponse(
        permissionResult.reason ?? '您无权修改此辩论状态'
      );
    }

    // 验证请求体
    const body = updateStatusSchema.parse(await request.json());
    const newStatus = body.status;

    // 检查辩论是否存在
    const existingDebate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { id: true, status: true },
    });

    if (!existingDebate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '辩论不存在',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    // 验证状态转换是否合法
    const currentStatus = existingDebate.status as string;
    const validNextStatuses = VALID_TRANSITIONS[currentStatus] || [];

    if (!validNextStatuses.includes(newStatus)) {
      return createForbiddenResponse(
        `无法从 ${currentStatus} 状态转换为 ${newStatus}。允许的状态转换：${validNextStatuses.join(', ')}`
      );
    }

    // 更新辩论状态
    const updatedDebate = await prisma.debate.update({
      where: { id: debateId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    return createSuccessResponse({
      debate: updatedDebate,
      previousStatus: currentStatus,
      newStatus,
    });
  }
);

/**
 * GET /api/v1/debates/[id]/status
 * 获取辩论当前状态
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const params = await context.params;
    const debateId = validatePathParam(params.id, uuidSchema);

    // 获取认证用户
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const permissionResult = await canAccessDebateByCasePermission(
      authUser.userId,
      debateId,
      CasePermission.VIEW_DEBATES
    );
    if (!permissionResult.allowed) {
      return createPermissionErrorResponse(
        permissionResult.reason ?? '您无权访问此辩论状态'
      );
    }

    // 获取辩论状态
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!debate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '辩论不存在',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    // 返回可用的状态转换
    const currentStatus = debate.status as string;
    const availableTransitions = VALID_TRANSITIONS[currentStatus] || [];

    return createSuccessResponse({
      ...debate,
      availableTransitions,
    });
  }
);
