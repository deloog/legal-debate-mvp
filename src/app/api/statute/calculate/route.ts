/**
 * 时效计算API路由
 *
 * POST /api/statute/calculate - 计算时效并保存结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { statuteCalculationService } from '@/lib/calculation/statute-calculation-service';
import { getAuthUser } from '@/lib/middleware/auth';
import type { StatuteCalculationParams } from '@/types/statute';
import {
  StatuteType,
  CaseTypeForStatute,
  SpecialCircumstances,
} from '@/types/statute';

/**
 * POST /api/statute/calculate
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { caseId, statuteType, caseType, startDate, ...rest } = body;

  // 验证必需参数
  if (!caseId || !statuteType || !caseType || !startDate) {
    return NextResponse.json(
      { error: '缺少必需参数: caseId, statuteType, caseType, startDate' },
      { status: 400 }
    );
  }

  // 验证时效类型
  if (!Object.values(StatuteType).includes(statuteType)) {
    return NextResponse.json(
      { error: `无效的时效类型: ${statuteType}` },
      { status: 400 }
    );
  }

  // 验证案件类型
  if (!Object.values(CaseTypeForStatute).includes(caseType)) {
    return NextResponse.json(
      { error: `无效的案件类型: ${caseType}` },
      { status: 400 }
    );
  }

  // 验证特殊情况
  let specialCircumstances: SpecialCircumstances[] | undefined;
  if (rest.specialCircumstances && Array.isArray(rest.specialCircumstances)) {
    specialCircumstances = rest.specialCircumstances.filter((sc: string) =>
      Object.values(SpecialCircumstances).includes(sc as SpecialCircumstances)
    ) as SpecialCircumstances[];
  }

  // 构建计算参数
  const params: StatuteCalculationParams = {
    caseId,
    statuteType,
    caseType,
    startDate: new Date(startDate),
    endDate: rest.endDate ? new Date(rest.endDate) : undefined,
    specialCircumstances,
    customRules: rest.customRules,
    timezone: rest.timezone,
  };

  // 执行计算
  const result = await statuteCalculationService.calculateAndSave(
    authUser.userId,
    params
  );

  return createSuccessResponse(result);
});

/**
 * OPTIONS /api/statute/calculate
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
