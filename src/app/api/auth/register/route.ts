/**
 * 用户注册 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { validateEmail, validateRegisterRequest } from '@/lib/auth/validation';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/jwt';
import { withRateLimit, strictRateLimiter } from '@/lib/middleware/rate-limit';
import type { AuthResponse, RegisterRequest } from '@/types/auth';
import type { JwtPayload } from '@/types/auth';
import { AuthErrorCode } from '@/types/auth';

/**
 * POST /api/auth/register
 * 用户注册
 */
async function handleRegister(request: NextRequest): Promise<NextResponse> {
  try {
    // 解析请求体
    const body: RegisterRequest = await request.json();
    const { email, password, username, name } = body;

    // 验证输入数据
    const validation = validateRegisterRequest(email, password, username);
    if (!validation.valid) {
      const response: AuthResponse = {
        success: false,
        message: '输入验证失败',
        error: validation.errors.join('; '),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // 验证邮箱格式
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      const response: AuthResponse = {
        success: false,
        message: '邮箱格式不正确',
        error: emailValidation.error,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // 验证密码复杂度
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      const response: AuthResponse = {
        success: false,
        message: '密码不符合要求',
        error: passwordValidation.errors.join('; '),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const response: AuthResponse = {
        success: false,
        message: '邮箱已被注册',
        error: AuthErrorCode.USER_EXISTS,
      };
      return NextResponse.json(response, { status: 409 });
    }

    // 加密密码
    const hashedPassword = await hashPassword(password);

    // 创建用户（使用Prisma create方法）
    const user = await prisma.user.create({
      data: {
        email,
        username: username || null,
        name: name || username || null,
        status: 'ACTIVE',
        password: hashedPassword,
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // 生成 JWT Token
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    console.log('[REGISTER] Generated tokens:', {
      accessTokenLength: accessToken.length,
      refreshTokenLength: refreshToken.length,
      userId: user.id,
    });

    // 创建session记录
    const sessionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后过期
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: refreshToken,
        expires: sessionExpires,
      },
    });

    console.log('[REGISTER] Created session:', {
      sessionId: session.id,
      tokenLength: session.sessionToken.length,
      expires: session.expires,
    });

    const expiresIn = 15 * 60; // 15分钟

    // 返回响应
    const response: AuthResponse = {
      success: true,
      message: '注册成功，请使用邮箱登录',
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        },
        token: accessToken,
        refreshToken,
        expiresIn,
      },
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('注册失败:', error);
    const response: AuthResponse = {
      success: false,
      message: '注册失败，请稍后重试',
      error: 'SERVER_ERROR',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * 导出带速率限制的POST处理器（每分钟5次）
 */
export const POST = withRateLimit(strictRateLimiter, handleRegister);

/**
 * 不支持其他 HTTP 方法
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, message: '方法不允许' },
    { status: 405 }
  );
}
