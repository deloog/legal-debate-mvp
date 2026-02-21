/**
 * 合规检查清单API接口
 * GET /api/compliance/checklist - 获取检查清单
 * PUT /api/compliance/checklist - 更新检查项
 */

import { NextRequest, NextResponse } from 'next/server';
import { ComplianceService } from '@/lib/compliance/compliance-service';
import type {
  GetChecklistResponse,
  UpdateCheckItemResponse,
} from '@/types/compliance';
import {
  ComplianceCategory,
  ComplianceCheckStatus,
  isValidComplianceCategory,
  isValidComplianceCheckStatus,
} from '@/types/compliance';
import { logger } from '@/lib/logger';

/**
 * GET /api/compliance/checklist
 * 获取合规检查清单
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<GetChecklistResponse>> {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const categoryStr = searchParams.get('category');
    const statusStr = searchParams.get('status');

    // 验证参数
    const category =
      categoryStr && isValidComplianceCategory(categoryStr)
        ? (categoryStr as ComplianceCategory)
        : undefined;

    const status =
      statusStr && isValidComplianceCheckStatus(statusStr)
        ? (statusStr as ComplianceCheckStatus)
        : undefined;

    const checklists = await ComplianceService.getChecklists({
      category,
      status,
    });

    return NextResponse.json(
      {
        success: true,
        data: checklists,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('获取检查清单错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVICE_ERROR',
          message: error instanceof Error ? error.message : '获取检查清单失败',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/compliance/checklist
 * 更新检查项状态
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<UpdateCheckItemResponse>> {
  try {
    // 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch (_error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: '无效的JSON格式',
          },
        },
        { status: 400 }
      );
    }

    // 验证请求体
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '无效的请求体',
          },
        },
        { status: 400 }
      );
    }

    const requestData = body as Record<string, unknown>;

    // 验证必填字段
    if (
      !requestData.checklistId ||
      typeof requestData.checklistId !== 'string'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '缺少checklistId字段',
          },
        },
        { status: 400 }
      );
    }

    if (!requestData.itemId || typeof requestData.itemId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '缺少itemId字段',
          },
        },
        { status: 400 }
      );
    }

    if (
      !requestData.status ||
      !isValidComplianceCheckStatus(requestData.status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '无效的status字段',
          },
        },
        { status: 400 }
      );
    }

    const updatedItem = await ComplianceService.updateCheckItem({
      checklistId: requestData.checklistId,
      itemId: requestData.itemId,
      status: requestData.status as ComplianceCheckStatus,
      notes:
        typeof requestData.notes === 'string' ? requestData.notes : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: updatedItem,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('更新检查项错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVICE_ERROR',
          message: error instanceof Error ? error.message : '更新检查项失败',
        },
      },
      { status: 500 }
    );
  }
}
