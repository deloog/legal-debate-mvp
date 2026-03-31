/**
 * Token刷新API
 * 使用刷新令牌获取新的访问令牌
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyToken,
  generateAccessToken,
  generateRefreshToken,
} from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';
import {
  withRateLimit,
  moderateRateLimiter,
} from '@/lib/middleware/rate-limit';
import { logError } from '@/lib/utils/safe-logger';
import type { JwtPayload } from '@/types/auth';
import type { RefreshTokenResponse } from '@/types/auth';
import { logger } from '@/lib/logger';

async function handleRefresh(
  request: NextRequest
): Promise<NextResponse<RefreshTokenResponse>> {
  try {
    // 安全优化：优先从cookie中读取refreshToken
    let refreshToken = request.cookies.get('refreshToken')?.value;

    // 如果cookie中没有，则从请求体中读取（向后兼容）
    if (!refreshToken) {
      const body = await request.json();
      refreshToken = body.refreshToken;
    }

    // 仅在开发环境记录
    if (process.env.NODE_ENV === 'development') {
      logger.info('[REFRESH] Token source:', {
        hasRefreshToken: !!refreshToken,
        source: request.cookies.get('refreshToken') ? 'cookie' : 'body',
      });
    }

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          message: '刷新令牌不能为空',
          error: 'MISSING_REFRESH_TOKEN',
        },
        { status: 400 }
      );
    }

    // 验证刷新令牌
    const verificationResult = verifyToken(refreshToken);

    if (process.env.NODE_ENV === 'development') {
      logger.info('[REFRESH] Token verification:', {
        valid: verificationResult.valid,
        error: verificationResult.error,
      });
    }

    if (!verificationResult.valid || !verificationResult.payload) {
      return NextResponse.json(
        {
          success: false,
          message: '无效或过期的刷新令牌',
          error: verificationResult.error ?? undefined,
        },
        { status: 401 }
      );
    }

    const payload = verificationResult.payload as JwtPayload;

    // 检查用户是否存在且状态正常
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: '用户不存在',
          error: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          message: '用户账户已被禁用',
          error: 'USER_INACTIVE',
        },
        { status: 403 }
      );
    }

    // 检查刷新令牌是否存在于数据库中
    const session = await prisma.session.findFirst({
      where: {
        userId: user.id,
        sessionToken: refreshToken,
        expires: {
          gt: new Date(),
        },
      },
    });

    if (process.env.NODE_ENV === 'development') {
      logger.info('[REFRESH] Session query result:', {
        found: !!session,
        userId: user.id,
      });
    }

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: '刷新令牌已失效或不存在',
          error: 'SESSION_NOT_FOUND',
        },
        { status: 401 }
      );
    }

    // 生成新的访问令牌（添加随机盐值确保每次生成的token都不同）
    const accessTokenPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      r: Math.random().toString(36).substring(2), // 随机盐值
    };
    const newAccessToken = generateAccessToken(accessTokenPayload);

    // 生成新的刷新令牌（轮换策略）
    const newRefreshToken = generateRefreshToken(accessTokenPayload);

    // 更新session（不改变id，只更新token和过期时间）
    await prisma.session.update({
      where: { id: session.id },
      data: {
        sessionToken: newRefreshToken,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
      },
    });

    // 计算过期时间（秒）
    const expiresIn = 7 * 24 * 60 * 60; // 7天

    const response = NextResponse.json(
      {
        success: true,
        message: '令牌刷新成功',
        data: {
          token: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn,
        },
      },
      { status: 200 }
    );

    // 安全优化：将新token存储到httpOnly cookie
    response.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7天
      path: '/',
    });

    response.cookies.set('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7天
      path: '/',
    });

    return response;
  } catch (error) {
    // 使用安全日志记录错误
    logError('[REFRESH] Token refresh error', error);

    return NextResponse.json(
      {
        success: false,
        message: '令牌刷新失败',
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * 导出带速率限制的POST处理器（每分钟30次）
 */
export const POST = withRateLimit(moderateRateLimiter, handleRefresh);
