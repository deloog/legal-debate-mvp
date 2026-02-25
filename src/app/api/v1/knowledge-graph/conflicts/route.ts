/**
 * 知识图谱冲突检测API
 *
 * 功能：检测法条间的冲突关系，用于合同审核时快速识别条款冲突
 *
 * 端点: GET /api/v1/knowledge-graph/conflicts
 * 参数:
 *   - lawArticleIds: 法条ID列表，逗号分隔，最多10个
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
} from '@/lib/middleware/knowledge-graph-permission';

/**
 * 冲突检测结果
 */
interface ConflictResult {
  articleId: string;
  articleTitle: string;
  conflictsWith: ConflictItem[];
}

/**
 * 冲突项
 */
interface ConflictItem {
  articleId: string;
  articleTitle: string;
  relationId: string;
  relationType: string;
  strength: number;
  reason?: string;
}

/**
 * GET /api/v1/knowledge-graph/conflicts
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;

  try {
    // 参数验证
    const lawArticleIdsParam = searchParams.get('lawArticleIds');

    if (!lawArticleIdsParam) {
      return NextResponse.json(
        { error: '缺少必需参数: lawArticleIds' },
        { status: 400 }
      );
    }

    if (!lawArticleIdsParam.trim()) {
      return NextResponse.json(
        { error: 'lawArticleIds不能为空' },
        { status: 400 }
      );
    }

    // 解析法条ID列表
    const lawArticleIds = lawArticleIdsParam
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (lawArticleIds.length === 0) {
      return NextResponse.json(
        { error: 'lawArticleIds不能为空' },
        { status: 400 }
      );
    }

    if (lawArticleIds.length > 10) {
      return NextResponse.json(
        { error: 'lawArticleIds最多支持10个' },
        { status: 400 }
      );
    }

    // 权限检查（查看权限）
    const permissionResult = await checkKnowledgeGraphPermission(
      '', // 用户ID从header中获取（实际实现中需要）
      KnowledgeGraphAction.VIEW_RELATIONS,
      'RELATION' as never
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限查看冲突检测', {
        reason: permissionResult.reason,
      });
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 查询法条数据
    const articles = await prisma.lawArticle.findMany({
      where: {
        id: { in: lawArticleIds },
      },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
      },
    });

    if (articles.length === 0) {
      return NextResponse.json({ error: '未找到相关法条' }, { status: 404 });
    }

    // 构建法条标题映射
    const articleTitleMap = new Map<string, string>();
    articles.forEach(article => {
      articleTitleMap.set(
        article.id,
        `${article.lawName}${article.articleNumber}`
      );
    });

    // 查询冲突关系
    const conflicts = await prisma.lawArticleRelation.findMany({
      where: {
        relationType: 'CONFLICTS',
        verificationStatus: 'VERIFIED',
        OR: [
          { sourceId: { in: lawArticleIds } },
          { targetId: { in: lawArticleIds } },
        ],
      },
      include: {
        source: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
          },
        },
        target: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
          },
        },
      },
    });

    // 构建冲突结果
    const conflictResults = new Map<string, ConflictResult>();

    conflicts.forEach(conflict => {
      const { sourceId, targetId, source, target, id, relationType, strength } =
        conflict;

      // 确保源法条和目标法条都在请求列表中
      if (
        !lawArticleIds.includes(sourceId) ||
        !lawArticleIds.includes(targetId)
      ) {
        return;
      }

      // 为源法条添加冲突
      if (!conflictResults.has(sourceId)) {
        conflictResults.set(sourceId, {
          articleId: sourceId,
          articleTitle: `${source.lawName}${source.articleNumber}`,
          conflictsWith: [],
        });
      }

      const sourceResult = conflictResults.get(sourceId);
      if (sourceResult) {
        sourceResult.conflictsWith.push({
          articleId: targetId,
          articleTitle: `${target.lawName}${target.articleNumber}`,
          relationId: id,
          relationType,
          strength,
          reason: '法条间存在冲突关系',
        });
      }

      // 为目标法条添加冲突（反向）
      if (!conflictResults.has(targetId)) {
        conflictResults.set(targetId, {
          articleId: targetId,
          articleTitle: `${target.lawName}${target.articleNumber}`,
          conflictsWith: [],
        });
      }

      const targetResult = conflictResults.get(targetId);
      if (targetResult) {
        targetResult.conflictsWith.push({
          articleId: sourceId,
          articleTitle: `${source.lawName}${source.articleNumber}`,
          relationId: id,
          relationType,
          strength,
          reason: '法条间存在冲突关系',
        });
      }
    });

    // 转换为数组并排序
    const results = Array.from(conflictResults.values()).sort((a, b) =>
      a.articleId.localeCompare(b.articleId)
    );

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: '', // 从header获取
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: 'RELATION' as never,
      description: `冲突检测查询，涉及${lawArticleIds.length}个法条`,
      metadata: {
        lawArticleIds,
        conflictCount: results.length,
      },
    });

    return NextResponse.json({
      conflicts: results,
      total: results.length,
    });
  } catch (error: unknown) {
    logger.error('冲突检测失败', { error });
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
