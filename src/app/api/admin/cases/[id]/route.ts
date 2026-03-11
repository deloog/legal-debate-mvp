/**
 * 案件管理API - 单个案件操作（管理员专用）
 * DELETE /api/admin/cases/[id] - 删除案件（软删除）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/api-response';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/admin/cases/[id]
 * 删除案件（软删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'case:delete');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { id } = await params;

    // 检查案件是否存在
    const existingCase = await prisma.case.findUnique({
      where: { id },
    });

    if (!existingCase) {
      return notFoundResponse('案件不存在');
    }

    // 软删除案件
    await prisma.case.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return successResponse(undefined, '案件删除成功');
  } catch (error) {
    logger.error('删除案件失败:', error);
    return serverErrorResponse('删除案件失败');
  }
}
