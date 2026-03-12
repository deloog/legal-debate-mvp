/**
 * 合同法条关联API路由
 * GET /api/v1/contracts/[id]/law-articles - 获取已关联的法条
 * POST /api/v1/contracts/[id]/law-articles - 添加法条关联
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  resolveContractUserId,
  unauthorizedResponse,
} from '@/app/api/lib/middleware/contract-auth';

/**
 * 获取合同已关联的法条
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // ─── 认证 ─────────────────────────────────────────────────────────────────
  const userId = resolveContractUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const { id: contractId } = await params;

    // 验证合同是否存在
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'CONTRACT_NOT_FOUND', message: '合同不存在' },
        },
        { status: 404 }
      );
    }

    // 查询已关联的法条
    const associations = await prisma.contractLawArticle.findMany({
      where: { contractId },
      include: {
        lawArticle: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            fullText: true,
            lawType: true,
            category: true,
            tags: true,
            effectiveDate: true,
            status: true,
          },
        },
      },
      orderBy: {
        addedAt: 'desc',
      },
    });

    // 格式化返回数据
    const lawArticles = associations.map(assoc => ({
      ...assoc.lawArticle,
      associationId: assoc.id,
      addedBy: assoc.addedBy,
      addedAt: assoc.addedAt,
      reason: assoc.reason,
      relevanceScore: assoc.relevanceScore,
    }));

    return NextResponse.json(
      {
        success: true,
        lawArticles,
        metadata: {
          contractId,
          totalCount: lawArticles.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('获取合同关联法条失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取关联法条失败' },
      },
      { status: 500 }
    );
  }
}

/**
 * 添加法条关联
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // ─── 认证 ─────────────────────────────────────────────────────────────────
  const userId = resolveContractUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const { id: contractId } = await params;
    const body = await request.json();

    // 验证请求体（addedBy 不再从请求体读取，由 JWT token 提供）
    const { lawArticleId, reason, relevanceScore } = body;

    if (!lawArticleId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_PARAMS', message: 'lawArticleId是必需的' },
        },
        { status: 400 }
      );
    }

    // 验证相关性分数
    if (relevanceScore !== undefined && relevanceScore !== null) {
      if (
        typeof relevanceScore !== 'number' ||
        relevanceScore < 0 ||
        relevanceScore > 1
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_PARAMS',
              message: 'relevanceScore必须是0到1之间的数字',
            },
          },
          { status: 400 }
        );
      }
    }

    // 验证合同是否存在
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'CONTRACT_NOT_FOUND', message: '合同不存在' },
        },
        { status: 404 }
      );
    }

    // 验证法条是否存在
    const lawArticle = await prisma.lawArticle.findUnique({
      where: { id: lawArticleId },
      select: { id: true },
    });

    if (!lawArticle) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ARTICLE_NOT_FOUND', message: '法条不存在' },
        },
        { status: 404 }
      );
    }

    // 检查是否已经关联
    const existingAssociation = await prisma.contractLawArticle.findUnique({
      where: {
        contractId_lawArticleId: {
          contractId,
          lawArticleId,
        },
      },
    });

    if (existingAssociation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_ASSOCIATED',
            message: '该法条已经关联到此合同',
          },
        },
        { status: 409 }
      );
    }

    // 创建关联（addedBy 使用来自 JWT 的 userId，保证审计链准确）
    const association = await prisma.contractLawArticle.create({
      data: {
        contractId,
        lawArticleId,
        addedBy: userId,
        reason: reason || null,
        relevanceScore: relevanceScore || null,
      },
      include: {
        lawArticle: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            fullText: true,
            lawType: true,
            category: true,
            tags: true,
            effectiveDate: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        association: {
          ...association.lawArticle,
          associationId: association.id,
          addedBy: association.addedBy,
          addedAt: association.addedAt,
          reason: association.reason,
          relevanceScore: association.relevanceScore,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('添加法条关联失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '添加关联失败' },
      },
      { status: 500 }
    );
  }
}
