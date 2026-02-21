/**
 * 客户分析API
 * 提供客户高级分析功能：转化漏斗、价值分析、生命周期、满意度、风险分析
 */

import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  type ClientAnalyticsResponse,
  type ClientConversionFunnel,
  type ClientValueAnalysis,
  ClientStatus,
  ClientValueLevel,
} from '@/types/client';
import { logger } from '@/lib/logger';

/**
 * GET /api/analytics/clients
 * 获取客户分析数据
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // 验证用户身份
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return Response.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const userId = authUser.userId;
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const timeRange =
      (searchParams.get('timeRange') as
        | 'LAST_30_DAYS'
        | 'LAST_90_DAYS'
        | 'LAST_180_DAYS'
        | 'ALL') || 'LAST_90_DAYS';
    const topClientsLimit = parseInt(
      searchParams.get('topClientsLimit') || '10',
      10
    );
    const includeLifecycle = searchParams.get('includeLifecycle') === 'true';
    const includeSatisfaction =
      searchParams.get('includeSatisfaction') === 'true';
    const includeRiskAnalysis =
      searchParams.get('includeRiskAnalysis') === 'true';

    // 计算时间范围
    const dateFilter = getDateFilter(timeRange);

    // 并行查询所有分析数据
    const [
      conversionFunnel,
      valueAnalysis,
      topClients,
      lifecycle,
      satisfaction,
      riskAnalysis,
      totalClients,
    ] = await Promise.all([
      getConversionFunnel(userId, dateFilter),
      getValueAnalysis(userId, dateFilter),
      getTopClients(userId, dateFilter, topClientsLimit),
      includeLifecycle
        ? getLifecycle(userId, dateFilter)
        : Promise.resolve(null),
      includeSatisfaction
        ? getSatisfaction(userId, dateFilter)
        : Promise.resolve(null),
      includeRiskAnalysis
        ? getRiskAnalysis(userId, dateFilter)
        : Promise.resolve(null),
      prisma.client.count({
        where: { userId, deletedAt: null },
      }),
    ]);

    // 构建响应数据
    const analytics: ClientAnalyticsResponse = {
      conversionFunnel,
      valueAnalysis,
      topClients,
      lifecycle: lifecycle || {
        avgDuration: 0,
        longestDuration: 0,
        shortestDuration: 0,
        retentionRate: 0,
      },
      satisfaction: satisfaction || {
        avgCommunicationFrequency: 0,
        avgResponseTime: 0,
        satisfactionScore: 0,
      },
      riskAnalysis: riskAnalysis || {
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        totalRisk: 0,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        timeRange,
        totalClients,
      },
    };

    return Response.json(analytics);
  } catch (error) {
    logger.error('[GET /api/analytics/clients] Error:', error);
    return Response.json(
      { error: '获取分析数据失败', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 根据时间范围获取日期过滤条件
 */
function getDateFilter(timeRange: string): { gte?: Date; lt?: Date } {
  const now = new Date();

  switch (timeRange) {
    case 'LAST_30_DAYS':
      return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    case 'LAST_90_DAYS':
      return { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
    case 'LAST_180_DAYS':
      return { gte: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) };
    case 'ALL':
    default:
      return {};
  }
}

/**
 * 获取客户转化漏斗
 */
async function getConversionFunnel(
  userId: string,
  dateFilter: { gte?: Date; lt?: Date }
): Promise<ClientConversionFunnel[]> {
  // 获取各状态客户数
  const clientsByStatus = await prisma.client.groupBy({
    by: ['status'],
    where: { userId, deletedAt: null, createdAt: dateFilter },
    _count: true,
  });

  const statusMap = new Map<ClientStatus, number>();
  clientsByStatus.forEach(item => {
    statusMap.set(item.status as ClientStatus, item._count);
  });

  const funnel: ClientConversionFunnel[] = [
    {
      stage: ClientStatus.ACTIVE,
      count: statusMap.get(ClientStatus.ACTIVE) || 0,
      percentage: 0,
      conversionRate: 0,
    },
    {
      stage: ClientStatus.INACTIVE,
      count: statusMap.get(ClientStatus.INACTIVE) || 0,
      percentage: 0,
      conversionRate: 0,
    },
    {
      stage: ClientStatus.LOST,
      count: statusMap.get(ClientStatus.LOST) || 0,
      percentage: 0,
      conversionRate: 0,
    },
    {
      stage: ClientStatus.BLACKLISTED,
      count: statusMap.get(ClientStatus.BLACKLISTED) || 0,
      percentage: 0,
      conversionRate: 0,
    },
  ];

  // 计算百分比和转化率
  const total = funnel.reduce((sum, item) => sum + item.count, 0);
  funnel.forEach((item, index) => {
    item.percentage = total > 0 ? (item.count / total) * 100 : 0;

    // 计算转化率（当前阶段/上一阶段）
    if (index > 0) {
      const prevCount = funnel[index - 1].count;
      item.conversionRate = prevCount > 0 ? (item.count / prevCount) * 100 : 0;
    } else {
      item.conversionRate = 100; // 第一阶段为100%
    }
  });

  return funnel;
}

