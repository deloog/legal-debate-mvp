import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { ALERT_PERMISSIONS } from '@/types/permission';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/alerts/[id]/acknowledge - 确认告警
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authCheck = await validatePermissions(
      request,
      ALERT_PERMISSIONS.ACKNOWLEDGE
    );
    if (authCheck) {
      return authCheck;
    }

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未认证' },
        { status: 401 }
      );
    }

    await request.json().catch(() => ({}));

    const alert = await prisma.alert.findUnique({
      where: { alertId: params.id },
    });

    if (!alert) {
      return NextResponse.json(
        { success: false, error: '告警不存在' },
        { status: 404 }
      );
    }

    if (alert.status !== 'TRIGGERED') {
      return NextResponse.json(
        { success: false, error: '告警状态不正确，无法确认' },
        { status: 400 }
      );
    }

    const updatedAlert = await prisma.alert.update({
      where: { alertId: params.id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedBy: user.userId,
        acknowledgedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: '告警已确认',
      data: updatedAlert,
    });
  } catch (error) {
    logger.error('确认告警失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '确认告警失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
