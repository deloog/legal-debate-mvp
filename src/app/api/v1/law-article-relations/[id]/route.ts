/**
 * 法条关系验证和删除API
 * 提供关系的验证和删除功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';
import { logger } from '@/lib/logger';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';

/**
 * POST /api/v1/law-article-relations/[id]
 * 验证关系（通过或拒绝）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // 验证必需字段
    if (!body.verifiedBy) {
      return NextResponse.json(
        { error: '缺少必需字段: verifiedBy' },
        { status: 400 }
      );
    }

    if (typeof body.isApproved !== 'boolean') {
      return NextResponse.json(
        { error: '缺少必需字段: isApproved' },
        { status: 400 }
      );
    }

    // 验证权限
    const permissionCheck = await checkKnowledgeGraphPermission(
      body.verifiedBy,
      KnowledgeGraphAction.MANAGE_RELATIONS,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.reason || '权限不足' },
        { status: 403 }
      );
    }

    // 验证关系
    const relation = await LawArticleRelationService.verifyRelation(
      params.id,
      body.verifiedBy,
      body.isApproved
    );

    // 记录操作日志（异步，不影响主流程）
    try {
      await logKnowledgeGraphAction({
        userId: body.verifiedBy,
        action: KnowledgeGraphAction.VERIFY_RELATION,
        resource: KnowledgeGraphResource.RELATION,
        resourceId: params.id,
        description: body.isApproved ? '验证关系通过' : '验证关系拒绝',
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          isApproved: body.isApproved,
          relationType: relation.relationType,
        },
      });
    } catch (logError) {
      // 日志记录失败不影响主流程
      logger.error('记录操作日志失败:', logError);
    }

    return NextResponse.json(relation);
  } catch (error: unknown) {
    logger.error('验证关系失败:', error);

    const errorMessage = error instanceof Error ? error.message : '服务器错误';

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * DELETE /api/v1/law-article-relations/[id]
 * 删除关系
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 从请求头获取用户ID
    const verifiedBy = request.headers.get('x-verified-by');

    if (!verifiedBy) {
      return NextResponse.json(
        { error: '缺少必需字段: x-verified-by' },
        { status: 400 }
      );
    }

    // 验证权限
    const permissionCheck = await checkKnowledgeGraphPermission(
      verifiedBy,
      KnowledgeGraphAction.MANAGE_RELATIONS,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.reason || '权限不足' },
        { status: 403 }
      );
    }

    // 删除关系
    await LawArticleRelationService.deleteRelation(params.id);

    // 记录操作日志（异步，不影响主流程）
    try {
      await logKnowledgeGraphAction({
        userId: verifiedBy,
        action: KnowledgeGraphAction.MANAGE_RELATIONS,
        resource: KnowledgeGraphResource.RELATION,
        resourceId: params.id,
        description: '删除关系',
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          relationId: params.id,
        },
      });
    } catch (logError) {
      // 日志记录失败不影响主流程
      logger.error('记录操作日志失败:', logError);
    }

    return NextResponse.json({
      message: '成功删除关系',
      id: params.id,
    });
  } catch (error: unknown) {
    logger.error('删除关系失败:', error);

    const errorMessage = error instanceof Error ? error.message : '服务器错误';

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
