/**
 * 风险评估API接口
 * POST /api/risk-assessment - 提交风险评估请求
 */

import { NextRequest, NextResponse } from 'next/server';
import { RiskAssessmentService } from '@/lib/risk/risk-assessment-service';
import type {
  RiskAssessmentRequest,
  RiskAssessmentResponse,
} from '@/types/risk-assessment';
import { isValidRiskAssessmentFormData } from '@/types/risk-assessment';

/**
 * POST /api/risk-assessment
 * 提交风险评估请求
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<RiskAssessmentResponse>> {
  try {
    // 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
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

    // 验证formData字段
    if (!requestData.formData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FORM_DATA',
            message: '缺少formData字段',
          },
        },
        { status: 400 }
      );
    }

    // 验证表单数据
    if (!isValidRiskAssessmentFormData(requestData.formData)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '表单数据验证失败，请检查必填字段',
          },
        },
        { status: 400 }
      );
    }

    const { formData } = requestData as RiskAssessmentRequest;

    // 执行风险评估
    const result = await RiskAssessmentService.assessRisk(formData);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('风险评估错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ASSESSMENT_ERROR',
          message: error instanceof Error ? error.message : '风险评估失败',
        },
      },
      { status: 500 }
    );
  }
}
