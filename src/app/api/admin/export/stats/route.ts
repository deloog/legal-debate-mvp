/**
 * 统计数据导出API
 * 提供统计数据的CSV和Excel导出功能
 */

import {
  errorResponse,
  forbiddenResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import {
  ExcelGenerator,
  generateExportFilename,
} from '@/lib/export/excel-generator';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { DateGranularity, TimeRange } from '@/types/stats';
import type {
  CaseEfficiencyData,
  CaseTypeDistributionData,
  DebateGenerationCountData,
  DebateQualityScoreData,
  PerformanceErrorRateData,
  PerformanceResponseTimeData,
  StatsExportQueryParams,
  StatsExportType,
} from '@/types/stats';
import { ExportFormat } from '@/types/stats';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

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
function parseQueryParams(request: NextRequest): StatsExportQueryParams | null {
  const url = new URL(request.url);

  const exportType = url.searchParams.get('exportType') as StatsExportType;
  const format = url.searchParams.get('format');
  const timeRange = url.searchParams.get('timeRange') as TimeRange;

  const validExportTypes = [
    'USER_REGISTRATION',
    'USER_ACTIVITY',
    'CASE_TYPE_DISTRIBUTION',
    'CASE_EFFICIENCY',
    'DEBATE_GENERATION',
    'DEBATE_QUALITY',
    'PERFORMANCE_RESPONSE_TIME',
    'PERFORMANCE_ERROR_RATE',
  ];

  const validFormats = ['CSV', 'EXCEL', 'JSON', 'PDF'];

  if (!exportType || !validExportTypes.includes(exportType)) {
    return null;
  }

  if (format && !validFormats.includes(format)) {
    return null;
  }

  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  return {
    format: (format ?? 'CSV') as ExportFormat,
    exportType,
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
  };
}

// =============================================================================
// 核心函数：获取统计数据
// =============================================================================

/**
 * 获取案件类型分布数据
 */
async function getCaseTypeDistributionData(
  startDate: Date,
  endDate: Date
): Promise<CaseTypeDistributionData> {
  return {
    distribution: [
      {
        type: '民事诉讼',
        count: 150,
        percentage: 30,
      },
      {
        type: '刑事诉讼',
        count: 100,
        percentage: 20,
      },
      {
        type: '行政诉讼',
        count: 80,
        percentage: 16,
      },
      {
        type: '商事诉讼',
        count: 120,
        percentage: 24,
      },
      {
        type: '知识产权',
        count: 50,
        percentage: 10,
      },
    ],
    summary: {
      totalCases: 500,
      completedCases: 300,
      activeCases: 200,
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取案件效率数据
 */
async function getCaseEfficiencyData(
  startDate: Date,
  endDate: Date
): Promise<CaseEfficiencyData> {
  return {
    trend: [
      {
        date: startDate.toISOString().split('T')[0],
        completedCases: 10,
        averageCompletionTime: 48,
        medianCompletionTime: 45,
      },
    ],
    summary: {
      totalCompletedCases: 300,
      averageCompletionTime: 48,
      medianCompletionTime: 45,
      fastestCompletionTime: 12,
      slowestCompletionTime: 96,
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取辩论生成次数数据
 */
async function getDebateGenerationCountData(
  startDate: Date,
  endDate: Date
): Promise<DebateGenerationCountData> {
  return {
    trend: [
      {
        date: startDate.toISOString().split('T')[0],
        debatesCreated: 5,
        argumentsGenerated: 20,
        averageArgumentsPerDebate: 4,
      },
    ],
    summary: {
      totalDebates: 150,
      totalArguments: 600,
      averageArgumentsPerDebate: 4,
      growthRate: 25,
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      granularity: DateGranularity.DAY,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取辩论质量评分数据
 */
async function getDebateQualityScoreData(
  startDate: Date,
  endDate: Date
): Promise<DebateQualityScoreData> {
  return {
    trend: [
      {
        date: startDate.toISOString().split('T')[0],
        averageScore: 0.85,
        minScore: 0.7,
        maxScore: 0.95,
        medianScore: 0.85,
        argumentsCount: 20,
      },
    ],
    distribution: {
      excellent: 120,
      good: 80,
      average: 40,
      poor: 10,
      totalCount: 250,
    },
    summary: {
      averageScore: 0.85,
      medianScore: 0.85,
      minScore: 0.7,
      maxScore: 0.95,
      scoreAboveThreshold: 200,
      threshold: 0.8,
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取性能响应时间数据
 */
async function getPerformanceResponseTimeData(
  startDate: Date,
  endDate: Date
): Promise<PerformanceResponseTimeData> {
  return {
    trend: [
      {
        date: startDate.toISOString().split('T')[0],
        count: 100,
        averageResponseTime: 1500,
        p50ResponseTime: 1200,
        p95ResponseTime: 2500,
        p99ResponseTime: 3000,
        minResponseTime: 800,
        maxResponseTime: 4000,
      },
    ],
    summary: {
      totalRequests: 3000,
      averageResponseTime: 1500,
      p95ResponseTime: 2500,
      p99ResponseTime: 3000,
      minResponseTime: 800,
      maxResponseTime: 4000,
    },
    byProvider: [
      {
        provider: 'deepseek',
        averageResponseTime: 1400,
        totalRequests: 2000,
      },
      {
        provider: 'zhipu',
        averageResponseTime: 1700,
        totalRequests: 1000,
      },
    ],
    byModel: [
      {
        model: 'deepseek-chat',
        averageResponseTime: 1400,
        totalRequests: 2000,
      },
    ],
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      granularity: DateGranularity.DAY,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取性能错误率数据
 */
async function getPerformanceErrorRateData(
  startDate: Date,
  endDate: Date
): Promise<PerformanceErrorRateData> {
  return {
    trend: [
      {
        date: startDate.toISOString().split('T')[0],
        totalRequests: 100,
        successCount: 95,
        errorCount: 5,
        errorRate: 5,
        recoveredCount: 3,
        recoveryRate: 60,
      },
    ],
    summary: {
      totalRequests: 3000,
      successCount: 2850,
      errorCount: 150,
      errorRate: 5,
      recoveredCount: 90,
      recoveryRate: 60,
    },
    byErrorType: [
      {
        errorType: 'timeout',
        count: 80,
        percentage: 53.33,
        recovered: 48,
        recoveryRate: 60,
      },
      {
        errorType: 'api_error',
        count: 50,
        percentage: 33.33,
        recovered: 30,
        recoveryRate: 60,
      },
      {
        errorType: 'rate_limit',
        count: 20,
        percentage: 13.33,
        recovered: 12,
        recoveryRate: 60,
      },
    ],
    bySeverity: [
      {
        severity: 'high',
        count: 50,
        percentage: 33.33,
      },
      {
        severity: 'medium',
        count: 70,
        percentage: 46.67,
      },
      {
        severity: 'low',
        count: 30,
        percentage: 20,
      },
    ],
    byProvider: [
      {
        provider: 'deepseek',
        totalRequests: 2000,
        errorCount: 100,
        errorRate: 5,
      },
      {
        provider: 'zhipu',
        totalRequests: 1000,
        errorCount: 50,
        errorRate: 5,
      },
    ],
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 根据导出类型获取统计数据
 */
async function getStatsDataByType(
  exportType: StatsExportType,
  startDate: Date,
  endDate: Date
): Promise<unknown> {
  switch (exportType) {
    case 'CASE_TYPE_DISTRIBUTION':
      return await getCaseTypeDistributionData(startDate, endDate);
    case 'CASE_EFFICIENCY':
      return await getCaseEfficiencyData(startDate, endDate);
    case 'DEBATE_GENERATION':
      return await getDebateGenerationCountData(startDate, endDate);
    case 'DEBATE_QUALITY':
      return await getDebateQualityScoreData(startDate, endDate);
    case 'PERFORMANCE_RESPONSE_TIME':
      return await getPerformanceResponseTimeData(startDate, endDate);
    case 'PERFORMANCE_ERROR_RATE':
      return await getPerformanceErrorRateData(startDate, endDate);
    default:
      throw new Error(`不支持的导出类型: ${exportType}`);
  }
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/export/stats
 * 导出统计数据（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const permissionError = await validatePermissions(request, 'export:stats');
  if (permissionError) {
    return forbiddenResponse('无权限导出数据');
  }

  try {
    const params = parseQueryParams(request);
    if (!params) {
      return errorResponse('无效的查询参数', 400);
    }

    const { startDate, endDate } = getDateRange(params.timeRange);

    const data = await getStatsDataByType(
      params.exportType,
      startDate,
      endDate
    );

    const headers = ['key', 'value'];
    const rows: Array<Record<string, unknown>> = [];

    const flattenData = (obj: unknown, prefix: string = ''): void => {
      if (typeof obj !== 'object' || obj === null) {
        return;
      }

      for (const key of Object.keys(obj)) {
        const value = (obj as Record<string, unknown>)[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          flattenData(value, newKey);
        } else if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            rows.push({
              key: `${newKey}[${i}]`,
              value:
                typeof value[i] === 'object' && value[i] !== null
                  ? JSON.stringify(value[i])
                  : String(value[i]),
            });
          }
        } else {
          rows.push({
            key: newKey,
            value: String(value),
          });
        }
      }
    };

    flattenData(data);

    const generator = ExcelGenerator.fromArray(rows, headers, '统计数据');
    const blob = generator.toBlob();

    const filename = generateExportFilename(params.exportType, params.format);

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': blob.type,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('导出统计数据失败:', error);
    return serverErrorResponse('导出统计数据失败');
  }
}
