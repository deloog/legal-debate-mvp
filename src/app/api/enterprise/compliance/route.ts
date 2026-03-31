import { NextRequest, NextResponse } from 'next/server';
import { IndustryComplianceService } from '@/services/enterprise/legal/industry-compliance.service';
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
 * POST /api/enterprise/compliance
 * 检查单个合同合规性
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

    const service = new IndustryComplianceService(prisma);

    const body = await request.json();
    const { contractId, industryType } = body;

    if (!contractId) {
      return NextResponse.json({ error: '合同ID不能为空' }, { status: 400 });
    }

    if (!industryType) {
      return NextResponse.json({ error: '行业类型不能为空' }, { status: 400 });
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

    const result = await service.checkContractCompliance(
      contractId,
      industryType
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('检查合同合规性失败', { error });
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
 * GET /api/enterprise/compliance?industryType=xxx
 * 获取行业合规规则
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
    const industryType = searchParams.get('industryType');

    if (!industryType) {
      return NextResponse.json({ error: '行业类型不能为空' }, { status: 400 });
    }

    const service = new IndustryComplianceService(prisma);
    const rules = await service.getIndustryComplianceRules(industryType);

    return NextResponse.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    logger.error('获取行业合规规则失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: '未知错误',
      },
      { status: 500 }
    );
  }
}
