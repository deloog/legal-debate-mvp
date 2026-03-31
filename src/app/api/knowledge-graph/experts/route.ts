/**
 * 专家列表和创建 API
 * GET /api/knowledge-graph/experts - 获取专家列表
 * POST /api/knowledge-graph/experts - 创建或获取专家档案
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import { expertService } from '@/lib/knowledge-graph/expert/expert-service';
import type { ExpertListFilters } from '@/lib/knowledge-graph/expert/types';

/**
 * GET 获取专家列表
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const expertLevelParam = searchParams.get('expertLevel');
    const filters: ExpertListFilters = {
      expertLevel: expertLevelParam
        ? (expertLevelParam as 'JUNIOR' | 'SENIOR' | 'MASTER')
        : undefined,
      expertiseArea: searchParams.get('expertiseArea') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
    };

    // 获取专家列表
    const result = await expertService.getExpertList(filters);

    logger.info('Expert list fetched successfully', {
      userId: user.userId,
      total: result.total,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('获取专家列表失败', { error });

    return NextResponse.json(
      {
        success: false,
        error: '获取专家列表失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST 创建或获取专家档案
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 创建或获取专家档案
    const expert = await expertService.getOrCreateExpertProfile(user.userId);

    logger.info('Expert profile created or retrieved successfully', {
      userId: user.userId,
      expertId: expert.id,
    });

    return NextResponse.json({
      success: true,
      expert,
    });
  } catch (error) {
    logger.error('创建或获取专家档案失败', { error });

    return NextResponse.json(
      {
        success: false,
        error: '创建或获取专家档案失败',
      },
      { status: 500 }
    );
  }
}
