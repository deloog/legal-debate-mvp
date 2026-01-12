import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { prisma } from '@/lib/db/prisma';
import { CaseType, CaseStatus, Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import { isAdminRole } from '@/lib/middleware/resource-permission';
import { UserRole } from '@/types/auth';

/**
 * GET /api/v1/cases
 * 获取案件列表
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 获取认证用户
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  // 处理案件列表查询
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const skip = (page - 1) * limit;

  // 筛选条件
  const userId = searchParams.get('userId');
  const type = searchParams.get('type') as CaseType | null;
  const status = searchParams.get('status')?.toUpperCase() as CaseStatus | null;
  const search = searchParams.get('search');

  // 排序
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // 构建查询条件
  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  // 权限过滤：非管理员只能看到自己创建的案件
  if (!isAdminRole(authUser.role as UserRole)) {
    where.userId = authUser.userId;
  } else if (userId) {
    // 管理员可以根据userId参数过滤
    where.userId = userId;
  }

  if (type) {
    where.type = type;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { caseNumber: { contains: search, mode: 'insensitive' } },
      { cause: { contains: search, mode: 'insensitive' } },
    ];
  }

  // 构建排序条件
  const orderBy: Record<string, 'asc' | 'desc'> = {};
  if (
    sortBy === 'createdAt' ||
    sortBy === 'updatedAt' ||
    sortBy === 'title' ||
    sortBy === 'status'
  ) {
    orderBy[sortBy] = sortOrder as 'asc' | 'desc';
  } else {
    orderBy.createdAt = 'desc';
  }

  // 查询案件列表
  const [cases, total] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        documents: {
          where: { deletedAt: null },
          select: { id: true, analysisStatus: true },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        debates: {
          select: { id: true, status: true },
          take: 1,
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
    }),
    prisma.case.count({ where }),
  ]);

  return createSuccessResponse(
    { cases, total },
    {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrevious: page > 1,
      },
    }
  );
});

/**
 * POST /api/v1/cases
 * 创建案件
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // 获取认证用户
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const body = await request.json();

  // 参数验证
  if (!body.title) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'title参数必填',
        },
      },
      { status: 400 }
    );
  }

  // 类型转换
  const typeMap: Record<string, CaseType> = {
    civil: 'CIVIL',
    criminal: 'CRIMINAL',
    administrative: 'ADMINISTRATIVE',
    commercial: 'COMMERCIAL',
    labor: 'LABOR',
    intellectual: 'INTELLECTUAL',
    other: 'OTHER',
  };

  const statusMap: Record<string, CaseStatus> = {
    draft: 'DRAFT',
    active: 'ACTIVE',
    completed: 'COMPLETED',
    archived: 'ARCHIVED',
  };

  const caseData = await prisma.case.create({
    data: {
      userId: authUser.userId,
      title: body.title,
      description: body.description || '',
      type: typeMap[body.type?.toLowerCase()] || 'CIVIL',
      status: statusMap[body.status?.toLowerCase()] || 'DRAFT',
      amount: body.amount ? new Prisma.Decimal(body.amount) : null,
      caseNumber: body.caseNumber,
      cause: body.cause,
      court: body.court,
      plaintiffName: body.plaintiffName,
      defendantName: body.defendantName,
      metadata: body.metadata || {},
    },
  });

  return createSuccessResponse(caseData);
});

/**
 * OPTIONS /api/v1/cases
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
