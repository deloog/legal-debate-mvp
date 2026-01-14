/**
 * 法条导入API - 管理员专用
 * 支持批量导入法条数据
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { LAW_PERMISSIONS } from '@/types/permission';
import { LawType, LawCategory, LawStatus } from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 法条数据导入请求
 */
interface LawArticleImportRequest {
  articles: Array<{
    lawName: string;
    articleNumber: string;
    fullText: string;
    lawType: string;
    category: string;
    subCategory?: string;
    tags?: string[];
    keywords?: string[];
    version?: string;
    effectiveDate: string;
    status?: string;
    issuingAuthority?: string;
    jurisdiction?: string;
    searchableText?: string;
  }>;
}

/**
 * 法条导入响应
 */
interface LawArticleImportResponse {
  total: number;
  success: number;
  failed: number;
  errors: Array<{
    lawName: string;
    articleNumber: string;
    reason: string;
  }>;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证法律类型枚举值
 */
function isValidLawType(lawType: string): boolean {
  const validTypes = Object.values(LawType);
  return validTypes.includes(lawType as LawType);
}

/**
 * 验证法律类别枚举值
 */
function isValidCategory(category: string): boolean {
  const validCategories = Object.values(LawCategory);
  return validCategories.includes(category as LawCategory);
}

/**
 * 验证法条数据
 */
function validateArticleData(
  article: LawArticleImportRequest['articles'][number]
): { valid: boolean; reason?: string } {
  if (!article.lawName || article.lawName.trim() === '') {
    return { valid: false, reason: '法条名称不能为空' };
  }

  if (!article.articleNumber || article.articleNumber.trim() === '') {
    return { valid: false, reason: '法条编号不能为空' };
  }

  if (!article.fullText || article.fullText.trim() === '') {
    return { valid: false, reason: '法条内容不能为空' };
  }

  if (!article.lawType || !isValidLawType(article.lawType)) {
    return { valid: false, reason: `无效的法律类型: ${article.lawType}` };
  }

  if (!article.category || !isValidCategory(article.category)) {
    return { valid: false, reason: `无效的法律类别: ${article.category}` };
  }

  if (!article.effectiveDate) {
    return { valid: false, reason: '生效日期不能为空' };
  }

  return { valid: true };
}

/**
 * 导入单个法条
 */
async function importArticle(
  article: LawArticleImportRequest['articles'][number]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 检查是否已存在
    const existing = await prisma.lawArticle.findFirst({
      where: {
        lawName: article.lawName,
        articleNumber: article.articleNumber,
      },
    });

    if (existing) {
      // 更新现有法条
      await prisma.lawArticle.update({
        where: { id: existing.id },
        data: {
          fullText: article.fullText,
          lawType: article.lawType as LawType,
          category: article.category as LawCategory,
          subCategory: article.subCategory ?? existing.subCategory,
          tags: article.tags ?? existing.tags,
          keywords: article.keywords ?? existing.keywords,
          version: article.version ?? existing.version,
          effectiveDate: new Date(article.effectiveDate),
          status: article.status
            ? (article.status as LawStatus)
            : existing.status,
          issuingAuthority:
            article.issuingAuthority ?? existing.issuingAuthority,
          jurisdiction: article.jurisdiction ?? existing.jurisdiction,
          searchableText: article.searchableText ?? existing.searchableText,
        },
      });
    } else {
      // 创建新法条
      await prisma.lawArticle.create({
        data: {
          lawName: article.lawName,
          articleNumber: article.articleNumber,
          fullText: article.fullText,
          lawType: article.lawType as LawType,
          category: article.category as LawCategory,
          subCategory: article.subCategory,
          tags: article.tags ?? [],
          keywords: article.keywords ?? [],
          version: article.version ?? '1.0',
          effectiveDate: new Date(article.effectiveDate),
          status: article.status
            ? (article.status as LawStatus)
            : LawStatus.VALID,
          issuingAuthority: article.issuingAuthority ?? '',
          jurisdiction: article.jurisdiction ?? '',
          searchableText: article.searchableText ?? article.fullText,
          viewCount: 0,
          referenceCount: 0,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error(
      `导入法条失败: ${article.lawName} ${article.articleNumber}`,
      error
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * POST /api/admin/law-articles/import
 * 批量导入法条（管理员权限）
 */
export async function POST(request: NextRequest): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(
    request,
    LAW_PERMISSIONS.CREATE
  );
  if (permissionError) {
    return permissionError;
  }

  try {
    // 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: '请求格式错误', message: '请提供有效的JSON数据' },
        { status: 400 }
      );
    }

    // 验证数据格式
    if (!body || typeof body !== 'object') {
      return Response.json(
        { error: '请求格式错误', message: '请提供有效的JSON数据' },
        { status: 400 }
      );
    }

    const importData = body as LawArticleImportRequest;

    if (!Array.isArray(importData.articles)) {
      return Response.json(
        {
          error: '请求格式错误',
          message: 'articles字段必须是数组',
        },
        { status: 400 }
      );
    }

    if (importData.articles.length === 0) {
      return Response.json(
        {
          error: '请求数据为空',
          message: '至少提供一条法条数据',
        },
        { status: 400 }
      );
    }

    if (importData.articles.length > 1000) {
      return Response.json(
        {
          error: '请求数据过大',
          message: '单次最多导入1000条法条',
        },
        { status: 400 }
      );
    }

    // 执行导入
    const response: LawArticleImportResponse = {
      total: importData.articles.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const article of importData.articles) {
      // 验证数据
      const validation = validateArticleData(article);
      if (!validation.valid) {
        response.failed++;
        response.errors.push({
          lawName: article.lawName,
          articleNumber: article.articleNumber,
          reason: validation.reason ?? '数据验证失败',
        });
        continue;
      }

      // 导入法条
      const result = await importArticle(article);
      if (result.success) {
        response.success++;
      } else {
        response.failed++;
        response.errors.push({
          lawName: article.lawName,
          articleNumber: article.articleNumber,
          reason: result.error ?? '导入失败',
        });
      }
    }

    return Response.json({ data: response }, { status: 200 });
  } catch (error) {
    console.error('导入法条失败:', error);
    return Response.json(
      { error: '服务器错误', message: '导入法条失败' },
      { status: 500 }
    );
  }
}
