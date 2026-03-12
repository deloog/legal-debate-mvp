/**
 * 专家等级升级 API
 * POST /api/knowledge-graph/experts/[expertId]/promote - 升级专家等级（仅管理员）
 * GET /api/knowledge-graph/experts/[expertId]/promote - 获取等级建议
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';
import { certificationService } from '@/lib/knowledge-graph/expert/certification-service';

/**
 * POST 升级专家等级（仅管理员）
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
        { success: false, error: '无权限升级专家等级' },
        { status: 403 }
      );
    }

    // 升级专家
    await certificationService.promoteExpert({
      expertId: (await params).expertId,
      newLevel: body.newLevel,
      reason: body.reason,
    });

    logger.info('Expert promoted successfully', {
      userId: session.user.id,
      expertId: (await params).expertId,
      newLevel: body.newLevel,
    });

    return NextResponse.json({
      success: true,
      message: '专家等级升级成功',
    });
  } catch (error) {
    logger.error('升级专家等级失败', {
      error,
      expertId: (await params).expertId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '升级专家等级失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET 获取等级建议
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

    const { prisma } = await import('@/lib/db/prisma');

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

    // 获取等级建议
    const suggestion = await certificationService.evaluateExpertLevelSuggestion(
      expert.userId
    );

    logger.info('Expert level suggestion evaluated', {
      userId: session.user.id,
      expertId: (await params).expertId,
    });

    return NextResponse.json({
      success: true,
      suggestion,
    });
  } catch (error) {
    logger.error('获取专家等级建议失败', {
      error,
      expertId: (await params).expertId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取专家等级建议失败',
      },
      { status: 500 }
    );
  }
}
