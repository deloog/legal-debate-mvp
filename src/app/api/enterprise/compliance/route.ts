import { NextRequest, NextResponse } from 'next/server';
import { IndustryComplianceService } from '@/services/enterprise/legal/industry-compliance.service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/enterprise/compliance
 * 检查单个合同合规性
 */
export async function POST(request: NextRequest) {
  try {
    const service = new IndustryComplianceService(prisma);

    const body = await request.json();
    const { contractId, industryType } = body;

    if (!contractId) {
      return NextResponse.json({ error: '合同ID不能为空' }, { status: 400 });
    }

    if (!industryType) {
      return NextResponse.json({ error: '行业类型不能为空' }, { status: 400 });
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
        error: error instanceof Error ? error.message : '未知错误',
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
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
