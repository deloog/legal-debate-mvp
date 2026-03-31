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
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';

// 查询深度限制
const MAX_QUERY_DEPTH = 5;
const MAX_RESULT_LIMIT = 1000;

/**
 * POST /api/v1/knowledge-graph/query
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 认证检查
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.VIEW_RELATIONS,
      KnowledgeGraphResource.GRAPH
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限执行图查询', {
        userId: authUser.userId,
        reason: permissionResult.reason,
      });
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: '权限不足' } },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 检查是否包含query字段
    if (!body.query) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_PARAM', message: '请求体必须包含query字段' },
        },
        { status: 400 }
      );
    }

    const queryInput = body.query as GraphQueryInput;

    // 验证查询输入
    const errors = validateQueryInput(queryInput);
    if (errors.length > 0) {
      logger.warn('查询输入验证失败', { userId: authUser.userId, errors });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '查询参数验证失败',
            details: errors,
          },
        },
        { status: 400 }
      );
    }

    // 限制查询深度防止DoS
    if (queryInput.depth && queryInput.depth > MAX_QUERY_DEPTH) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEPTH_EXCEEDED',
            message: `查询深度不能超过${MAX_QUERY_DEPTH}`,
          },
        },
        { status: 400 }
      );
    }

    // 限制返回结果数量
    if (queryInput.limit && queryInput.limit > MAX_RESULT_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LIMIT_EXCEEDED',
            message: `返回结果数量不能超过${MAX_RESULT_LIMIT}`,
          },
        },
        { status: 400 }
      );
    }

    // 执行查询
    const executor = new GraphQueryExecutor();
    const result = await executor.executeQuery(queryInput);

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: authUser.userId,
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: KnowledgeGraphResource.GRAPH,
      description: `执行图查询: ${queryInput.startNode}`,
      metadata: {
        startNode: queryInput.startNode,
        direction: queryInput.direction,
        depth: queryInput.depth,
        filter: queryInput.filter,
        aggregate: queryInput.aggregate,
        resultNodeCount: result.nodes?.length || 0,
        resultLinkCount: result.links?.length || 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('图查询执行失败', { error });

    const errorMessage = '服务器错误';

    // 区分不同类型的错误
    if (error instanceof Error && error.message.includes('不存在')) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: errorMessage } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
      },
      { status: 500 }
    );
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
    authentication: '需要JWT认证',
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
        description: `查询深度（1-${MAX_QUERY_DEPTH}）`,
        min: 1,
        max: MAX_QUERY_DEPTH,
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
        description: `返回结果数量限制（1-${MAX_RESULT_LIMIT}）`,
        min: 1,
        max: MAX_RESULT_LIMIT,
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
