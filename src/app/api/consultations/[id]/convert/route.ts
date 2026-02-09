/**
 * 咨询转案件API路由
 * GET /api/consultations/[id]/convert - 获取转化预览
 * POST /api/consultations/[id]/convert - 执行转化
 */
import { getCurrentUserId } from '@/lib/auth/get-current-user';
import {
  ConversionResult,
  createConversionService,
} from '@/lib/consultation/conversion-service';
import { ErrorResponse, SuccessResponse } from '@/types/api-response';
import { ConversionPreviewData, ConvertRequest } from '@/types/consultation';
import { CaseType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/consultations/[id]/convert
 * 获取转化预览
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<
  NextResponse<SuccessResponse<ConversionPreviewData> | ErrorResponse>
> {
  try {
    const { id } = await params;

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的咨询ID',
          },
        },
        { status: 400 }
      );
    }

    // 获取转化预览
    const conversionService = createConversionService();
    const result = await conversionService.getConversionPreview(id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PREVIEW_FAILED',
            message: result.message || '获取转化预览失败',
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('获取转化预览失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '服务器内部错误',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/consultations/[id]/convert
 * 执行转化
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse<ConversionResult> | ErrorResponse>> {
  try {
    const { id } = await params;

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的咨询ID',
          },
        },
        { status: 400 }
      );
    }

    // 解析请求体
    let body: ConvertRequest = {};
    try {
      body = await request.json();
    } catch {
      // 允许空请求体
    }

    // 验证案件类型
    if (body.caseType) {
      const validCaseTypes: CaseType[] = [
        'CIVIL' as CaseType,
        'CRIMINAL' as CaseType,
        'ADMINISTRATIVE' as CaseType,
        'COMMERCIAL' as CaseType,
        'LABOR' as CaseType,
        'INTELLECTUAL' as CaseType,
        'OTHER' as CaseType,
      ];
      if (!validCaseTypes.includes(body.caseType as CaseType)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_CASE_TYPE',
              message: '无效的案件类型',
            },
          },
          { status: 400 }
        );
      }
    }

    // 执行转化
    const conversionService = createConversionService();
    const result = await conversionService.convertToCase({
      consultationId: id,
      // 从session获取真实用户ID
      userId: await getCurrentUserId(),
      title: body.title,
      description: body.description,
      caseType: body.caseType as CaseType,
      plaintiffName: body.plaintiffName,
      defendantName: body.defendantName,
      amount: body.amount,
      createClient: body.createClient,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONVERSION_FAILED',
            message: result.message,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('转化失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '服务器内部错误',
        },
      },
      { status: 500 }
    );
  }
}
