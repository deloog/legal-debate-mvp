/**
 * 法条导入API - 管理员专用
 * 支持批量导入法条数据
 */

import {
  badRequestResponse,
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { LAW_PERMISSIONS } from '@/types/permission';
import { LawCategory, LawStatus, LawType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 法条数据导入请求
 */
interface LawArticleImportRequest {
  dataSource?: string; // 数据源：'local' | 'judiciary' | 'cail' | 'lawgpt' | 'lawstar' | 'pkulaw'
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
    expiryDate?: string;
    status?: string;
    issuingAuthority?: string;
    jurisdiction?: string;
    searchableText?: string;
    level?: number;
    sourceId?: string;
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

    const now = new Date();

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
          expiryDate: article.expiryDate
            ? new Date(article.expiryDate)
            : existing.expiryDate,
          status: article.status
            ? (article.status as LawStatus)
            : existing.status,
          issuingAuthority:
            article.issuingAuthority ?? existing.issuingAuthority,
          jurisdiction: article.jurisdiction ?? existing.jurisdiction,
          searchableText: article.searchableText ?? existing.searchableText,
          level: article.level ?? existing.level,
          updatedAt: now,
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
          expiryDate: article.expiryDate ? new Date(article.expiryDate) : null,
          status: article.status
            ? (article.status as LawStatus)
            : LawStatus.VALID,
          issuingAuthority: article.issuingAuthority ?? '',
          jurisdiction: article.jurisdiction ?? '',
          searchableText: article.searchableText ?? article.fullText,
          level: article.level ?? 3,
          viewCount: 0,
          referenceCount: 0,
        },
      });
    }

    return { success: true };
  } catch (error) {
    logger.error(
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
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
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
      return badRequestResponse('请提供有效的JSON数据');
    }

    // 验证数据格式
    if (!body || typeof body !== 'object') {
      return badRequestResponse('请提供有效的JSON数据');
    }

    const importData = body as LawArticleImportRequest;

    if (!Array.isArray(importData.articles)) {
      return badRequestResponse('articles字段必须是数组');
    }

    if (importData.articles.length === 0) {
      return badRequestResponse('至少提供一条法条数据');
    }

    if (importData.articles.length > 1000) {
      return badRequestResponse('单次最多导入1000条法条');
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

    return successResponse(response, '导入法条成功');
  } catch (error) {
    logger.error('导入法条失败:', error);
    return serverErrorResponse('导入法条失败');
  }
}
