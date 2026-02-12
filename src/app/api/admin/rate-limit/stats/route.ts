/**
 * 速率限制统计API
 * GET /api/admin/rate-limit/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { rateLimitMonitor } from '@/lib/middleware/rate-limit-monitor';
import { rateLimitConfig } from '@/lib/middleware/rate-limit-config';
import { adaptiveRateLimit } from '@/lib/middleware/adaptive-rate-limit';
import { ipFilter } from '@/lib/middleware/ip-filter';

/**
 * GET /api/admin/rate-limit/stats
 * 获取速率限制统计信息
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限（需要管理员权限）
  const permissionError = await validatePermissions(request, 'admin:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    // 获取时间窗口参数（默认60分钟）
    const { searchParams } = new URL(request.url);
    const timeWindow = parseInt(searchParams.get('timeWindow') || '60', 10);

    // 收集所有统计信息
    const stats = {
      // 速率限制事件统计
      rateLimitStats: rateLimitMonitor.getStats(timeWindow),

      // 配置统计
      configStats: rateLimitConfig.getEndpointStats(),

      // 全局配置
      globalSettings: rateLimitConfig.getGlobalSettings(),

      // 自适应速率限制统计
      adaptiveStats: adaptiveRateLimit.getStats(),

      // 服务器负载
      serverLoad: adaptiveRateLimit.getServerLoad(),

      // IP过滤统计
      ipFilterStats: ipFilter.getStats(),

      // 时间戳
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[RateLimit Stats] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取统计信息失败',
      },
      { status: 500 }
    );
  }
}
