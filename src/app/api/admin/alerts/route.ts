import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { ALERT_PERMISSIONS } from '@/types/permission';
import { ALERT_SEVERITY, ALERT_STATUS } from '@/types/log';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/alerts - 获取告警列表
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await validatePermissions(
      request,
      ALERT_PERMISSIONS.READ
    );
    if (authCheck) {
      return authCheck;
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '10', 10);
    const limit = pageSize;
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const errorType = searchParams.get('errorType');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (
      severity &&
      ALERT_SEVERITY.includes(severity as (typeof ALERT_SEVERITY)[number])
    ) {
      where.severity = severity;
    }

    if (
      status &&
      ALERT_STATUS.includes(status as (typeof ALERT_STATUS)[number])
    ) {
      where.status = status;
    }

    if (errorType) {
      where.errorType = errorType;
    }

    const triggeredAtCondition: Record<string, Date> = {};
    if (startTime) {
      triggeredAtCondition.gte = new Date(startTime);
    }
    if (endTime) {
      triggeredAtCondition.lte = new Date(endTime);
    }
    if (Object.keys(triggeredAtCondition).length > 0) {
      where.triggeredAt = triggeredAtCondition;
    }

    if (search) {
      where.OR = [
        { ruleName: { contains: search, mode: 'insensitive' } },
        { errorMessage: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.alert.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: alerts,
      total,
    });
  } catch (error) {
    logger.error('获取告警列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取告警列表失败',
        message: '未知错误',
      },
      { status: 500 }
    );
  }
}
