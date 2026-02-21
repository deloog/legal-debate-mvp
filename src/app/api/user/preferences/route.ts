/**
 * GET  /api/user/preferences  — 获取当前用户偏好设置（含提醒配置）
 * PUT  /api/user/preferences  — 更新用户偏好设置
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // preferences 是 Json 字段，直接返回其中的 reminderPreferences 部分
    const prefs = (user.preferences as Record<string, unknown> | null) ?? {};
    const reminderPreferences = prefs.reminderPreferences ?? null;

    return NextResponse.json({
      success: true,
      message: '获取偏好设置成功',
      data: reminderPreferences,
    });
  } catch (error) {
    logger.error('获取偏好设置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取偏好设置失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { reminderPreferences } = body as { reminderPreferences?: unknown };

    if (reminderPreferences === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少 reminderPreferences 字段' },
        { status: 400 }
      );
    }

    // 读取现有 preferences，合并更新
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPrefs =
      (existing?.preferences as Record<string, unknown> | null) ?? {};
    const mergedPrefs = {
      ...currentPrefs,
      reminderPreferences,
    };
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: mergedPrefs as Prisma.InputJsonValue,
      },
      select: { preferences: true },
    });

    const savedPrefs = (updated.preferences as Record<string, unknown>) ?? {};

    return NextResponse.json({
      success: true,
      message: '保存偏好设置成功',
      data: savedPrefs.reminderPreferences,
    });
  } catch (error) {
    logger.error('保存偏好设置失败:', error);
    return NextResponse.json(
      { success: false, error: '保存偏好设置失败' },
      { status: 500 }
    );
  }
}
