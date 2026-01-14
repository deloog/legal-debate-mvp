/**
 * 案件数据导出API
 * 提供案件数据的CSV和Excel导出功能
 */

import {
  errorResponse,
  forbiddenResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import {
  ExcelGenerator,
  generateExportFilename,
} from '@/lib/export/excel-generator';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { TimeRange } from '@/types/stats';
import type { CaseExportQueryParams, ExportFormat } from '@/types/stats';
import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// 辅助函数：时间范围处理
// =============================================================================

/**
 * 根据时间范围类型计算起止日期
 */
function getDateRange(timeRange: TimeRange): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;

  switch (timeRange) {
    case TimeRange.TODAY:
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.YESTERDAY:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      return {
        startDate,
        endDate: new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1),
      };

    case TimeRange.LAST_7_DAYS:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.LAST_30_DAYS:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.LAST_90_DAYS:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 89);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.THIS_WEEK:
      startDate = new Date(now);
      const dayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.LAST_WEEK:
      startDate = new Date(now);
      const lastWeekDayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - lastWeekDayOfWeek - 7);
      startDate.setHours(0, 0, 0, 0);
      return {
        startDate,
        endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
      };

    case TimeRange.THIS_MONTH:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.LAST_MONTH:
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      return {
        startDate,
        endDate: new Date(
          now.getFullYear(),
          now.getMonth(),
          0,
          23,
          59,
          59,
          999
        ),
      };

    case TimeRange.THIS_YEAR:
      startDate = new Date(now.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
      break;

    default:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

// =============================================================================
// 辅助函数：参数解析
// =============================================================================

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): CaseExportQueryParams | null {
  const url = new URL(request.url);

  const formatParam = url.searchParams.get('format');
  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const caseType = url.searchParams.get('caseType');
  const status = url.searchParams.get('status');

  const validFormats = ['CSV', 'EXCEL', 'JSON', 'PDF'];
  const format = (formatParam || 'CSV') as ExportFormat;

  if (!validFormats.includes(format)) {
    return null;
  }

  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  return {
    format,
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
    caseType: caseType ?? undefined,
    status: status ?? undefined,
  };
}

// =============================================================================
// 核心函数：查询案件数据
// =============================================================================

/**
 * 查询案件数据并格式化为导出格式
 */
async function getCaseExportData(
  startDate: Date,
  endDate: Date,
  caseType?: string,
  status?: string
): Promise<Array<Record<string, unknown>>> {
  const where: Record<string, unknown> = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (caseType) {
    where.type = caseType;
  }

  if (status) {
    where.status = status;
  }

  const cases = await prisma.case.findMany({
    where,
    include: {
      _count: {
        select: {
          debates: true,
          documents: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return cases.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    type: c.type,
    status: c.status,
    amount: c.amount ? c.amount.toString() : '',
    caseNumber: c.caseNumber ?? '',
    cause: c.cause ?? '',
    court: c.court ?? '',
    plaintiffName: c.plaintiffName ?? '',
    defendantName: c.defendantName ?? '',
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    debateCount: c._count.debates,
    documentCount: c._count.documents,
  }));
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/export/cases
 * 导出案件数据（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const permissionError = await validatePermissions(request, 'export:case');
  if (permissionError) {
    return forbiddenResponse('无权限导出数据');
  }

  try {
    const params = parseQueryParams(request);
    if (!params) {
      return errorResponse('无效的查询参数', 400);
    }

    const { startDate, endDate } = getDateRange(params.timeRange);

    const data = await getCaseExportData(
      startDate,
      endDate,
      params.caseType,
      params.status
    );

    const headers = [
      'id',
      'title',
      'description',
      'type',
      'status',
      'amount',
      'caseNumber',
      'cause',
      'court',
      'plaintiffName',
      'defendantName',
      'createdAt',
      'updatedAt',
      'debateCount',
      'documentCount',
    ];

    const generator = ExcelGenerator.fromArray(data, headers, '案件数据');
    const blob = generator.toBlob();

    const filename = generateExportFilename('cases', params.format);

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': blob.type,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('导出案件数据失败:', error);
    return serverErrorResponse('导出案件数据失败');
  }
}
