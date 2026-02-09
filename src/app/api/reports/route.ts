/**
 * 法务报表API接口
 * POST /api/reports - 生成报表
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/lib/reports/report-service';
import type {
  GenerateReportRequest,
  GenerateReportResponse,
} from '@/types/report';
import { isValidReportFilter } from '@/types/report';

/**
 * POST /api/reports
 * 生成报表
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateReportResponse>> {
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

    // 验证filter字段
    if (!requestData.filter) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FILTER',
            message: '缺少filter字段',
          },
        },
        { status: 400 }
      );
    }

    // 验证筛选条件
    if (!isValidReportFilter(requestData.filter)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILTER',
            message: '筛选条件验证失败，请检查必填字段',
          },
        },
        { status: 400 }
      );
    }

    const { filter } = requestData as any;

    // 生成报表
    const result = await ReportService.generateReport(filter);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('生成报表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GENERATE_REPORT_ERROR',
          message: error instanceof Error ? error.message : '生成报表失败',
        },
      },
      { status: 500 }
    );
  }
}
