/**
 * 知识图谱增强的辩论法条搜索服务
 *
 * 功能：
 * 1. 并行执行关键词搜索 + 图谱查询
 * 2. 500ms超时机制
 * 3. 优雅降级
 * 4. 攻击路径发现
 */

import { prisma } from '@/lib/db/prisma';
import { LawCategory, RelationType, VerificationStatus } from '@prisma/client';
import { searchAllLawArticles } from '@/lib/debate/law-search';
import { logger } from '@/lib/logger';

/**
 * 超时时间（毫秒）
 */
const GRAPH_QUERY_TIMEOUT_MS = 500;

/**
 * 案件类型 → 法条分类映射
 */
const CASE_TYPE_TO_LAW_CATEGORIES: Record<string, LawCategory[]> = {
  CIVIL: [LawCategory.CIVIL, LawCategory.PROCEDURE],
  CRIMINAL: [LawCategory.CRIMINAL, LawCategory.PROCEDURE],
  ADMINISTRATIVE: [LawCategory.ADMINISTRATIVE, LawCategory.PROCEDURE],
  COMMERCIAL: [LawCategory.COMMERCIAL, LawCategory.CIVIL],
  LABOR: [LawCategory.LABOR, LawCategory.CIVIL],
  INTELLECTUAL_PROPERTY: [LawCategory.INTELLECTUAL_PROPERTY, LawCategory.CIVIL],
};

/**
 * 法条信息（带关系）
 */
export interface LawArticleWithRelations {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  category: LawCategory;
  relationType?: RelationType;
  strength?: number;
  confidence?: number;
}

/**
 * 攻击路径
 */
export interface AttackPath {
  sourceArticle: LawArticleWithRelations;
  targetArticle: LawArticleWithRelations;
  relationType: RelationType;
  explanation: string;
}

/**
 * 图谱增强搜索结果
 */
export interface GraphEnhancedSearchResult {
  /** 关键词搜索结果 */
  keywordResults: LawArticleWithRelations[];
  /** 原告方支持法条（图谱） */
  supportingArticles: LawArticleWithRelations[];
  /** 被告方可能引用的法条（图谱） */
  opposingArticles: LawArticleWithRelations[];
  /** 冲突关系 */
  conflictRelations: Array<{
    source: LawArticleWithRelations;
    target: LawArticleWithRelations;
  }> | null;
  /** 补充关系 */
  complementRelations: Array<{
    source: LawArticleWithRelations;
    target: LawArticleWithRelations;
  }> | null;
  /** 攻击路径 */
  attackPaths: AttackPath[];
  /** 图谱分析是否完成 */
  graphAnalysisCompleted: boolean;
  /** 信息来源标记 */
  sourceAttribution: {
    keyword: boolean;
    graph: boolean;
  };
}

/**
 * 带超时的 Promise 执行
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve =>
      setTimeout(() => resolve(fallbackValue), timeoutMs)
    ),
  ]) as Promise<T>;
}

/**
 * 获取关键词检索结果
 */
async function searchByKeywords(
  caseType: string | null,
  keywords: string,
  limit = 6
): Promise<LawArticleWithRelations[]> {
  try {
    const result = await searchAllLawArticles(
      caseType,
      keywords,
      null, // caseDescription
      limit
    );
    return result.articles.map(article => ({
      id: `${article.lawName}-${article.articleNumber}`,
      lawName: article.lawName,
      articleNumber: article.articleNumber,
      fullText: article.fullText,
      category: article.category,
    }));
  } catch (error) {
    logger.error('关键词搜索失败:', error);
    return [];
  }
}

/**
 * 获取冲突/限制关系法条
 * 找到 CONFLICTS 关系的法条，对方可能引用来反驳
 */
