/**
 * POST /api/contracts/[id]/versions/rollback
 * 回滚到指定版本
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractVersionService } from '@/lib/contract/contract-version-service';
import { clearContractPDFCache } from '@/lib/contract/contract-pdf-generator';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import {
  resolveContractUserId,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/app/api/lib/middleware/contract-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ─── 认证 ─────────────────────────────────────────────────────────────────
  const userId = resolveContractUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.versionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_VERSION_ID',
            message: '缺少版本ID',
          },
        },
        { status: 400 }
      );
    }

    // ─── 合同存在性 + 所有权检查 ──────────────────────────────────────────────
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { lawyerId: true },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: { code: 'CONTRACT_NOT_FOUND', message: '合同不存在' } },
        { status: 404 }
      );
    }

    if (contract.lawyerId !== userId) {
      return forbiddenResponse();
    }

    // 执行回滚（createdBy 使用来自 JWT 的 userId，不再信任请求体）
    await contractVersionService.rollbackToVersion(
      id,
      body.versionId,
      userId
    );

    // 清除PDF缓存
    clearContractPDFCache(id).catch(error => {
      logger.error('清除PDF缓存失败:', error);
    });

    return NextResponse.json({
      success: true,
      message: '版本回滚成功',
    });
  } catch (error) {
    logger.error('版本回滚失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '版本回滚失败',
        },
      },
      { status: 500 }
    );
  }
}
