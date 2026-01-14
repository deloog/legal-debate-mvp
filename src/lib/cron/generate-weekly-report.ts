/**
 * 周报生成定时任务
 * 每周一凌晨2:00执行
 */

import { generateWeeklyReport } from '@/lib/report/report-generator';
import { prisma } from '@/lib/db/prisma';
import { ReportStatus } from '@/types/stats';

/**
 * 执行周报生成任务
 */
export async function executeWeeklyReportGeneration(): Promise<{
  success: boolean;
  reportId?: string;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    console.log('开始执行周报生成任务...');

    // 检查本周是否已生成报告
    const now = new Date();
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const existingReport = await prisma.report.findFirst({
      where: {
        type: 'WEEKLY',
        periodStart: weekStart,
        periodEnd: weekEnd,
        status: {
          in: [ReportStatus.COMPLETED, ReportStatus.GENERATING],
        },
      },
    });

    if (existingReport) {
      console.log('本周报告已存在，跳过生成');
      return {
        success: true,
        reportId: existingReport.id,
      };
    }

    // 生成周报
    const result = await generateWeeklyReport(now);

    if (result.success) {
      const duration = Date.now() - startTime;
      console.log(
        `周报生成成功，报告ID: ${result.reportId}，耗时: ${duration}ms`
      );

      return {
        success: true,
        reportId: result.reportId,
      };
    } else {
      console.error('周报生成失败:', result.error);
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('周报生成任务执行异常:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 获取本周的开始时间（周一凌晨0:00）
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 手动触发周报生成（用于测试）
 */
export async function triggerWeeklyReportGeneration(endDate?: Date): Promise<{
  success: boolean;
  reportId?: string;
  error?: string;
}> {
  try {
    const result = await generateWeeklyReport(endDate || new Date());
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
