/**
 * 访问审计报告生成器
 * 统计知识图谱的访问行为
 */

import {
  AuditReportType,
  GenerateReportParams,
  AccessAuditSummary,
  AccessAuditDetail,
  AuditReport,
  ReportGenerator,
} from './types';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * 访问审计生成器
 */
export class AccessAuditGenerator implements ReportGenerator<AccessAuditSummary> {
  /**
   * 生成访问审计报告
   */
  async generate(
    params: GenerateReportParams
  ): Promise<AuditReport<AccessAuditSummary>> {
    logger.info('开始生成访问审计报告', {
      startDate: params.startDate,
      endDate: params.endDate,
      userId: params.userId,
    });

    try {
      // 验证日期格式
      const startDate = new Date(params.startDate);
      const endDate = new Date(params.endDate);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('无效的日期格式');
      }

      if (startDate > endDate) {
        throw new Error('开始日期不能大于结束日期');
      }

      // 设置结束时间为当天最后一刻
      endDate.setHours(23, 59, 59, 999);

      // 查询访问相关的日志
      const logs = await this.queryAccessLogs(startDate, endDate);

      // 生成摘要
      const summary = this.generateSummary(logs);

      // 格式化详情
      const details = this.formatDetails(logs);

      const report: AuditReport<AccessAuditSummary> = {
        reportType: AuditReportType.ACCESS_AUDIT,
        period: {
          start: params.startDate,
          end: params.endDate,
        },
        summary,
        details,
        generatedAt: new Date().toISOString(),
        generatedBy: params.userId || 'system',
      };

      logger.info('访问审计报告生成完成', {
        totalLogs: logs.length,
        totalViews: summary.totalViews,
        totalExports: summary.totalExports,
        uniqueUsers: summary.uniqueUsers,
      });

      return report;
    } catch (error) {
      logger.error('生成访问审计报告失败', { error, params });
      throw error;
    }
  }

  /**
   * 查询访问相关的日志
   */
  private async queryAccessLogs(
    startDate: Date,
    endDate: Date
  ): Promise<unknown[]> {
    return prisma.actionLog.findMany({
      where: {
        actionType: {
          in: ['VIEW_CASE', 'EXPORT_DATA'],
        },
        resourceType: 'LAW_ARTICLE_RELATION',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * 生成访问审计摘要
   */
  private generateSummary(logs: unknown[]): AccessAuditSummary {
    const viewLogs = logs.filter(
      log => (log as { actionType: string }).actionType === 'VIEW_CASE'
    );
    const exportLogs = logs.filter(
      log => (log as { actionType: string }).actionType === 'EXPORT_DATA'
    );

    const uniqueUsers = new Set(
      logs.map(log => (log as { userId: string }).userId)
    );

    // 计算人均访问次数
    const avgViewsPerUser =
      uniqueUsers.size > 0
        ? Math.round((viewLogs.length / uniqueUsers.size) * 100) / 100
        : 0;

    // 统计热门关系TOP10
    const relationCounts = new Map<string, number>();
    for (const log of viewLogs) {
      const resourceId = (log as { resourceId?: string }).resourceId;
      if (resourceId) {
        relationCounts.set(
          resourceId,
          (relationCounts.get(resourceId) || 0) + 1
        );
      }
    }

    const topViewedRelations = Array.from(relationCounts.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 找到访问高峰时间（按小时统计）
    const peakViewTime = this.findPeakViewTime(viewLogs);

    return {
      totalViews: viewLogs.length,
      totalExports: exportLogs.length,
      uniqueUsers: uniqueUsers.size,
      topViewedRelations,
      avgViewsPerUser,
      peakViewTime,
    };
  }

  /**
   * 找到访问高峰时间
   */
  private findPeakViewTime(viewLogs: unknown[]): Date | null {
    if (viewLogs.length === 0) {
      return null;
    }

    const hourCounts = new Map<string, number>();
    for (const log of viewLogs) {
      const createdAt = (log as { createdAt: Date }).createdAt;
      const hourKey = new Date(
        createdAt.getFullYear(),
        createdAt.getMonth(),
        createdAt.getDate(),
        createdAt.getHours()
      ).toISOString();
      hourCounts.set(hourKey, (hourCounts.get(hourKey) || 0) + 1);
    }

    let maxCount = 0;
    let peakHour: string | null = null;

    for (const [hour, count] of hourCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    }

    return peakHour ? new Date(peakHour) : null;
  }

  /**
   * 格式化详情记录
   */
  formatDetails(logs: unknown[]): AccessAuditDetail[] {
    return logs.map(log => {
      const logData = log as {
        createdAt: Date;
        userId: string;
        actionType: string;
        resourceType: string;
        resourceId?: string;
        description: string;
        ipAddress?: string;
        userAgent?: string;
      };

      return {
        timestamp: logData.createdAt,
        userId: logData.userId,
        action: logData.actionType,
        resourceType: logData.resourceType,
        resourceId: logData.resourceId,
        description: logData.description,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
      };
    });
  }
}
