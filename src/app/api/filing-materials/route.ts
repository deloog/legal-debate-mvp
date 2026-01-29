/**
 * GET /api/filing-materials
 * 获取立案材料清单
 */

import { NextRequest, NextResponse } from 'next/server';
import { filingMaterialsService } from '@/lib/case/filing-materials-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const caseType = searchParams.get('caseType');
    const courtLevel = searchParams.get('courtLevel') || '基层';

    if (!caseType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_CASE_TYPE',
            message: '缺少案件类型参数',
          },
        },
        { status: 400 }
      );
    }

    // 获取立案材料清单
    const materials = filingMaterialsService.getFilingMaterials(
      caseType,
      courtLevel
    );

    return NextResponse.json({
      success: true,
      data: materials,
    });
  } catch (error) {
    console.error('获取立案材料清单失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '获取材料清单失败',
        },
      },
      { status: 500 }
    );
  }
}
