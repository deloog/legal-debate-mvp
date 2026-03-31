/**
 * 登出API
 * 支持登出当前设备或所有设备
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import type { LogoutResponse } from '@/types/auth';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest
): Promise<NextResponse<LogoutResponse>> {
  try {
    const user = await getAuthUser(request);
    logger.info('[LOGOUT] Auth user:', {
      hasUser: !!user,
      userId: user?.userId,
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: '未认证或令牌已失效',
        },
        { status: 401 }
      );
    }

    // 请求体可能为空（无 body 的 POST），不能直接 json()
    let allDevices = false;
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        const body = (await request.json()) as { allDevices?: boolean };
        allDevices = body.allDevices ?? false;
      } catch {
        // body 解析失败则忽略，按默认值处理
      }
    }
    logger.info('[LOGOUT] Request body:', { allDevices });

    if (allDevices) {
      // 登出所有设备：删除用户的所有会话
      const deleteResult = await prisma.session.deleteMany({
        where: { userId: user.userId },
      });
      logger.info('[LOGOUT] Deleted all sessions:', deleteResult.count);
    } else {
      // 登出当前设备：从Cookie中获取refresh token并删除对应会话
      const cookieHeader = request.headers.get('cookie');
      logger.info('[LOGOUT] Cookie header:', {
        hasCookie: !!cookieHeader,
      });

      if (!cookieHeader) {
        return NextResponse.json(
          {
            success: false,
            message: '缺少会话令牌',
          },
          { status: 400 }
        );
      }

      // 从cookie中解析refresh token
      const refreshTokenMatch = cookieHeader.match(/refreshToken=([^;]+)/);
      const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : null;
      logger.info('[LOGOUT] Parsed refresh token:', {
        found: !!refreshToken,
        tokenLength: refreshToken?.length || 0,
      });

      if (!refreshToken) {
        return NextResponse.json(
          {
            success: false,
            message: '无效的会话令牌',
          },
          { status: 400 }
        );
      }

      const deleteResult = await prisma.session.deleteMany({
        where: {
          userId: user.userId,
          sessionToken: refreshToken,
        },
      });
      logger.info('[LOGOUT] Deleted session:', deleteResult.count);
    }

    const response = NextResponse.json(
      {
        success: true,
        message: allDevices ? '已登出所有设备' : '已登出当前设备',
      },
      { status: 200 }
    );

    // 安全优化：清除cookie中的token（必须指定 path 才能匹配原始 cookie）
    const cookieOpts = {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
    response.cookies.set('accessToken', '', cookieOpts);
    response.cookies.set('refreshToken', '', cookieOpts);

    return response;
  } catch (error) {
    logger.error('Logout error:', error);

    return NextResponse.json(
      {
        success: false,
        message: '登出失败',
      },
      { status: 500 }
    );
  }
}
