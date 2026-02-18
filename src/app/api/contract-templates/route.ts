/**
 * GET /api/contract-templates
 * 获取合同模板列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const isDefault = searchParams.get('isDefault');

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

    // 查询模板列表
    const templates = await prisma.contractTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('获取合同模板列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '获取模板列表失败',
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
    console.error('创建合同模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '创建模板失败',
        },
      },
      { status: 500 }
    );
  }
}
