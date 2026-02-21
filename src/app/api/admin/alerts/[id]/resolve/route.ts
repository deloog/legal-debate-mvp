import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { ALERT_PERMISSIONS } from '@/types/permission';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/alerts/[id]/resolve - 处理告警
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authCheck = await validatePermissions(
      request,
      ALERT_PERMISSIONS.RESOLVE
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

    const body = await request.json().catch(() => ({}));
    const notes = body.notes as string | undefined;

    const alert = await prisma.alert.findUnique({
      where: { alertId: params.id },
    });

    if (!alert) {
      return NextResponse.json(
        { success: false, error: '告警不存在' },
        { status: 404 }
      );
    }

    if (alert.status === 'RESOLVED') {
      return NextResponse.json(
        { success: false, error: '告警已处理' },
        { status: 400 }
      );
    }

    const updatedAlert = await prisma.alert.update({
      where: { alertId: params.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNotes: notes ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      message: '告警已处理',
      data: updatedAlert,
    });
  } catch (error) {
    logger.error('处理告警失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '处理告警失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
