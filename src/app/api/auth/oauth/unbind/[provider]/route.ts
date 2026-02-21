/**
 * OAuth 账号解绑 API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { OAuthService } from '@/lib/auth/oauth-service';
import { verifyToken } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/auth/oauth/unbind/[provider] - 解绑 OAuth 账号
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
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

    const { provider } = params;

    // 检查是否可以解绑
    const canUnbind = await OAuthService.canUnbindAccount(
      decoded.payload.userId
    );

    if (!canUnbind) {
      return NextResponse.json(
        {
          error:
            'Cannot unbind: you must have at least one login method remaining',
        },
        { status: 400 }
      );
    }

    // 解绑账号
    await OAuthService.unbindOAuthAccount(decoded.payload.userId, provider);

    return NextResponse.json({
      success: true,
      message: 'Account unbound successfully',
    });
  } catch (error) {
    logger.error('Unbind OAuth account error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to unbind account',
      },
      { status: 500 }
    );
  }
}
