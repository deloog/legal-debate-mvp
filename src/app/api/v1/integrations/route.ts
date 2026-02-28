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

/**
 * GET /api/v1/integrations
 * 获取业务系统集成列表
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SuccessResponse<{
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
}> | ErrorResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params: IntegrationQueryParams = {
      enterpriseId: searchParams.get('enterpriseId') || undefined,
      systemType: searchParams.get('systemType') || undefined,
      status: searchParams.get('status') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
    };

    const result = await businessSystemIntegrationService.queryIntegrations(params);

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
          details: error instanceof Error ? error.message : undefined,
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
          details: error instanceof Error ? error.message : undefined,
        },
      },
      { status: 500 }
    );
  }
}
