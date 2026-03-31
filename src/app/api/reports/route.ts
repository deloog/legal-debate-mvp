/**
 * 法务报表API接口
 * POST /api/reports - 生成报表
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/lib/reports/report-service';
import type { GenerateReportResponse, ReportFilter } from '@/types/report';
import { isValidReportFilter } from '@/types/report';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/reports
 * 生成报表
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateReportResponse>> {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    // 允许律师、企业用户、管理员生成报表
    const allowedRoles = ['LAWYER', 'ENTERPRISE', 'ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(authUser.role)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '无权限访问' },
        },
        { status: 403 }
      );
    }

    // 非管理员只能查看自己的数据
    const isAdmin =
      authUser.role === 'ADMIN' || authUser.role === 'SUPER_ADMIN';

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

    const filter = requestData.filter as ReportFilter;

    // 生成报表（非管理员只查自己的数据）
    const result = await ReportService.generateReport(
      filter,
      isAdmin ? undefined : authUser.userId
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('生成报表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GENERATE_REPORT_ERROR',
          message: '生成报表失败',
        },
      },
      { status: 500 }
    );
  }
}
