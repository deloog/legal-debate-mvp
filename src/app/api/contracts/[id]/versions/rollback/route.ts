/**
 * POST /api/contracts/[id]/versions/rollback
 * 回滚到指定版本
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractVersionService } from '@/lib/contract/contract-version-service';
import { clearContractPDFCache } from '@/lib/contract/contract-pdf-generator';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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

    if (!body.createdBy) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_CREATED_BY',
            message: '缺少操作人信息',
          },
        },
        { status: 400 }
      );
    }

    // 执行回滚
    await contractVersionService.rollbackToVersion(
      id,
      body.versionId,
      body.createdBy
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
