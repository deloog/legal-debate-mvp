/**
 * 变更审计报告生成器
 * 统计知识图谱的变更行为
 */

import {
  AuditReportType,
  GenerateReportParams,
  ChangeAuditSummary,
  ChangeAuditDetail,
  AuditReport,
  ReportGenerator,
} from './types';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * 变更审计生成器
 */
export class ChangeAuditGenerator implements ReportGenerator<ChangeAuditSummary> {
  /**
   * 生成变更审计报告
   */
  async generate(
    params: GenerateReportParams
  ): Promise<AuditReport<ChangeAuditSummary>> {
    logger.info('开始生成变更审计报告', {
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

      // 查询变更相关的日志
      const logs = await this.queryChangeLogs(startDate, endDate);

      // 生成摘要
      const summary = this.generateSummary(logs);

      // 格式化详情
      const details = this.formatDetails(logs);

      const report: AuditReport<ChangeAuditSummary> = {
        reportType: AuditReportType.CHANGE_AUDIT,
        period: {
          start: params.startDate,
          end: params.endDate,
        },
        summary,
        details,
        generatedAt: new Date().toISOString(),
        generatedBy: params.userId || 'system',
      };

      logger.info('变更审计报告生成完成', {
        totalLogs: logs.length,
        totalRelationsCreated: summary.totalRelationsCreated,
        totalRelationsDeleted: summary.totalRelationsDeleted,
        totalVerified: summary.totalVerified,
      });

      return report;
    } catch (error) {
      logger.error('生成变更审计报告失败', { error, params });
      throw error;
    }
  }

  /**
   * 查询变更相关的日志
   */
  private async queryChangeLogs(
    startDate: Date,
    endDate: Date
  ): Promise<unknown[]> {
    return prisma.actionLog.findMany({
      where: {
        actionType: 'UPDATE_CASE',
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
   * 生成变更审计摘要
   */
  private generateSummary(logs: unknown[]): ChangeAuditSummary {
    // 统计创建、删除、验证、拒绝
    let totalRelationsCreated = 0;
    let totalRelationsDeleted = 0;
    let totalVerified = 0;
    let totalRejected = 0;
    let totalBatchOperations = 0;

    // 统计操作员活跃度
    const operatorCounts = new Map<
      string,
      { count: number; userName?: string }
    >();

    for (const log of logs) {
      const logData = log as {
        metadata?: { operation?: string; result?: string; isBatch?: boolean };
        userId: string;
        userName?: string;
      };

      // 统计操作类型
      const operation = logData.metadata?.operation;
      if (operation === 'create') {
        totalRelationsCreated++;
      } else if (operation === 'delete') {
        totalRelationsDeleted++;
      } else if (operation === 'verify') {
        if (logData.metadata?.result === 'approved') {
          totalVerified++;
        } else if (logData.metadata?.result === 'rejected') {
          totalRejected++;
        }
      }

      // 统计批量操作
      if (logData.metadata?.isBatch) {
        totalBatchOperations++;
      }

      // 统计操作员
      const userId = logData.userId;
      const operator = operatorCounts.get(userId);
      if (operator) {
        operator.count++;
      } else {
        operatorCounts.set(userId, { count: 1, userName: logData.userName });
      }
    }

    // 计算验证率
    const totalVerificationOperations = totalVerified + totalRejected;
    const verificationRate =
      totalVerificationOperations > 0
        ? Math.round((totalVerified / totalVerificationOperations) * 10000) /
          100
        : 0;

    // 找到活跃操作员TOP5
    const topOperators = Array.from(operatorCounts.entries())
      .map(([userId, data]) => ({
        userId,
        userName: data.userName,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRelationsCreated,
      totalRelationsDeleted,
      totalVerified,
      totalRejected,
      verificationRate,
      totalBatchOperations,
      topOperators,
    };
  }

  /**
   * 格式化详情记录
   */
  formatDetails(logs: unknown[]): ChangeAuditDetail[] {
    return logs.map(log => {
      const logData = log as {
        createdAt: Date;
        userId: string;
        userName?: string;
        actionType: string;
        resourceType: string;
        resourceId?: string;
        description: string;
        metadata?: Record<string, unknown>;
      };

      return {
        timestamp: logData.createdAt,
        userId: logData.userId,
        userName: logData.userName,
        action: logData.actionType,
        resourceType: logData.resourceType,
        resourceId: logData.resourceId,
        description: logData.description,
        metadata: logData.metadata,
      };
    });
  }
}
