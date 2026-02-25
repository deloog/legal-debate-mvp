/**
 * 合规报告生成器
 * 统计知识图谱的合规情况（基于PIPL）
 */

import {
  AuditReportType,
  GenerateReportParams,
  ComplianceSummary,
  ComplianceAuditDetail,
  AuditReport,
  ReportGenerator,
} from './types';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * 合规报告生成器
 */
export class ComplianceGenerator implements ReportGenerator<ComplianceSummary> {
  /**
   * 生成合规报告
   */
  async generate(
    params: GenerateReportParams
  ): Promise<AuditReport<ComplianceSummary>> {
    logger.info('开始生成合规报告', {
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

      // 查询合规相关的日志
      const logs = await this.queryComplianceLogs(startDate, endDate);

      // 生成摘要
      const summary = this.generateSummary(logs);

      // 格式化详情
      const details = this.formatDetails(logs);

      const report: AuditReport<ComplianceSummary> = {
        reportType: AuditReportType.COMPLIANCE,
        period: {
          start: params.startDate,
          end: params.endDate,
        },
        summary,
        details,
        generatedAt: new Date().toISOString(),
        generatedBy: params.userId || 'system',
      };

      logger.info('合规报告生成完成', {
        totalLogs: logs.length,
        totalDataAccess: summary.totalDataAccess,
        sensitiveDataAccess: summary.sensitiveDataAccess,
        complianceScore: summary.complianceScore,
      });

      return report;
    } catch (error) {
      logger.error('生成合规报告失败', { error, params });
      throw error;
    }
  }

  /**
   * 查询合规相关的日志
   */
  private async queryComplianceLogs(
    startDate: Date,
    endDate: Date
  ): Promise<unknown[]> {
    return prisma.actionLog.findMany({
      where: {
        actionType: {
          in: ['VIEW_CASE', 'DELETE_CASE'],
        },
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
   * 生成合规摘要
   */
  private generateSummary(logs: unknown[]): ComplianceSummary {
    let totalDataAccess = 0;
    let sensitiveDataAccess = 0;
    let dataDeletionRequests = 0;
    let dataDeletionCompleted = 0;
    let unauthorizedAccessAttempts = 0;
    let privacyViolations = 0;

    for (const log of logs) {
      const logData = log as {
        actionType: string;
        metadata?: {
          isSensitive?: boolean;
          isCompleted?: boolean;
          isUnauthorized?: boolean;
          isAuthorized?: boolean;
        };
      };

      // 统计数据访问
      if (logData.actionType === 'VIEW_CASE') {
        totalDataAccess++;
      }

      // 统计敏感数据访问
      if (logData.metadata?.isSensitive) {
        sensitiveDataAccess++;
      }

      // 统计删除请求
      if (logData.actionType === 'DELETE_CASE') {
        dataDeletionRequests++;
        if (logData.metadata?.isCompleted) {
          dataDeletionCompleted++;
        }
      }

      // 统计未授权访问
      if (logData.metadata?.isUnauthorized) {
        unauthorizedAccessAttempts++;
        privacyViolations++;
      }
    }

    // 计算合规评分（基于未授权访问的比例）
    const complianceScore =
      totalDataAccess > 0
        ? Math.round(
            ((totalDataAccess - unauthorizedAccessAttempts) / totalDataAccess) *
              10000
          ) / 100
        : 100; // 无数据时默认100分

    return {
      totalDataAccess,
      sensitiveDataAccess,
      dataDeletionRequests,
      dataDeletionCompleted,
      complianceScore,
      privacyViolations,
      unauthorizedAccessAttempts,
    };
  }

  /**
   * 格式化详情记录
   */
  formatDetails(logs: unknown[]): ComplianceAuditDetail[] {
    return logs.map(log => {
      const logData = log as {
        createdAt: Date;
        userId: string;
        userName?: string;
        actionType: string;
        resourceType: string;
        resourceId?: string;
        description: string;
        metadata?: {
          isSensitive?: boolean;
          isUnauthorized?: boolean;
          isAuthorized?: boolean;
        };
      };

      // 判断风险等级
      const isSensitive = logData.metadata?.isSensitive || false;
      const isUnauthorized = logData.metadata?.isUnauthorized || false;
      const riskLevel = this.determineRiskLevel(isSensitive, isUnauthorized);

      return {
        timestamp: logData.createdAt,
        userId: logData.userId,
        userName: logData.userName,
        action: logData.actionType,
        resourceType: logData.resourceType,
        resourceId: logData.resourceId,
        isSensitive,
        description: logData.description,
        riskLevel,
      };
    });
  }

  /**
   * 确定风险等级
   */
  private determineRiskLevel(
    isSensitive: boolean,
    isUnauthorized: boolean
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (isSensitive && isUnauthorized) {
      return 'critical'; // 敏感数据+未授权=严重风险
    }
    if (isUnauthorized) {
      return 'high'; // 未授权访问=高风险
    }
    if (isSensitive) {
      return 'medium'; // 敏感数据访问=中风险
    }
    return 'low'; // 普通访问=低风险
  }
}
