/**
 * GET /api/contracts/[id]/versions
 * 获取合同版本列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractVersionService } from '@/lib/contract/contract-version-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import { getContractAccess } from '@/app/api/lib/middleware/contract-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证身份
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const { id } = await params;

    const access = await getContractAccess(id, user.userId);
    if (!access.exists) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '合同不存在' } },
        { status: 404 }
      );
    }

    if (!access.canManage) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '无权访问此合同' },
        },
        { status: 403 }
      );
    }

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
          message: '获取版本列表失败',
        },
      },
      { status: 500 }
    );
  }
}
