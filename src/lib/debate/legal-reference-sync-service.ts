import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface LegalBasisForSync {
  lawName: string;
  articleNumber: string;
  relevance?: number;
  explanation?: string;
}

interface MergedLegalBasis extends Required<LegalBasisForSync> {
  sides: string[];
}

export interface SyncDebateLegalReferencesResult {
  total: number;
  created: number;
  updated: number;
}

function normalizeLegalBasis(raw: unknown): LegalBasisForSync | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<LegalBasisForSync>;
  if (!item.lawName || !item.articleNumber) return null;

  return {
    lawName: item.lawName,
    articleNumber: item.articleNumber,
    relevance:
      typeof item.relevance === 'number' && Number.isFinite(item.relevance)
        ? item.relevance
        : 0.5,
    explanation: item.explanation ?? '',
  };
}

function mergeLegalBasisByArticle(
  entries: Array<{ side: string; legalBasis: LegalBasisForSync[] }>
): MergedLegalBasis[] {
  const basisMap = new Map<string, MergedLegalBasis>();

  for (const entry of entries) {
    for (const item of entry.legalBasis) {
      const normalized = normalizeLegalBasis(item);
      if (!normalized) continue;

      const key = `${normalized.lawName}|${normalized.articleNumber}`;
      const existing = basisMap.get(key);
      if (existing) {
        if (!existing.sides.includes(entry.side)) {
          existing.sides.push(entry.side);
        }
        existing.relevance = Math.max(
          existing.relevance,
          normalized.relevance ?? 0.5
        );
        if (!existing.explanation && normalized.explanation) {
          existing.explanation = normalized.explanation;
        }
        continue;
      }

      basisMap.set(key, {
        lawName: normalized.lawName,
        articleNumber: normalized.articleNumber,
        relevance: normalized.relevance ?? 0.5,
        explanation: normalized.explanation ?? '',
        sides: [entry.side],
      });
    }
  }

  return [...basisMap.values()];
}

async function hydrateLawArticles(items: MergedLegalBasis[]) {
  if (items.length === 0)
    return new Map<
      string,
      {
        id: string;
        lawName: string;
        articleNumber: string;
        fullText: string;
        lawType: string;
        category: string;
      }
    >();

  const articles = await prisma.lawArticle.findMany({
    where: {
      OR: items.map(item => ({
        lawName: item.lawName,
        articleNumber: item.articleNumber,
      })),
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
      lawType: true,
      category: true,
    },
  });

  return new Map(
    articles.map(article => [
      `${article.lawName}|${article.articleNumber}`,
      article,
    ])
  );
}

/**
 * 将辩论论点中的 legalBasis 持久化为案件级 LegalReference。
 * 这是案件法条图谱的数据入口，不能依赖前端打开某个列表页来“顺手同步”。
 */
export async function syncDebateLegalReferences(
  caseId: string,
  roundId: string,
  entries: Array<{ side: string; legalBasis: unknown }>
): Promise<SyncDebateLegalReferencesResult> {
  const merged = mergeLegalBasisByArticle(
    entries.map(entry => ({
      side: entry.side,
      legalBasis: Array.isArray(entry.legalBasis)
        ? (entry.legalBasis as LegalBasisForSync[])
        : [],
    }))
  );

  if (merged.length === 0) {
    return { total: 0, created: 0, updated: 0 };
  }

  const articleMap = await hydrateLawArticles(merged);
  let created = 0;
  let updated = 0;

  for (const item of merged) {
    const key = `${item.lawName}|${item.articleNumber}`;
    const article = articleMap.get(key);

    const existing = await prisma.legalReference.findFirst({
      where: {
        caseId,
        ...(article?.id
          ? { articleId: article.id }
          : { source: item.lawName, articleNumber: item.articleNumber }),
      },
    });

    const metadata = {
      ...(existing?.metadata && typeof existing.metadata === 'object'
        ? (existing.metadata as Record<string, unknown>)
        : {}),
      roundId,
      aiGenerated: true,
      source: 'debate_legal_basis',
      sides: item.sides,
    };

    const data = {
      articleId: article?.id ?? existing?.articleId ?? null,
      source: article?.lawName ?? item.lawName,
      articleNumber: article?.articleNumber ?? item.articleNumber,
      content: article?.fullText ?? existing?.content ?? item.explanation,
      lawType: article?.lawType ?? existing?.lawType ?? null,
      category: article?.category ?? existing?.category ?? null,
      applicabilityScore: item.relevance,
      applicabilityReason: item.explanation || null,
      metadata: metadata as Prisma.InputJsonValue,
    };

    if (existing) {
      await prisma.legalReference.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.legalReference.create({
        data: {
          caseId,
          ...data,
        },
      });
      created++;
    }
  }

  logger.info('[debate-legal-reference-sync] 同步辩论法条引用完成', {
    caseId,
    roundId,
    total: merged.length,
    created,
    updated,
  });

  return { total: merged.length, created, updated };
}
