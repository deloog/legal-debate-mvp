/**
 * 合规仪表盘API接口
 * GET /api/compliance/dashboard - 获取合规仪表盘数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { ComplianceService } from '@/lib/compliance/compliance-service';
import type { GetComplianceDashboardResponse } from '@/types/compliance';
import { logger } from '@/lib/logger';

/**
 * GET /api/compliance/dashboard
 * 获取合规仪表盘数据
 */
export async function GET(
  _request: NextRequest
): Promise<NextResponse<GetComplianceDashboardResponse>> {
  try {
    const dashboard = await ComplianceService.getDashboard();

    return NextResponse.json(
      {
        success: true,
        data: dashboard,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('获取合规仪表盘错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVICE_ERROR',
          message:
            error instanceof Error ? error.message : '获取仪表盘数据失败',
        },
      },
      { status: 500 }
    );
  }
}
