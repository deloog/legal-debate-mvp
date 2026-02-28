import { NextRequest, NextResponse } from 'next/server';
import { ContractClauseRiskService } from '@/services/enterprise/legal/contract-clause-risk.service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/enterprise/contract-clause-risk
 * 分析合同条款风险
 */
export async function POST(request: NextRequest) {
  try {
    const service = new ContractClauseRiskService(prisma);

    const body = await request.json();
    const { contractId, userId, clauseText, clauseNumber, clauseType } = body;

    if (!contractId) {
      return NextResponse.json({ error: '合同ID不能为空' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    if (!clauseText) {
      return NextResponse.json({ error: '条款文本不能为空' }, { status: 400 });
    }

    const result = await service.analyzeClauseRisk(
      contractId,
      userId,
      clauseText,
      clauseNumber,
      clauseType
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('分析合同条款风险失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/enterprise/contract-clause-risk?contractId=xxx
 * 获取合同风险分析结果
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');

    if (!contractId) {
      return NextResponse.json({ error: '合同ID不能为空' }, { status: 400 });
    }

    const service = new ContractClauseRiskService(prisma);

    const result = await service.getContractRiskSummary(contractId);

    if (!result) {
      return NextResponse.json(
        { error: '未找到风险分析结果' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('获取合同条款风险失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
