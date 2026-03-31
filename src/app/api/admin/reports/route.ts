/**
 * 报告管理API
 * GET /api/admin/reports - 获取报告列表
 * POST /api/admin/reports - 创建报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { prisma } from '@/lib/db/prisma';
import { generateReport } from '@/lib/report/report-generator';
import {
  ReportStatus,
  ReportType,
  ReportFormat,
  ReportSection,
} from '@/types/stats';
import { triggerWeeklyReportGeneration } from '@/lib/cron/generate-weekly-report';
import { triggerMonthlyReportGeneration } from '@/lib/cron/generate-monthly-report';
import { logger } from '@/lib/logger';

// 辅助响应函数
function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, message: '未授权访问' },
    { status: 401 }
  );
}

/**
 * GET /api/admin/reports - 获取报告列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const user = await getAuthUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    // 检查权限（使用报告读取权限）
    const permissionError = await validatePermissions(request, 'report:read');
    if (permissionError) {
      return permissionError;
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as ReportType | null;
    const status = searchParams.get('status') as ReportStatus | null;
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (periodStart && periodEnd) {
      where.createdAt = {
        gte: new Date(periodStart),
        lte: new Date(periodEnd),
      };
    }

    // 查询报告列表
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          filePath: true,
          fileSize: true,
          format: true,
          generatedAt: true,
          downloadCount: true,
          createdAt: true,
        },
      }),
      prisma.report.count({ where }),
    ]);

    // 计算文件名
    const reportList = reports.map(report => ({
      ...report,
      fileName: report.filePath?.split('/').pop() || '',
    }));

    return NextResponse.json({
      success: true,
      message: '获取报告列表成功',
      data: {
        reports: reportList,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('获取报告列表失败:', error);
    return NextResponse.json(
      { success: false, message: '获取报告列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/reports - 创建报告
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const user = await getAuthUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    // 检查权限（使用报告创建权限）
    const permissionError = await validatePermissions(request, 'report:create');
    if (permissionError) {
      return permissionError;
    }

    // 解析请求体
    const body = await request.json();
    const {
      type,
      periodStart,
      periodEnd,
      format = ReportFormat.HTML,
      triggerType,
    } = body;

    // 验证必填字段
    if (!type) {
      return NextResponse.json(
        { success: false, message: '报告类型不能为空' },
        { status: 400 }
      );
    }

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { success: false, message: '时间范围不能为空' },
        { status: 400 }
      );
    }

    // 验证报告类型
    if (!Object.values(ReportType).includes(type)) {
      return NextResponse.json(
        { success: false, message: '无效的报告类型' },
        { status: 400 }
      );
    }

    // 验证格式
    if (!Object.values(ReportFormat).includes(format)) {
      return NextResponse.json(
        { success: false, message: '无效的报告格式' },
        { status: 400 }
      );
    }

    let reportId: string | undefined;
    let filePath: string | undefined;
    let fileSize: number | undefined;

    // 根据触发类型执行不同的生成逻辑
    if (triggerType === 'WEEKLY') {
      // 使用周报生成任务
      const result = await triggerWeeklyReportGeneration(new Date(periodEnd));
      if (!result.success) {
        return NextResponse.json(
          { success: false, message: result.error || '周报生成失败' },
          { status: 500 }
        );
      }
      reportId = result.reportId;
    } else if (triggerType === 'MONTHLY') {
      // 使用月报生成任务
      const result = await triggerMonthlyReportGeneration(new Date(periodEnd));
      if (!result.success) {
        return NextResponse.json(
          { success: false, message: result.error || '月报生成失败' },
          { status: 500 }
        );
      }
      reportId = result.reportId;
    } else {
      // 自定义报告生成
      const result = await generateReport(
        {
          type,
          periodStart,
          periodEnd,
          format,
          includeSections: [
            ReportSection.USER_STATS,
            ReportSection.CASE_STATS,
            ReportSection.DEBATE_STATS,
            ReportSection.PERFORMANCE_STATS,
            ReportSection.SUMMARY,
          ],
        },
        user.userId
      );

      if (!result.success) {
        return NextResponse.json(
          { success: false, message: result.error || '报告生成失败' },
          { status: 500 }
        );
      }

      reportId = result.reportId;
      filePath = result.filePath;
      fileSize = result.fileSize;
    }

    return NextResponse.json({
      success: true,
      message: '报告生成成功',
      data: {
        reportId,
        filePath,
        fileSize,
      },
    });
  } catch (error) {
    logger.error('创建报告失败:', error);
    return NextResponse.json(
      { success: false, message: '创建报告失败' },
      { status: 500 }
    );
  }
}
