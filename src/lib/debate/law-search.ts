/**
 * 共享法条检索工具
 * 被 /generate 和 /stream 路由共同使用
 */

import { LawStarClient } from '@/lib/ai/lawstar-client';
import { getLawStarConfig, isLawStarAvailable } from '@/lib/ai/lawstar-config';
import { prisma } from '@/lib/db/prisma';
import { LawCategory, LawStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';

// =============================================================================
// 案件类型 → 法条分类映射
// =============================================================================

export const CASE_TYPE_TO_LAW_CATEGORIES: Record<string, LawCategory[]> = {
  CIVIL: [LawCategory.CIVIL, LawCategory.PROCEDURE],
  CRIMINAL: [LawCategory.CRIMINAL, LawCategory.PROCEDURE],
  ADMINISTRATIVE: [LawCategory.ADMINISTRATIVE, LawCategory.PROCEDURE],
  COMMERCIAL: [LawCategory.COMMERCIAL, LawCategory.CIVIL],
  LABOR: [LawCategory.LABOR, LawCategory.CIVIL],
  INTELLECTUAL_PROPERTY: [LawCategory.INTELLECTUAL_PROPERTY, LawCategory.CIVIL],
};

export type LocalArticle = {
  lawName: string;
  articleNumber: string;
  fullText: string;
  category: LawCategory;
};

// =============================================================================
// 本地 DB 检索
// =============================================================================

/**
 * 从本地数据库检索与案件相关的法律条文
 * 策略：优先按案件类型分类检索，再按关键词全文匹配，返回现行有效法条
 */
export async function searchLocalLawArticles(
  caseType: string | null,
  keywords: string,
  limit = 6
): Promise<LocalArticle[]> {
  const categories = caseType
    ? (CASE_TYPE_TO_LAW_CATEGORIES[caseType] ?? [])
    : [];

  const keywordList = keywords
    .replace(/[，。、！？；：""''【】（）《》]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .slice(0, 10);

  const validStatuses = [LawStatus.VALID, LawStatus.AMENDED];

  try {
    const articles = await prisma.lawArticle.findMany({
      where: {
        status: { in: validStatuses },
        ...(categories.length > 0 ? { category: { in: categories } } : {}),
        ...(keywordList.length > 0
          ? {
              OR: keywordList.map(kw => ({
                searchableText: { contains: kw },
              })),
            }
          : {}),
      },
      select: {
        lawName: true,
        articleNumber: true,
        fullText: true,
        category: true,
        referenceCount: true,
      },
      orderBy: [{ referenceCount: 'desc' }, { viewCount: 'desc' }],
      take: limit,
    });

    return articles;
  } catch (err) {
    console.error('本地法条检索失败:', err);
    return [];
  }
}

// =============================================================================
// LawStar 二级备用检索（本地结果不足时触发）
// =============================================================================

/**
 * 查询 ExternalCache 中是否有缓存的 LawStar 结果
 */
export async function getLawStarFromCache(
  queryHash: string
): Promise<LocalArticle[] | null> {
  try {
    const cached = await prisma.externalCache.findUnique({
      where: { queryHash },
    });
    if (!cached) return null;
    if (new Date(cached.expiresAt) < new Date()) return null;

    await prisma.externalCache.update({
      where: { queryHash },
      data: { hitCount: { increment: 1 }, lastAccessedAt: new Date() },
    });

    return (cached.resultData as { articles: LocalArticle[] }).articles ?? null;
  } catch {
    return null;
  }
}

/**
 * 将 LawStar 结果写入 ExternalCache（24小时有效）
 */
export async function saveLawStarToCache(
  queryHash: string,
  query: string,
  articles: LocalArticle[]
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.externalCache.upsert({
      where: { queryHash },
      create: {
        source: 'lawstar',
        query,
        queryHash,
        resultType: 'law_article',
        resultData: { articles } as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
      update: {
        resultData: { articles } as unknown as Prisma.InputJsonValue,
        expiresAt,
        hitCount: 0,
        lastAccessedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn('LawStar 缓存写入失败:', err);
  }
}

/**
 * 通过 LawStar 向量检索补充法条（二级备用）
 * 触发条件：本地DB结果 < 2 条 且 LawStar 已配置
 */
export async function searchLawStarFallback(
  caseTitle: string,
  caseDescription: string | null,
  limit = 4
): Promise<LocalArticle[]> {
  if (!isLawStarAvailable()) {
    console.log('LawStar 未配置，跳过二级备用检索');
    return [];
  }

  const query = [caseTitle, caseDescription ?? ''].join(' ').substring(0, 200);
  const queryHash = createHash('sha256')
    .update(`lawstar_debate_${query}_${limit}`)
    .digest('hex');

  const cached = await getLawStarFromCache(queryHash);
  if (cached) {
    console.log(`LawStar 缓存命中，返回 ${cached.length} 条法条`);
    return cached;
  }

  try {
    const client = new LawStarClient(getLawStarConfig());
    const response = await client.vectorSearch({
      query,
      topK: limit,
      timeliness: 1,
      includeContent: true,
    });

    const rawList =
      (response as { data?: { list?: unknown[] } }).data?.list ?? [];
    const articles: LocalArticle[] = rawList
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null
      )
      .map(item => ({
        lawName: String(item.lawName ?? item.title ?? ''),
        articleNumber: String(item.articleNumber ?? item.article ?? ''),
        fullText: String(item.content ?? item.fullText ?? '').substring(0, 500),
        category: LawCategory.OTHER,
      }))
      .filter(a => a.lawName && a.articleNumber);

    if (articles.length > 0) {
      await saveLawStarToCache(queryHash, query, articles);
      console.log(`LawStar 检索成功，获取 ${articles.length} 条法条（已缓存）`);
    }

    return articles;
  } catch (err) {
    console.error('LawStar 二级备用检索失败:', err);
    return [];
  }
}

// =============================================================================
// 合并检索（本地 + LawStar 二级备用）
// =============================================================================

/**
 * 执行完整的法条检索流程：本地优先，不足时触发 LawStar 备用
 * 返回去重后的合并结果及统计信息
 */
export async function searchAllLawArticles(
  caseType: string | null,
  caseTitle: string,
  caseDescription: string | null,
  localLimit = 6,
  lawstarLimit = 4
): Promise<{
  articles: LocalArticle[];
  localCount: number;
  lawstarCount: number;
}> {
  const localArticles = await searchLocalLawArticles(
    caseType,
    [caseTitle, caseDescription ?? ''].join(' '),
    localLimit
  );

  if (localArticles.length >= 2) {
    console.log(`本地DB检索到 ${localArticles.length} 条相关法条`);
    return {
      articles: localArticles,
      localCount: localArticles.length,
      lawstarCount: 0,
    };
  }

  console.log(
    `本地DB仅检索到 ${localArticles.length} 条法条，触发 LawStar 二级备用检索…`
  );
  const lawstarArticles = await searchLawStarFallback(
    caseTitle,
    caseDescription,
    lawstarLimit
  );

  const seen = new Set(
    localArticles.map(a => `${a.lawName}|${a.articleNumber}`)
  );
  const merged = [...localArticles];
  for (const a of lawstarArticles) {
    const key = `${a.lawName}|${a.articleNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(a);
    }
  }

  if (lawstarArticles.length > 0) {
    console.log(
      `LawStar 补充了 ${lawstarArticles.length} 条法条，合计 ${merged.length} 条`
    );
  }

  return {
    articles: merged,
    localCount: localArticles.length,
    lawstarCount: lawstarArticles.length,
  };
}
