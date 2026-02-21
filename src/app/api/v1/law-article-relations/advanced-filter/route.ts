/**
 * 高级过滤API
 * GET /api/v1/law-article-relations/advanced-filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
  Prisma,
} from '@prisma/client';
import { logger } from '@/lib/logger';

interface AdvancedFilterParams {
  // 关系类型过滤
  relationType?: string; // 逗号分隔的多个类型
  // 发现方式过滤
  discoveryMethod?: string; // 逗号分隔的多个方式
  // 置信度范围
  minConfidence?: number;
  maxConfidence?: number;
  // 强度范围
  minStrength?: number;
  maxStrength?: number;
  // 审核状态
  verificationStatus?: string; // 逗号分隔的多个状态
  // 法条名称搜索
  sourceLawName?: string;
  targetLawName?: string;
  // 时间范围
  startDate?: string;
  endDate?: string;
  // 分页
  page?: number;
  pageSize?: number;
  // 排序
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface AdvancedFilterResponse {
  success: boolean;
  data?: {
    relations: unknown[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

// 默认分页参数
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(
  request: NextRequest
): Promise<NextResponse<AdvancedFilterResponse>> {
  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const params: AdvancedFilterParams = {
      relationType: searchParams.get('relationType') || undefined,
      discoveryMethod: searchParams.get('discoveryMethod') || undefined,
      minConfidence: searchParams.get('minConfidence')
        ? parseFloat(searchParams.get('minConfidence')!)
        : undefined,
      maxConfidence: searchParams.get('maxConfidence')
        ? parseFloat(searchParams.get('maxConfidence')!)
        : undefined,
      minStrength: searchParams.get('minStrength')
        ? parseFloat(searchParams.get('minStrength')!)
        : undefined,
      maxStrength: searchParams.get('maxStrength')
        ? parseFloat(searchParams.get('maxStrength')!)
        : undefined,
      verificationStatus: searchParams.get('verificationStatus') || undefined,
      sourceLawName: searchParams.get('sourceLawName') || undefined,
      targetLawName: searchParams.get('targetLawName') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      page: searchParams.get('page')
        ? parseInt(searchParams.get('page')!)
        : DEFAULT_PAGE,
      pageSize: searchParams.get('pageSize')
        ? parseInt(searchParams.get('pageSize')!)
        : DEFAULT_PAGE_SIZE,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    // 参数验证
    const validationError = validateParams(params);
    if (validationError) {
      return NextResponse.json(
        {
          success: false,
          error: validationError,
        },
        { status: 400 }
      );
    }

    // 构建查询条件
    const where: Prisma.LawArticleRelationWhereInput = {};

    // 关系类型过滤
    if (params.relationType) {
      const types = params.relationType.split(',').map(t => t.trim());
      where.relationType = { in: types as RelationType[] };
    }

    // 发现方式过滤
    if (params.discoveryMethod) {
      const methods = params.discoveryMethod.split(',').map(m => m.trim());
      where.discoveryMethod = { in: methods as DiscoveryMethod[] };
    }

    // 置信度范围过滤
    if (
      params.minConfidence !== undefined ||
      params.maxConfidence !== undefined
    ) {
      where.confidence = {};
      if (params.minConfidence !== undefined) {
        where.confidence.gte = params.minConfidence;
      }
      if (params.maxConfidence !== undefined) {
        where.confidence.lte = params.maxConfidence;
      }
    }

    // 强度范围过滤
    if (params.minStrength !== undefined || params.maxStrength !== undefined) {
      where.strength = {};
      if (params.minStrength !== undefined) {
        where.strength.gte = params.minStrength;
      }
      if (params.maxStrength !== undefined) {
        where.strength.lte = params.maxStrength;
      }
    }

    // 审核状态过滤
    if (params.verificationStatus) {
      const statuses = params.verificationStatus.split(',').map(s => s.trim());
      where.verificationStatus = { in: statuses as VerificationStatus[] };
    }

    // 法条名称搜索
    if (params.sourceLawName || params.targetLawName) {
      where.AND = [];

      if (params.sourceLawName) {
        where.AND.push({
          source: {
            lawName: {
              contains: params.sourceLawName,
              mode: 'insensitive',
            },
          },
        });
      }

      if (params.targetLawName) {
        where.AND.push({
          target: {
            lawName: {
              contains: params.targetLawName,
              mode: 'insensitive',
            },
          },
        });
      }
    }

    // 时间范围过滤
    if (params.startDate || params.endDate) {
      where.createdAt = {} as any;
      if (params.startDate) {
        (where.createdAt as any).gte = new Date(params.startDate);
      }
      if (params.endDate) {
        (where.createdAt as any).lte = new Date(params.endDate);
      }
    }

    // 构建排序条件
    const orderBy: Prisma.LawArticleRelationOrderByWithRelationInput = {};
    if (params.sortBy === 'confidence') {
      orderBy.confidence = params.sortOrder;
    } else if (params.sortBy === 'strength') {
      orderBy.strength = params.sortOrder;
    } else if (params.sortBy === 'createdAt') {
      orderBy.createdAt = params.sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    // 计算分页
    const skip = (params.page! - 1) * params.pageSize!;
    const take = params.pageSize!;

    // 查询总数
    const total = await prisma.lawArticleRelation.count({ where });

    // 查询关系数据
    const relations = await prisma.lawArticleRelation.findMany({
      where,
      orderBy,
      skip,
      take,
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
    });

    // 计算总页数
    const totalPages = Math.ceil(total / params.pageSize!);

    return NextResponse.json({
      success: true,
      data: {
        relations,
        pagination: {
          page: params.page!,
          pageSize: params.pageSize!,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    logger.error('高级过滤查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '高级过滤查询失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 验证查询参数
 */
