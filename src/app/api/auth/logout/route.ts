/**
 * 登出API
 * 支持登出当前设备或所有设备
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import type { LogoutResponse } from '@/types/auth';

export async function POST(
  request: NextRequest
): Promise<NextResponse<LogoutResponse>> {
  try {
    const user = await getAuthUser(request);
    console.log('[LOGOUT] Auth user:', {
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

    const body = await request.json();
    const { allDevices = false } = body as { allDevices?: boolean };
    console.log('[LOGOUT] Request body:', { allDevices });

    if (allDevices) {
      // 登出所有设备：删除用户的所有会话
      const deleteResult = await prisma.session.deleteMany({
        where: { userId: user.userId },
      });
      console.log('[LOGOUT] Deleted all sessions:', deleteResult.count);
    } else {
      // 登出当前设备：从Cookie中获取refresh token并删除对应会话
      const cookieHeader = request.headers.get('cookie');
      console.log('[LOGOUT] Cookie header:', {
        hasCookie: !!cookieHeader,
        cookieValue: cookieHeader || '',
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
      console.log('[LOGOUT] Parsed refresh token:', {
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
      console.log('[LOGOUT] Deleted session:', deleteResult.count);
    }

    const response = NextResponse.json(
      {
        success: true,
        message: allDevices ? '已登出所有设备' : '已登出当前设备',
      },
      { status: 200 }
    );

    // 安全优化：清除cookie中的token
    response.cookies.delete('accessToken');
    response.cookies.delete('refreshToken');

    return response;
  } catch (error) {
    console.error('Logout error:', error);

    return NextResponse.json(
      {
        success: false,
        message: '登出失败',
      },
      { status: 500 }
    );
  }
}
