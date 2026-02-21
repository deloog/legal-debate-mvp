/**
 * 合规报告API接口
 * GET /api/compliance/report - 生成合规报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { ComplianceService } from '@/lib/compliance/compliance-service';
import type { GetComplianceReportResponse } from '@/types/compliance';
import { ComplianceCategory } from '@/types/compliance';
import { logger } from '@/lib/logger';

/**
 * GET /api/compliance/report
 * 生成合规报告
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<GetComplianceReportResponse>> {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const categoryStr = searchParams.get('category');

    // 构建请求参数
    const reportRequest = {
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      category: categoryStr ? (categoryStr as ComplianceCategory) : undefined,
    };

    const report = await ComplianceService.generateReport(reportRequest);

    return NextResponse.json(
      {
        success: true,
        data: report,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('生成合规报告错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVICE_ERROR',
          message: error instanceof Error ? error.message : '生成报告失败',
        },
      },
      { status: 500 }
    );
  }
}
