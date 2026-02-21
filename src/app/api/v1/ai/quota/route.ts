import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  getUserQuotaUsage,
  calculateQuotaPercentage,
  getQuotaStatusMessage,
} from '@/lib/ai/quota';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/ai/quota
 * 获取用户AI配额使用情况
 */
export async function GET(request: NextRequest) {
  try {
    // 获取认证用户
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    // 获取用户配额使用情况
    const quotaUsage = await getUserQuotaUsage(
      authUser.userId,
      authUser.role as string
    );

    // 计算使用百分比
    const dailyPercentage = calculateQuotaPercentage(
      quotaUsage.daily.used,
      quotaUsage.daily.limit
    );
    const monthlyPercentage = calculateQuotaPercentage(
      quotaUsage.monthly.used,
      quotaUsage.monthly.limit
    );

    // 获取状态描述
    const dailyStatus = getQuotaStatusMessage(dailyPercentage);
    const monthlyStatus = getQuotaStatusMessage(monthlyPercentage);

    // 返回配额信息
    return NextResponse.json({
      success: true,
      data: {
        daily: {
          used: quotaUsage.daily.used,
          limit: quotaUsage.daily.limit,
          remaining: quotaUsage.daily.remaining,
          percentage: dailyPercentage,
          status: dailyStatus,
        },
        monthly: {
          used: quotaUsage.monthly.used,
          limit: quotaUsage.monthly.limit,
          remaining: quotaUsage.monthly.remaining,
          percentage: monthlyPercentage,
          status: monthlyStatus,
        },
        hasUnlimited: quotaUsage.daily.limit === -1,
      },
    });
  } catch (error) {
    logger.error('获取配额信息失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: `获取配额信息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/v1/ai/quota
 * CORS预检请求
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
