/**
 * 法条关系管理API
 * 提供关系的查询和创建功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
} from '@prisma/client';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * GET /api/v1/law-articles/[id]/relations
 * 获取法条的所有关系
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const relationTypeParam = searchParams.get('relationType');
    const directionParam = searchParams.get('direction');
    const minStrengthParam = searchParams.get('minStrength');
    const verificationStatusParam = searchParams.get('verificationStatus');

    // 验证和转换参数
    const relationType = relationTypeParam
      ? (relationTypeParam as RelationType)
      : undefined;

    const direction = directionParam
      ? (directionParam as 'outgoing' | 'incoming' | 'both')
      : undefined;

    const minStrength = minStrengthParam
      ? parseFloat(minStrengthParam)
      : undefined;

    const verificationStatus = verificationStatusParam
      ? (verificationStatusParam as VerificationStatus)
      : undefined;

    // 获取关系
    const relations = await LawArticleRelationService.getArticleRelations(
      (await params).id,
      {
        relationType,
        direction,
        minStrength,
        verificationStatus,
      }
    );

    return NextResponse.json({ success: true, data: relations });
  } catch (error) {
    logger.error('获取关系失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/law-articles/[id]/relations
 * 创建新的关系
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // 验证必需字段
    if (!body.targetId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_FIELD', message: '缺少必需字段: targetId' },
        },
        { status: 400 }
      );
    }

    if (!body.relationType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FIELD',
            message: '缺少必需字段: relationType',
          },
        },
        { status: 400 }
      );
    }

    // 创建关系（userId 从 JWT 获取，不从 body 读取，防止身份伪造）
    const relation = await LawArticleRelationService.createRelation({
      sourceId: (await params).id,
      targetId: body.targetId,
      relationType: body.relationType as RelationType,
      strength: body.strength,
      confidence: body.confidence,
      description: body.description,
      evidence: body.evidence,
      discoveryMethod: body.discoveryMethod as DiscoveryMethod | undefined,
      userId: authUser.userId,
    });

    return NextResponse.json(
      { success: true, data: relation },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('创建关系失败:', error);

    const errorMessage = error instanceof Error ? error.message : '服务器错误';

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
      },
      { status: 400 }
    );
  }
}
