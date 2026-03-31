import { NextRequest, NextResponse } from 'next/server';
import { EnterpriseRiskProfileService } from '@/services/enterprise/legal/enterprise-risk-profile.service';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

/**
 * 校验企业账号访问权限（仅账号所有者或管理员）
 */
async function resolveEnterpriseAccess(enterpriseId: string, userId: string) {
  const [enterprise, dbUser] = await Promise.all([
    prisma.enterpriseAccount.findUnique({
      where: { id: enterpriseId },
      select: { userId: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  if (!enterprise) return { found: false, allowed: false };
  const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
  const isOwner = enterprise.userId === userId;
  return { found: true, allowed: isAdmin || isOwner };
}

/**
 * POST /api/enterprise/risk-profile
 * 生成企业风险画像
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const service = new EnterpriseRiskProfileService(prisma);

    const body = await request.json();
    const { enterpriseId } = body;

    if (!enterpriseId) {
      return NextResponse.json({ error: '企业ID不能为空' }, { status: 400 });
    }

    const { found, allowed } = await resolveEnterpriseAccess(
      enterpriseId,
      authUser.userId
    );
    if (!found) {
      return NextResponse.json(
        { success: false, error: '企业账号不存在' },
        { status: 404 }
      );
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: '无权访问此企业账号' },
        { status: 403 }
      );
    }

    // 使用认证用户ID，不接受客户端传入的 userId
    const result = await service.generateEnterpriseRiskProfile(
      enterpriseId,
      authUser.userId
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('生成企业风险画像失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/enterprise/risk-profile?enterpriseId=xxx
 * 获取企业风险画像
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const enterpriseId = searchParams.get('enterpriseId');

    if (!enterpriseId) {
      return NextResponse.json({ error: '企业ID不能为空' }, { status: 400 });
    }

    const { found, allowed } = await resolveEnterpriseAccess(
      enterpriseId,
      authUser.userId
    );
    if (!found) {
      return NextResponse.json(
        { success: false, error: '企业账号不存在' },
        { status: 404 }
      );
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: '无权访问此企业账号' },
        { status: 403 }
      );
    }

    const service = new EnterpriseRiskProfileService(prisma);

    const result = await service.getEnterpriseRiskProfile(enterpriseId);

    if (!result) {
      return NextResponse.json({ error: '未找到风险画像' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('获取企业风险画像失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: '未知错误',
      },
      { status: 500 }
    );
  }
}
