/**
 * 知识图谱动态更新 - 影响分析API端点
 *
 * POST /api/knowledge-graph/impact-analysis
 * 分析法条变更对知识图谱关系的影响
 */

import { NextRequest, NextResponse } from 'next/server';
import { ImpactAnalysisService } from '@/lib/knowledge-graph/impact-analysis';
import { ChangeType } from '@/lib/knowledge-graph/impact-analysis/types';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * 分析法条变更影响
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '请先登录' },
        { status: 401 }
      );
    }

    // 从DB实时读取角色，仅管理员或专家可执行影响分析
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '权限不足，仅管理员可执行影响分析' },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证请求参数
    const { lawArticleId, changeType, depth, includeIndirect } = body;

    if (!lawArticleId) {
      return NextResponse.json(
        {
          error: 'BAD_REQUEST',
          message: '缺少必填参数：lawArticleId',
        },
        { status: 400 }
      );
    }

    if (!changeType) {
      return NextResponse.json(
        {
          error: 'BAD_REQUEST',
          message: '缺少必填参数：changeType',
        },
        { status: 400 }
      );
    }

    // 验证变更类型
    if (!Object.values(ChangeType).includes(changeType as ChangeType)) {
      return NextResponse.json(
        {
          error: 'INVALID_CHANGE_TYPE',
          message: `无效的变更类型：${changeType}，支持的类型：${Object.values(ChangeType).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 调用影响分析服务
    const input = {
      lawArticleId,
      changeType: changeType as ChangeType,
      depth: depth ?? 2,
      includeIndirect: includeIndirect ?? false,
    };

    const result = await ImpactAnalysisService.analyzeImpact(input);

    logger.info('影响分析成功', {
      lawArticleId,
      changeType,
      userId: authUser.userId,
      totalImpacted: result.statistics.totalImpacted,
      highPriorityCount: result.statistics.highPriorityCount,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('影响分析失败', { error });

    if (error instanceof Error) {
      if (error.message === '法条不存在') {
        return NextResponse.json(
          {
            error: 'NOT_FOUND',
            message: '指定的法条不存在',
          },
          { status: 404 }
        );
      }

      // Prisma错误处理
      if (error.name === 'PrismaClientKnownRequestError') {
        return NextResponse.json(
          {
            error: 'DATABASE_ERROR',
            message: '数据库操作失败',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 获取配置信息
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '请先登录' },
        { status: 401 }
      );
    }

    const config = ImpactAnalysisService.getConfig();

    return NextResponse.json(
      {
        success: true,
        data: {
          config,
          changeTypes: Object.values(ChangeType).map(type => ({
            value: type,
            label: type === ChangeType.AMENDED ? '法条修改' : '法条废止',
          })),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('获取配置信息失败', { error });

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}
