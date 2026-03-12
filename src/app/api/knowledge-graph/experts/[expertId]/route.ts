/**
 * 专家详情 API
 * GET /api/knowledge-graph/experts/[expertId] - 获取专家详情
 * PATCH /api/knowledge-graph/experts/[expertId] - 更新专家信息
 * DELETE /api/knowledge-graph/experts/[expertId] - 删除专家档案
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';
import { expertService } from '@/lib/knowledge-graph/expert/expert-service';

/**
 * GET 获取专家详情
 */
export async function GET(
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

    // 从Prisma获取专家详情
    const { prisma } = await import('@/lib/db/prisma');
    const expert = await prisma.knowledgeGraphExpert.findUnique({
      where: { id: (await params).expertId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!expert) {
      return NextResponse.json(
        { success: false, error: '专家不存在' },
        { status: 404 }
      );
    }

    logger.info('Expert detail fetched successfully', {
      userId: session.user.id,
      expertId: (await params).expertId,
    });

    return NextResponse.json({
      success: true,
      expert: expertService['mapToExpertProfile'](expert),
    });
  } catch (error) {
    logger.error('获取专家详情失败', {
      error,
      expertId: (await params).expertId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取专家详情失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH 更新专家信息
 */
export async function PATCH(
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

    // 检查权限：只能更新自己的档案，或者管理员可以更新任何档案
    const { prisma } = await import('@/lib/db/prisma');
    const expert = await prisma.knowledgeGraphExpert.findUnique({
      where: { id: (await params).expertId },
    });

    if (!expert) {
      return NextResponse.json(
        { success: false, error: '专家不存在' },
        { status: 404 }
      );
    }

    // 验证权限
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    const isOwner = expert.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, error: '无权限更新此专家档案' },
        { status: 403 }
      );
    }

    // 非管理员不能更新expertLevel
    if (!isAdmin && body.expertLevel) {
      return NextResponse.json(
        { success: false, error: '无权限更新专家等级' },
        { status: 403 }
      );
    }

    // 更新专家信息
    const updatedExpert = await expertService.updateExpertProfile(
      expert.userId,
      body
    );

    logger.info('Expert profile updated successfully', {
      userId: session.user.id,
      expertId: (await params).expertId,
    });

    return NextResponse.json({
      success: true,
      expert: updatedExpert,
    });
  } catch (error) {
    logger.error('更新专家档案失败', {
      error,
      expertId: (await params).expertId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新专家档案失败',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE 删除专家档案（仅管理员）
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

    // 检查管理员权限
    const { prisma } = await import('@/lib/db/prisma');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { success: false, error: '无权限删除专家档案' },
        { status: 403 }
      );
    }

    // 获取专家信息
    const expert = await prisma.knowledgeGraphExpert.findUnique({
      where: { id: (await params).expertId },
    });

    if (!expert) {
      return NextResponse.json(
        { success: false, error: '专家不存在' },
        { status: 404 }
      );
    }

    // 删除专家档案
    await expertService.deleteExpertProfile(expert.userId);

    logger.info('Expert profile deleted successfully', {
      userId: session.user.id,
      expertId: (await params).expertId,
    });

    return NextResponse.json({
      success: true,
      message: '专家档案已删除',
    });
  } catch (error) {
    logger.error('删除专家档案失败', {
      error,
      expertId: (await params).expertId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除专家档案失败',
      },
      { status: 500 }
    );
  }
}
