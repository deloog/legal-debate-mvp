/**
 * 报告数据收集器
 * 从各个统计API收集数据
 */

import type { ReportGenerationConfig, ReportContent } from '@/types/stats';
import { ReportSection } from '@/types/stats';
import { prisma } from '@/lib/db/prisma';

/**
 * 收集报告数据
 */
export async function collectReportData(
  config: ReportGenerationConfig
): Promise<ReportContent> {
  const content: ReportContent = {
    summary: {
      keyMetrics: [],
      highlights: [],
      issues: [],
      recommendations: [],
    },
  };

  // 根据配置收集数据
  const sections = config.includeSections || [
    ReportSection.USER_STATS,
    ReportSection.CASE_STATS,
    ReportSection.DEBATE_STATS,
    ReportSection.PERFORMANCE_STATS,
    ReportSection.SUMMARY,
  ];

  for (const section of sections) {
    switch (section) {
      case ReportSection.USER_STATS:
        content.userStats = await collectUserStats(config);
        break;
      case ReportSection.CASE_STATS:
        content.caseStats = await collectCaseStats(config);
        break;
      case ReportSection.DEBATE_STATS:
        content.debateStats = await collectDebateStats(config);
        break;
      case ReportSection.PERFORMANCE_STATS:
        content.performanceStats = await collectPerformanceStats(config);
        break;
      case ReportSection.SUMMARY:
        content.summary = generateSummary(content);
        break;
    }
  }

  return content;
}

/**
 * 收集用户统计数据
 */
