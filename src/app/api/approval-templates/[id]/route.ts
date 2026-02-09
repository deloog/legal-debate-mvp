/**
 * 审批模板详情API
 * GET - 获取审批模板详情
 * PUT - 更新审批模板
 * DELETE - 删除审批模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const updateTemplateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').optional(),
  description: z.string().optional(),
  steps: z
    .array(
      z.object({
        stepNumber: z.number(),
        approverRole: z.string(),
        approverId: z.string().optional(),
        approverName: z.string().optional(),
      })
    )
    .optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;

    const template = await prisma.approvalTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '审批模板不存在',
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
    console.error('获取审批模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '获取审批模板失败',
        },
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;
    const body = await request.json();

    // 验证请求数据
    const validatedData = updateTemplateSchema.parse(body);

    // 更新审批模板
    const template = await prisma.approvalTemplate.update({
      where: { id: templateId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description,
        }),
        ...(validatedData.steps && {
          steps: validatedData.steps as Prisma.JsonArray,
        }),
        ...(validatedData.isActive !== undefined && {
          isActive: validatedData.isActive,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
      message: '审批模板更新成功',
    });
  } catch (error) {
    console.error('更新审批模板失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据格式错误',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '更新审批模板失败',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;

    // 检查模板是否被使用
    const usageCount = await prisma.contractApproval.count({
      where: { templateId },
    });

    if (usageCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TEMPLATE_IN_USE',
            message: `该模板已被 ${usageCount} 个审批流程使用，无法删除`,
          },
        },
        { status: 400 }
      );
    }

    // 删除审批模板
    await prisma.approvalTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({
      success: true,
      message: '审批模板删除成功',
    });
  } catch (error) {
    console.error('删除审批模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '删除审批模板失败',
        },
      },
      { status: 500 }
    );
  }
}
