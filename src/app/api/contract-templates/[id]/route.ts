/**
 * GET /api/contract-templates/[id]
 * 获取单个合同模板详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const template = await prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: '模板不存在',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('获取合同模板详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '获取模板详情失败',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/contract-templates/[id]
 * 更新合同模板
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // 检查模板是否存在
    const existingTemplate = await prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: '模板不存在',
          },
        },
        { status: 404 }
      );
    }

    // 如果更新了code，检查是否与其他模板冲突
    if (body.code && body.code !== existingTemplate.code) {
      const codeExists = await prisma.contractTemplate.findUnique({
        where: { code: body.code },
      });

      if (codeExists) {
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
    }

    // 更新模板
    const template = await prisma.contractTemplate.update({
      where: { id },
      data: {
        name: body.name,
        code: body.code,
        category: body.category,
        content: body.content,
        variables: body.variables,
        isDefault: body.isDefault,
        isActive: body.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
      message: '模板更新成功',
    });
  } catch (error) {
    console.error('更新合同模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '更新模板失败',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contract-templates/[id]
 * 删除合同模板
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 检查模板是否存在
    const existingTemplate = await prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: '模板不存在',
          },
        },
        { status: 404 }
      );
    }

    // 如果是默认模板，不允许删除
    if (existingTemplate.isDefault) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CANNOT_DELETE_DEFAULT_TEMPLATE',
            message: '不能删除默认模板',
          },
        },
        { status: 400 }
      );
    }

    // 删除模板
    await prisma.contractTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '模板删除成功',
    });
  } catch (error) {
    console.error('删除合同模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '删除模板失败',
        },
      },
      { status: 500 }
    );
  }
}
