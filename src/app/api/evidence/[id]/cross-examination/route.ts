/**
 * 质证预判API
 *
 * POST /api/evidence/[id]/cross-examination
 * 预判对方可能的质证意见，提供应对建议
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CrossExaminationService } from '@/lib/evidence/cross-examination-service';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 请求体接口
 */
interface CrossExaminationRequest {
  ourPosition: 'plaintiff' | 'defendant';
  caseType?: string;
}

/**
 * 路由参数接口
 */
interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/evidence/[id]/cross-examination
 * 质证预判
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 认证检查
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '请先登录',
          },
        },
        { status: 401 }
      );
    }

    // 验证证据ID
    const { id: evidenceId } = await params;
    if (!evidenceId || evidenceId.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_EVIDENCE_ID',
            message: '证据ID不能为空',
          },
        },
        { status: 400 }
      );
    }

    // 解析请求体
    let body: CrossExaminationRequest;
    try {
      body = await request.json();
    } catch (_error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: '无效的JSON格式',
          },
        },
        { status: 400 }
      );
    }

    // 验证参数
    const { ourPosition, caseType } = body;

    if (!ourPosition) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_OUR_POSITION',
            message: '我方立场不能为空',
          },
        },
        { status: 400 }
      );
    }

    if (ourPosition !== 'plaintiff' && ourPosition !== 'defendant') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_OUR_POSITION_VALUE',
            message: '我方立场必须是plaintiff或defendant',
          },
        },
        { status: 400 }
      );
    }

    // 查询证据（包含案件信息用于权限检查）
    const evidence = await prisma.evidence.findFirst({
      where: { id: evidenceId, deletedAt: null },
      include: {
        case: {
          select: { id: true, type: true, userId: true },
        },
      },
    });

    if (!evidence) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EVIDENCE_NOT_FOUND',
            message: '证据不存在',
          },
        },
        { status: 404 }
      );
    }

    // 权限检查：用户只能访问自己案件的证据
    if (evidence.case?.userId !== authUser.userId) {
      logger.warn('用户尝试访问无权访问的证据:', {
        userId: authUser.userId,
        evidenceId,
        caseId: evidence.case?.id,
        ownerId: evidence.case?.userId,
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '您没有权限访问此证据',
          },
        },
        { status: 403 }
      );
    }

    // 调用质证预判服务
    const service = CrossExaminationService.getInstance();
    const result = await service.preAssess({
      evidence,
      ourPosition,
      caseType: caseType || evidence.case?.type,
    });

    // 返回成功响应
    return NextResponse.json(
      {
        success: true,
        data: result,
        message: '质证预判完成',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('质证预判API错误:', error);

    const message = error instanceof Error ? error.message : '服务器内部错误';
    const isAIUnavailable =
      /api.?key|401|unauthorized|fetch failed|timeout|network|deepseek|zhipu|ai/i.test(
        message
      );

    // 返回错误响应
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isAIUnavailable ? 'AI_UNAVAILABLE' : 'INTERNAL_ERROR',
          message: isAIUnavailable
            ? 'AI 服务暂时不可用，请稍后重试'
            : '服务器内部错误',
        },
      },
      { status: isAIUnavailable ? 503 : 500 }
    );
  }
}
