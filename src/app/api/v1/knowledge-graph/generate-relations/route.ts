/**
 * POST /api/v1/knowledge-graph/generate-relations
 *
 * 触发 Layer 1 规则基础法条关系生成。
 * 主要用途：在新法条批量导入后自动调用（增量模式）。
 *
 * 请求体：
 *   {
 *     mode?: 'incremental' | 'full'   // 默认 'incremental'
 *     rule?: 'supersedes' | 'cites'   // 不传 = 全部规则
 *   }
 *
 * 增量模式：仅处理上次生成时间之后新导入的法条，通常在秒到分钟级别完成。
 * 全量模式：清除所有 RULE_BASED 关系后重新生成，可能耗时 30-60 分钟，
 *           建议通过命令行脚本运行：
 *           npx ts-node --transpile-only scripts/generate-relations-layer1.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkKnowledgeGraphPermission,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';
import {
  generateLayer1Relations,
  getLastGeneratedAt,
} from '@/lib/knowledge-graph/relation-generator';

interface RequestBody {
  mode?: 'incremental' | 'full';
  rule?: 'supersedes' | 'cites' | 'implements';
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
        { status: 401 }
      );
    }

    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.MANAGE_RELATIONS,
      KnowledgeGraphResource.RELATION
    );
    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: permissionResult.reason || '权限不足',
          },
        },
        { status: 403 }
      );
    }

    // 解析参数
    let body: RequestBody = {};
    try {
      body = await request.json();
    } catch {
      // 无请求体时使用默认值
    }

    const mode = body.mode ?? 'incremental';
    const rule = body.rule;

    if (mode !== 'incremental' && mode !== 'full') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'mode 必须为 incremental 或 full',
          },
        },
        { status: 400 }
      );
    }

    if (
      rule &&
      rule !== 'supersedes' &&
      rule !== 'cites' &&
      rule !== 'implements'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'rule 必须为 supersedes、cites 或 implements',
          },
        },
        { status: 400 }
      );
    }

    // Mock 模式：直接返回固定数据，跳过耗时的数据库扫描（E2E 测试用）
    if (process.env.USE_MOCK_AI === 'true' || process.env.NODE_ENV === 'test') {
      logger.info('[knowledge-graph][Mock] 跳过实际关系生成，返回 Mock 数据');
      return NextResponse.json({
        success: true,
        data: {
          mode,
          rule: rule ?? 'all',
          supersedesCreated: 0,
          citesCreated: 0,
          implementsCreated: 0,
          totalCreated: 0,
          durationSeconds: 0,
        },
      });
    }

    // 全量模式提示
    if (mode === 'full') {
      logger.warn(
        `[knowledge-graph] 用户 ${authUser.userId} 触发全量关系重生成，这可能耗时很长`
      );
    }

    // 增量模式：确定起始时间
    let sinceDate: Date | undefined;
    if (mode === 'incremental') {
      const lastAt = await getLastGeneratedAt(prisma);
      sinceDate = lastAt ?? undefined;
      logger.info(
        `[knowledge-graph] 增量生成，起始时间：${sinceDate?.toISOString() ?? '全量（首次）'}`
      );
    }

    // 执行生成
    const stats = await generateLayer1Relations(prisma, {
      sinceDate,
      rule,
      clearExisting: mode === 'full',
    });

    logger.info(
      `[knowledge-graph] Layer 1 生成完成：${stats.totalCreated} 条，耗时 ${(stats.durationMs / 1000).toFixed(1)}s`
    );

    return NextResponse.json({
      success: true,
      data: {
        mode,
        rule: rule ?? 'all',
        supersedesCreated: stats.supersedesCreated,
        citesCreated: stats.citesCreated,
        implementsCreated: stats.implementsCreated,
        totalCreated: stats.totalCreated,
        durationSeconds: +(stats.durationMs / 1000).toFixed(1),
      },
    });
  } catch (error) {
    logger.error('[knowledge-graph] 关系生成失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '关系生成失败' },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/knowledge-graph/generate-relations
 * 查询当前关系统计
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
        { status: 401 }
      );
    }

    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.VIEW_STATS,
      KnowledgeGraphResource.STATS
    );
    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: permissionResult.reason || '权限不足',
          },
        },
        { status: 403 }
      );
    }

    const [totalRelations, lastGeneratedAt, byType] = await Promise.all([
      prisma.lawArticleRelation.count(),
      getLastGeneratedAt(prisma),
      prisma.$queryRaw<{ relationType: string; cnt: bigint; method: string }[]>`
        SELECT "relationType", "discoveryMethod" as method, COUNT(*) as cnt
        FROM law_article_relations
        GROUP BY "relationType", "discoveryMethod"
        ORDER BY cnt DESC
      `,
    ]);

    const distribution: Record<string, Record<string, number>> = {};
    for (const row of byType) {
      if (!distribution[row.relationType]) distribution[row.relationType] = {};
      distribution[row.relationType][row.method] = Number(row.cnt);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRelations,
        lastGeneratedAt,
        distribution,
      },
    });
  } catch (error) {
    logger.error('[knowledge-graph] 获取统计失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取统计失败' },
      },
      { status: 500 }
    );
  }
}
