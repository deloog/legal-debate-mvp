/**
 * 用户信誉管理API
 * GET /api/admin/reputation - 获取用户信誉列表
 * PUT /api/admin/reputation - 更新用户信誉等级
 * DELETE /api/admin/reputation - 重置用户信誉
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  adaptiveRateLimit,
  UserReputationLevel,
} from '@/lib/middleware/adaptive-rate-limit';

/**
 * GET /api/admin/reputation
 * 获取所有用户信誉数据
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') as UserReputationLevel | null;

    let reputations = adaptiveRateLimit.getAllReputations();

    // 按等级过滤
    if (level && Object.values(UserReputationLevel).includes(level)) {
      reputations = reputations.filter(rep => rep.level === level);
    }

    // 按分数排序（降序）
    reputations.sort((a, b) => b.score - a.score);

    const stats = adaptiveRateLimit.getStats();

    return NextResponse.json({
      success: true,
      data: {
        reputations,
        stats,
        total: reputations.length,
      },
    });
  } catch (error) {
    console.error('[Reputation] GET Error:', error);
    return NextResponse.json(
      { success: false, error: '获取信誉数据失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/reputation
 * 更新用户信誉等级
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:write');
  if (permissionError) {
    return permissionError;
  }

  try {
    const body = await request.json();
    const { identifier, level } = body;

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { success: false, error: '标识符必填' },
        { status: 400 }
      );
    }

    if (!level || !Object.values(UserReputationLevel).includes(level)) {
      return NextResponse.json(
        {
          success: false,
          error: `等级必须是以下之一: ${Object.values(UserReputationLevel).join(', ')}`,
        },
        { status: 400 }
      );
    }

    adaptiveRateLimit.setReputationLevel(identifier, level);

    const updatedReputation = adaptiveRateLimit.getReputation(identifier);

    return NextResponse.json({
      success: true,
      message: `用户信誉等级已更新为: ${level}`,
      data: updatedReputation,
    });
  } catch (error) {
    console.error('[Reputation] PUT Error:', error);
    return NextResponse.json(
      { success: false, error: '更新信誉等级失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reputation
 * 重置用户信誉
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:write');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('identifier');

    if (!identifier) {
      return NextResponse.json(
        { success: false, error: '标识符必填' },
        { status: 400 }
      );
    }

    adaptiveRateLimit.resetReputation(identifier);

    return NextResponse.json({
      success: true,
      message: `用户信誉已重置: ${identifier}`,
    });
  } catch (error) {
    console.error('[Reputation] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: '重置信誉失败' },
      { status: 500 }
    );
  }
}
