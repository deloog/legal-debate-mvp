/**
 * 证据链分析API
 *
 * POST /api/evidence/chain-analysis
 * 分析证据链，返回证据关联关系、完整性评估和建议
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { EvidenceChainService } from '@/lib/evidence/evidence-chain-service';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 请求体接口
 */
interface ChainAnalysisRequest {
  caseId: string;
  evidenceIds: string[];
  targetFact: string;
}

/**
 * POST /api/evidence/chain-analysis
 * 证据链分析
 */
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '未授权，请先登录' },
      },
      { status: 401 }
    );
  }

  try {
    // 解析请求体
    let body: ChainAnalysisRequest;
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
    const { caseId, evidenceIds, targetFact } = body;

    if (!caseId || typeof caseId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CASE_ID',
            message: '案件ID不能为空',
          },
        },
        { status: 400 }
      );
    }

    if (!evidenceIds || !Array.isArray(evidenceIds)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_EVIDENCE_IDS',
            message: '证据ID列表必须是数组',
          },
        },
        { status: 400 }
      );
    }

    if (evidenceIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMPTY_EVIDENCE_IDS',
            message: '证据ID列表不能为空',
          },
        },
        { status: 400 }
      );
    }

    if (
      !targetFact ||
      typeof targetFact !== 'string' ||
      targetFact.trim() === ''
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TARGET_FACT',
            message: '待证明事实不能为空',
          },
        },
        { status: 400 }
      );
    }

    // 验证案件是否存在并校验归属
    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, userId: true },
    });

    if (!caseExists) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CASE_NOT_FOUND',
            message: '案件不存在',
          },
        },
        { status: 404 }
      );
    }

    if (caseExists.userId !== authUser.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '无权访问此案件',
          },
        },
        { status: 403 }
      );
    }

    // 查询证据
    const evidences = await prisma.evidence.findMany({
      where: {
        id: { in: evidenceIds },
        caseId: caseId,
        deletedAt: null,
      },
    });

    if (evidences.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EVIDENCES_NOT_FOUND',
            message: '未找到指定的证据',
          },
        },
        { status: 404 }
      );
    }

    // 调用证据链分析服务
    const service = EvidenceChainService.getInstance();
    const result = await service.analyzeChain({
      caseId,
      evidences,
      targetFact: targetFact.trim(),
    });

    // 返回成功响应
    return NextResponse.json(
      {
        success: true,
        data: result,
        message: '证据链分析完成',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('证据链分析API错误:', error);

    // 返回错误响应
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
        },
      },
      { status: 500 }
    );
  }
}
