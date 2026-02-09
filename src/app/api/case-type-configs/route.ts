/**
 * 案件类型配置API
 * GET /api/case-type-configs - 获取案件类型配置列表
 */
import { prisma } from '@/lib/db/prisma';
import type { ErrorResponse, SuccessResponse } from '@/types/api-response';
import { CaseTypeCategory } from '@/types/case-type-config';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 案件类型配置响应数据接口
 */
interface CaseTypeConfigResponse {
  id: string;
  code: string;
  name: string;
  category: CaseTypeCategory;
  baseFee: number;
  riskFeeRate: number | null;
  hourlyRate: number | null;
  avgDuration: number | null;
  complexityLevel: number;
  isActive: boolean;
  sortOrder: number;
}

/**
 * 查询参数接口
 */
interface QueryParams {
  category?: string;
  isActive?: string;
  keyword?: string;
}

/**
 * GET /api/case-type-configs
 * 获取案件类型配置列表
 */
export async function GET(
  request: NextRequest
): Promise<
  | NextResponse<SuccessResponse<CaseTypeConfigResponse[]>>
  | NextResponse<ErrorResponse>
> {
  try {
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const params: QueryParams = Object.fromEntries(searchParams);

    const { category, isActive, keyword } = params;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    // 按大类筛选
    if (
      category &&
      Object.values(CaseTypeCategory).includes(category as CaseTypeCategory)
    ) {
      where.category = category;
    }

    // 按启用状态筛选（默认只返回启用的）
    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }

    // 查询案件类型配置列表
    const configs = await prisma.caseTypeConfig.findMany({
      where,
      orderBy: {
        sortOrder: 'asc',
        name: 'asc',
      },
    });

    // 转换响应数据
    const responseData: CaseTypeConfigResponse[] = configs.map(
      (config): CaseTypeConfigResponse => ({
        id: config.id,
        code: config.code,
        name: config.name,
        category: config.category as CaseTypeCategory,
        baseFee: Number(config.baseFee),
        riskFeeRate: config.riskFeeRate,
        hourlyRate: config.hourlyRate ? Number(config.hourlyRate) : null,
        avgDuration: config.avgDuration,
        complexityLevel: config.complexityLevel,
        isActive: config.isActive,
        sortOrder: config.sortOrder,
      })
    );

    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('获取案件类型配置失败:', error);

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