/**
 * 获取客户价值分析
 */
async function getValueAnalysis(
  userId: string,
  dateFilter: { gte?: Date; lt?: Date }
): Promise<{
  highValue: number;
  mediumValue: number;
  lowValue: number;
  totalValue: number;
  averageValueScore: number;
}> {
  // 获取所有客户及其案件数据
  const clients = await prisma.client.findMany({
    where: { userId, deletedAt: null, createdAt: dateFilter },
    include: {
      cases: {
        select: { amount: true },
      },
      _count: {
        select: { cases: true },
      },
    },
  });

  // 计算每个客户的价值
  const clientValues = await Promise.all(
    clients.map(async client =>
      calculateClientValue(client.id, userId, client._count.cases)
    )
  );

  // 分级统计
  const highValue = clientValues.filter(
    v => v.valueLevel === ClientValueLevel.HIGH
  ).length;
  const mediumValue = clientValues.filter(
    v => v.valueLevel === ClientValueLevel.MEDIUM
  ).length;
  const lowValue = clientValues.filter(
    v => v.valueLevel === ClientValueLevel.LOW
  ).length;
  const totalValue = clientValues.reduce((sum, v) => sum + v.totalValue, 0);
  const averageValueScore =
    clientValues.length > 0
      ? clientValues.reduce((sum, v) => sum + v.valueScore, 0) /
        clientValues.length
      : 0;

  return { highValue, mediumValue, lowValue, totalValue, averageValueScore };
}

/**
 * 获取Top客户列表
 */
async function getTopClients(
  userId: string,
  dateFilter: { gte?: Date; lt?: Date },
  limit: number
): Promise<
  Array<{
    clientId: string;
    clientName: string;
    valueLevel: ClientValueLevel;
    valueScore: number;
    caseCount: number;
    totalRevenue: number;
  }>
> {
  const clients = await prisma.client.findMany({
    where: { userId, deletedAt: null, createdAt: dateFilter },
    include: {
      cases: {
        select: { amount: true },
      },
      _count: {
        select: { cases: true },
      },
    },
    take: limit * 2, // 获取更多以便排序
  });

  // 计算所有客户价值
  const clientValues = await Promise.all(
    clients.map(async client => {
      const value = await calculateClientValue(
        client.id,
        userId,
        client._count.cases
      );
      const caseRevenue = client.cases.reduce((sum, c) => {
        const amount = c.amount ? Number(c.amount) : 0;
        return sum + amount;
      }, 0);

      return {
        clientId: client.id,
        clientName: client.name,
        valueLevel: value.valueLevel,
        valueScore: value.valueScore,
        caseCount: client._count.cases,
        totalRevenue: caseRevenue,
      };
    })
  );

  // 按价值分数排序并返回Top N
  return clientValues
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, limit);
}

/**
 * 计算单个客户的价值
 */
