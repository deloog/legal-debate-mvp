/**
 * 法条审核API - 管理员专用
 * 支持审核通过/拒绝操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { LAW_PERMISSIONS } from '@/types/permission';
import { LawStatus } from '@prisma/client';
import {
  successResponse,
  unauthorizedResponse,
  badRequestResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-response';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 法条审核请求
 */
interface LawArticleReviewRequest {
  status: 'APPROVED' | 'REJECTED';
  reviewNotes?: string;
}

/**
 * 法条审核响应
 */
interface LawArticleReviewResponse {
  id: string;
  lawName: string;
  articleNumber: string;
  status: string;
  reviewedBy: string;
  reviewedAt: Date;
  reviewNotes?: string;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证审核状态
 */
function isValidReviewStatus(
  status: string
): status is 'APPROVED' | 'REJECTED' {
  const validStatuses = ['APPROVED', 'REJECTED'];
  return validStatuses.includes(status);
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * POST /api/admin/law-articles/[id]/review
 * 审核法条（管理员权限）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(
    request,
    LAW_PERMISSIONS.UPDATE
  );
  if (permissionError) {
    return permissionError;
  }

  try {
    // 获取法条ID
    const { id } = await params;

    // 验证法条是否存在
    const article = await prisma.lawArticle.findUnique({
      where: { id },
    });

    if (!article) {
      return notFoundResponse('未找到指定的法条');
    }

    // 解析请求体
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return badRequestResponse('请提供有效的JSON数据');
    }

    const reviewData = body as LawArticleReviewRequest;

    // 验证审核状态
    if (!reviewData.status || !isValidReviewStatus(reviewData.status)) {
      return badRequestResponse('status字段必须为APPROVED或REJECTED');
    }

    // 更新法条状态
    const updatedArticle = await prisma.lawArticle.update({
      where: { id },
      data: {
        status:
          reviewData.status === 'APPROVED' ? LawStatus.VALID : LawStatus.DRAFT,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        status: true,
      },
    });

    const response: LawArticleReviewResponse = {
      id: updatedArticle.id,
      lawName: updatedArticle.lawName,
      articleNumber: updatedArticle.articleNumber,
      status: updatedArticle.status,
      reviewedBy: user.userId,
      reviewedAt: new Date(),
      reviewNotes: reviewData.reviewNotes,
    };

    return successResponse(response, '审核法条成功');
  } catch (error) {
    console.error('审核法条失败:', error);
    return serverErrorResponse('审核法条失败');
  }
}
