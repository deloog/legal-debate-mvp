/**
 * Error Analyzer
 *
 * 错误分析模块
 * 负责根因分析、模式识别、趋势分析
 */

import { prisma } from "@/lib/db/prisma";
import {
  ErrorLog,
  ErrorType,
  ErrorPattern,
  RootCauseAnalysis,
  ErrorSeverity,
  TimeRange,
} from "./types";

/**
 * 错误分析器
 */
export class ErrorAnalyzer {
  /**
   * 执行根因分析
   * @param errorLog 错误日志
   * @returns 根因分析结果
   */
  async performRootCauseAnalysis(
    errorLog: ErrorLog,
  ): Promise<RootCauseAnalysis> {
    const analysisId = `analysis_${Date.now()}`;
    const rootCause = this.identifyRootCause(errorLog);
    const contributingFactors = this.identifyContributingFactors(errorLog);
    const suggestedFixes = this.suggestFixes(errorLog);
    const confidence = this.calculateConfidence(errorLog);

    return {
      analysisId,
      errorLogId: errorLog.id || "",
      rootCause,
      confidence,
      contributingFactors,
      suggestedFixes,
      analyzedAt: new Date(),
      aiGenerated: false, // 目前为规则基础，未来可集成AI
    };
  }

  /**
   * 识别错误模式
   * @param timeRange 时间范围
   * @returns 错误模式列表
   */
  async identifyPatterns(timeRange: TimeRange): Promise<ErrorPattern[]> {
    // 查询时间范围内的所有错误
    const errorLogs = await prisma.errorLog.findMany({
      where: {
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 按类型分组
    const errorsByType = new Map<ErrorType, ErrorLog[]>();
    for (const error of errorLogs) {
      const errorType = error.errorType as ErrorType;
      if (!errorsByType.has(errorType)) {
        errorsByType.set(errorType, []);
      }
      errorsByType.get(errorType)!.push(error as unknown as ErrorLog);
    }

    // 识别模式
    const patterns: ErrorPattern[] = [];
    for (const [errorType, errors] of errorsByType.entries()) {
      if (errors.length >= 3) {
        // 至少发生3次才认为是模式
        const pattern = this.analyzePattern(errorType, errors);
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * 分析趋势
   * @param timeRange 时间范围
   * @returns 趋势数据
   */
  async analyzeTrends(timeRange: TimeRange): Promise<{
    byType: Map<ErrorType, number>;
    bySeverity: Map<ErrorSeverity, number>;
    hourlyTrend: number[];
    recoveryRate: number;
  }> {
    const errorLogs = await prisma.errorLog.findMany({
      where: {
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
    });

    // 按类型统计
    const byType = new Map<ErrorType, number>();
    for (const error of errorLogs) {
      const errorType = error.errorType as ErrorType;
      byType.set(errorType, (byType.get(errorType) || 0) + 1);
    }

    // 按严重程度统计
    const bySeverity = new Map<ErrorSeverity, number>();
    for (const error of errorLogs) {
      const severity = error.severity as ErrorSeverity;
      bySeverity.set(severity, (bySeverity.get(severity) || 0) + 1);
    }

    // 按小时统计
    const hours = Math.ceil(
      (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60),
    );
    const hourlyTrend = new Array(hours).fill(0);

    for (const error of errorLogs) {
      const hourIndex = Math.floor(
        (error.createdAt.getTime() - timeRange.start.getTime()) /
          (1000 * 60 * 60),
      );
      if (hourIndex >= 0 && hourIndex < hours) {
        hourlyTrend[hourIndex]++;
      }
    }

    // 计算恢复率
    const recovered = errorLogs.filter((log) => log.recovered).length;
    const recoveryRate =
      errorLogs.length > 0 ? recovered / errorLogs.length : 0;

    return {
      byType,
      bySeverity,
      hourlyTrend,
      recoveryRate,
    };
  }

  /**
   * 识别根因
   * @param errorLog 错误日志
   * @returns 根因描述
   */
  private identifyRootCause(errorLog: ErrorLog): string {
    const errorType = errorLog.errorType;
    const errorMessage = errorLog.errorMessage.toLowerCase();

    // 根据错误类型和消息判断根因
    if (errorMessage.includes("timeout")) {
      return "服务响应超时，可能是网络延迟或服务处理能力不足";
    }

    if (errorMessage.includes("rate limit")) {
      return "API调用频率超出限制，需要实现请求限流";
    }

    if (errorMessage.includes("connection")) {
      return "网络连接失败，可能是服务不可用或网络配置问题";
    }

    if (errorMessage.includes("not found")) {
      return "请求的资源不存在，可能是数据被删除或ID错误";
    }

    if (errorMessage.includes("validation")) {
      return "数据验证失败，输入数据不符合业务规则";
    }

    if (errorMessage.includes("database") || errorMessage.includes("db")) {
      return "数据库操作失败，可能是数据结构问题或约束冲突";
    }

    if (errorType === ErrorType.AI_SERVICE_ERROR) {
      return "AI服务错误，可能是模型响应异常或API配置问题";
    }

    return "未知原因，需要进一步调查";
  }

  /**
   * 识别促成因素
   * @param errorLog 错误日志
   * @returns 促成因素列表
   */
  private identifyContributingFactors(errorLog: ErrorLog): string[] {
    const factors: string[] = [];

    const errorMessage = errorLog.errorMessage.toLowerCase();

    if (errorMessage.includes("timeout")) {
      factors.push("网络延迟");
      factors.push("服务负载过高");
    }

    if (errorMessage.includes("connection")) {
      factors.push("网络不稳定");
      factors.push("服务可用性");
    }

    if (errorMessage.includes("validation")) {
      factors.push("输入数据质量");
      factors.push("业务规则变更");
    }

    if (errorLog.context?.agentName) {
      factors.push(`Agent: ${errorLog.context.agentName}`);
    }

    if (errorLog.context?.operation) {
      factors.push(`操作: ${errorLog.context.operation}`);
    }

    return factors;
  }

  /**
   * 建议修复方案
   * @param errorLog 错误日志
   * @returns 修复建议列表
   */
  private suggestFixes(errorLog: ErrorLog): string[] {
    const fixes: string[] = [];
    const errorMessage = errorLog.errorMessage.toLowerCase();

    if (errorMessage.includes("timeout")) {
      fixes.push("增加超时时间配置");
      fixes.push("实现指数退避重试机制");
      fixes.push("监控服务响应时间");
    }

    if (errorMessage.includes("rate limit")) {
      fixes.push("实现请求队列和限流");
      fixes.push("增加缓存层减少API调用");
      fixes.push("联系服务提供商提升配额");
    }

    if (errorMessage.includes("connection")) {
      fixes.push("检查网络连接和防火墙配置");
      fixes.push("实现连接池和健康检查");
      fixes.push("增加重试机制");
    }

    if (errorMessage.includes("validation")) {
      fixes.push("改进前端验证逻辑");
      fixes.push("提供更清晰的错误提示");
      fixes.push("更新业务规则文档");
    }

    if (errorMessage.includes("database")) {
      fixes.push("检查数据库连接池配置");
      fixes.push("优化数据库查询性能");
      fixes.push("审查数据完整性约束");
    }

    // 通用建议
    fixes.push("增强日志记录");
    fixes.push("添加监控和告警");

    return fixes;
  }

  /**
   * 计算置信度
   * @param errorLog 错误日志
   * @returns 置信度（0-1）
   */
  private calculateConfidence(errorLog: ErrorLog): number {
    let confidence = 0.5; // 基础置信度

    const errorMessage = errorLog.errorMessage.toLowerCase();

    // 明确的错误消息提高置信度
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("not found")
    ) {
      confidence += 0.2;
    }

    // 有上下文信息提高置信度
    if (errorLog.context) {
      confidence += 0.1;
    }

    // 有堆栈跟踪提高置信度
    if (errorLog.stackTrace) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 分析单个错误模式
   * @param errorType 错误类型
   * @param errors 错误列表
   * @returns 错误模式
   */
  private analyzePattern(
    errorType: ErrorType,
    errors: ErrorLog[],
  ): ErrorPattern {
    const patternId = `pattern_${errorType}_${Date.now()}`;
    const frequency = errors.length;
    const lastOccurredAt = errors[0].createdAt;

    // 识别常见原因
    const commonCauses = new Map<string, number>();
    for (const error of errors) {
      const cause = this.identifyRootCause(error);
      commonCauses.set(cause, (commonCauses.get(cause) || 0) + 1);
    }

    const topCauses = Array.from(commonCauses.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cause]) => cause);

    // 确定根因（最常见的原因）
    const rootCause = topCauses[0] || "Unknown";

    // 计算平均恢复时间
    let totalRecoveryTime = 0;
    let recoveredCount = 0;

    for (const error of errors) {
      if (error.recovered && error.createdAt && error.recoveryTime) {
        totalRecoveryTime += error.recoveryTime;
        recoveredCount++;
      }
    }

    const averageRecoveryTime =
      recoveredCount > 0 ? totalRecoveryTime / recoveredCount : 0;

    // 判断趋势
    const recentErrors = errors.slice(0, Math.floor(errors.length / 2));
    const olderErrors = errors.slice(Math.floor(errors.length / 2));

    let trend: "INCREASING" | "STABLE" | "DECREASING" = "STABLE";
    if (recentErrors.length > olderErrors.length + 2) {
      trend = "INCREASING";
    } else if (recentErrors.length < olderErrors.length - 2) {
      trend = "DECREASING";
    }

    return {
      patternId,
      errorType,
      frequency,
      commonCauses: topCauses,
      rootCause,
      averageRecoveryTime,
      lastOccurredAt,
      trend,
    };
  }

  /**
   * 生成错误报告
   * @param timeRange 时间范围
   * @returns 错误报告
   */
  async generateReport(timeRange: TimeRange): Promise<{
    summary: {
      totalErrors: number;
      recoveredErrors: number;
      recoveryRate: number;
      topErrorTypes: Array<{ type: ErrorType; count: number }>;
    };
    patterns: ErrorPattern[];
    trends: {
      byType: Map<ErrorType, number>;
      bySeverity: Map<ErrorSeverity, number>;
      hourlyTrend: number[];
      recoveryRate: number;
    };
  }> {
    const errorLogs = await prisma.errorLog.findMany({
      where: {
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
    });

    // 汇总统计
    const totalErrors = errorLogs.length;
    const recoveredErrors = errorLogs.filter((log) => log.recovered).length;
    const recoveryRate = totalErrors > 0 ? recoveredErrors / totalErrors : 0;

    // 按类型统计
    const errorsByType = new Map<ErrorType, number>();
    for (const error of errorLogs) {
      const errorType = error.errorType as ErrorType;
      errorsByType.set(errorType, (errorsByType.get(errorType) || 0) + 1);
    }

    const topErrorTypes = Array.from(errorsByType.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // 识别模式
    const patterns = await this.identifyPatterns(timeRange);

    // 分析趋势
    const trends = await this.analyzeTrends(timeRange);

    return {
      summary: {
        totalErrors,
        recoveredErrors,
        recoveryRate,
        topErrorTypes,
      },
      patterns,
      trends,
    };
  }
}
