/**
 * 专家认证 API
 * POST /api/knowledge-graph/experts/[expertId]/certify - 认证专家（仅管理员）
 * DELETE /api/knowledge-graph/experts/[expertId]/certify - 撤销认证（仅管理员）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { certificationService } from '@/lib/knowledge-graph/expert/certification-service';

/**
 * POST 认证专家（仅管理员）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ expertId: string }> }
) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { expertId } = await params;

    // 检查管理员权限
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { success: false, error: '无权限进行专家认证' },
        { status: 403 }
      );
    }

    // 认证专家
    await certificationService.certifyExpert({
      expertId,
      adminId: authUser.userId,
      notes: body.notes,
    });

    logger.info('Expert certified successfully', {
      userId: authUser.userId,
      expertId,
    });

    return NextResponse.json({
      success: true,
      message: '专家认证成功',
    });
  } catch (error) {
    const { expertId } = await params;
    logger.error('认证专家失败', { error, expertId });

    return NextResponse.json(
      { success: false, error: '认证专家失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE 撤销认证（仅管理员）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ expertId: string }> }
) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { expertId } = await params;

    // 检查管理员权限
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { success: false, error: '无权限撤销专家认证' },
        { status: 403 }
      );
    }

    // 撤销认证
    await certificationService.revokeExpertCertification(
      expertId,
      authUser.userId,
      body.reason || '管理员撤销认证'
    );

    logger.info('Expert certification revoked successfully', {
      userId: authUser.userId,
      expertId,
    });

    return NextResponse.json({
      success: true,
      message: '专家认证已撤销',
    });
  } catch (error) {
    const { expertId } = await params;
    logger.error('撤销专家认证失败', { error, expertId });

    return NextResponse.json(
      { success: false, error: '撤销专家认证失败' },
      { status: 500 }
    );
  }
}
