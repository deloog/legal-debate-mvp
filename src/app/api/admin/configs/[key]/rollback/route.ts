import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { rollbackSystemConfigFromHistory } from '@/lib/admin/system-config-governance';
import {
  validateAdminStepUpToken,
  validateSensitiveOperationReason,
} from '@/lib/admin/step-up';
import { clearConfigCache } from '@/lib/config/system-config';
import { clearQuotaConfigCache } from '@/lib/ai/quota';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 }
    );
  }

  const permissionError = await validatePermissions(request, 'system:config');
  if (permissionError) {
    return permissionError;
  }

  const stepUp = validateAdminStepUpToken(request, user.userId);
  if (!stepUp.valid) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'STEP_UP_REQUIRED',
          message: stepUp.reason,
        },
      },
      { status: 403 }
    );
  }

  try {
    const { key } = await params;
    const body = (await request.json()) as {
      historyId?: string;
      changeReason?: string;
    };

    if (!body.historyId) {
      return NextResponse.json(
        { success: false, error: 'INVALID_INPUT', message: 'historyId 必填' },
        { status: 400 }
      );
    }

    const reasonCheck = validateSensitiveOperationReason(body.changeReason);
    if (!reasonCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_INPUT',
          message: reasonCheck.message,
        },
        { status: 400 }
      );
    }

    const result = await rollbackSystemConfigFromHistory({
      configKey: key,
      historyId: body.historyId,
      userId: user.userId,
      reason: body.changeReason!.trim(),
      request,
    });

    clearConfigCache(key);
    if (key.startsWith('business.ai_quota_')) {
      clearQuotaConfigCache();
    }

    return NextResponse.json({
      success: true,
      message: '配置已回滚',
      data: result,
    });
  } catch (error) {
    logger.error('回滚配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'ROLLBACK_FAILED',
        message: error instanceof Error ? error.message : '回滚配置失败',
      },
      { status: 500 }
    );
  }
}
