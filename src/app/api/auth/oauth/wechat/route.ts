/**
 * 微信 OAuth API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWechatOAuth } from '@/lib/auth/wechat-oauth';
import { OAuthService } from '@/lib/auth/oauth-service';
import { withRateLimit, strictRateLimiter } from '@/lib/middleware/rate-limit';
import { logger } from '@/lib/logger';

/**
 * 生成随机state
 */
function generateState(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * GET /api/auth/oauth/wechat/authorize - 获取微信授权URL
 */
export async function GET(_request: NextRequest) {
  try {
    const wechatOAuth = getWechatOAuth();
    const state = generateState();

    // 不使用客户端传入的 redirect_uri，始终使用服务端配置值，防止 OAuth redirect_uri 注入
    const response = await wechatOAuth.authorize({
      state,
    });

    if (!response.success) {
      return NextResponse.json({ error: response.error }, { status: 400 });
    }

    return NextResponse.json({
      authorizeUrl: response.authorizeUrl,
      state: response.state,
    });
  } catch (_error) {
    logger.error('Wechat authorize error:', _error);
    return NextResponse.json(
      { error: 'Failed to generate authorize URL' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/oauth/wechat/callback - 微信OAuth回调
 */
async function handleWechatCallback(request: NextRequest) {
  try {
    const wechatOAuth = getWechatOAuth();
    const body = await request.json();
    const { code, state } = body;

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Code and state are required' },
        { status: 400 }
      );
    }

    // 处理OAuth回调
    const callbackResponse = await wechatOAuth.callback({
      code,
      state,
    });

    if (!callbackResponse.success) {
      return NextResponse.json(
        { error: callbackResponse.error },
        { status: 400 }
      );
    }

    // 获取用户信息
    const userInfo = await wechatOAuth.getUserInfo(
      callbackResponse.token,
      callbackResponse.user.id
    );

    // 处理登录
    const loginResult = await OAuthService.handleOAuthLogin(
      'wechat',
      callbackResponse.user.id,
      userInfo
    );

    // 将 token 设置为 httpOnly cookie，避免 XSS 泄露
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };
    const response = NextResponse.json({
      success: true,
      user: loginResult.user,
      isNewUser: loginResult.isNewUser,
    });
    response.cookies.set('accessToken', loginResult.token, {
      ...cookieOpts,
      maxAge: 15 * 60,
    });
    return response;
  } catch (_error) {
    logger.error('Wechat callback error:', _error);
    return NextResponse.json(
      { error: 'Failed to handle OAuth callback' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(strictRateLimiter, handleWechatCallback);
