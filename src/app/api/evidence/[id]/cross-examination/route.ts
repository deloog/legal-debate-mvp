/**
 * 质证预判API
 *
 * POST /api/evidence/[id]/cross-examination
 * 预判对方可能的质证意见，提供应对建议
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CrossExaminationService } from '@/lib/evidence/cross-examination-service';
import { logger } from '@/lib/logger';

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
  params: {
    id: string;
  };
}

/**
 * POST /api/evidence/[id]/cross-examination
 * 质证预判
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    // 验证证据ID
    const evidenceId = params.id;
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

    // 查询证据
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
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

    // 检查证据是否已删除
    if (evidence.deletedAt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EVIDENCE_DELETED',
            message: '证据已被删除',
          },
        },
        { status: 404 }
      );
    }

    // 查询案件信息（可选，用于获取案件类型）
    const caseInfo = await prisma.case.findUnique({
      where: { id: evidence.caseId },
      select: { id: true, type: true },
    });

    // 调用质证预判服务
    const service = new CrossExaminationService();
    const result = await service.preAssess({
      evidence,
      ourPosition,
      caseType: caseType || caseInfo?.type,
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

    // 返回错误响应
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '服务器内部错误',
        },
      },
      { status: 500 }
    );
  }
}
