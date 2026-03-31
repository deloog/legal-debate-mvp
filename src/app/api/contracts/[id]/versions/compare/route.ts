/**
 * POST /api/contracts/[id]/versions/compare
 * 对比两个版本
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractVersionService } from '@/lib/contract/contract-version-service';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const { id: contractId } = await context.params;

    // 验证合同所有权（防止 IDOR）
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        OR: [
          { lawyerId: authUser.userId },
          { case: { userId: authUser.userId } },
        ],
      },
      select: { id: true },
    });
    if (!contract) {
      // 区分"不存在"和"无权限"需要额外查询，统一返回404防止枚举
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: '合同不存在或无权访问' },
        },
        { status: 404 }
      );
    }

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
    logger.error('版本对比失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '版本对比失败',
        },
      },
      { status: 500 }
    );
  }
}