async function findConflictingArticles(
  articleIds: string[]
): Promise<{ source: LawArticleWithRelations; target: LawArticleWithRelations }[]> {
  if (articleIds.length === 0) return [];

  try {
    const relations = await prisma.lawArticleRelation.findMany({
      where: {
        OR: [
          {
            sourceId: { in: articleIds },
            relationType: RelationType.CONFLICTS,
            verificationStatus: VerificationStatus.VERIFIED,
          },
          {
            targetId: { in: articleIds },
            relationType: RelationType.CONFLICTS,
            verificationStatus: VerificationStatus.VERIFIED,
          },
        ],
      },
      include: {
        source: true,
        target: true,
      },
      take: 10,
    });

    return relations.map(rel => ({
      source: {
        id: rel.source.id,
        lawName: rel.source.lawName,
        articleNumber: rel.source.articleNumber,
        fullText: rel.source.fullText || '',
        category: rel.source.category,
        relationType: rel.relationType,
        strength: rel.strength,
        confidence: rel.confidence,
      },
      target: {
        id: rel.target.id,
        lawName: rel.target.lawName,
        articleNumber: rel.target.articleNumber,
        fullText: rel.target.fullText || '',
        category: rel.target.category,
        relationType: rel.relationType,
        strength: rel.strength,
        confidence: rel.confidence,
      },
    }));
  } catch (error) {
    logger.error('查询冲突关系失败:', error);
    return [];
  }
}

/**
 * 获取补充关系法条
 * 找到 COMPLETES 关系的法条，需要同时引用
 */
async function findComplementArticles(
  articleIds: string[]
): Promise<{ source: LawArticleWithRelations; target: LawArticleWithRelations }[]> {
  if (articleIds.length === 0) return [];

  try {
    const complementTypes = [RelationType.COMPLETES, RelationType.COMPLETED_BY];
    const relations = await prisma.lawArticleRelation.findMany({
      where: {
        OR: [
          {
            sourceId: { in: articleIds },
            relationType: { in: complementTypes },
            verificationStatus: VerificationStatus.VERIFIED,
          },
          {
            targetId: { in: articleIds },
            relationType: { in: complementTypes },
            verificationStatus: VerificationStatus.VERIFIED,
          },
        ],
      },
      include: {
        source: true,
        target: true,
      },
      take: 10,
    });

    return relations.map(rel => ({
      source: {
        id: rel.source.id,
        lawName: rel.source.lawName,
        articleNumber: rel.source.articleNumber,
        fullText: rel.source.fullText || '',
        category: rel.source.category,
        relationType: rel.relationType,
        strength: rel.strength,
        confidence: rel.confidence,
      },
      target: {
        id: rel.target.id,
        lawName: rel.target.lawName,
        articleNumber: rel.target.articleNumber,
        fullText: rel.target.fullText || '',
        category: rel.target.category,
        relationType: rel.relationType,
        strength: rel.strength,
        confidence: rel.confidence,
      },
    }));
  } catch (error) {
    logger.error('查询补充关系失败:', error);
    return [];
  }
}

/**
 * 获取相关法条（图谱关系）
 */
async function findRelatedArticles(
  articleIds: string[]
): Promise<LawArticleWithRelations[]> {
  if (articleIds.length === 0) return [];

  try {
    const relations = await prisma.lawArticleRelation.findMany({
      where: {
        OR: [
          { sourceId: { in: articleIds } },
          { targetId: { in: articleIds } },
        ],
        verificationStatus: VerificationStatus.VERIFIED,
      },
      include: {
        source: true,
        target: true,
      },
      take: 20,
    });

    const articleMap = new Map<string, LawArticleWithRelations>();

    for (const rel of relations) {
      // 添加 source
      if (!articleMap.has(rel.source.id)) {
        articleMap.set(rel.source.id, {
          id: rel.source.id,
          lawName: rel.source.lawName,
          articleNumber: rel.source.articleNumber,
          fullText: rel.source.fullText || '',
          category: rel.source.category,
        });
      }
      // 添加 target
      if (!articleMap.has(rel.target.id)) {
        articleMap.set(rel.target.id, {
          id: rel.target.id,
          lawName: rel.target.lawName,
          articleNumber: rel.target.articleNumber,
          fullText: rel.target.fullText || '',
          category: rel.target.category,
        });
      }
    }

    // 排除原始文章
    articleIds.forEach(id => articleMap.delete(id));

    return Array.from(articleMap.values());
  } catch (error) {
    logger.error('查询相关法条失败:', error);
    return [];
  }
}

