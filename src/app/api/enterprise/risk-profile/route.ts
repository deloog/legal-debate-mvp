import { NextRequest, NextResponse } from 'next/server';
import { EnterpriseRiskProfileService } from '@/services/enterprise/legal/enterprise-risk-profile.service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/enterprise/risk-profile
 * 生成企业风险画像
 */
export async function POST(request: NextRequest) {
  try {
    const service = new EnterpriseRiskProfileService(prisma);

    const body = await request.json();
    const { enterpriseId, userId } = body;

    if (!enterpriseId) {
      return NextResponse.json({ error: '企业ID不能为空' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    const result = await service.generateEnterpriseRiskProfile(
      enterpriseId,
      userId
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('生成企业风险画像失败', { error });
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
 * GET /api/enterprise/risk-profile?enterpriseId=xxx
 * 获取企业风险画像
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enterpriseId = searchParams.get('enterpriseId');

    if (!enterpriseId) {
      return NextResponse.json({ error: '企业ID不能为空' }, { status: 400 });
    }

    const service = new EnterpriseRiskProfileService(prisma);

    const result = await service.getEnterpriseRiskProfile(enterpriseId);

    if (!result) {
      return NextResponse.json({ error: '未找到风险画像' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('获取企业风险画像失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
