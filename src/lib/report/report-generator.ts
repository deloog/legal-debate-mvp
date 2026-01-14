/**
 * 报告生成器模块
 * 负责生成周报和月报
 */

import { prisma } from '@/lib/db/prisma';
import type {
  ReportContent,
  ReportGenerationConfig,
  ReportType,
} from '@/types/stats';
import { ReportStatus, ReportFormat, ReportSection } from '@/types/stats';
import { collectReportData } from './report-data-collector';
import { buildReportContent } from './report-content-builder';
import { formatReport } from './report-formatter';
import fs from 'fs/promises';
import type { Prisma } from '@prisma/client';

/**
 * 报告生成结果
 */
interface ReportGenerationResult {
  success: boolean;
  reportId?: string;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

/**
 * 生成报告
 */
export async function generateReport(
  config: ReportGenerationConfig,
  userId?: string
): Promise<ReportGenerationResult> {
  const startTime = Date.now();

  try {
    // 1. 创建报告记录
    const report = await prisma.report.create({
      data: {
        type: config.type,
        periodStart: new Date(config.periodStart),
        periodEnd: new Date(config.periodEnd),
        format: config.format,
        status: ReportStatus.GENERATING,
        generatedBy: userId || 'SYSTEM',
      },
    });

    // 2. 收集统计数据
    const reportData = await collectReportData(config);

    // 3. 构建报告内容
    const content = buildReportContent(reportData, config);

    // 4. 生成报告文件
    const fileName = generateFileName(config, report.id);
    const filePath = await formatReport(content, config.format, fileName);

    // 5. 获取文件大小
    const fileStats = await fs.stat(filePath);
    const fileSize = fileStats.size;

    // 6. 更新报告记录
    const generationTime = Date.now() - startTime;
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.COMPLETED,
        filePath,
        fileSize,
        generatedAt: new Date(),
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: userId || 'SYSTEM',
          generationTime,
          dataPoints: calculateDataPoints(content),
          periodStart: config.periodStart,
          periodEnd: config.periodEnd,
        },
        content: content as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      reportId: report.id,
      filePath,
      fileSize,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 更新报告记录为失败状态
    if (error instanceof Error && 'reportId' in error) {
      try {
        await prisma.report.update({
          where: { id: (error as { reportId: string }).reportId },
          data: {
            status: ReportStatus.FAILED,
            error: errorMessage,
          },
        });
      } catch (updateError) {
        console.error('Failed to update report status:', updateError);
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 生成周报
 */
export async function generateWeeklyReport(
  endDate: Date = new Date(),
  userId?: string
): Promise<ReportGenerationResult> {
  // 计算上周的日期范围（周一至周日）
  const periodEnd = new Date(endDate);
  const periodStart = new Date(endDate);
  periodStart.setDate(periodStart.getDate() - 6); // 回溯6天

  const config: ReportGenerationConfig = {
    type: 'WEEKLY' as ReportType,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    format: ReportFormat.HTML,
    includeSections: [
      ReportSection.USER_STATS,
      ReportSection.CASE_STATS,
      ReportSection.DEBATE_STATS,
      ReportSection.PERFORMANCE_STATS,
      ReportSection.SUMMARY,
    ],
  };

  return generateReport(config, userId);
}

/**
 * 生成月报
 */
export async function generateMonthlyReport(
  endDate: Date = new Date(),
  userId?: string
): Promise<ReportGenerationResult> {
  // 计算上月的日期范围
  const periodEnd = new Date(endDate);
  const periodStart = new Date(endDate);
  periodStart.setMonth(periodStart.getMonth() - 1);
  periodStart.setDate(1);

  return generateReport(
    {
      type: 'MONTHLY' as ReportType,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      format: ReportFormat.HTML,
      includeSections: [
        ReportSection.USER_STATS,
        ReportSection.CASE_STATS,
        ReportSection.DEBATE_STATS,
        ReportSection.PERFORMANCE_STATS,
        ReportSection.SUMMARY,
      ],
    },
    userId
  );
}

/**
 * 生成文件名
 */
function generateFileName(
  config: ReportGenerationConfig,
  reportId: string
): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const typeMap: Record<string, string> = {
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    CUSTOM: 'custom',
  };

  const type = typeMap[config.type] || 'custom';
  const formatExt = config.format.toLowerCase();

  return `reports/${type}_${reportId}_${dateStr}.${formatExt}`;
}

/**
 * 计算数据点数量
 */
function calculateDataPoints(content: ReportContent): number {
  let count = 0;

  if (content.userStats?.trends?.registrationTrend) {
    count += content.userStats.trends.registrationTrend.length;
  }
  if (content.userStats?.trends?.activityTrend) {
    count += content.userStats.trends.activityTrend.length;
  }
  if (content.caseStats?.trends) {
    count += content.caseStats.trends.length;
  }
  if (content.debateStats?.trends?.generationCount) {
    count += content.debateStats.trends.generationCount.length;
  }
  if (content.debateStats?.trends?.qualityScore) {
    count += content.debateStats.trends.qualityScore.length;
  }
  if (content.performanceStats?.trends?.responseTime) {
    count += content.performanceStats.trends.responseTime.length;
  }
  if (content.performanceStats?.trends?.errorRate) {
    count += content.performanceStats.trends.errorRate.length;
  }

  return count;
}
