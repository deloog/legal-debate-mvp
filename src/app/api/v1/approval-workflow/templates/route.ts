/**
 * 审批工作流模板 API
 * GET  /api/v1/approval-workflow/templates - 列出模板
 * POST /api/v1/approval-workflow/templates - 创建模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { approvalWorkflowService } from '@/lib/contract/approval-workflow-service';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader ?? '');
    const tokenResult = verifyToken(token ?? '');

    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isActiveParam = searchParams.get('isActive');
    const category = searchParams.get('category') ?? undefined;

    const filter: { isActive?: boolean; category?: string } = { category };
    if (isActiveParam !== null) {
      filter.isActive = isActiveParam === 'true';
    }

    const templates =
      await approvalWorkflowService.listWorkflowTemplates(filter);

    return NextResponse.json({
      success: true,
      data: { templates },
    });
  } catch (error) {
    logger.error('获取工作流模板列表失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
    };

    const { name, description, category, flowDefinition } = body;

    if (!name || !flowDefinition) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '模板名称和工作流定义为必填项',
          },
        },
        { status: 400 }
      );
    }

    const template = await approvalWorkflowService.createWorkflowTemplate({
      name,
      description,
      category,
      flowDefinition: flowDefinition as Parameters<
        typeof approvalWorkflowService.createWorkflowTemplate
      >[0]['flowDefinition'],
    });

    return NextResponse.json(
      { success: true, data: { template } },
      { status: 201 }
    );
  } catch (error) {
    logger.error('创建工作流模板失败', { error });

    const message = error instanceof Error ? error.message : '服务器内部错误';
    const isValidationError =
      message.includes('工作流定义无效') || message.includes('不能为空');

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
