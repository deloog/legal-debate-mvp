/**
 * 批量删除法条关系API
 *
 * 端点: POST /api/v1/law-article-relations/batch-delete
 *
 * 功能：批量删除法条关系
 *
 * 参数:
 *   - relationIds: 关系ID数组
 *   - deletedBy: 操作人ID
 *   - reason: 删除原因（可选）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';
import { logger } from '@/lib/logger';

interface BatchDeleteRequestBody {
  relationIds: string[];
  deletedBy: string;
  reason?: string;
}

interface BatchDeleteResult {
  relationId: string;
  success: boolean;
  error?: string;
}

interface BatchDeleteResponse {
  success: boolean;
  data?: {
    successCount: number;
    failedCount: number;
    results: BatchDeleteResult[];
  };
  error?: string;
}

// 批量删除的最大数量限制
const MAX_BATCH_SIZE = 100;

export async function POST(
  request: NextRequest
): Promise<NextResponse<BatchDeleteResponse>> {
  try {
    // 解析请求体
    let body: BatchDeleteRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: '无效的请求体',
        },
        { status: 400 }
      );
    }

    // 参数验证
    if (!Array.isArray(body.relationIds)) {
      return NextResponse.json(
        {
          success: false,
          error: 'relationIds参数必须是数组',
        },
        { status: 400 }
      );
    }

    if (body.relationIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'relationIds不能为空',
        },
        { status: 400 }
      );
    }

    if (body.relationIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `最多只能批量删除${MAX_BATCH_SIZE}个关系`,
        },
        { status: 400 }
      );
    }

    if (!body.deletedBy || typeof body.deletedBy !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'deletedBy参数是必需的',
        },
        { status: 400 }
      );
    }

    if (body.deletedBy.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'deletedBy不能为空',
        },
        { status: 400 }
      );
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      body.deletedBy,
      KnowledgeGraphAction.MANAGE_RELATIONS,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: permissionResult.reason || '权限不足',
        },
        { status: 403 }
      );
    }

    // 批量删除关系
    const results: BatchDeleteResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const relationId of body.relationIds) {
      try {
        // 查询关系是否存在
        const relation = await prisma.lawArticleRelation.findUnique({
          where: { id: relationId },
        });

        if (!relation) {
          results.push({
            relationId,
            success: false,
            error: '关系不存在',
          });
          failedCount++;
          continue;
        }

        // 删除关系
        await prisma.lawArticleRelation.delete({
          where: { id: relationId },
        });

        results.push({
          relationId,
          success: true,
        });
        successCount++;
      } catch (error) {
        logger.error(`删除关系 ${relationId} 失败:`, error);
        results.push({
          relationId,
          success: false,
          error: '删除失败',
        });
        failedCount++;
      }
    }

    // 记录批量删除操作日志
    try {
      const ipAddress =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await logKnowledgeGraphAction({
        userId: body.deletedBy,
        action: KnowledgeGraphAction.MANAGE_RELATIONS,
        resource: KnowledgeGraphResource.RELATION,
        description: `批量删除${body.relationIds.length}个法条关系`,
        ipAddress,
        userAgent,
        metadata: {
          count: body.relationIds.length,
          successCount,
          failedCount,
          reason: body.reason,
        },
      });
    } catch (logError) {
      // 日志记录失败不应影响主流程
      logger.error('记录批量删除日志失败:', logError);
    }

    return NextResponse.json({
      success: true,
      data: {
        successCount,
        failedCount,
        results,
      },
    });
  } catch (error) {
    logger.error('批量删除关系失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '批量删除关系失败',
      },
      { status: 500 }
    );
  }
}
