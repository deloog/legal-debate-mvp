/**
 * 密码找回 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPasswordResetService } from '@/lib/auth/password-reset-service';
import { withRateLimit, strictRateLimiter } from '@/lib/middleware/rate-limit';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
} from '@/types/password-reset';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/forgot-password
 * 请求密码重置验证码
 */
async function handleForgotPassword(
  request: NextRequest
): Promise<NextResponse<ForgotPasswordResponse>> {
  try {
    // 解析请求体
    const body: ForgotPasswordRequest = await request.json();

    // 获取密码重置服务
    const service = getPasswordResetService();

    // 处理密码找回请求
    const result: ForgotPasswordResponse = await service.forgotPassword(body);

    // 根据结果返回状态码
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('密码找回 API 错误:', error);
    const errorResponse: ForgotPasswordResponse = {
      success: false,
      message: '服务器内部错误，请稍后重试',
      error: 'SERVER_ERROR',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * 导出带速率限制的POST处理器（每分钟5次）
 */
export const POST = withRateLimit(strictRateLimiter, handleForgotPassword);

/**
 * 不支持其他 HTTP 方法
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, message: '方法不允许' },
    { status: 405 }
  );
}
