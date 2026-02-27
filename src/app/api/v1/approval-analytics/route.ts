/**
 * 审批效率分析 API
 * GET /api/v1/approval-analytics - 获取审批效率分析报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { approvalAnalyticsService } from '@/lib/contract/approval-analytics-service';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader ?? '');
    const tokenResult = verifyToken(token ?? '');

    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const contractId = searchParams.get('contractId') ?? undefined;

    const filter: {
      startDate?: Date;
      endDate?: Date;
      contractId?: string;
    } = { contractId };

    if (startDateStr) {
      const parsed = new Date(startDateStr);
      if (!isNaN(parsed.getTime())) {
        filter.startDate = parsed;
      }
    }

    if (endDateStr) {
      const parsed = new Date(endDateStr);
      if (!isNaN(parsed.getTime())) {
        filter.endDate = parsed;
      }
    }

    const analytics =
      await approvalAnalyticsService.generateAnalyticsReport(filter);

    return NextResponse.json({ success: true, data: { analytics } });
  } catch (error) {
    logger.error('获取审批分析报告失败', { error });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
      },
      { status: 500 }
    );
  }
}
