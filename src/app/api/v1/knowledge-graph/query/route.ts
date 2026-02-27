/**
 * 知识图谱查询语言API
 *
 * 功能：提供统一的图谱查询接口
 *
 * 端点: POST /api/v1/knowledge-graph/query
 *
 * 请求体:
 * {
 *   "query": {
 *     "startNode": "articleA",
 *     "direction": "both",  // "in" | "out" | "both"
 *     "depth": 2,
 *     "filter": {
 *       "relationType": "CONFLICTS",
 *       "minStrength": 0.5
 *     },
 *     "aggregate": "count"  // "count" | "sum" | "avg" | "max" | "min"
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphQueryExecutor } from '@/lib/knowledge-graph/query/query-executor';
import {
  GraphQueryInput,
  validateQueryInput,
} from '@/lib/knowledge-graph/query/types';
import { logger } from '@/lib/logger';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
} from '@/lib/middleware/knowledge-graph-permission';

/**
 * POST /api/v1/knowledge-graph/query
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 解析请求体
    const body = await request.json();

    // 检查是否包含query字段
    if (!body.query) {
      return NextResponse.json(
        { error: '请求体必须包含query字段' },
        { status: 400 }
      );
    }

    const queryInput = body.query as GraphQueryInput;

    // 验证查询输入
    const errors = validateQueryInput(queryInput);
    if (errors.length > 0) {
      logger.warn('查询输入验证失败', { errors });
      return NextResponse.json(
        { error: '查询参数验证失败', details: errors },
        { status: 400 }
      );
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      '',
      KnowledgeGraphAction.VIEW_RELATIONS,
      'RELATION' as never
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限执行图查询', {
        reason: permissionResult.reason,
      });
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 执行查询
    const executor = new GraphQueryExecutor();
    const result = await executor.executeQuery(queryInput);

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: '',
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: 'RELATION' as never,
      description: `执行图查询: ${queryInput.startNode}`,
      metadata: {
        startNode: queryInput.startNode,
        direction: queryInput.direction,
        depth: queryInput.depth,
        filter: queryInput.filter,
        aggregate: queryInput.aggregate,
        resultNodeCount: result.nodes.length,
        resultLinkCount: result.links.length,
      },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('图查询执行失败', {
      error,
    });

    const errorMessage = error instanceof Error ? error.message : '服务器错误';

    // 区分不同类型的错误
    if (error instanceof Error && error.message.includes('不存在')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * GET /api/v1/knowledge-graph/query
 *
 * 返回API文档信息
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: '知识图谱查询语言API',
    version: '1.0.0',
    description: '提供灵活的图谱查询接口',
    endpoint: 'POST /api/v1/knowledge-graph/query',
    parameters: {
      startNode: {
        type: 'string',
        required: true,
        description: '起始节点ID（法条ID）',
      },
      direction: {
        type: 'string',
        required: false,
        default: 'both',
        description: '查询方向：in（入）、out（出）、both（双向）',
        enum: ['in', 'out', 'both'],
      },
      depth: {
        type: 'number',
        required: false,
        default: 1,
        description: '查询深度（1-10）',
        min: 1,
        max: 10,
      },
      filter: {
        type: 'object',
        required: false,
        description: '过滤条件',
        properties: {
          relationType: {
            type: 'string',
            description: '关系类型（CITES, CONFLICTS, etc.）',
          },
          minStrength: {
            type: 'number',
            description: '最小关系强度（0-1）',
            min: 0,
            max: 1,
          },
          verificationStatus: {
            type: 'string',
            description: '验证状态（PENDING, VERIFIED, REJECTED）',
          },
          discoveryMethod: {
            type: 'string',
            description: '发现方法（AI, RULE, CASE）',
          },
        },
      },
      aggregate: {
        type: 'string',
        required: false,
        description: '聚合函数',
        enum: ['count', 'sum', 'avg', 'max', 'min'],
      },
      sortBy: {
        type: 'string',
        required: false,
        default: 'strength',
        description: '排序字段',
      },
      sortOrder: {
        type: 'string',
        required: false,
        default: 'desc',
        description: '排序方向',
        enum: ['asc', 'desc'],
      },
      limit: {
        type: 'number',
        required: false,
        default: 50,
        description: '返回结果数量限制（1-100）',
        min: 1,
        max: 100,
      },
      offset: {
        type: 'number',
        required: false,
        default: 0,
        description: '分页偏移量',
        min: 0,
      },
    },
    example: {
      query: {
        startNode: 'article-123',
        direction: 'both',
        depth: 2,
        filter: {
          relationType: 'CONFLICTS',
          minStrength: 0.5,
        },
        aggregate: 'count',
      },
    },
  });
}
