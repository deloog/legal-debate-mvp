/**
 * OAuth 账号绑定 API 路由
 */

import { verifyToken } from '@/lib/auth/jwt';
import { OAuthService } from '@/lib/auth/oauth-service';
import type { OAuthUserInfo } from '@/types/oauth';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/oauth/bind - 绑定 OAuth 账号
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded.valid || !decoded.payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
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
      decoded.payload.userId,
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
      {
        error:
          error instanceof Error ? error.message : 'Failed to bind account',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/oauth/bind - 获取用户的 OAuth 账号列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded.valid || !decoded.payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 获取账号列表
    const accounts = await OAuthService.getUserOAuthAccounts(
      decoded.payload.userId
    );

    return NextResponse.json({
      success: true,
      accounts,
    });
  } catch (error) {
    logger.error('Get OAuth accounts error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to get accounts',
      },
      { status: 500 }
    );
  }
}
