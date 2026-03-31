/**
 * GET /api/contracts/[id]/versions
 * 获取合同版本列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractVersionService } from '@/lib/contract/contract-version-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

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

    // 验证合同所有权（律师 / 委托方 / 管理员）
    const [contract, dbUser] = await Promise.all([
      prisma.contract.findUnique({
        where: { id },
        select: { lawyerId: true, case: { select: { userId: true } } },
      }),
      prisma.user.findUnique({
        where: { id: user.userId },
        select: { role: true },
      }),
    ]);
    if (!contract) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '合同不存在' } },
        { status: 404 }
      );
    }
    // 从 DB 实时读取角色，防止 stale JWT 绕过管理员豁免
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
    const isLawyer = contract.lawyerId === user.userId;
    const isClient = contract.case?.userId === user.userId;
    if (!isAdmin && !isLawyer && !isClient) {
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
