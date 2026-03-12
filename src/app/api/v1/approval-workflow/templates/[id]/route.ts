/**
 * 审批工作流模板详情 API
 * GET    /api/v1/approval-workflow/templates/[id] - 获取模板详情
 * PUT    /api/v1/approval-workflow/templates/[id] - 更新模板
 * DELETE /api/v1/approval-workflow/templates/[id] - 删除模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { approvalWorkflowService } from '@/lib/contract/approval-workflow-service';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader ?? '');
    const tokenResult = verifyToken(token ?? '');

    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
        { status: 401 }
      );
    }

    const template = await approvalWorkflowService.getWorkflowTemplate(id);

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: '模板不存在' },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { template } });
  } catch (error) {
    logger.error('获取工作流模板详情失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader ?? '');
    const tokenResult = verifyToken(token ?? '');

    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      name?: string;
      description?: string;
      category?: string;
      flowDefinition?: unknown;
      isActive?: boolean;
    };

    const template = await approvalWorkflowService.updateWorkflowTemplate(id, {
      name: body.name,
      description: body.description,
      category: body.category,
      isActive: body.isActive,
      flowDefinition: body.flowDefinition as Parameters<
        typeof approvalWorkflowService.updateWorkflowTemplate
      >[1]['flowDefinition'],
    });

    return NextResponse.json({ success: true, data: { template } });
  } catch (error) {
    logger.error('更新工作流模板失败', { error });

    const message = error instanceof Error ? error.message : '服务器内部错误';
    const isValidationError = message.includes('工作流定义无效');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isValidationError ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
          message,
        },
      },
      { status: isValidationError ? 400 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader ?? '');
    const tokenResult = verifyToken(token ?? '');

    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
        { status: 401 }
      );
    }

    // 检查模板是否存在
    const template = await approvalWorkflowService.getWorkflowTemplate(id);

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: '模板不存在' },
        },
        { status: 404 }
      );
    }

    // 软删除：设置为非活跃状态
    await prisma.approvalTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error('删除工作流模板失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
      },
      { status: 500 }
    );
  }
}