async function calculateClientValue(
  clientId: string,
  userId: string,
  caseCount: number
): Promise<ClientValueAnalysis> {
  // 获取案件数据
  const cases = await prisma.case.findMany({
    where: { clientId, deletedAt: null },
    select: { amount: true, createdAt: true, status: true },
  });

  const caseRevenue = cases.reduce((sum, c) => {
    const amount = c.amount ? Number(c.amount) : 0;
    return sum + amount;
  }, 0);
  const communicationCount = await prisma.communicationRecord.count({
    where: { clientId, userId },
  });

  // 计算合作时长（天数）
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { createdAt: true },
  });
  const cooperationDuration = client
    ? Math.floor(
        (Date.now() - client.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  // 获取推荐的新客户数
  const referralsCount = await prisma.client.count({
    where: {
      userId,
      source: 'REFERRAL',
      deletedAt: null,
    },
  });

  // 价值评分计算（加权平均）
  const caseCountScore = Math.min(caseCount * 10, 30); // 最多30分
  const revenueScore = Math.min((caseRevenue / 10000) * 20, 40); // 最多40分
  const communicationScore = Math.min(communicationCount * 2, 10); // 最多10分
  const durationScore = Math.min((cooperationDuration / 30) * 10, 10); // 最多10分
  const referralScore = Math.min(referralsCount * 5, 10); // 最多10分

  const valueScore =
    caseCountScore +
    revenueScore +
    communicationScore +
    durationScore +
    referralScore;

  // 确定价值等级
  let valueLevel: ClientValueLevel;
  if (valueScore >= 70) {
    valueLevel = ClientValueLevel.HIGH;
  } else if (valueScore >= 40) {
    valueLevel = ClientValueLevel.MEDIUM;
  } else {
    valueLevel = ClientValueLevel.LOW;
  }

  return {
    totalValue: caseRevenue,
    valueLevel,
    valueScore,
    factors: {
      caseCount,
      caseRevenue,
      communicationFrequency: communicationCount,
      cooperationDuration,
      referralCount: referralsCount,
    },
    ranking: 0, // 稍后计算
    percentile: 0, // 稍后计算
  };
}

/**
 * 获取客户生命周期分析
 */
async function getLifecycle(
  userId: string,
  dateFilter: { gte?: Date; lt?: Date }
): Promise<{
  avgDuration: number;
  longestDuration: number;
  shortestDuration: number;
  retentionRate: number;
}> {
  const clients = await prisma.client.findMany({
    where: { userId, deletedAt: null, createdAt: dateFilter },
    select: { createdAt: true, status: true },
  });

  if (clients.length === 0) {
    return {
      avgDuration: 0,
      longestDuration: 0,
      shortestDuration: 0,
      retentionRate: 0,
    };
  }

  const now = Date.now();
  const durations = clients.map(c =>
    Math.floor((now - c.createdAt.getTime()) / (1000 * 60 * 60 * 24))
  );

  const avgDuration =
    durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const longestDuration = Math.max(...durations);
  const shortestDuration = Math.min(...durations);

  // 计算保留率（活跃客户/总客户）
  const activeClients = clients.filter(
    c => c.status === ClientStatus.ACTIVE
  ).length;
  const retentionRate = (activeClients / clients.length) * 100;

  return { avgDuration, longestDuration, shortestDuration, retentionRate };
}

/**
 * 获取客户满意度分析
 */
async function getSatisfaction(
  userId: string,
  dateFilter: { gte?: Date; lt?: Date }
): Promise<{
  avgCommunicationFrequency: number;
  avgResponseTime: number;
  satisfactionScore: number;
}> {
  // 获取沟通记录数
  const communicationCount = await prisma.communicationRecord.count({
    where: { userId, createdAt: dateFilter },
  });

  // 获取跟进任务完成时间（作为响应时间参考）
  const followUpTasks = await prisma.followUpTask.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      completedAt: dateFilter,
    },
    select: { createdAt: true, completedAt: true },
  });

  let avgResponseTime = 0;
  if (followUpTasks.length > 0) {
    const responseTimes = followUpTasks
      .filter(t => t.completedAt !== null)
      .map(t =>
        Math.floor(
          (t.completedAt!.getTime() - t.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
    avgResponseTime =
      responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
  }

  // 获取客户数
  const clientCount = await prisma.client.count({
    where: { userId, deletedAt: null, createdAt: dateFilter },
  });

  // 计算满意度评分
  const frequencyScore =
    Math.min((communicationCount / clientCount) * 10, 50) || 0; // 沟通频率
  const responseScore = Math.min(100 - avgResponseTime, 50); // 响应速度
  const satisfactionScore = frequencyScore + responseScore;

  return {
    avgCommunicationFrequency:
      clientCount > 0 ? communicationCount / clientCount : 0,
    avgResponseTime,
    satisfactionScore,
  };
}

/**
 * 获取风险客户分析
 */
async function getRiskAnalysis(
  userId: string,
  dateFilter: { gte?: Date; lt?: Date }
): Promise<{
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  totalRisk: number;
}> {
  // 获取案件失败情况
  const cases = await prisma.case.findMany({
    where: { userId, deletedAt: null, createdAt: dateFilter },
    select: { status: true, clientId: true },
  });

  // 按客户统计失败案件
  const clientRiskMap = new Map<string, { total: number; failed: number }>();
  cases.forEach(c => {
    const clientId = c.clientId;
    if (!clientId) return;

    const current = clientRiskMap.get(clientId) || { total: 0, failed: 0 };
    current.total++;
    if (c.status === 'ARCHIVED') {
      current.failed++;
    }
    clientRiskMap.set(clientId, current);
  });

  // 评估风险等级
  let highRisk = 0;
  let mediumRisk = 0;
  let lowRisk = 0;

  clientRiskMap.forEach(data => {
    const failureRate = data.total > 0 ? (data.failed / data.total) * 100 : 0;

    if (failureRate >= 60) {
      highRisk++;
    } else if (failureRate >= 30) {
      mediumRisk++;
    } else if (failureRate > 0) {
      lowRisk++;
    }
  });

  return {
    highRisk,
    mediumRisk,
    lowRisk,
    totalRisk: highRisk + mediumRisk + lowRisk,
  };
}

/**
 * OPTIONS /api/analytics/clients
 * 处理CORS预检请求
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
