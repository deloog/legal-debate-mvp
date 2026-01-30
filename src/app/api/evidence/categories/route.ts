/**
 * 证据分类配置API
 *
 * GET /api/evidence/categories
 * 获取证据分类配置
 */

import { NextResponse } from 'next/server';
import {
  getEvidenceCategoriesByCaseType,
  getAllCaseTypes,
  searchCategories,
} from '@/lib/evidence/evidence-category-config';

/**
 * GET /api/evidence/categories
 * 获取证据分类配置
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseType = searchParams.get('caseType');
    const keyword = searchParams.get('keyword');

    // 如果没有指定案件类型，返回所有案件类型列表
    if (!caseType) {
      const allCaseTypes = getAllCaseTypes();
      return NextResponse.json(
        {
          success: true,
          data: {
            caseTypes: allCaseTypes,
          },
          message: '获取案件类型列表成功',
        },
        { status: 200 }
      );
    }

    // 如果有搜索关键词，执行搜索
    if (keyword) {
      const results = searchCategories(caseType, keyword);
      return NextResponse.json(
        {
          success: true,
          data: {
            caseType,
            keyword,
            categories: results,
            total: results.length,
          },
          message: '搜索证据分类成功',
        },
        { status: 200 }
      );
    }

    // 获取指定案件类型的分类配置
    const categories = getEvidenceCategoriesByCaseType(caseType);

    if (categories.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CASE_TYPE_NOT_FOUND',
            message: '未找到该案件类型的分类配置',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          caseType,
          categories,
          total: categories.length,
        },
        message: '获取证据分类配置成功',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('证据分类配置API错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '服务器内部错误',
        },
      },
      { status: 500 }
    );
  }
}
