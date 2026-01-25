import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { FeeCalculationService } from '@/lib/calculation/fee-calculation-service';
import {
  FeeType,
  LawyerFeeConfig,
  LitigationFeeConfig,
  TravelExpenseConfig,
} from '@/types/calculation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { successResponse, errorResponse } from '@/lib/api-response';

const calculationService = new FeeCalculationService(prisma);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    const body = await req.json();
    const { type, ...params } = body;

    let result;

    switch (type) {
      case FeeType.LAWYER_FEE:
        // 验证必要参数
        if (!params.config && !userId) {
          // 如果没有config且未登录，尝试构建默认config
          // 这里可以根据需求决定是否允许未登录用户计算（提供默认值）
          params.config = {
            mode: 'HOURLY', // 默认按小时
            hourlyRate: 1000,
            currency: 'CNY',
          } as LawyerFeeConfig;
        }

        result = await calculationService.calculateLawyerFee(userId, params);
        break;

      case FeeType.LITIGATION_FEE:
        if (!params.caseType) {
          return errorResponse('Missing caseType', 400);
        }

        // 默认配置
        if (!params.config) {
          params.config = {
            caseType: params.caseType,
            currency: 'CNY',
          } as LitigationFeeConfig;
        }

        result = await calculationService.calculateLitigationFee(
          userId,
          params
        );
        break;

      case FeeType.TRAVEL_EXPENSE:
        if (!params.days || !params.peopleCount || !params.expenses) {
          return errorResponse(
            'Missing required travel expense parameters',
            400
          );
        }

        // 默认配置
        if (!params.config) {
          params.config = {
            dailyAllowance: 0,
            accommodationLimit: 0,
            currency: 'CNY',
          } as TravelExpenseConfig;
        }

        result = await calculationService.calculateTravelExpense(
          userId,
          params
        );
        break;

      case 'TOTAL':
        result = await calculationService.calculateTotalFee(userId, params);
        break;

      default:
        return errorResponse(`Unsupported calculation type: ${type}`, 400);
    }

    return successResponse(result);
  } catch (error) {
    console.error('Fee calculation error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Calculation failed',
      500
    );
  }
}
