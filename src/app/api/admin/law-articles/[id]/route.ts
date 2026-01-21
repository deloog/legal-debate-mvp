/**
 * 法条详情和更新API - 管理员专用
 * 支持查询和更新法条详情
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { LAW_PERMISSIONS } from '@/types/permission';
import { LawType, LawCategory, LawStatus } from '@prisma/client';
import { validatePathParam } from '@/app/api/lib/validation/validator';
import { uuidSchema } from '@/app/api/lib/validation/schemas';
import {
  successResponse,
  notFoundResponse,
  unauthorizedResponse,
  serverErrorResponse,
  badRequestResponse,
} from '@/lib/api-response';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 法条更新请求
 */
interface LawArticleUpdateRequest {
  lawName?: string;
  articleNumber?: string;
  fullText?: string;
  lawType?: string;
  category?: string;
  subCategory?: string | null;
  tags?: string[];
  keywords?: string[];
  version?: string;
  effectiveDate?: string;
  expiryDate?: string | null;
  status?: string;
  amendmentHistory?: Record<string, unknown> | null;
  issuingAuthority?: string;
  jurisdiction?: string | null;
  relatedArticles?: string[];
  legalBasis?: string | null;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证法律类型枚举值
 */
function isValidLawType(lawType: string): boolean {
  const validTypes = Object.values(LawType);
  return validTypes.includes(lawType as LawType);
}

/**
 * 验证法律类别枚举值
 */
function isValidCategory(category: string): boolean {
  const validCategories = Object.values(LawCategory);
  return validCategories.includes(category as LawCategory);
}

/**
 * 验证法条状态枚举值
 */
function isValidStatus(status: string): boolean {
  const validStatuses = Object.values(LawStatus);
  return validStatuses.includes(status as LawStatus);
}

/**
 * 构建Prisma更新数据
 */
function buildUpdateData(
  requestData: LawArticleUpdateRequest
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  if (requestData.lawName !== undefined) {
    updateData.lawName = requestData.lawName;
  }

  if (requestData.articleNumber !== undefined) {
    updateData.articleNumber = requestData.articleNumber;
  }

  if (requestData.fullText !== undefined) {
    updateData.fullText = requestData.fullText;
    updateData.searchableText = requestData.fullText;
  }

  if (
    requestData.lawType !== undefined &&
    isValidLawType(requestData.lawType)
  ) {
    updateData.lawType = requestData.lawType as LawType;
  }

  if (
    requestData.category !== undefined &&
    isValidCategory(requestData.category)
  ) {
    updateData.category = requestData.category as LawCategory;
  }

  if (requestData.subCategory !== undefined) {
    updateData.subCategory = requestData.subCategory;
  }

  if (requestData.tags !== undefined) {
    updateData.tags = requestData.tags;
  }

  if (requestData.keywords !== undefined) {
    updateData.keywords = requestData.keywords;
  }

  if (requestData.version !== undefined) {
    updateData.version = requestData.version;
  }

  if (requestData.effectiveDate !== undefined) {
    updateData.effectiveDate = new Date(requestData.effectiveDate);
  }

  if (requestData.expiryDate !== undefined) {
    updateData.expiryDate = requestData.expiryDate
      ? new Date(requestData.expiryDate)
      : null;
  }

  if (requestData.status !== undefined && isValidStatus(requestData.status)) {
    updateData.status = requestData.status as LawStatus;
  }

  if (requestData.amendmentHistory !== undefined) {
    updateData.amendmentHistory = requestData.amendmentHistory;
  }

  if (requestData.issuingAuthority !== undefined) {
    updateData.issuingAuthority = requestData.issuingAuthority;
  }

  if (requestData.jurisdiction !== undefined) {
    updateData.jurisdiction = requestData.jurisdiction;
  }

  if (requestData.relatedArticles !== undefined) {
    updateData.relatedArticles = requestData.relatedArticles;
  }

  if (requestData.legalBasis !== undefined) {
    updateData.legalBasis = requestData.legalBasis;
  }

  return updateData;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/law-articles/[id]
 * 获取法条详情（管理员权限）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(
    request,
    LAW_PERMISSIONS.READ
  );
  if (permissionError) {
    return permissionError;
  }

  try {
    // 获取法条ID
    const { id } = await params;
    const validatedId = validatePathParam(id, uuidSchema);

    // 查询法条详情
    const article = await prisma.lawArticle.findUnique({
      where: { id: validatedId },
      include: {
        parent: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
          },
        },
        children: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            status: true,
          },
        },
      },
    });

    if (!article) {
      return notFoundResponse('法条不存在');
    }

    return successResponse(article, '获取法条详情成功');
  } catch (error) {
    console.error('获取法条详情失败:', error);
    return serverErrorResponse('获取法条详情失败');
  }
}

/**
 * PUT /api/admin/law-articles/[id]
 * 更新法条（管理员权限）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
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
    const validatedId = validatePathParam(id, uuidSchema);

    // 验证法条是否存在
    const existingArticle = await prisma.lawArticle.findUnique({
      where: { id: validatedId },
    });

    if (!existingArticle) {
      return notFoundResponse('法条不存在');
    }

    // 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequestResponse('请求格式错误');
    }

    if (!body || typeof body !== 'object') {
      return badRequestResponse('请求格式错误');
    }

    const updateRequest = body as LawArticleUpdateRequest;

    // 验证法律类型
    if (
      updateRequest.lawType !== undefined &&
      !isValidLawType(updateRequest.lawType)
    ) {
      return badRequestResponse('无效的法律类型');
    }

    // 验证法律类别
    if (
      updateRequest.category !== undefined &&
      !isValidCategory(updateRequest.category)
    ) {
      return badRequestResponse('无效的法律类别');
    }

    // 验证法条状态
    if (
      updateRequest.status !== undefined &&
      !isValidStatus(updateRequest.status)
    ) {
      return badRequestResponse('无效的法条状态');
    }

    // 构建更新数据
    const updateData = buildUpdateData(updateRequest);

    // 如果没有任何需要更新的字段
    if (Object.keys(updateData).length === 0) {
      return badRequestResponse('没有需要更新的字段');
    }

    // 更新法条
    const updatedArticle = await prisma.lawArticle.update({
      where: { id: validatedId },
      data: updateData,
      include: {
        parent: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
          },
        },
        children: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            status: true,
          },
        },
      },
    });

    return successResponse(updatedArticle, '更新法条成功');
  } catch (error) {
    console.error('更新法条失败:', error);
    return serverErrorResponse('更新法条失败');
  }
}

/**
 * DELETE /api/admin/law-articles/[id]
 * 删除法条（管理员权限）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(
    request,
    LAW_PERMISSIONS.DELETE
  );
  if (permissionError) {
    return permissionError;
  }

  try {
    // 获取法条ID
    const { id } = await params;
    const validatedId = validatePathParam(id, uuidSchema);

    // 验证法条是否存在
    const existingArticle = await prisma.lawArticle.findUnique({
      where: { id: validatedId },
    });

    if (!existingArticle) {
      return notFoundResponse('法条不存在');
    }

    // 删除法条
    await prisma.lawArticle.delete({
      where: { id: validatedId },
    });

    return successResponse({ id }, '删除法条成功');
  } catch (error) {
    console.error('删除法条失败:', error);
    return serverErrorResponse('删除法条失败');
  }
}
