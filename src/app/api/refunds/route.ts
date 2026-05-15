/**
 * 退款记录列表 API
 * GET /api/refunds — 获取当前用户的退款记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, message: '未授权' },
        { status: 401 }
      );
    }

    const { userId } = authUser;

    const refunds = await prisma.refundRecord.findMany({
      where: { userId },
      orderBy: { appliedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: {
        refunds: refunds.map(r => ({
          id: r.id,
          orderId: r.orderId,
          amount: Number(r.amount),
          refundAmount: Number(r.refundAmount),
          status: r.status,
          reason: r.reason,
          appliedAt: r.appliedAt.toISOString(),
          currency: r.currency,
        })),
      },
    });
  } catch (error) {
    logger.error('获取退款记录失败:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}
