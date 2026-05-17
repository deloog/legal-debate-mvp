/**
 * 获取当前用户信息 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import { getEffectiveUserRole } from '@/lib/auth/role-onboarding';

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 验证用户认证
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, message: '未认证' },
        { status: 401 }
      );
    }

    // 查找用户详细信息
    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        avatar: true,
        bio: true,
        phone: true,
        organizationId: true,
        preferences: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: '用户不存在' },
        { status: 404 }
      );
    }

    // 封禁/停用的用户不允许获取自身信息（等同于未认证）
    if (currentUser.status === 'SUSPENDED' || currentUser.status === 'BANNED') {
      return NextResponse.json(
        {
          success: false,
          message: '账号已被停用，请联系管理员',
          error: { code: 'ACCOUNT_DISABLED' },
        },
        { status: 403 }
      );
    }

    const effectiveRole = getEffectiveUserRole(
      currentUser.role,
      currentUser.preferences
    );
    if (effectiveRole !== currentUser.role) {
      await prisma.user.update({
        where: { id: currentUser.id },
        data: { role: effectiveRole },
      });
      currentUser.role = effectiveRole as typeof currentUser.role;
    }

    return NextResponse.json(
      {
        success: true,
        message: '获取成功',
        data: {
          user: currentUser,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    return NextResponse.json(
      { success: false, message: '获取失败，请稍后重试' },
      { status: 500 }
    );
  }
}
