import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { ALERT_PERMISSIONS } from '@/types/permission';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/alerts/[id] - 获取告警详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await validatePermissions(
      request,
      ALERT_PERMISSIONS.READ
    );
    if (authCheck) {
      return authCheck;
    }

    const alert = await prisma.alert.findUnique({
      where: { alertId: (await params).id },
    });

    if (!alert) {
      return NextResponse.json(
        { success: false, error: '告警不存在' },
        { status: 404 }
      );
    }

    const errorLog = await prisma.errorLog.findUnique({
      where: { id: alert.errorLogId },
    });

    return NextResponse.json({
      success: true,
      data: {
        alert,
        errorLog,
      },
    });
  } catch (error) {
    logger.error('获取告警详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取告警详情失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
