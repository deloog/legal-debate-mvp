import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse, createPaginatedResponse, createCreatedResponse } from '@/app/api/lib/responses/api-response';
import { validateQueryParams, validateRequestBody } from '@/app/api/lib/validation/validator';
import { createCaseSchema, paginationSchema } from '@/app/api/lib/validation/schemas';
import { buildPaginationOptions } from '@/app/api/lib/responses/pagination';

/**
 * GET /api/v1/cases
 * 获取案件列表（支持分页和搜索）
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 验证查询参数
  const query = validateQueryParams(request, paginationSchema);
  const { search, page, limit } = query;

  // 构建查询选项
  const options = buildPaginationOptions(query);
  
  // 这里应该调用实际的数据库查询
  // const [cases, total] = await Promise.all([
  //   prisma.case.findMany({
  //     where: search ? {
  //       OR: [
  //         { title: { contains: search, mode: 'insensitive' } },
  //         { description: { contains: search, mode: 'insensitive' } },
  //       ],
  //     } : {},
  //     ...options,
  //   }),
  //   prisma.case.count({
  //     where: search ? {
  //       OR: [
  //         { title: { contains: search, mode: 'insensitive' } },
  //         { description: { contains: search, mode: 'insensitive' } },
  //       ],
  //     } : {},
  //   }),
  // ]);

  // 模拟数据
  const mockCases = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: '合同纠纷案件',
      description: '涉及买卖合同违约的纠纷案件',
      type: 'civil',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '123e4567-e89b-12d3-a456-426614174001',
      title: '劳动争议案件',
      description: '员工与公司之间的劳动纠纷',
      type: 'labor',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const cases = mockCases;
  const total = mockCases.length;

  // 计算分页信息
  const pagination = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };

  return createPaginatedResponse(cases, pagination);
});

/**
 * POST /api/v1/cases
 * 创建新案件
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // 验证请求体
  const body = await validateRequestBody(request, createCaseSchema);

  // 这里应该调用实际的数据库操作
  // const newCase = await prisma.case.create({
  //   data: {
  //     ...body,
  //     id: generateUUID(),
  //     createdAt: new Date(),
  //     updatedAt: new Date(),
  //   },
  // });

  // 模拟创建的案例
  const newCase = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    ...body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return createCreatedResponse(newCase);
});

/**
 * OPTIONS /api/v1/cases
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async (request: NextRequest) => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
