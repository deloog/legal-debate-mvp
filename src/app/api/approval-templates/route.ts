/** @legacy 优先使用 /api/v1/approval-templates，此路由保留以向后兼容 */
/**
 * 审批模板API
 * GET - 获取审批模板列表
 * POST - 创建审批模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

const createTemplateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空'),
  description: z.string().optional(),
  steps: z.array(
    z.object({
      stepNumber: z.number(),
      approverRole: z.string(),
      approverId: z.string().optional(),
      approverName: z.string().optional(),
    })
  ),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');

    const templates = await prisma.approvalTemplate.findMany({
      where: isActive !== null ? { isActive: isActive === 'true' } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    logger.error('获取审批模板失败:', error);
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证请求数据
    const validatedData = createTemplateSchema.parse(body);

    // 创建审批模板
    const template = await prisma.approvalTemplate.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        steps: validatedData.steps as Prisma.JsonArray,
        isActive: validatedData.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
      message: '审批模板创建成功',
    });
  } catch (error) {
    logger.error('创建审批模板失败:', error);

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
          message: error instanceof Error ? error.message : '创建审批模板失败',
        },
      },
      { status: 500 }
    );
  }
}
