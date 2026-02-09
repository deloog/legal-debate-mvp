/**
 * 批量审核API
 * POST /api/v1/law-article-relations/batch-verify
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

interface BatchVerifyRequestBody {
  relationIds: string[];
  approved: boolean;
  verifiedBy: string;
  note?: string;
}

interface BatchVerifyResult {
  relationId: string;
  success: boolean;
  error?: string;
}

interface BatchVerifyResponse {
  success: boolean;
  data?: {
    successCount: number;
    failedCount: number;
    results: BatchVerifyResult[];
  };
  error?: string;
}

// 批量审核的最大数量限制
const MAX_BATCH_SIZE = 100;

export async function POST(
  request: NextRequest
): Promise<NextResponse<BatchVerifyResponse>> {
  try {
    // 解析请求体
    let body: BatchVerifyRequestBody;
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
          error: `最多只能批量审核${MAX_BATCH_SIZE}个关系`,
        },
        { status: 400 }
      );
    }

    if (typeof body.approved !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: 'approved参数是必需的且必须是布尔值',
        },
        { status: 400 }
      );
    }

    if (!body.verifiedBy || typeof body.verifiedBy !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'verifiedBy参数是必需的',
        },
        { status: 400 }
      );
    }

    if (body.verifiedBy.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'verifiedBy不能为空',
        },
        { status: 400 }
      );
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      body.verifiedBy,
      KnowledgeGraphAction.BATCH_VERIFY,
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

    // 批量审核关系
    const results: BatchVerifyResult[] = [];
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

        // 检查是否已经被审核
        if (relation.verificationStatus !== VerificationStatus.PENDING) {
          results.push({
            relationId,
            success: false,
            error: '该关系已经被审核',
          });
          failedCount++;
          continue;
        }

        // 更新审核状态
        await prisma.lawArticleRelation.update({
          where: { id: relationId },
          data: {
            verificationStatus: body.approved
              ? VerificationStatus.VERIFIED
              : VerificationStatus.REJECTED,
            verifiedBy: body.verifiedBy,
            verifiedAt: new Date(),
          },
        });

        results.push({
          relationId,
          success: true,
        });
        successCount++;
      } catch (error) {
        console.error(`审核关系 ${relationId} 失败:`, error);
        results.push({
          relationId,
          success: false,
          error: '审核失败',
        });
        failedCount++;
      }
    }

    // 记录批量审核操作日志
    try {
      const ipAddress =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await logKnowledgeGraphAction({
        userId: body.verifiedBy,
        action: KnowledgeGraphAction.BATCH_VERIFY,
        resource: KnowledgeGraphResource.RELATION,
        description: `批量${body.approved ? '通过' : '拒绝'}${body.relationIds.length}个法条关系审核`,
        ipAddress,
        userAgent,
        metadata: {
          count: body.relationIds.length,
          successCount,
          failedCount,
          approved: body.approved,
          note: body.note,
        },
      });
    } catch (logError) {
      // 日志记录失败不应影响主流程
      console.error('记录批量审核日志失败:', logError);
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
    console.error('批量审核关系失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '批量审核关系失败',
      },
      { status: 500 }
    );
  }
}
