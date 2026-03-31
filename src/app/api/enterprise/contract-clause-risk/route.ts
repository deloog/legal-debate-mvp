import { NextRequest, NextResponse } from 'next/server';
import { ContractClauseRiskService } from '@/services/enterprise/legal/contract-clause-risk.service';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

/**
 * 校验合同访问权限（律师 / 委托方 / 管理员）
 */
async function resolveContractAccess(contractId: string, userId: string) {
  const [contract, dbUser] = await Promise.all([
    prisma.contract.findUnique({
      where: { id: contractId },
      select: { lawyerId: true, case: { select: { userId: true } } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  if (!contract) return { found: false, allowed: false };
  const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
  const isLawyer = contract.lawyerId === userId;
  const isClient = contract.case?.userId === userId;
  return { found: true, allowed: isAdmin || isLawyer || isClient };
}

/**
 * POST /api/enterprise/contract-clause-risk
 * 分析合同条款风险
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const service = new ContractClauseRiskService(prisma);

    const body = await request.json();
    const { contractId, clauseText, clauseNumber, clauseType } = body;

    if (!contractId) {
      return NextResponse.json({ error: '合同ID不能为空' }, { status: 400 });
    }

    if (!clauseText) {
      return NextResponse.json({ error: '条款文本不能为空' }, { status: 400 });
    }

    const { found, allowed } = await resolveContractAccess(
      contractId,
      authUser.userId
    );
    if (!found) {
      return NextResponse.json(
        { success: false, error: '合同不存在' },
        { status: 404 }
      );
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: '无权访问此合同' },
        { status: 403 }
      );
    }

    // 使用认证用户ID，不接受客户端传入的 userId
    const result = await service.analyzeClauseRisk(
      contractId,
      authUser.userId,
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
        error: '未知错误',
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
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');

    if (!contractId) {
      return NextResponse.json({ error: '合同ID不能为空' }, { status: 400 });
    }

    const { found, allowed } = await resolveContractAccess(
      contractId,
      authUser.userId
    );
    if (!found) {
      return NextResponse.json(
        { success: false, error: '合同不存在' },
        { status: 404 }
      );
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: '无权访问此合同' },
        { status: 403 }
      );
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
        error: '未知错误',
      },
      { status: 500 }
    );
  }
}
