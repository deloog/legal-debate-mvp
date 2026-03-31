/**
 * 专家等级升级 API
 * POST /api/knowledge-graph/experts/[expertId]/promote - 升级专家等级（仅管理员）
 * GET /api/knowledge-graph/experts/[expertId]/promote - 获取等级建议
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
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
        { success: false, error: '无权限升级专家等级' },
        { status: 403 }
      );
    }

    // 升级专家
    await certificationService.promoteExpert({
      expertId,
      newLevel: body.newLevel,
      reason: body.reason,
    });

    logger.info('Expert promoted successfully', {
      userId: authUser.userId,
      expertId,
      newLevel: body.newLevel,
    });

    return NextResponse.json({
      success: true,
      message: '专家等级升级成功',
    });
  } catch (error) {
    const { expertId } = await params;
    logger.error('升级专家等级失败', { error, expertId });

    return NextResponse.json(
      { success: false, error: '升级专家等级失败' },
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
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { expertId } = await params;

    // 获取专家信息
    const expert = await prisma.knowledgeGraphExpert.findUnique({
      where: { id: expertId },
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
      userId: authUser.userId,
      expertId,
    });

    return NextResponse.json({
      success: true,
      suggestion,
    });
  } catch (error) {
    const { expertId } = await params;
    logger.error('获取专家等级建议失败', { error, expertId });

    return NextResponse.json(
      { success: false, error: '获取专家等级建议失败' },
      { status: 500 }
    );
  }
}
