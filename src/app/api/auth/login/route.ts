/**
 * 用户登录 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { validateLoginRequest } from '@/lib/auth/validation';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/jwt';
import { withRateLimit, strictRateLimiter } from '@/lib/middleware/rate-limit';
import type { AuthResponse, LoginRequest } from '@/types/auth';
import type { JwtPayload } from '@/types/auth';
import { AuthErrorCode } from '@/types/auth';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

function getLoginErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    error.message.includes('JWT_SECRET环境变量未设置')
  ) {
    return '服务端认证配置不完整，请联系管理员检查 JWT_SECRET';
  }

  return '登录失败，请稍后重试';
}

/**
 * POST /api/auth/login
 * 用户登录（应用严格速率限制：每分钟5次）
 */
async function handleLogin(request: NextRequest): Promise<NextResponse> {
  try {
    // 解析请求体
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // 验证输入数据
    const validation = validateLoginRequest(email, password);
    if (!validation.valid) {
      const response: AuthResponse = {
        success: false,
        message: '输入验证失败',
        error: validation.errors.join('; '),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        password: true,
        loginCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      const response: AuthResponse = {
        success: false,
        message: '邮箱或密码错误',
        error: AuthErrorCode.INVALID_CREDENTIALS,
      };
      return NextResponse.json(response, { status: 401 });
    }

    // 检查用户状态（统一错误信息，防止账号枚举和类型探测）
    if (user.status !== 'ACTIVE') {
      const response: AuthResponse = {
        success: false,
        message: '邮箱或密码错误',
        error: AuthErrorCode.INVALID_CREDENTIALS,
      };
      return NextResponse.json(response, { status: 401 });
    }

    // 验证密码（无密码账号统一返回"邮箱或密码错误"，不暴露登录方式）
    if (!user.password) {
      const response: AuthResponse = {
        success: false,
        message: '邮箱或密码错误',
        error: AuthErrorCode.INVALID_CREDENTIALS,
      };
      return NextResponse.json(response, { status: 401 });
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      const response: AuthResponse = {
        success: false,
        message: '邮箱或密码错误',
        error: AuthErrorCode.INVALID_CREDENTIALS,
      };
      return NextResponse.json(response, { status: 401 });
    }

    // 更新最后登录时间和登录次数
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: user.loginCount + 1,
      },
    });

    // 先创建 session，使用 session.id 绑定 access/refresh token
    const sessionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后过期
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: `pending:${randomUUID()}`,
        expires: sessionExpires,
      },
    });

    // 生成 JWT Token
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      jti: session.id,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 用真实 refreshToken 更新 placeholder sessionToken
    await prisma.session.update({
      where: { id: session.id },
      data: {
        sessionToken: refreshToken,
      },
    });

    // token 通过 httpOnly cookie 传递，不在响应体中暴露（防止 XSS 窃取）
    const expiresIn = 7 * 24 * 60 * 60; // 7天

    // 返回响应
    // 注意：token 已通过 httpOnly cookie 传递
    // 在测试环境下同时在响应体中返回 token，以便 E2E 测试使用
    const isTestEnv = process.env.NODE_ENV === 'test';

    const response: AuthResponse = {
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        },
        token: isTestEnv ? accessToken : '', // 测试环境返回 token，生产环境留空
        refreshToken: isTestEnv ? refreshToken : undefined, // 测试环境返回 refreshToken
        expiresIn,
      },
    };

    const jsonResponse = NextResponse.json(response, { status: 200 });

    // 安全优化：将refreshToken存储到httpOnly cookie
    jsonResponse.cookies.set('refreshToken', refreshToken, {
      httpOnly: true, // 防止JS访问，防XSS攻击
      secure: process.env.NODE_ENV === 'production', // 生产环境仅HTTPS
      sameSite: 'lax', // CSRF保护
      maxAge: 7 * 24 * 60 * 60, // 7天
      path: '/',
      // 确保在开发环境中也能正确设置cookie
      ...(process.env.NODE_ENV !== 'production' && {
        sameSite: 'lax',
      }),
    });

    // 也可以将accessToken存储到cookie（可选）
    jsonResponse.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7天（与refreshToken一致，避免中间件15分钟后强制跳转登录）
      path: '/',
    });

    // 调试日志：确认Cookie已设置（仅开发环境）
    if (process.env.NODE_ENV === 'development') {
      logger.info('[Login API] 登录成功，Cookie已设置:', {
        userId: user.id,
        email: user.email,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        // 不打印token内容，即使在开发环境
      });
    }

    return jsonResponse;
  } catch (error) {
    // 生产环境不记录 stack，避免泄露内部路径信息
    logger.error('登录失败:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ...(process.env.NODE_ENV !== 'production' && {
        stack: error instanceof Error ? error.stack : undefined,
      }),
    });
    const response: AuthResponse = {
      success: false,
      message: getLoginErrorMessage(error),
      error: 'SERVER_ERROR',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * 导出带速率限制的POST处理器
 */
export const POST = withRateLimit(strictRateLimiter, handleLogin);

/**
 * 不支持其他 HTTP 方法
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, message: '方法不允许' },
    { status: 405 }
  );
}
