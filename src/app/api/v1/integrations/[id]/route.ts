/**
 * /api/v1/integrations/[id]
 *
 * 单个业务系统集成 API 路由
 *
 * GET /api/v1/integrations/[id] - 获取集成详情
 * PUT /api/v1/integrations/[id] - 更新集成
 * DELETE /api/v1/integrations/[id] - 删除集成
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  businessSystemIntegrationService,
  UpdateIntegrationInput,
} from '@/lib/integration';
import type { ErrorResponse, SuccessResponse } from '@/types/api-response';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

async function requireAdmin(
  request: NextRequest
): Promise<NextResponse<ErrorResponse> | null> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: '仅管理员可管理业务系统集成' },
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * GET /api/v1/integrations/[id]
 * 获取业务系统集成详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<unknown> | ErrorResponse>> {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  try {
    const { id } = await params;

    const result = await businessSystemIntegrationService.getIntegration(id);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '业务系统集成不存在',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('获取业务系统集成详情失败', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTEGRATION_GET_ERROR',
          message: '获取业务系统集成详情失败',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/integrations/[id]
 * 更新业务系统集成
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<unknown> | ErrorResponse>> {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await request.json();

    const input: UpdateIntegrationInput = {
      systemName: body.systemName,
      systemUrl: body.systemUrl,
      authType: body.authType,
      authToken: body.authToken,
      apiKey: body.apiKey,
      refreshToken: body.refreshToken,
      tokenExpiresAt: body.tokenExpiresAt
        ? new Date(body.tokenExpiresAt)
        : undefined,
      syncConfig: body.syncConfig,
      syncEnabled: body.syncEnabled,
      syncInterval: body.syncInterval,
      webhookUrl: body.webhookUrl,
      webhookSecret: body.webhookSecret,
      webhookEnabled: body.webhookEnabled,
      webhookEvents: body.webhookEvents,
      status: body.status,
      description: body.description,
      metadata: body.metadata,
    };

    const result = await businessSystemIntegrationService.updateIntegration(
      id,
      input
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('更新业务系统集成失败', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTEGRATION_UPDATE_ERROR',
          message: '更新业务系统集成失败',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/integrations/[id]
 * 删除业务系统集成
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<unknown> | ErrorResponse>> {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  try {
    const { id } = await params;

    await businessSystemIntegrationService.deleteIntegration(id);

    return NextResponse.json({
      success: true,
      data: {
        message: '业务系统集成已删除',
      },
    });
  } catch (error) {
    logger.error('删除业务系统集成失败', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTEGRATION_DELETE_ERROR',
          message: '删除业务系统集成失败',
        },
      },
      { status: 500 }
    );
  }
}
