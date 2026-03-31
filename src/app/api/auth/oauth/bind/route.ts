/**
 * OAuth 账号绑定 API 路由
 */

import { getAuthUser } from '@/lib/middleware/auth';
import { OAuthService } from '@/lib/auth/oauth-service';
import {
  withRateLimit,
  moderateRateLimiter,
} from '@/lib/middleware/rate-limit';
import type { OAuthUserInfo } from '@/types/oauth';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/oauth/bind - 绑定 OAuth 账号
 */
async function handleBind(request: NextRequest) {
  try {
    // 统一认证（支持 cookie 和 Bearer token）
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, providerAccountId, userInfo } = body;

    if (!provider || !providerAccountId || !userInfo) {
      return NextResponse.json(
        { error: 'Provider, providerAccountId and userInfo are required' },
        { status: 400 }
      );
    }

    // 绑定账号
    const account = await OAuthService.bindOAuthAccount(
      authUser.userId,
      provider,
      providerAccountId,
      userInfo as OAuthUserInfo
    );

    return NextResponse.json({
      success: true,
      account,
    });
  } catch (error) {
    logger.error('Bind OAuth account error:', error);
    return NextResponse.json(
      { error: 'Failed to bind account' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(moderateRateLimiter, handleBind);

/**
 * GET /api/auth/oauth/bind - 获取用户的 OAuth 账号列表
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accounts = await OAuthService.getUserOAuthAccounts(authUser.userId);

    return NextResponse.json({
      success: true,
      accounts,
    });
  } catch (error) {
    logger.error('Get OAuth accounts error:', error);
    return NextResponse.json(
      { error: 'Failed to get accounts' },
      { status: 500 }
    );
  }
}