/**
 * 发现攻击路径
 * 找出对方可能用来限制己方论点的法条
 */
async function discoverAttackPaths(
  supportingArticles: LawArticleWithRelations[],
  opposingArticles: LawArticleWithRelations[]
): Promise<AttackPath[]> {
  const attackPaths: AttackPath[] = [];
  const supportingIds = supportingArticles.map(a => a.id);
  const opposingIds = opposingArticles.map(a => a.id);

  try {
    // 查找从对方法条到己方法条的冲突/替代关系
    const relations = await prisma.lawArticleRelation.findMany({
      where: {
        OR: [
          // 对方法条可能冲突的
          {
            sourceId: { in: opposingIds },
            targetId: { in: supportingIds },
            relationType: {
              in: [RelationType.CONFLICTS, RelationType.SUPERSEDES],
            },
            verificationStatus: VerificationStatus.VERIFIED,
          },
        ],
      },
      include: {
        source: true,
        target: true,
      },
      take: 10,
    });

    for (const rel of relations) {
      const sourceArticle = opposingArticles.find(a => a.id === rel.source.id);
      const targetArticle = supportingArticles.find(
        a => a.id === rel.target.id
      );

      if (sourceArticle && targetArticle) {
        attackPaths.push({
          sourceArticle,
          targetArticle,
          relationType: rel.relationType,
          explanation: getAttackPathExplanation(
            rel.relationType,
            sourceArticle,
            targetArticle
          ),
        });
      }
    }
  } catch (error) {
    logger.error('发现攻击路径失败:', error);
  }

  return attackPaths;
}

/**
 * 生成攻击路径说明
 */
function getAttackPathExplanation(
  relationType: RelationType,
  source: LawArticleWithRelations,
  target: LawArticleWithRelations
): string {
  switch (relationType) {
    case RelationType.CONFLICTS:
      return `${source.lawName}第${source.articleNumber}条与${target.lawName}第${target.articleNumber}条存在冲突，对方可能引用来反驳我方论点`;
    case RelationType.SUPERSEDES:
      return `${source.lawName}第${source.articleNumber}条可能替代${target.lawName}第${target.articleNumber}条，需注意法律修订`;
    default:
      return `${source.lawName}第${source.articleNumber}条与${target.lawName}第${target.articleNumber}条存在${relationType}关系`;
  }
}

/**
 * 图谱增强搜索主函数
 *
 * @param caseType 案件类型
 * @param keywords 关键词
 * @param options 选项
 * @returns 图谱增强搜索结果
 */
