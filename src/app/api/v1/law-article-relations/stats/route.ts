/**
 * 关系质量统计API
 * GET /api/v1/law-article-relations/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { VerificationStatus, Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 时间范围参数
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 参数验证
    let dateFilter: { gte?: Date; lte?: Date } | undefined;

    if (startDate || endDate) {
      dateFilter = {};

      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: '无效的开始日期',
            },
            { status: 400 }
          );
        }
        dateFilter.gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: '无效的结束日期',
            },
            { status: 400 }
          );
        }
        dateFilter.lte = end;
      }

      // 验证日期范围
      if (dateFilter.gte && dateFilter.lte && dateFilter.gte > dateFilter.lte) {
        return NextResponse.json(
          {
            success: false,
            error: '开始日期不能晚于结束日期',
          },
          { status: 400 }
        );
      }
    }

    // 构建查询条件
    const where: Prisma.LawArticleRelationWhereInput = {};
    if (dateFilter) {
      where.createdAt = dateFilter;
    }

    // 并行查询统计数据
    const [
      total,
      verified,
      pending,
      rejected,
      byType,
      byDiscoveryMethod,
      avgStats,
    ] = await Promise.all([
      // 总数
      prisma.lawArticleRelation.count({ where }),
      // 已验证数量
      prisma.lawArticleRelation.count({
        where: { ...where, verificationStatus: VerificationStatus.VERIFIED },
      }),
      // 待审核数量
      prisma.lawArticleRelation.count({
        where: { ...where, verificationStatus: VerificationStatus.PENDING },
      }),
      // 已拒绝数量
      prisma.lawArticleRelation.count({
        where: { ...where, verificationStatus: VerificationStatus.REJECTED },
      }),
      // 按关系类型分组
      prisma.lawArticleRelation.groupBy({
        by: ['relationType'],
        where,
        _count: true,
      }),
      // 按发现方式分组
      prisma.lawArticleRelation.groupBy({
        by: ['discoveryMethod'],
        where,
        _count: true,
      }),
      // 平均置信度和强度
      prisma.lawArticleRelation.aggregate({
        where,
        _avg: {
          confidence: true,
          strength: true,
        },
      }),
    ]);

    // 构建按类型统计
    const byTypeMap: Record<string, number> = {};
    byType.forEach(item => {
      byTypeMap[item.relationType] = item._count;
    });

    // 构建按发现方式统计
    const byDiscoveryMethodMap: Record<string, number> = {};
    byDiscoveryMethod.forEach(item => {
      byDiscoveryMethodMap[item.discoveryMethod] = item._count;
    });

    // 计算验证率
    const verificationRate = total > 0 ? verified / total : 0;

    return NextResponse.json({
      success: true,
      data: {
        total,
        verified,
        pending,
        rejected,
        verificationRate: Math.round(verificationRate * 100) / 100,
        byType: byTypeMap,
        byDiscoveryMethod: byDiscoveryMethodMap,
        avgConfidence: avgStats._avg.confidence || 0,
        avgStrength: avgStats._avg.strength || 0,
      },
    });
  } catch (error) {
    console.error('获取关系统计失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取关系统计失败',
      },
      { status: 500 }
    );
  }
}
