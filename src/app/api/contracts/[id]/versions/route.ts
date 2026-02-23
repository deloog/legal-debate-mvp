/**
 * GET /api/contracts/[id]/versions
 * 获取合同版本列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractVersionService } from '@/lib/contract/contract-version-service';
import { logger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 获取版本列表
    const versions = await contractVersionService.getVersions(id);

    return NextResponse.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    logger.error('获取版本列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '获取版本列表失败',
        },
      },
      { status: 500 }
    );
  }
}
