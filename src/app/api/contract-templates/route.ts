/** @legacy 优先使用 /api/v1/contract-templates，此路由保留以向后兼容 */
/**
 * GET /api/contract-templates
 * 获取合同模板列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const isDefault = searchParams.get('isDefault');
    const keyword = searchParams.get('keyword');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '12', 10))
    );

    // 构建查询条件
    const where: Prisma.ContractTemplateWhereInput = {};

    if (category) {
      where.category = category;
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    if (isDefault !== null) {
      where.isDefault = isDefault === 'true';
    }

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { keywords: { has: keyword } },
      ];
    }

    // 分页查询
    const [templates, total] = await Promise.all([
      prisma.contractTemplate.findMany({
        where,
        orderBy: [
          { isDefault: 'desc' },
          { viewCount: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          category: true,
          subCategory: true,
          description: true,
          source: true,
          version: true,
          viewCount: true,
          tags: true,
          keywords: true,
        },
      }),
      prisma.contractTemplate.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { items: templates, total, page, pageSize },
    });
  } catch (error) {
    logger.error('获取合同模板列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取模板列表失败',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contract-templates
 * 创建新的合同模板
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    // 合同模板为共享资源，仅管理员可创建
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '仅管理员可创建合同模板' },
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 验证必填字段
    if (!body.name || !body.code || !body.category || !body.content) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '缺少必填字段：name, code, category, content',
          },
        },
        { status: 400 }
      );
    }

    // 验证变量列表格式
    if (body.variables && !Array.isArray(body.variables)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_VARIABLES_FORMAT',
            message: '变量列表格式错误，应为数组',
          },
        },
        { status: 400 }
      );
    }

    // 检查模板代码是否已存在
    const existingTemplate = await prisma.contractTemplate.findUnique({
      where: { code: body.code },
    });

    if (existingTemplate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TEMPLATE_CODE_EXISTS',
            message: '模板代码已存在',
          },
        },
        { status: 400 }
      );
    }

    // 创建模板
    const template = await prisma.contractTemplate.create({
      data: {
        name: body.name,
        code: body.code,
        category: body.category,
        content: body.content,
        variables: body.variables || [],
        clauses: body.clauses || [],
        tags: body.tags || [],
        keywords: body.keywords || [],
        isDefault: body.isDefault || false,
        isActive: body.isActive !== undefined ? body.isActive : true,
      } as Prisma.ContractTemplateCreateInput,
    });

    return NextResponse.json({
      success: true,
      data: template,
      message: '模板创建成功',
    });
  } catch (error) {
    logger.error('创建合同模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '创建模板失败',
        },
      },
      { status: 500 }
    );
  }
}