async function collectUserStats(
  config: ReportGenerationConfig
): Promise<ReportContent['userStats']> {
  // 获取注册趋势
  const registrationTrend = await prisma.$queryRaw<
    Array<{
      date: Date;
      count: bigint;
    }>
  >`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as count
    FROM users
    WHERE created_at >= ${new Date(config.periodStart)}
      AND created_at <= ${new Date(config.periodEnd)}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  // 获取用户总数
  const totalUsers = await prisma.user.count();
  const newUsers = await prisma.user.count({
    where: {
      createdAt: {
        gte: new Date(config.periodStart),
        lte: new Date(config.periodEnd),
      },
    },
  });

  // 获取活跃用户（7天内登录）
  const activeDate = new Date();
  activeDate.setDate(activeDate.getDate() - 7);
  const activeUsers = await prisma.user.count({
    where: {
      lastLoginAt: {
        gte: activeDate,
      },
    },
  });

  // 计算增长率
  const growthRate = totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0;

  return {
    summary: {
      totalUsers,
      newUsers,
      activeUsers,
      growthRate: Number(growthRate.toFixed(2)),
    },
    trends: {
      registrationTrend: registrationTrend.map(item => ({
        date: item.date.toISOString().split('T')[0],
        count: Number(item.count),
      })),
      activityTrend: [],
    },
    distribution: {
      veryActive: 0,
      active: activeUsers,
      inactive: 0,
      dormant: 0,
    },
  };
}

/**
 * 收集案件统计数据
 */
async function collectCaseStats(
  config: ReportGenerationConfig
): Promise<ReportContent['caseStats']> {
  // 获取案件总数
  const totalCases = await prisma.case.count({
    where: {
      createdAt: {
        gte: new Date(config.periodStart),
        lte: new Date(config.periodEnd),
      },
    },
  });

  // 获取案件类型分布
  const typeDistribution = await prisma.$queryRaw<
    Array<{
      type: string;
      count: bigint;
    }>
  >`
    SELECT type, COUNT(*) as count
    FROM cases
    WHERE created_at >= ${new Date(config.periodStart)}
      AND created_at <= ${new Date(config.periodEnd)}
    GROUP BY type
  `;

  const total = Number(
    typeDistribution.reduce((sum, item) => sum + Number(item.count), 0)
  );

  // 获取案件效率
  const completedCases = await prisma.case.findMany({
    where: {
      status: 'COMPLETED',
      createdAt: {
        gte: new Date(config.periodStart),
        lte: new Date(config.periodEnd),
      },
    },
    select: {
      createdAt: true,
      updatedAt: true,
    },
  });

  const completionTimes = completedCases.map(
    c => c.updatedAt.getTime() - c.createdAt.getTime()
  );

  const avgCompletionTime =
    completionTimes.length > 0
      ? completionTimes.reduce((sum, time) => sum + time, 0) /
        completionTimes.length /
        (1000 * 60 * 60)
      : 0;

  return {
    summary: {
      totalCases,
      completedCases: completedCases.length,
      activeCases: totalCases - completedCases.length,
      averageCompletionTime: Number(avgCompletionTime.toFixed(2)),
    },
    distribution: typeDistribution.map(item => ({
      type: item.type,
      count: Number(item.count),
      percentage: total > 0 ? (Number(item.count) / total) * 100 : 0,
    })),
    trends: [],
  };
}

/**
 * 收集辩论统计数据
 */
async function collectDebateStats(
  config: ReportGenerationConfig
): Promise<ReportContent['debateStats']> {
  // 获取辩论总数
  const debates = await prisma.debate.findMany({
    where: {
      createdAt: {
        gte: new Date(config.periodStart),
        lte: new Date(config.periodEnd),
      },
    },
    include: {
      rounds: {
        include: {
          arguments: true,
        },
      },
    },
  });

  const totalDebates = debates.length;
  const totalArguments = debates.reduce(
    (sum, debate) =>
      sum +
      debate.rounds.reduce(
        (roundSum, round) => roundSum + round.arguments.length,
        0
      ),
    0
  );

  const averageArgumentsPerDebate =
    totalDebates > 0 ? totalArguments / totalDebates : 0;

  // 计算平均质量评分
  const argumentsList = debates.flatMap(debate =>
    debate.rounds.flatMap(round => round.arguments)
  );

  const confidenceScores = argumentsList
    .map(arg => arg.confidence)
    .filter((score): score is number => score !== null && score !== undefined);

  const averageQualityScore =
    confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) /
        confidenceScores.length
      : 0;

  return {
    summary: {
      totalDebates,
      totalArguments,
      averageArgumentsPerDebate: Number(averageArgumentsPerDebate.toFixed(2)),
      averageQualityScore: Number(averageQualityScore.toFixed(4)),
    },
    trends: {
      generationCount: [],
      qualityScore: [],
    },
    distribution: {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0,
      totalCount: totalArguments,
    },
  };
}

/**
 * 收集性能统计数据
 */
async function collectPerformanceStats(
  config: ReportGenerationConfig
): Promise<ReportContent['performanceStats']> {
  // 获取AI交互记录
  const interactions = await prisma.aIInteraction.findMany({
    where: {
      createdAt: {
        gte: new Date(config.periodStart),
        lte: new Date(config.periodEnd),
      },
    },
  });

  const totalRequests = interactions.length;
  const successRequests = interactions.filter(i => i.success).length;
  const errorRequests = totalRequests - successRequests;
  const errorRate =
    totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

  // 计算平均响应时间
  const durations = interactions
    .map(i => i.duration)
    .filter((d): d is number => d !== null && d !== undefined);

  const averageResponseTime =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

  // 计算P95响应时间
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedDurations.length * 0.95);
  const p95ResponseTime =
    sortedDurations.length > 0 ? sortedDurations[p95Index] || 0 : 0;

  return {
    summary: {
      totalRequests,
      averageResponseTime: Number(averageResponseTime.toFixed(2)),
      p95ResponseTime: Number(p95ResponseTime.toFixed(2)),
      errorRate: Number(errorRate.toFixed(2)),
    },
    trends: {
      responseTime: [],
      errorRate: [],
    },
  };
}

/**
 * 生成报告摘要
 */
function generateSummary(content: ReportContent): ReportContent['summary'] {
  const keyMetrics: Array<{
    label: string;
    value: number;
    change: number;
    unit: string;
  }> = [];

  const highlights: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  // 用户统计关键指标
  if (content.userStats?.summary) {
    keyMetrics.push({
      label: '新增用户',
      value: content.userStats.summary.newUsers,
      change: content.userStats.summary.growthRate,
      unit: '人',
    });
  }

  // 案件统计关键指标
  if (content.caseStats?.summary) {
    keyMetrics.push({
      label: '新增案件',
      value: content.caseStats.summary.totalCases,
      change: 0,
      unit: '件',
    });
  }

  // 辩论统计关键指标
  if (content.debateStats?.summary) {
    keyMetrics.push({
      label: '生成辩论',
      value: content.debateStats.summary.totalDebates,
      change: 0,
      unit: '次',
    });
  }

  // 性能统计关键指标
  if (content.performanceStats?.summary) {
    keyMetrics.push({
      label: '系统错误率',
      value: content.performanceStats.summary.errorRate,
      change: 0,
      unit: '%',
    });
  }

  return {
    keyMetrics,
    highlights,
    issues,
    recommendations,
  };
}
