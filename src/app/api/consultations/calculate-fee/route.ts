/**
 * 律师费计算API路由
 * POST /api/consultations/calculate-fee - 计算律师费
 */
import {
  createFeeCalculatorService,
  FeeCalculationResult,
  FeeCalculatorService,
  FeeMode,
} from '@/lib/consultation/fee-calculator-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { ErrorResponse, SuccessResponse } from '@/types/api-response';
import { CalculateFeeRequest } from '@/types/consultation';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/consultations/calculate-fee
 * 计算律师费
 */
export async function POST(
  request: NextRequest
): Promise<
  NextResponse<SuccessResponse<FeeCalculationResult> | ErrorResponse>
> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '未授权' },
      },
      { status: 401 }
    );
  }

  try {
    // 解析请求体
    let body: CalculateFeeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: '请求体格式错误',
          },
        },
        { status: 400 }
      );
    }

    // 验证收费模式
    const validFeeModes: FeeMode[] = [
      'FIXED' as FeeMode,
      'RISK' as FeeMode,
      'HOURLY' as FeeMode,
      'STAGED' as FeeMode,
    ];
    if (!body.feeMode || !validFeeModes.includes(body.feeMode as FeeMode)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FEE_MODE',
            message: '无效的收费模式',
          },
        },
        { status: 400 }
      );
    }

    // 验证风险代理比例
    if (body.feeMode === 'RISK' && body.riskRate !== undefined) {
      if (body.riskRate < 0.05 || body.riskRate > 0.3) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_RISK_RATE',
              message: '风险代理比例应在5%-30%之间',
            },
          },
          { status: 400 }
        );
      }
    }

    // 验证小时费率
    if (body.feeMode === 'HOURLY' && body.hourlyRate !== undefined) {
      if (body.hourlyRate < 100 || body.hourlyRate > 5000) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_HOURLY_RATE',
              message: '小时费率应在100-5000元之间',
            },
          },
          { status: 400 }
        );
      }
    }

    // 创建计算服务并执行计算
    const feeCalculatorService = createFeeCalculatorService();
    const result = await feeCalculatorService.calculate({
      caseType: body.caseType,
      caseAmount: body.caseAmount,
      difficulty: body.difficulty,
      feeMode: body.feeMode as FeeMode,
      riskRate: body.riskRate,
      estimatedHours: body.estimatedHours,
      hourlyRate: body.hourlyRate,
      stages: body.stages,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('费用计算失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CALCULATION_FAILED',
          message: '计算失败，请重试',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/consultations/calculate-fee
 * 获取收费模式列表
 */
export async function GET(): Promise<
  NextResponse<
    SuccessResponse<Array<{ value: FeeMode; label: string }>> | ErrorResponse
  >
> {
  try {
    const feeModes = FeeCalculatorService.getFeeModes();

    return NextResponse.json({
      success: true,
      data: feeModes,
    });
  } catch (error) {
    logger.error('获取收费模式失败:', error);

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
