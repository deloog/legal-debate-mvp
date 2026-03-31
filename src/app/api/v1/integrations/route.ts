/**
 * /api/v1/integrations
 *
 * 业务系统集成 API 路由
 * 支持与企业业务系统（ERP、CRM、财务系统等）的对接
 *
 * GET /api/v1/integrations - 获取集成列表
 * POST /api/v1/integrations - 创建集成
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  businessSystemIntegrationService,
  CreateIntegrationInput,
  IntegrationQueryParams,
} from '@/lib/integration';
import type { ErrorResponse, SuccessResponse } from '@/types/api-response';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/v1/integrations
 * 获取业务系统集成列表
 */
async function requireAdminIntegrations(
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

export async function GET(request: NextRequest): Promise<
  NextResponse<
    | SuccessResponse<{
        items: unknown[];
        total: number;
        page: number;
        pageSize: number;
      }>
    | ErrorResponse
  >
> {
  const authErr = await requireAdminIntegrations(request);
  if (authErr) return authErr;

  try {
    const searchParams = request.nextUrl.searchParams;
    const params: IntegrationQueryParams = {
      enterpriseId: searchParams.get('enterpriseId') || undefined,
      systemType: searchParams.get('systemType') || undefined,
      status: searchParams.get('status') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
    };

    const result =
      await businessSystemIntegrationService.queryIntegrations(params);

    return NextResponse.json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page: params.page || 1,
        pageSize: params.pageSize || 20,
      },
    });
  } catch (error) {
    logger.error('获取业务系统集成列表失败', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTEGRATION_LIST_ERROR',
          message: '获取业务系统集成列表失败',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/integrations
 * 创建业务系统集成
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SuccessResponse<unknown> | ErrorResponse>> {
  const authErr = await requireAdminIntegrations(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();

    // 验证必填字段
    if (!body.enterpriseId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'enterpriseId 为必填字段',
          },
        },
        { status: 400 }
      );
    }

    if (!body.systemType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'systemType 为必填字段',
          },
        },
        { status: 400 }
      );
    }

    if (!body.systemName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'systemName 为必填字段',
          },
        },
        { status: 400 }
      );
    }

    if (!body.systemUrl) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'systemUrl 为必填字段',
          },
        },
        { status: 400 }
      );
    }

    if (!body.authType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'authType 为必填字段',
          },
        },
        { status: 400 }
      );
    }

    const input: CreateIntegrationInput = {
      enterpriseId: body.enterpriseId,
      systemType: body.systemType,
      systemName: body.systemName,
      systemUrl: body.systemUrl,
      authType: body.authType,
      authToken: body.authToken,
      apiKey: body.apiKey,
      refreshToken: body.refreshToken,
      syncConfig: body.syncConfig,
      syncEnabled: body.syncEnabled,
      syncInterval: body.syncInterval,
      webhookUrl: body.webhookUrl,
      webhookSecret: body.webhookSecret,
      webhookEnabled: body.webhookEnabled,
      webhookEvents: body.webhookEvents,
      description: body.description,
      metadata: body.metadata,
    };

    const result =
      await businessSystemIntegrationService.createIntegration(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('创建业务系统集成失败', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTEGRATION_CREATE_ERROR',
          message: '创建业务系统集成失败',
        },
      },
      { status: 500 }
    );
  }
}
