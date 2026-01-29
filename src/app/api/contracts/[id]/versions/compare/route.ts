/**
 * POST /api/contracts/[id]/versions/compare
 * 对比两个版本
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractVersionService } from '@/lib/contract/contract-version-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (!body.versionId1 || !body.versionId2) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: '缺少版本ID',
          },
        },
        { status: 400 }
      );
    }

    // 对比版本
    const diff = await contractVersionService.compareVersions(
      body.versionId1,
      body.versionId2
    );

    return NextResponse.json({
      success: true,
      data: diff,
    });
  } catch (error) {
    console.error('版本对比失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '版本对比失败',
        },
      },
      { status: 500 }
    );
  }
}
