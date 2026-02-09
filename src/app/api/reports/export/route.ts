/**
 * 法务报表导出API接口
 * POST /api/reports/export - 导出报表
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/lib/reports/report-service';
import type { ExportReportRequest, ExportReportResponse } from '@/types/report';
import { isValidExportFormat } from '@/types/report';

/**
 * POST /api/reports/export
 * 导出报表
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ExportReportResponse>> {
  try {
    // 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
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

    // 验证请求体
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '无效的请求体',
          },
        },
        { status: 400 }
      );
    }

    const requestData = body as Record<string, unknown>;

    // 验证reportId字段
    if (!requestData.reportId || typeof requestData.reportId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_REPORT_ID',
            message: '缺少reportId字段',
          },
        },
        { status: 400 }
      );
    }

    // 验证format字段
    if (!isValidExportFormat(requestData.format)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: '无效的导出格式',
          },
        },
        { status: 400 }
      );
    }

    const { reportId, format } = requestData as any;

    // 导出报表
    const result = await ReportService.exportReport(reportId, format);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('导出报表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'EXPORT_REPORT_ERROR',
          message: error instanceof Error ? error.message : '导出报表失败',
        },
      },
      { status: 500 }
    );
  }
}
