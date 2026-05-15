/**
 * 案号生成API
 *
 * GET /api/v1/cases/generate-case-number
 *
 * 功能：根据案件类型生成连续的案号
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { getAuthUser } from '@/lib/middleware/auth';
import { generateCaseNumber } from '@/lib/case/case-number-service';

/**
 * 案件类型代码映射
 */
const caseTypeConfig: Record<string, { code: string; name: string }> = {
  CIVIL: { code: 'M', name: '民' },
  CRIMINAL: { code: 'X', name: '刑' },
  ADMINISTRATIVE: { code: 'G', name: '行' },
  COMMERCIAL: { code: 'S', name: '商' },
  LABOR: { code: 'L', name: '劳' },
  INTELLECTUAL_PROPERTY: { code: 'Z', name: '知' },
};

/**
 * GET 处理函数
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权，请先登录' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get('type') || 'CIVIL').toUpperCase();
  const status = (searchParams.get('status') || 'DRAFT').toUpperCase();

  // 验证案件类型
  if (!caseTypeConfig[type]) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: '无效的案件类型',
        },
      },
      { status: 400 }
    );
  }

  // 生成案号
  const caseNumber = await generateCaseNumber(prisma, type, status);

  return NextResponse.json({
    success: true,
    data: {
      caseNumber,
      type,
      year: new Date().getFullYear(),
    },
  });
});
