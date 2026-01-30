/**
 * 风险评估历史API接口
 * GET /api/risk-assessment/history - 获取评估历史
 */

import { NextRequest, NextResponse } from 'next/server';
import type { RiskAssessmentHistoryResponse } from '@/types/risk-assessment';

/**
 * GET /api/risk-assessment/history
 * 获取风险评估历史记录
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<RiskAssessmentHistoryResponse>> {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    // 计算分页
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // 从数据库获取历史记录
    // 注意：这里使用动态导入以避免在测试环境中的问题
    const { prisma } = await import('@/lib/db');

    const [items, total] = await Promise.all([
      prisma.riskAssessment.findMany({
        skip,
        take,
        orderBy: {
          assessedAt: 'desc',
        },
        select: {
          id: true,
          caseId: true,
          caseTitle: true,
          assessedAt: true,
          overallRiskLevel: true,
          overallRiskScore: true,
          totalRisks: true,
          criticalRisks: true,
        },
      }),
      prisma.riskAssessment.count(),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          items,
          total,
          page,
          pageSize,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('获取评估历史错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error instanceof Error ? error.message : '获取历史记录失败',
        },
      },
      { status: 500 }
    );
  }
}