function validateParams(params: AdvancedFilterParams): string | null {
  // 验证置信度范围
  if (params.minConfidence !== undefined) {
    if (params.minConfidence < 0 || params.minConfidence > 1) {
      return '最小置信度必须在0到1之间';
    }
  }

  if (params.maxConfidence !== undefined) {
    if (params.maxConfidence < 0 || params.maxConfidence > 1) {
      return '最大置信度必须在0到1之间';
    }
  }

  if (
    params.minConfidence !== undefined &&
    params.maxConfidence !== undefined &&
    params.minConfidence > params.maxConfidence
  ) {
    return '最小置信度不能大于最大置信度';
  }

  // 验证强度范围
  if (params.minStrength !== undefined) {
    if (params.minStrength < 0 || params.minStrength > 1) {
      return '最小强度必须在0到1之间';
    }
  }

  if (params.maxStrength !== undefined) {
    if (params.maxStrength < 0 || params.maxStrength > 1) {
      return '最大强度必须在0到1之间';
    }
  }

  if (
    params.minStrength !== undefined &&
    params.maxStrength !== undefined &&
    params.minStrength > params.maxStrength
  ) {
    return '最小强度不能大于最大强度';
  }

  // 验证分页参数
  if (params.page !== undefined && params.page < 1) {
    return '页码必须大于0';
  }

  if (params.pageSize !== undefined) {
    if (params.pageSize < 1) {
      return '每页数量必须大于0';
    }
    if (params.pageSize > MAX_PAGE_SIZE) {
      return `每页数量不能超过${MAX_PAGE_SIZE}`;
    }
  }

  // 验证排序参数
  if (
    params.sortBy &&
    !['confidence', 'strength', 'createdAt'].includes(params.sortBy)
  ) {
    return '排序字段必须是confidence、strength或createdAt';
  }

  if (params.sortOrder && !['asc', 'desc'].includes(params.sortOrder)) {
    return '排序顺序必须是asc或desc';
  }

  // 验证日期格式
  if (params.startDate) {
    const date = new Date(params.startDate);
    if (isNaN(date.getTime())) {
      return '开始日期格式无效';
    }
  }

  if (params.endDate) {
    const date = new Date(params.endDate);
    if (isNaN(date.getTime())) {
      return '结束日期格式无效';
    }
  }

  return null;
}
