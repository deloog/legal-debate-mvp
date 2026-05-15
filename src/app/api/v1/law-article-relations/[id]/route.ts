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
import { getAuthUser } from '@/lib/middleware/auth';
import { ExpertService } from '@/lib/knowledge-graph/expert/expert-service';

/**
 * POST /api/v1/law-article-relations/[id]
 * 验证关系（通过或拒绝）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 从 JWT 获取用户身份，防止用户 ID 注入
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 验证必需字段
    if (typeof body.isApproved !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '缺少必需字段: isApproved' },
        { status: 400 }
      );
    }

    // 验证权限（使用 JWT 中的 userId）
    const permissionCheck = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.MANAGE_RELATIONS,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { success: false, error: permissionCheck.reason || '权限不足' },
        { status: 403 }
      );
    }

    const relationId = (await params).id;
    const expert = await new ExpertService().getOrCreateExpertProfile(
      authUser.userId
    );

    // 验证关系
    const relation = await LawArticleRelationService.verifyRelation(
      relationId,
      expert.id,
      body.isApproved
    );

    // 记录操作日志（异步，不影响主流程）
    try {
      await logKnowledgeGraphAction({
        userId: authUser.userId,
        action: KnowledgeGraphAction.VERIFY_RELATION,
        resource: KnowledgeGraphResource.RELATION,
        resourceId: relationId,
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

    return NextResponse.json({ success: true, data: relation });
  } catch (error: unknown) {
    logger.error('验证关系失败:', error);

    const errorMessage = '服务器错误';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/v1/law-article-relations/[id]
 * 删除关系
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 从 JWT 获取用户身份，防止用户 ID 注入
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const relationId = (await params).id;

    // 验证权限（使用 JWT 中的 userId）
    const permissionCheck = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.MANAGE_RELATIONS,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { success: false, error: permissionCheck.reason || '权限不足' },
        { status: 403 }
      );
    }

    // 删除关系
    await LawArticleRelationService.deleteRelation(relationId);

    // 记录操作日志（异步，不影响主流程）
    try {
      await logKnowledgeGraphAction({
        userId: authUser.userId,
        action: KnowledgeGraphAction.MANAGE_RELATIONS,
        resource: KnowledgeGraphResource.RELATION,
        resourceId: relationId,
        description: '删除关系',
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          relationId,
        },
      });
    } catch (logError) {
      // 日志记录失败不影响主流程
      logger.error('记录操作日志失败:', logError);
    }

    return NextResponse.json({
      success: true,
      message: '成功删除关系',
      id: relationId,
    });
  } catch (error: unknown) {
    logger.error('删除关系失败:', error);

    const errorMessage = '服务器错误';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
