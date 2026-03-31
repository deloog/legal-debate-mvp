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
 * 状态代码映射
 */
const statusConfig: Record<string, string> = {
  DRAFT: '初',
  ACTIVE: '初',
  COMPLETED: '终',
  ARCHIVED: '决',
};

/**
 * 生成连续案号
 */
async function generateCaseNumber(
  type: string = 'CIVIL',
  status: string = 'DRAFT'
): Promise<string> {
  const year = new Date().getFullYear();
  const typeInfo = caseTypeConfig[type] || caseTypeConfig.CIVIL;
  const statusCode = statusConfig[status] || '初';

  // 获取该类型案件在当年的最大案号
  const prefix = `${year}${typeInfo.code}${typeInfo.name}${statusCode}`;

  const latestCase = await prisma.case.findFirst({
    where: {
      caseNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      caseNumber: 'desc',
    },
    select: {
      caseNumber: true,
    },
  });

  let sequence = 1;
  if (latestCase?.caseNumber) {
    // 尝试从现有案号中提取序号
    const match = latestCase.caseNumber.match(/(\d+)号?$/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }

  // 格式化序号为4位数字
  const sequenceStr = sequence.toString().padStart(4, '0');

  return `${prefix}${sequenceStr}号`;
}

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
  const caseNumber = await generateCaseNumber(type, status);

  return NextResponse.json({
    success: true,
    data: {
      caseNumber,
      type,
      year: new Date().getFullYear(),
    },
  });
});
