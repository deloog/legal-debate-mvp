import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { createAuditLog } from '@/lib/audit/logger';
import {
  ADMIN_STEP_UP_COOKIE,
  attachAdminStepUpCookie,
  clearAdminStepUpCookie,
  createAdminStepUpToken,
  verifyAdminStepUpPassword,
} from '@/lib/admin/step-up';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as { password?: string };

    if (!body.password) {
      return NextResponse.json(
        { success: false, error: 'INVALID_INPUT', message: '密码不能为空' },
        { status: 400 }
      );
    }

    const valid = await verifyAdminStepUpPassword(user.userId, body.password);
    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: '密码验证失败',
          },
        },
        { status: 403 }
      );
    }

    const token = createAdminStepUpToken(user);
    const response = NextResponse.json({
      success: true,
      message: '二次认证成功',
      data: {
        cookieName: ADMIN_STEP_UP_COOKIE,
        expiresIn: 600,
      },
    });
    attachAdminStepUpCookie(response, token);

    void createAuditLog({
      userId: user.userId,
      actionType: 'UNKNOWN',
      actionCategory: 'ADMIN',
      description: '管理员完成二次认证',
      resourceType: 'AdminSecurity',
      resourceId: user.userId,
      requestMethod: request.method,
      requestPath: request.nextUrl.pathname,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return response;
  } catch (error) {
    logger.error('管理员二次认证失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '二次认证失败',
        },
        message: '二次认证失败',
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: '二次认证已清除',
  });
  clearAdminStepUpCookie(response);
  return response;
}
