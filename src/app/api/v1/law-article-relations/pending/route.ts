/**
 * 待审核关系列表API
 * GET /api/v1/law-article-relations/pending
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  VerificationStatus,
  RelationType,
  DiscoveryMethod,
  Prisma,
} from '@prisma/client';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权，请先登录' },
      { status: 401 }
    );
  }

  // 仅管理员可查看待审核关系列表
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN')) {
    return NextResponse.json(
      { success: false, error: '权限不足' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    // 分页参数
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 过滤参数
    const relationType = searchParams.get('relationType');
    const discoveryMethod = searchParams.get('discoveryMethod');
    const minConfidence = searchParams.get('minConfidence');

    // 参数验证
    if (page <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: '页码必须大于0',
        },
        { status: 400 }
      );
    }

    if (pageSize <= 0 || pageSize > 100) {
      return NextResponse.json(
        {
          success: false,
          error: '每页数量必须在1-100之间',
        },
        { status: 400 }
      );
    }

    // 验证关系类型
    if (
      relationType &&
      !Object.values(RelationType).includes(relationType as RelationType)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的关系类型',
        },
        { status: 400 }
      );
    }

    // 验证发现方式
    if (
      discoveryMethod &&
      !Object.values(DiscoveryMethod).includes(
        discoveryMethod as DiscoveryMethod
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的发现方式',
        },
        { status: 400 }
      );
    }

    // 验证最小置信度
    if (minConfidence) {
      const confidence = parseFloat(minConfidence);
      if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        return NextResponse.json(
          {
            success: false,
            error: '最小置信度必须在0-1之间',
          },
          { status: 400 }
        );
      }
    }

    // 构建查询条件
    const where: Prisma.LawArticleRelationWhereInput = {
      verificationStatus: VerificationStatus.PENDING,
    };

    if (relationType) {
      where.relationType = relationType as RelationType;
    }

    if (discoveryMethod) {
      where.discoveryMethod = discoveryMethod as DiscoveryMethod;
    }

    if (minConfidence) {
      where.confidence = { gte: parseFloat(minConfidence) };
    }

    // 查询数据
    const [relations, total] = await Promise.all([
      prisma.lawArticleRelation.findMany({
        where,
        include: {
          source: {
            select: {
              id: true,
              lawName: true,
              articleNumber: true,
              fullText: true,
            },
          },
          target: {
            select: {
              id: true,
              lawName: true,
              articleNumber: true,
              fullText: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.lawArticleRelation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        relations,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    logger.error('获取待审核关系失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取待审核关系失败',
      },
      { status: 500 }
    );
  }
}
