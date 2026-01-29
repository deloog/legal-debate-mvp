/**
 * 咨询转案件API路由
 * GET /api/consultations/[id]/convert - 获取转化预览
 * POST /api/consultations/[id]/convert - 执行转化
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  createConversionService,
  ConversionResult,
} from '@/lib/consultation/conversion-service';
import { CaseType } from '@prisma/client';

/**
 * 标准成功响应格式
 */
interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * 标准错误响应格式
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * 转化预览响应数据
 */
interface ConversionPreviewData {
  consultNumber: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  caseType: string | null;
  caseSummary: string;
  clientDemand: string | null;
  suggestedTitle: string;
  suggestedCaseType: CaseType;
  winRate: number | null;
  difficulty: string | null;
  riskLevel: string | null;
  suggestedFee: number | null;
}

/**
 * 转化请求体接口
 */
interface ConvertRequest {
  title?: string;
  description?: string;
  caseType?: CaseType;
  plaintiffName?: string;
  defendantName?: string;
  amount?: number;
  createClient?: boolean;
}

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
        'CIVIL',
        'CRIMINAL',
        'ADMINISTRATIVE',
        'COMMERCIAL',
        'LABOR',
        'INTELLECTUAL',
        'OTHER',
      ];
      if (!validCaseTypes.includes(body.caseType)) {
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
      // TODO: 从session获取真实用户ID
      userId: 'demo-user-id',
      title: body.title,
      description: body.description,
      caseType: body.caseType,
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
