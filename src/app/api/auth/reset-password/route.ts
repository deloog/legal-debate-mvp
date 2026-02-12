/**
 * 密码重置 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPasswordResetService } from '@/lib/auth/password-reset-service';
import { withRateLimit, strictRateLimiter } from '@/lib/middleware/rate-limit';
import type {
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '@/types/password-reset';

/**
 * POST /api/auth/reset-password
 * 使用验证码重置密码
 */
async function handleResetPassword(
  request: NextRequest
): Promise<NextResponse<ResetPasswordResponse>> {
  try {
    // 解析请求体
    const body: ResetPasswordRequest = await request.json();

    // 获取密码重置服务
    const service = getPasswordResetService();

    // 处理密码重置请求
    const result: ResetPasswordResponse = await service.resetPassword(body);

    // 根据结果返回状态码
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('密码重置 API 错误:', error);
    const errorResponse: ResetPasswordResponse = {
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
export const POST = withRateLimit(strictRateLimiter, handleResetPassword);

/**
 * 不支持其他 HTTP 方法
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, message: '方法不允许' },
    { status: 405 }
  );
}
