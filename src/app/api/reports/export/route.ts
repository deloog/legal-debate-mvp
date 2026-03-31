/**
 * 法务报表导出API接口
 * POST /api/reports/export - 导出报表
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/lib/reports/report-service';
import type { ExportReportResponse } from '@/types/report';
import { isValidExportFormat, ExportFormat } from '@/types/report';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * POST /api/reports/export
 * 导出报表
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ExportReportResponse>> {
  // ─── 认证：必须登录 ────────────────────────────────────────────────────────
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未授权，请先登录',
        },
      },
      { status: 401 }
    ) as NextResponse<ExportReportResponse>;
  }

  // ─── 授权：律师、企业、管理员可导出报表 ──────────────────────────────────
  const allowedExportRoles = ['LAWYER', 'ENTERPRISE', 'ADMIN', 'SUPER_ADMIN'];
  if (!allowedExportRoles.includes(authUser.role)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '无权限访问',
        },
      },
      { status: 403 }
    ) as NextResponse<ExportReportResponse>;
  }

  try {
    // 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch (_error) {
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

    // 验证reportId格式（防止路径穿越）：只允许 report_ 前缀 + 纯数字
    if (!/^report_\d+$/.test(requestData.reportId as string)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REPORT_ID',
            message: '无效的reportId格式',
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

    const reportId = requestData.reportId as string;
    const format = requestData.format as ExportFormat;

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
    logger.error('导出报表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'EXPORT_REPORT_ERROR',
          message: '导出报表失败',
        },
      },
      { status: 500 }
    );
  }
}
