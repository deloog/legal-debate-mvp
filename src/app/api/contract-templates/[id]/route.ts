/**
 * GET /api/contract-templates/[id]
 * 获取单个合同模板详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

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
    logger.error('获取合同模板详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取模板详情失败',
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
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 仅管理员可更新合同模板
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '仅管理员可更新合同模板' },
        },
        { status: 403 }
      );
    }

    const { id } = await params;
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
    logger.error('更新合同模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '更新模板失败',
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
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 仅管理员可删除合同模板
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '仅管理员可删除合同模板' },
        },
        { status: 403 }
      );
    }

    const { id } = await params;

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
    logger.error('删除合同模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '删除模板失败',
        },
      },
      { status: 500 }
    );
  }
}
