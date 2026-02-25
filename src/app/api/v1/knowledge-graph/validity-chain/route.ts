/**
 * 知识图谱效力链追踪API
 *
 * 功能：追踪法条效力链，查找替代法条和效力状态
 *
 * 端点: GET /api/v1/knowledge-graph/validity-chain
 * 参数:
 *   - lawArticleId: 法条ID
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
 * 效力链节点
 */
interface ValidityChainNode {
  id: string;
  title: string;
  status: string;
  effectiveDate?: string;
  replacedBy?: string;
  replacedAt?: string;
}

/**
 * GET /api/v1/knowledge-graph/validity-chain
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;

  // 在try外声明，以便在catch块中使用
  let lawArticleId: string | null = null;

  try {
    // 参数验证
    lawArticleId = searchParams.get('lawArticleId');

    if (!lawArticleId) {
      return NextResponse.json(
        { error: '缺少必需参数: lawArticleId' },
        { status: 400 }
      );
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      '', // 用户ID从header中获取（实际实现中需要）
      KnowledgeGraphAction.VIEW_RELATIONS,
      'RELATION' as never
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限查看效力链', {
        reason: permissionResult.reason,
      });
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 查询源法条
    const sourceArticle = await prisma.lawArticle.findUnique({
      where: { id: lawArticleId },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        status: true,
        effectiveDate: true,
      },
    });

    if (!sourceArticle) {
      return NextResponse.json({ error: '未找到该法条' }, { status: 404 });
    }

    // 构建效力链
    const chain = await buildValidityChain(sourceArticle);

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: '', // 从header获取
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: 'RELATION' as never,
      resourceId: lawArticleId,
      description: `查询法条效力链，链长度: ${chain.length}`,
    });

    return NextResponse.json({
      articleId: lawArticleId,
      chain,
      chainLength: chain.length,
    });
  } catch (error: unknown) {
    logger.error('效力链追踪失败', { error, lawArticleId });
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * 构建效力链
 *
 * @param sourceArticle 源法条
 * @returns 效力链
 */
async function buildValidityChain(sourceArticle: {
  id: string;
  lawName: string;
  articleNumber: string;
  status: string;
  effectiveDate: Date | null;
}): Promise<ValidityChainNode[]> {
  const chain: ValidityChainNode[] = [];
  const visited = new Set<string>();
  let currentArticle = sourceArticle;

  // 限制最大深度，防止无限循环
  const maxDepth = 10;
  let depth = 0;

  while (currentArticle && depth < maxDepth) {
    // 防止循环
    if (visited.has(currentArticle.id)) {
      logger.warn('检测到效力链循环', { articleId: currentArticle.id });
      break;
    }

    visited.add(currentArticle.id);

    // 添加到链中
    const node: ValidityChainNode = {
      id: currentArticle.id,
      title: `${currentArticle.lawName}${currentArticle.articleNumber}`,
      status: currentArticle.status,
    };

    if (currentArticle.effectiveDate) {
      node.effectiveDate = currentArticle.effectiveDate.toISOString();
    }

    // 查找替代关系
    const replacementRelation = await prisma.lawArticleRelation.findFirst({
      where: {
        sourceId: currentArticle.id,
        relationType: 'SUPERSEDES',
        verificationStatus: 'VERIFIED',
      },
      select: {
        targetId: true,
        verifiedAt: true,
      },
    });

    if (replacementRelation) {
      node.replacedBy = replacementRelation.targetId;
      if (replacementRelation.verifiedAt) {
        node.replacedAt = replacementRelation.verifiedAt.toISOString();
      }

      // 查询下一个法条
      const nextArticle = await prisma.lawArticle.findUnique({
        where: { id: replacementRelation.targetId },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          status: true,
          effectiveDate: true,
        },
      });

      if (nextArticle) {
        chain.push(node);
        currentArticle = nextArticle;
      } else {
        chain.push(node);
        break;
      }
    } else {
      // 没有替代关系，链结束
      chain.push(node);
      break;
    }

    depth++;
  }

  return chain;
}
