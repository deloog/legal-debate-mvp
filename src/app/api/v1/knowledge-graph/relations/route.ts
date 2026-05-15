/**
 * 知识图谱关系API
 *
 * 功能：
 * - GET: 获取关系列表
 * - POST: 创建法条关系
 *
 * 端点:
 *   GET /api/v1/knowledge-graph/relations?page=&pageSize=&relationType=&verificationStatus=
 *   POST /api/v1/knowledge-graph/relations
 *     - sourceId: 源法条ID
 *     - targetId: 目标法条ID
 *     - relationType: 关系类型
 *     - confidence: 置信度（可选，默认0.7）
 *     - evidence: 证据（可选）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RelationType, VerificationStatus } from '@prisma/client';
import { validateID } from '@/lib/validation/id-validator';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

interface CreateRelationRequestBody {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  confidence?: number;
  evidence?: Record<string, unknown>;
}

interface CreateRelationResponse {
  success: boolean;
  relation?: Record<string, unknown>;
  error?: string;
}

// 默认置信度
const DEFAULT_CONFIDENCE = 0.7;

/**
 * POST /api/v1/knowledge-graph/relations
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateRelationResponse>> {
  // ─── 认证：从服务器端获取 userId，禁止客户端伪造 ─────────────────────────
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权，请先登录' },
      { status: 401 }
    );
  }

  try {
    // 解析请求体
    let body: CreateRelationRequestBody;
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
    if (!body.sourceId || typeof body.sourceId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数: sourceId',
        },
        { status: 400 }
      );
    }

    if (!body.targetId || typeof body.targetId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数: targetId',
        },
        { status: 400 }
      );
    }

    if (!body.relationType || typeof body.relationType !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数: relationType',
        },
        { status: 400 }
      );
    }

    // 验证confidence参数
    let confidence = body.confidence ?? DEFAULT_CONFIDENCE;
    if (typeof confidence === 'number') {
      if (confidence < 0 || confidence > 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'confidence参数必须在0-1之间',
          },
          { status: 400 }
        );
      }
    } else {
      confidence = DEFAULT_CONFIDENCE;
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
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

    // 验证源法条和目标法条是否存在
    const sourceArticle = await prisma.lawArticle.findUnique({
      where: { id: body.sourceId },
      select: { id: true, lawName: true, articleNumber: true },
    });

    if (!sourceArticle) {
      return NextResponse.json(
        {
          success: false,
          error: '源法条不存在',
        },
        { status: 404 }
      );
    }

    const targetArticle = await prisma.lawArticle.findUnique({
      where: { id: body.targetId },
      select: { id: true, lawName: true, articleNumber: true },
    });

    if (!targetArticle) {
      return NextResponse.json(
        {
          success: false,
          error: '目标法条不存在',
        },
        { status: 404 }
      );
    }

    // 检查关系是否已存在
    const existingRelation = await prisma.lawArticleRelation.findFirst({
      where: {
        sourceId: body.sourceId,
        targetId: body.targetId,
        relationType: body.relationType,
      },
    });

    if (existingRelation) {
      return NextResponse.json(
        {
          success: false,
          error: '关系已存在',
        },
        { status: 409 }
      );
    }

    // 创建关系
    const createData = {
      sourceId: body.sourceId,
      targetId: body.targetId,
      relationType: body.relationType,
      confidence,
      strength: confidence,
      verificationStatus: 'PENDING' as const,
      createdBy: authUser.userId,
      discoveryMethod: 'MANUAL' as const,
      ...(body.evidence ? { evidence: body.evidence as never } : {}),
    };

    const newRelation = await prisma.lawArticleRelation.create({
      data: createData,
    });

    // 记录操作日志
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logKnowledgeGraphAction({
      userId: authUser.userId,
      action: KnowledgeGraphAction.MANAGE_RELATIONS,
      resource: KnowledgeGraphResource.RELATION,
      resourceId: newRelation.id,
      description: `创建法条关系: ${sourceArticle.lawName}${sourceArticle.articleNumber} -> ${targetArticle.lawName}${targetArticle.articleNumber}`,
      ipAddress,
      userAgent,
      metadata: {
        sourceId: body.sourceId,
        targetId: body.targetId,
        relationType: body.relationType,
        confidence,
      },
    });

    return NextResponse.json(
      {
        success: true,
        relation: newRelation,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('创建关系失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建关系失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/knowledge-graph/relations
 *
 * 获取关系列表，支持分页和过滤
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 认证检查
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    // 权限检查 - 只需查看权限
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.VIEW_RELATIONS,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
    );
    const relationType = searchParams.get(
      'relationType'
    ) as RelationType | null;
    const verificationStatus = searchParams.get(
      'verificationStatus'
    ) as VerificationStatus | null;
    const sourceId = searchParams.get('sourceId')?.trim() || null;
    const targetId = searchParams.get('targetId')?.trim() || null;

    // 验证 ID 格式
    if (sourceId) {
      const validation = validateID(sourceId, 'sourceId');
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        );
      }
    }

    if (targetId) {
      const validation = validateID(targetId, 'targetId');
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        );
      }
    }

    // 构建查询条件
    const where: {
      relationType?: RelationType;
      verificationStatus?: VerificationStatus;
      sourceId?: string;
      targetId?: string;
    } = {};

    if (relationType && Object.values(RelationType).includes(relationType)) {
      where.relationType = relationType;
    }

    if (
      verificationStatus &&
      Object.values(VerificationStatus).includes(verificationStatus)
    ) {
      where.verificationStatus = verificationStatus;
    }

    if (sourceId) {
      where.sourceId = sourceId;
    }

    if (targetId) {
      where.targetId = targetId;
    }

    // 并行查询总数和数据
    const [total, relations] = await Promise.all([
      prisma.lawArticleRelation.count({ where }),
      prisma.lawArticleRelation.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: authUser.userId,
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: KnowledgeGraphResource.RELATION,
      description: `查询关系列表，共 ${total} 条`,
      metadata: {
        page,
        pageSize,
        filters: { relationType, verificationStatus, sourceId, targetId },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        relations,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    logger.error('获取关系列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取关系列表失败',
      },
      { status: 500 }
    );
  }
}
