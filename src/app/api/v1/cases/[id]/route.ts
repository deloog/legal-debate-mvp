import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { validatePathParam } from '@/app/api/lib/validation/validator';
import { uuidSchema } from '@/app/api/lib/validation/schemas';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  createPermissionErrorResponse,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { canAccessSharedCase } from '@/lib/case/share-permission-validator';
import { CasePermission } from '@/types/case-collaboration';

async function checkCaseAccess(
  userId: string,
  caseId: string,
  permission: CasePermission
): Promise<{ allowed: boolean; reason?: string }> {
  const ownership = await checkResourceOwnership(
    userId,
    caseId,
    ResourceType.CASE
  );
  if (ownership.hasPermission) {
    return { allowed: true };
  }

  const result = await canAccessSharedCase(userId, caseId, permission);
  return {
    allowed: result.hasAccess,
    reason: result.reason,
  };
}

/**
 * GET /api/v1/cases/[id]
 * 获取单个案件详情
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    // Next.js 15中params是Promise，需要await
    const { id } = await params;

    // 验证路径参数
    const validatedId = validatePathParam(id, uuidSchema);

    // 获取认证用户
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    // 调用实际的数据库查询
    const caseItem = await prisma.case.findFirst({
      where: { id: validatedId, deletedAt: null },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        debates: {
          where: { deletedAt: null },
          include: {
            rounds: {
              orderBy: { roundNumber: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!caseItem) {
      const { NotFoundError } = await import('@/app/api/lib/errors/api-error');
      throw new NotFoundError('Case');
    }

    // 检查案件访问权限（所有者 / 案件成员 / 共享团队成员）
    const permissionResult = await checkCaseAccess(
      authUser.userId,
      validatedId,
      CasePermission.VIEW_CASE
    );

    if (!permissionResult.allowed) {
      return createPermissionErrorResponse(
        permissionResult.reason ?? '您无权访问此案件'
      );
    }

    return createSuccessResponse(caseItem);
  }
);

/**
 * PUT /api/v1/cases/[id]
 * 更新案件信息
 */
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    // Next.js 15中params是Promise，需要await
    const { id } = await params;

    // 验证路径参数
    const validatedId = validatePathParam(id, uuidSchema);

    // 获取认证用户
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    // 检查案件编辑权限
    const permissionResult = await checkCaseAccess(
      authUser.userId,
      validatedId,
      CasePermission.EDIT_CASE
    );

    if (!permissionResult.allowed) {
      return createPermissionErrorResponse(
        permissionResult.reason ?? '您无权修改此案件'
      );
    }

    // 验证请求体
    const { updateCaseSchema } =
      await import('@/app/api/lib/validation/schemas');
    const { validateRequestBody } =
      await import('@/app/api/lib/validation/core');

    const validatedData = await validateRequestBody(request, updateCaseSchema);

    // 转换类型枚举值
    const typeMap: Record<
      string,
      | 'CIVIL'
      | 'CRIMINAL'
      | 'ADMINISTRATIVE'
      | 'COMMERCIAL'
      | 'LABOR'
      | 'INTELLECTUAL'
      | 'OTHER'
    > = {
      civil: 'CIVIL',
      criminal: 'CRIMINAL',
      administrative: 'ADMINISTRATIVE',
      commercial: 'COMMERCIAL',
      labor: 'LABOR',
      intellectual: 'INTELLECTUAL',
      other: 'OTHER',
    };

    const statusMap: Record<
      string,
      'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
    > = {
      draft: 'DRAFT',
      active: 'ACTIVE',
      completed: 'COMPLETED',
      archived: 'ARCHIVED',
    };

    // 构建更新数据对象，只包含提供的字段
    const updateData: Record<string, unknown> = {};

    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    if (validatedData.type !== undefined) {
      updateData.type = typeMap[validatedData.type];
    }
    if (validatedData.status !== undefined) {
      updateData.status = statusMap[validatedData.status];
    }
    if (validatedData.amount !== undefined) {
      updateData.amount = new Prisma.Decimal(validatedData.amount);
    }
    if (validatedData.caseNumber !== undefined) {
      updateData.caseNumber = validatedData.caseNumber;
    }
    if (validatedData.cause !== undefined) {
      updateData.cause = validatedData.cause;
    }
    if (validatedData.court !== undefined) {
      updateData.court = validatedData.court;
    }
    if (validatedData.plaintiffName !== undefined) {
      updateData.plaintiffName = validatedData.plaintiffName;
    }
    if (validatedData.defendantName !== undefined) {
      updateData.defendantName = validatedData.defendantName;
    }
    if (validatedData.metadata !== undefined) {
      updateData.metadata = validatedData.metadata;
    }

    // 如果没有任何更新字段，返回错误
    if (Object.keys(updateData).length === 0) {
      const { ValidationError } =
        await import('@/app/api/lib/errors/api-error');
      throw new ValidationError(
        'At least one field must be provided for update'
      );
    }

    // 检查case是否存在
    const existingCase = await prisma.case.findUnique({
      where: { id: validatedId },
    });

    if (!existingCase) {
      const { NotFoundError } = await import('@/app/api/lib/errors/api-error');
      throw new NotFoundError('Case');
    }

    // 状态机：校验状态转换合法性
    if (updateData.status !== undefined) {
      const currentStatus = existingCase.status as string;
      const newStatus = updateData.status as string;
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        DRAFT: ['ACTIVE', 'ARCHIVED'],
        ACTIVE: ['COMPLETED', 'ARCHIVED', 'DRAFT'],
        COMPLETED: ['ARCHIVED'],
        ARCHIVED: [], // 归档为终态，不允许任何转换
      };
      const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(newStatus)) {
        const { ValidationError } =
          await import('@/app/api/lib/errors/api-error');
        throw new ValidationError(
          `不允许的状态转换：${currentStatus} → ${newStatus}`
        );
      }
    }

    // 自动更新updatedAt时间戳
    updateData.updatedAt = new Date();

    // 调用实际的数据库操作
    const updatedCase = await prisma.case.update({
      where: { id: validatedId },
      data: updateData,
    });

    return createSuccessResponse(updatedCase);
  }
);

/**
 * DELETE /api/v1/cases/[id]
 * 删除案件（软删除）
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    // Next.js 15中params是Promise，需要await
    const { id } = await params;

    // 验证路径参数
    const validatedId = validatePathParam(id, uuidSchema);

    // 获取认证用户
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    // 检查案件删除权限
    const permissionResult = await checkCaseAccess(
      authUser.userId,
      validatedId,
      CasePermission.DELETE_CASE
    );

    if (!permissionResult.allowed) {
      return createPermissionErrorResponse(
        permissionResult.reason ?? '您无权删除此案件'
      );
    }

    // 检查case是否存在
    const existingCase = await prisma.case.findUnique({
      where: { id: validatedId },
    });

    if (!existingCase) {
      const { NotFoundError } = await import('@/app/api/lib/errors/api-error');
      throw new NotFoundError('Case');
    }

    // 调用实际的数据库操作（软删除）
    await prisma.case.update({
      where: { id: validatedId },
      data: {
        deletedAt: new Date(),
      },
    });

    return new NextResponse(null, { status: 204 });
  }
);

/**
 * OPTIONS /api/v1/cases/[id]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
