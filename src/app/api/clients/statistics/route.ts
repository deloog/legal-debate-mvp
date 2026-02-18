/**
 * 客户统计API
 * 提供客户数据的统计分析
 */

import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  ClientType,
  ClientSource,
  ClientStatus,
  type ClientStatistics,
  type ClientDetail,
} from '@/types/client';

/**
 * GET /api/clients/statistics
 * 获取客户统计数据
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

    // 并行查询所有统计数据
    const [
      totalClients,
      activeClients,
      inactiveClients,
      lostClients,
      blacklistedClients,
      clientsByType,
      clientsBySource,
      clientsByTags,
      monthlyGrowth,
      recentClients,
    ] = await Promise.all([
      // 客户总数
      prisma.client.count({
        where: { userId, deletedAt: null },
      }),
      // 活跃客户数
      prisma.client.count({
        where: { userId, status: 'ACTIVE', deletedAt: null },
      }),
      // 非活跃客户数
      prisma.client.count({
        where: { userId, status: 'INACTIVE', deletedAt: null },
      }),
      // 流失客户数
      prisma.client.count({
        where: { userId, status: 'LOST', deletedAt: null },
      }),
      // 黑名单客户数
      prisma.client.count({
        where: { userId, status: 'BLACKLISTED', deletedAt: null },
      }),
      // 按类型统计
      getClientStatsByType(userId),
      // 按来源统计
      getClientStatsBySource(userId),
      // 按标签统计
      getClientStatsByTags(userId),
      // 月度增长趋势
      getClientMonthlyGrowth(userId),
      // 最近创建的客户
      getRecentClients(userId, 10),
    ]);

    // 构建响应数据
    const statistics: ClientStatistics = {
      totalClients,
      activeClients,
      inactiveClients,
      lostClients,
      blacklistedClients,
      clientsByType,
      clientsBySource,
      clientsByTags,
      monthlyGrowth,
      recentClients,
    };

    return Response.json(statistics);
  } catch (error) {
    console.error('[GET /api/clients/statistics] Error:', error);
    return Response.json(
      { error: '获取统计数据失败', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 按客户类型统计
 */
async function getClientStatsByType(
  userId: string
): Promise<Record<string, number>> {
  const result = await prisma.client.groupBy({
    by: ['clientType'],
    where: { userId, deletedAt: null },
    _count: true,
  });

  // 初始化所有类型的计数为0
  const stats: Record<string, number> = {
    INDIVIDUAL: 0,
    ENTERPRISE: 0,
    POTENTIAL: 0,
  };

  // 更新实际统计值
  result.forEach(item => {
    stats[item.clientType] = item._count;
  });

  return stats;
}

/**
 * 按客户来源统计
 */
async function getClientStatsBySource(
  userId: string
): Promise<Record<string, number>> {
  const result = await prisma.client.groupBy({
    by: ['source'],
    where: { userId, deletedAt: null },
    _count: true,
  });

  // 构建统计对象
  const stats: Record<string, number> = {};
  result.forEach(item => {
    if (item.source) {
      stats[item.source] = item._count;
    }
  });

  return stats;
}

/**
 * 按标签统计
 */
async function getClientStatsByTags(
  userId: string
): Promise<Record<string, number>> {
  const clients = await prisma.client.findMany({
    where: { userId, deletedAt: null },
    select: { tags: true },
  });

  // 统计标签出现次数
  const stats: Record<string, number> = {};
  clients.forEach(client => {
    client.tags.forEach(tag => {
      stats[tag] = (stats[tag] || 0) + 1;
    });
  });

  return stats;
}

/**
 * 获取月度增长趋势（最近12个月）
 */
async function getClientMonthlyGrowth(
  userId: string
): Promise<Array<{ month: string; count: number }>> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // 获取最近12个月创建的客户
  const clients = await prisma.client.findMany({
    where: {
      userId,
      createdAt: { gte: twelveMonthsAgo },
      deletedAt: null,
    },
    select: { createdAt: true },
  });

  // 按月统计
  const monthlyData: Record<string, number> = {};
  const now = new Date();

  // 初始化最近12个月的数据
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[monthKey] = 0;
  }

  // 统计每月创建的客户数
  clients.forEach(client => {
    const date = new Date(client.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[monthKey] !== undefined) {
      monthlyData[monthKey]++;
    }
  });

  // 转换为数组格式
  return Object.entries(monthlyData).map(([month, count]) => ({
    month,
    count,
  }));
}

/**
 * 获取最近创建的客户
 */
async function getRecentClients(
  userId: string,
  limit: number
): Promise<ClientDetail[]> {
  const clients = await prisma.client.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      userId: true,
      clientType: true,
      name: true,
      gender: true,
      age: true,
      profession: true,
      phone: true,
      email: true,
      address: true,
      idCardNumber: true,
      company: true,
      creditCode: true,
      legalRep: true,
      source: true,
      tags: true,
      status: true,
      notes: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      _count: {
        select: {
          cases: true,
          communications: true,
        },
      },
    },
  });

  // 转换为ClientDetail类型
  return clients.map(client => ({
    id: client.id,
    userId: client.userId,
    clientType: client.clientType as ClientType,
    name: client.name,
    gender: client.gender,
    age: client.age,
    profession: client.profession,
    phone: client.phone,
    email: client.email,
    address: client.address,
    idCardNumber: client.idCardNumber,
    company: client.company,
    creditCode: client.creditCode,
    legalRep: client.legalRep,
    source: client.source as ClientSource | null,
    tags: client.tags,
    status: client.status as ClientStatus,
    notes: client.notes,
    metadata: client.metadata as Record<string, unknown> | null,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    deletedAt: client.deletedAt,
    cases: client._count.cases + client._count.communications,
  }));
}

/**
 * OPTIONS /api/clients/statistics
 * 处理CORS预检请求
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
