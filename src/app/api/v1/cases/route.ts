import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { prisma } from '@/lib/db/prisma';
import { CaseType, CaseStatus, Prisma, OwnerType } from '@prisma/client';
import { generateCaseNumber } from '@/lib/case/case-number-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { isAdminRole } from '@/lib/middleware/resource-permission';
import { UserRole } from '@/types/auth';
import { isValidOwnerType } from '@/types/case';
import {
  validateSortBy,
  validateSortOrder,
  validatePagination,
  sanitizeSearchKeyword,
} from '@/lib/validation/query-params';

/**
 * 允许的排序字段白名单
 */
const ALLOWED_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'status',
  'type',
  'caseNumber',
] as const;

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

  // 使用验证工具处理分页和排序参数
  const pagination = validatePagination({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  const sortBy = validateSortBy(
    searchParams.get('sortBy'),
    [...ALLOWED_SORT_FIELDS],
    'createdAt'
  );

  const sortOrder = validateSortOrder(searchParams.get('sortOrder'), 'desc');

  const page = pagination.page;
  const limit = pagination.limit;
  const skip = (page - 1) * limit;

  // 筛选条件
  const userId = searchParams.get('userId');
  const type = searchParams.get('type') as CaseType | null;
  const status = searchParams.get('status')?.toUpperCase() as CaseStatus | null;
  const ownerType = searchParams.get('ownerType');
  const sharedWithTeam = searchParams.get('sharedWithTeam');

  // 清理搜索关键词
  const rawSearch = searchParams.get('search');
  const search = rawSearch ? sanitizeSearchKeyword(rawSearch) : null;

  // 构建查询条件
  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  // 权限过滤：非管理员只能看到自己创建的案件（DB 重查角色，避免 stale JWT）
  const dbUserCases = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  if (!isAdminRole((dbUserCases?.role ?? '') as UserRole)) {
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

  if (ownerType && isValidOwnerType(ownerType)) {
    where.ownerType = ownerType as OwnerType;
  }

  if (sharedWithTeam) {
    where.sharedWithTeam = sharedWithTeam === 'true';
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { caseNumber: { contains: search, mode: 'insensitive' } },
      { cause: { contains: search, mode: 'insensitive' } },
    ];
  }

  // 构建排序条件（sortBy已经过白名单验证）
  const orderBy: Record<string, 'asc' | 'desc'> = {
    [sortBy]: sortOrder,
  };

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

  const ownerTypeMap: Record<string, OwnerType> = {
    user: 'USER',
    team: 'TEAM',
  };

  // 处理ownerType，默认为USER
  const ownerTypeValue = body.ownerType
    ? ownerTypeMap[body.ownerType?.toLowerCase()] || 'USER'
    : 'USER';

  // 处理sharedWithTeam，默认为false
  const sharedWithTeamValue = body.sharedWithTeam === true;

  // 校验金额（如有提供，必须为正数）
  if (body.amount !== undefined && body.amount !== null) {
    const amountNum = Number(body.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_AMOUNT', message: '案件金额必须为正数' },
        },
        { status: 400 }
      );
    }
  }

  const caseType = typeMap[body.type?.toLowerCase()] || 'CIVIL';
  const caseStatus = statusMap[body.status?.toLowerCase()] || 'DRAFT';
  const caseNumber =
    body.caseNumber || (await generateCaseNumber(prisma, caseType, caseStatus));

  const caseData = await prisma.case.create({
    data: {
      userId: authUser.userId,
      title: body.title,
      description: body.description || '',
      type: caseType,
      status: caseStatus,
      amount: body.amount ? new Prisma.Decimal(body.amount) : null,
      caseNumber,
      cause: body.cause,
      court: body.court,
      plaintiffName: body.plaintiffName,
      defendantName: body.defendantName,
      metadata: body.metadata || {},
      ownerType: ownerTypeValue,
      sharedWithTeam: sharedWithTeamValue,
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
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
