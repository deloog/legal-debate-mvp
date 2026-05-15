/**
 * 速率限制配置管理API
 * GET /api/admin/rate-limit/config - 获取所有配置
 * POST /api/admin/rate-limit/config - 更新配置
 * DELETE /api/admin/rate-limit/config - 删除配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { rateLimitConfig } from '@/lib/middleware/rate-limit-config';
import { logger } from '@/lib/logger';
import {
  validateAdminStepUpToken,
  validateSensitiveOperationReason,
} from '@/lib/admin/step-up';

/**
 * GET /api/admin/rate-limit/config
 * 获取所有速率限制配置
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

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    const configs = rateLimitConfig.getAllConfigs();
    const globalSettings = rateLimitConfig.getGlobalSettings();
    const stats = rateLimitConfig.getEndpointStats();

    return NextResponse.json({
      success: true,
      data: {
        endpoints: configs,
        globalSettings,
        stats,
      },
    });
  } catch (error) {
    logger.error('[RateLimit Config] GET Error:', error);
    return NextResponse.json(
      { success: false, error: '获取配置失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/rate-limit/config
 * 更新速率限制配置
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:write');
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
          message: stepUp.reason ?? '需要二次认证',
        },
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { endpoint, config, globalSettings, changeReason } = body;
    const reasonCheck = validateSensitiveOperationReason(changeReason);
    if (!reasonCheck.valid) {
      return NextResponse.json(
        { success: false, error: reasonCheck.message },
        { status: 400 }
      );
    }

    // 更新全局设置
    if (globalSettings) {
      rateLimitConfig.updateGlobalSettings(globalSettings);
      return NextResponse.json({
        success: true,
        message: '全局设置已更新',
        data: rateLimitConfig.getGlobalSettings(),
      });
    }

    // 更新端点配置
    if (endpoint && config) {
      // 验证配置
      if (
        config.windowMs &&
        (config.windowMs < 1000 || config.windowMs > 3600000)
      ) {
        return NextResponse.json(
          { success: false, error: 'windowMs必须在1000-3600000之间' },
          { status: 400 }
        );
      }

      if (
        config.maxRequests &&
        (config.maxRequests < 1 || config.maxRequests > 10000)
      ) {
        return NextResponse.json(
          { success: false, error: 'maxRequests必须在1-10000之间' },
          { status: 400 }
        );
      }

      const currentConfig = rateLimitConfig.getConfig(endpoint);
      const newConfig = {
        ...currentConfig,
        endpoint,
        ...config,
        updatedAt: new Date(),
      };

      rateLimitConfig.setConfig(endpoint, newConfig);

      return NextResponse.json({
        success: true,
        message: `端点 ${endpoint} 的配置已更新`,
        data: rateLimitConfig.getConfig(endpoint),
      });
    }

    return NextResponse.json(
      { success: false, error: '请提供有效的配置数据' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('[RateLimit Config] POST Error:', error);
    return NextResponse.json(
      { success: false, error: '更新配置失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/rate-limit/config
 * 删除端点配置
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:write');
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
          message: stepUp.reason ?? '需要二次认证',
        },
      },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const changeReason = searchParams.get('changeReason') ?? '';

    const reasonCheck = validateSensitiveOperationReason(changeReason);
    if (!reasonCheck.valid) {
      return NextResponse.json(
        { success: false, error: reasonCheck.message },
        { status: 400 }
      );
    }

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: '端点路径必填' },
        { status: 400 }
      );
    }

    const deleted = rateLimitConfig.deleteConfig(endpoint);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '配置不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `端点 ${endpoint} 的配置已删除`,
    });
  } catch (error) {
    logger.error('[RateLimit Config] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: '删除配置失败' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/rate-limit/config/toggle
 * 启用/禁用端点的速率限制
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:write');
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
          message: stepUp.reason ?? '需要二次认证',
        },
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { endpoint, enabled, changeReason } = body;

    const reasonCheck = validateSensitiveOperationReason(changeReason);
    if (!reasonCheck.valid) {
      return NextResponse.json(
        { success: false, error: reasonCheck.message },
        { status: 400 }
      );
    }

    if (!endpoint || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '端点和enabled参数必填' },
        { status: 400 }
      );
    }

    const success = rateLimitConfig.toggleEndpoint(endpoint, enabled);

    if (!success) {
      return NextResponse.json(
        { success: false, error: '端点配置不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `端点 ${endpoint} 已${enabled ? '启用' : '禁用'}`,
      data: rateLimitConfig.getConfig(endpoint),
    });
  } catch (error) {
    logger.error('[RateLimit Config] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: '切换状态失败' },
      { status: 500 }
    );
  }
}
