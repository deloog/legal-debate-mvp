/**
 * 测试辅助认证端点
 *
 * 此端点专门用于E2E测试，提供简化的认证接口
 * 允许测试脚本获取有效的Next-Auth会话状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { compare } from 'bcryptjs';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/test-session - 测试专用登录端点
 *
 * 用于E2E测试快速登录，返回会话信息供Playwright使用
 * 仅在非生产环境可用。
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    // 验证必需参数
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'MISSING_CREDENTIALS' },
        { status: 400 }
      );
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    // 验证密码
    const isValidPassword = await compare(password, user.password ?? '');
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    // 检查用户状态
    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'USER_INACTIVE' },
        { status: 403 }
      );
    }

    // 返回用户信息（注意：不返回敏感信息）
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      },
      message: 'Login successful',
    });
  } catch (error) {
    logger.error('Test session login error:', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/test-session - 获取当前会话状态
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'NOT_FOUND' },
      { status: 404 }
    );
  }
  return NextResponse.json({
    success: true,
    data: { message: 'Test session endpoint is available' },
  });
}
