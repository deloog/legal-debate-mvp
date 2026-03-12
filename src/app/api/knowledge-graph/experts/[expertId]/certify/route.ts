/**
 * 专家认证 API
 * POST /api/knowledge-graph/experts/[expertId]/certify - 认证专家（仅管理员）
 * DELETE /api/knowledge-graph/experts/[expertId]/certify - 撤销认证（仅管理员）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 检查管理员权限
    const { prisma } = await import('@/lib/db/prisma');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { success: false, error: '无权限进行专家认证' },
        { status: 403 }
      );
    }

    // 认证专家
    await certificationService.certifyExpert({
      expertId: (await params).expertId,
      adminId: session.user.id,
      notes: body.notes,
    });

    logger.info('Expert certified successfully', {
      userId: session.user.id,
      expertId: (await params).expertId,
    });

    return NextResponse.json({
      success: true,
      message: '专家认证成功',
    });
  } catch (error) {
    logger.error('认证专家失败', {
      error,
      expertId: (await params).expertId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '认证专家失败',
      },
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 检查管理员权限
    const { prisma } = await import('@/lib/db/prisma');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { success: false, error: '无权限撤销专家认证' },
        { status: 403 }
      );
    }

    // 撤销认证
    await certificationService.revokeExpertCertification(
      (await params).expertId,
      session.user.id,
      body.reason || '管理员撤销认证'
    );

    logger.info('Expert certification revoked successfully', {
      userId: session.user.id,
      expertId: (await params).expertId,
    });

    return NextResponse.json({
      success: true,
      message: '专家认证已撤销',
    });
  } catch (error) {
    logger.error('撤销专家认证失败', {
      error,
      expertId: (await params).expertId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '撤销专家认证失败',
      },
      { status: 500 }
    );
  }
}
