/**
 * 资格审核列表API - 管理员专用
 * 支持分页、筛选、搜索
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { QualificationErrorCode } from '@/types/qualification';
import type { QualificationStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 资格列表查询参数
 */
interface QualificationListQueryParams {
  page?: string;
  limit?: string;
  status?: string;
  search?: string;
}

/**
 * 资格列表响应数据
 */
interface QualificationListResponse {
  qualifications: Array<{
    id: string;
    userId: string;
    licenseNumber: string;
    fullName: string;
    lawFirm: string;
    status: QualificationStatus;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewNotes: string | null;
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
    };
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证资格状态枚举值
 */
function isValidQualificationStatus(
  status: string
): status is QualificationStatus {
  const validStatuses = [
    'PENDING',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
  ];
  return validStatuses.includes(status);
}

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): QualificationListQueryParams {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  return {
    page: url.searchParams.get('page') ?? '1',
    limit: url.searchParams.get('limit') ?? '20',
    status: status && isValidQualificationStatus(status) ? status : undefined,
    search: url.searchParams.get('search') ?? undefined,
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: QualificationListQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.search && params.search.trim() !== '') {
    const searchTerm = params.search.trim();
    where.OR = [
      { licenseNumber: { contains: searchTerm, mode: 'insensitive' } },
      { fullName: { contains: searchTerm, mode: 'insensitive' } },
      { lawFirm: { contains: searchTerm, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { username: { contains: searchTerm, mode: 'insensitive' } },
            { name: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      },
    ];
  }

  return where;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/qualifications
 * 获取资格审核列表（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    ) as unknown as NextResponse;
  }

  // 检查权限
  const permissionError = await validatePermissions(
    request,
    'qualification:read'
  );
  if (permissionError) {
    return permissionError;
  }

  try {
    // 解析查询参数
    const params = parseQueryParams(request);
    const page = Math.max(1, Number.parseInt(params.page, 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(params.limit, 10)));
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where = buildWhereClause(params);

    // 查询资格总数
    const total = await prisma.lawyerQualification.count({ where });

    // 查询资格列表
    const qualifications = await prisma.lawyerQualification.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    // 构建响应数据
    const responseData: QualificationListResponse = {
      qualifications: qualifications.map(q => ({
        id: q.id,
        userId: q.userId,
        licenseNumber: q.licenseNumber,
        fullName: q.fullName,
        lawFirm: q.lawFirm,
        status: q.status as QualificationStatus,
        submittedAt: q.submittedAt,
        reviewedAt: q.reviewedAt,
        reviewNotes: q.reviewNotes,
        user: q.user,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return Response.json(
      { data: responseData },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('获取资格审核列表失败:', error);
    return Response.json(
      {
        error: '服务器错误',
        message: '获取资格审核列表失败',
        code: QualificationErrorCode.VERIFICATION_FAILED,
      },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

/**
 * OPTIONS /api/admin/qualifications
 * 处理CORS预检请求
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
