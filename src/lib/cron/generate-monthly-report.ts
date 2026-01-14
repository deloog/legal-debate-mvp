/**
 * 月报生成定时任务
 * 每月1日凌晨3:00执行
 */

import { generateMonthlyReport } from '@/lib/report/report-generator';
import { prisma } from '@/lib/db/prisma';
import { ReportStatus } from '@/types/stats';

/**
 * 执行月报生成任务
 */
export async function executeMonthlyReportGeneration(): Promise<{
  success: boolean;
  reportId?: string;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    console.log('开始执行月报生成任务...');

    // 检查本月是否已生成报告
    const now = new Date();
    const monthStart = getMonthStart(now);
    const monthEnd = getMonthEnd(now);

    const existingReport = await prisma.report.findFirst({
      where: {
        type: 'MONTHLY',
        periodStart: monthStart,
        periodEnd: monthEnd,
        status: {
          in: [ReportStatus.COMPLETED, ReportStatus.GENERATING],
        },
      },
    });

    if (existingReport) {
      console.log('本月报告已存在，跳过生成');
      return {
        success: true,
        reportId: existingReport.id,
      };
    }

    // 生成月报
    const result = await generateMonthlyReport(now);

    if (result.success) {
      const duration = Date.now() - startTime;
      console.log(
        `月报生成成功，报告ID: ${result.reportId}，耗时: ${duration}ms`
      );

      return {
        success: true,
        reportId: result.reportId,
      };
    } else {
      console.error('月报生成失败:', result.error);
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('月报生成任务执行异常:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 获取本月的开始时间（1号凌晨0:00）
 */
function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 获取本月的结束时间（最后一天23:59:59）
 */
function getMonthEnd(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * 手动触发月报生成（用于测试）
 */
export async function triggerMonthlyReportGeneration(endDate?: Date): Promise<{
  success: boolean;
  reportId?: string;
  error?: string;
}> {
  try {
    const result = await generateMonthlyReport(endDate || new Date());
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