export async function graphEnhancedSearch(
  caseType: string | null,
  keywords: string,
  options: {
    timeoutMs?: number;
    includeAttackPaths?: boolean;
  } = {}
): Promise<GraphEnhancedSearchResult> {
  const { timeoutMs = GRAPH_QUERY_TIMEOUT_MS, includeAttackPaths = false } =
    options;

  // 1. 关键词搜索（不设超时，始终执行）
  const keywordResults = await searchByKeywords(caseType, keywords);

  // 2. 准备图谱搜索
  const articleIds = keywordResults.map(a => a.id);
  const categories = caseType
    ? (CASE_TYPE_TO_LAW_CATEGORIES[caseType] ?? [])
    : [];

  // 3. 异步执行图谱查询（带超时）
  const graphQueryPromise = (async () => {
    // 并行执行多个图谱查询
    const [conflicts, complements, related] = await Promise.all([
      withTimeout(findConflictingArticles(articleIds), timeoutMs, []),
      withTimeout(findComplementArticles(articleIds), timeoutMs, []),
      withTimeout(findRelatedArticles(articleIds), timeoutMs, []),
    ]);

    // 分类：己方支持 vs 对方可能引用
    const conflictSourceIds = new Set(conflicts.map(c => c.source.id));
    const complementSourceIds = new Set(complements.map(c => c.source.id));

    // 己方支持法条 = 关键词结果 + 补充关系
    const supportingArticles: LawArticleWithRelations[] = [
      ...keywordResults,
      ...complements.flatMap(c => [c.source, c.target]),
    ];

    // 对方可能引用 = 冲突关系的源头 + 相关法条
    const opposingArticles: LawArticleWithRelations[] = [
      ...conflicts.map(c => c.source),
      ...related.filter(a => !articleIds.includes(a.id)),
    ];

    // 去重
    const uniqueSupporting = Array.from(
      new Map(supportingArticles.map(a => [a.id, a])).values()
    ).filter(a => !articleIds.includes(a.id) || articleIds.includes(a.id));

    // 发现攻击路径
    const attackPaths = includeAttackPaths
      ? await discoverAttackPaths(uniqueSupporting, opposingArticles)
      : [];

    return {
      conflicts,
      complements,
      related,
      supportingArticles: uniqueSupporting,
      opposingArticles: Array.from(
        new Map(opposingArticles.map(a => [a.id, a])).values()
      ),
      attackPaths,
    };
  })();

  // 等待图谱查询结果（带超时）
  let graphData;
  try {
    graphData = await withTimeout(graphQueryPromise, timeoutMs, null);
  } catch (error) {
    logger.error('图谱查询异常:', error);
    graphData = null;
  }

  // 4. 构建结果
  if (!graphData) {
    // 图谱查询超时或失败，返回关键词结果
    return {
      keywordResults,
      supportingArticles: [],
      opposingArticles: [],
      conflictRelations: [],
      complementRelations: [],
      attackPaths: [],
      graphAnalysisCompleted: false,
      sourceAttribution: {
        keyword: true,
        graph: false,
      },
    };
  }

  return {
    keywordResults,
    supportingArticles: graphData.supportingArticles.slice(0, 5),
    opposingArticles: graphData.opposingArticles.slice(0, 5),
    conflictRelations: graphData.conflicts,
    complementRelations: graphData.complements,
    attackPaths: graphData.attackPaths,
    graphAnalysisCompleted: true,
    sourceAttribution: {
      keyword: true,
      graph: true,
    },
  };
}

/**
 * 格式化图谱分析结果为 Prompt 注入文本
 */
export function formatGraphAnalysisForPrompt(
  result: GraphEnhancedSearchResult
): string {
  const lines: string[] = [];

  lines.push('【法条关系图谱分析】');

  if (!result.graphAnalysisCompleted) {
    lines.push('（图谱分析未完成，仅基于关键词检索）');
    return lines.join('\n');
  }

  // 原告方支持法条
  if (result.supportingArticles.length > 0) {
    lines.push('己方支持法条:');
    result.supportingArticles.forEach(article => {
      lines.push(`- ${article.lawName}第${article.articleNumber}条`);
    });
  }

  // 被告方可能引用法条
  if (result.opposingArticles.length > 0) {
    lines.push('对方可能引用的法条:');
    result.opposingArticles.forEach(article => {
      lines.push(`- ${article.lawName}第${article.articleNumber}条`);
    });
  }

  // 冲突关系
  if (result.conflictRelations.length > 0) {
    lines.push('冲突关系（需特别注意）:');
    result.conflictRelations.forEach(rel => {
      lines.push(
        `- ${rel.source.lawName}第${rel.source.articleNumber}条 ↔ ${rel.target.lawName}第${rel.target.articleNumber}条`
      );
    });
  }

  // 补充关系
  if (result.complementRelations.length > 0) {
    lines.push('补充关系（建议同时引用）:');
    result.complementRelations.forEach(rel => {
      lines.push(
        `- ${rel.source.lawName}第${rel.source.articleNumber}条 → ${rel.target.lawName}第${rel.target.articleNumber}条`
      );
    });
  }

  // 攻击路径
  if (result.attackPaths.length > 0) {
    lines.push('攻击路径建议:');
    result.attackPaths.forEach(path => {
      lines.push(`- ${path.explanation}`);
    });
  }

  return lines.join('\n');
}
