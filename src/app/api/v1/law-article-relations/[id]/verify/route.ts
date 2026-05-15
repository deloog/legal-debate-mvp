/**
 * 关系审核API
 * POST /api/v1/law-article-relations/[id]/verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { VerificationStatus } from '@prisma/client';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { ExpertService } from '@/lib/knowledge-graph/expert/expert-service';

interface VerifyRequestBody {
  approved: boolean;
  note?: string;
}

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

    // 解析请求体
    let body: VerifyRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: '无效的请求体' },
        { status: 400 }
      );
    }

    // 参数验证
    if (typeof body.approved !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'approved参数是必需的且必须是布尔值' },
        { status: 400 }
      );
    }

    // 权限检查（使用 JWT 中的 userId）
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.VERIFY_RELATION,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        { success: false, error: permissionResult.reason || '权限不足' },
        { status: 403 }
      );
    }

    const relationId = (await params).id;
    const expert = await new ExpertService().getOrCreateExpertProfile(
      authUser.userId
    );

    // 查询关系是否存在
    const relation = await prisma.lawArticleRelation.findUnique({
      where: { id: relationId },
    });

    if (!relation) {
      return NextResponse.json(
        { success: false, error: '关系不存在' },
        { status: 404 }
      );
    }

    // 检查是否已经被审核
    if (relation.verificationStatus !== VerificationStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: '该关系已经被审核' },
        { status: 400 }
      );
    }

    // 关系表 verifiedBy 外键指向专家档案，而操作日志仍记录真实 userId。
    const updatedRelation = await prisma.lawArticleRelation.update({
      where: { id: relationId },
      data: {
        verificationStatus: body.approved
          ? VerificationStatus.VERIFIED
          : VerificationStatus.REJECTED,
        verifiedBy: expert.id,
        verifiedAt: new Date(),
      },
    });

    // 记录审核操作日志
    try {
      const ipAddress =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await logKnowledgeGraphAction({
        userId: authUser.userId,
        action: KnowledgeGraphAction.VERIFY_RELATION,
        resource: KnowledgeGraphResource.RELATION,
        resourceId: relationId,
        description: `${body.approved ? '通过' : '拒绝'}法条关系审核`,
        ipAddress,
        userAgent,
        metadata: {
          approved: body.approved,
          note: body.note,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          relationType: relation.relationType,
        },
      });
    } catch (logError) {
      // 日志记录失败不应影响主流程
      logger.error('记录审核日志失败:', logError);
    }

    return NextResponse.json({
      success: true,
      data: updatedRelation,
    });
  } catch (error) {
    logger.error('审核关系失败:', error);
    return NextResponse.json(
      { success: false, error: '审核关系失败' },
      { status: 500 }
    );
  }
}
