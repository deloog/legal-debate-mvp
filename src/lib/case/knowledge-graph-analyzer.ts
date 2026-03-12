/**
 * 案件知识图谱分析服务
 *
 * 读取案件关联的法条（legal_references），
 * 分析法条之间的冲突、历史沿革（替代链）、补充推荐，
 * 并构建可供前端渲染的图谱数据。
 */

import { prisma } from '@/lib/db';
import { VerificationStatus, RelationType } from '@prisma/client';
import { logger } from '@/lib/logger';
import { RuleEngine } from '@/lib/knowledge-graph/reasoning/rule-engine';
import { TransitiveSupersessionRule } from '@/lib/knowledge-graph/reasoning/rules/transitive-supersession-rule';
import { ConflictPropagationRule } from '@/lib/knowledge-graph/reasoning/rules/conflict-propagation-rule';
import { CompletionChainRule } from '@/lib/knowledge-graph/reasoning/rules/completion-chain-rule';
import type { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import type {
  ArticleNode,
  ArticleRelation,
  InferenceResult,
} from '@/lib/knowledge-graph/reasoning/types';

/** 冲突关系 */
export interface ConflictInfo {
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  description: string;
}

/** 替代沿革链条 */
export interface EvolutionChainItem {
  articleId: string;
  articleName: string;
  isSuperseded: boolean;
  supersededBy?: string;
}

/** 案件图谱分析结果 */
export interface CaseLawGraphResult {
  /** 涉案法条 ID 列表 */
  articleIds: string[];
  /** 法条之间的冲突 */
  conflicts: ConflictInfo[];
  /** 历史沿革（替代链） */
  evolutionChain: EvolutionChainItem[];
  /** 推荐补充的法条 ID */
  recommendedArticleIds: string[];
  /** 推理引擎分析结论 */
  keyInferences: InferenceResult[];
  /** 图谱可视化数据 */
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  /** 是否有足够的数据（false 时提示用户关联法条） */
  hasData: boolean;
}

/** 节点颜色：按角色区分 */
const NODE_COLORS: Record<string, string> = {
  case_article: '#3B82F6', // 蓝色：案件涉及法条
  conflict: '#EF4444',     // 红色：冲突法条
  supplement: '#10B981',  // 绿色：补充法条
  superseded: '#9CA3AF',  // 灰色：已被替代
};

export class CaseKnowledgeGraphAnalyzer {
  /**
   * 分析案件的法条知识图谱
   */
  static async analyze(caseId: string): Promise<CaseLawGraphResult> {
    const empty: CaseLawGraphResult = {
      articleIds: [],
      conflicts: [],
      evolutionChain: [],
      recommendedArticleIds: [],
      keyInferences: [],
      graphData: { nodes: [], links: [] },
      hasData: false,
    };

    try {
      // 1. 从 legal_references 找到涉案法条
      const articleIds = await this.findCaseArticleIds(caseId);
      if (articleIds.length === 0) return empty;

      // 2. 并行分析：冲突 + 替代链 + 推理引擎
      const [conflicts, evolutionItems, relationsData] = await Promise.all([
        this.findConflicts(articleIds),
        this.buildEvolutionChain(articleIds),
        this.loadRelationsData(articleIds),
      ]);

      // 3. 运行推理引擎
      const keyInferences = await this.runReasoning(articleIds, relationsData);

      // 4. 从补全链推断中提取推荐补充法条
      const completionInferences = keyInferences.filter(
        inf => inf.inferredRelation === RelationType.COMPLETES
      );
      const recommendedArticleIds = [
        ...new Set(completionInferences.map(inf => inf.targetArticleId)),
      ].filter(id => !articleIds.includes(id));

      // 5. 构建图谱可视化数据
      const graphData = await this.buildGraphData(
        articleIds,
        conflicts,
        recommendedArticleIds
      );

      return {
        articleIds,
        conflicts,
        evolutionChain: evolutionItems,
        recommendedArticleIds: recommendedArticleIds.slice(0, 5),
        keyInferences: keyInferences.slice(0, 8),
        graphData,
        hasData: true,
      };
    } catch (error) {
      logger.error(
        '案件知识图谱分析失败',
        error instanceof Error ? error : undefined,
        { caseId }
      );
      return empty;
    }
  }

  /**
   * 从 legal_references 中提取并匹配法条 ID
   * legal_references 无直接外键，通过 source(法律名) + articleNumber 软匹配
   */
  private static async findCaseArticleIds(caseId: string): Promise<string[]> {
    const refs = await prisma.legalReference.findMany({
      where: { caseId },
      select: { source: true, articleNumber: true },
    });

    if (refs.length === 0) return [];

    // 批量软匹配
    const ids: string[] = [];
    const BATCH = 20;

    for (let i = 0; i < refs.length; i += BATCH) {
      const batch = refs.slice(i, i + BATCH);
      const articles = await prisma.lawArticle.findMany({
        where: {
          OR: batch.map(ref => ({
            lawName: { contains: ref.source, mode: 'insensitive' as const },
            ...(ref.articleNumber
              ? { articleNumber: ref.articleNumber }
              : {}),
          })),
        },
        select: { id: true },
        take: BATCH * 3,
      });
      ids.push(...articles.map(a => a.id));
    }

    return [...new Set(ids)].slice(0, 30);
  }

  /**
   * 查找法条之间的冲突关系
   */
  private static async findConflicts(
    articleIds: string[]
  ): Promise<ConflictInfo[]> {
    const relations = await prisma.lawArticleRelation.findMany({
      where: {
        OR: [
          { sourceId: { in: articleIds }, relationType: RelationType.CONFLICTS },
          { targetId: { in: articleIds }, relationType: RelationType.CONFLICTS },
        ],
        verificationStatus: VerificationStatus.VERIFIED,
      },
      include: {
        source: { select: { id: true, lawName: true, articleNumber: true } },
        target: { select: { id: true, lawName: true, articleNumber: true } },
      },
      take: 20,
    });

    return relations.map(rel => ({
      sourceId: rel.source.id,
      sourceName: `${rel.source.lawName}第${rel.source.articleNumber}条`,
      targetId: rel.target.id,
      targetName: `${rel.target.lawName}第${rel.target.articleNumber}条`,
      description: `两条法律规定存在冲突，适用时需注意优先级`,
    }));
  }

  /**
   * 构建历史沿革链（替代关系）
   */
  private static async buildEvolutionChain(
    articleIds: string[]
  ): Promise<EvolutionChainItem[]> {
    const relations = await prisma.lawArticleRelation.findMany({
      where: {
        OR: [
          { sourceId: { in: articleIds }, relationType: RelationType.SUPERSEDES },
          { targetId: { in: articleIds }, relationType: RelationType.SUPERSEDES },
          {
            sourceId: { in: articleIds },
            relationType: RelationType.SUPERSEDED_BY,
          },
        ],
        verificationStatus: VerificationStatus.VERIFIED,
      },
      include: {
        source: { select: { id: true, lawName: true, articleNumber: true } },
        target: { select: { id: true, lawName: true, articleNumber: true } },
      },
      take: 20,
    });

    const items = new Map<string, EvolutionChainItem>();

    for (const rel of relations) {
      if (rel.relationType === RelationType.SUPERSEDES) {
        // source 替代了 target → target 是旧法
        items.set(rel.target.id, {
          articleId: rel.target.id,
          articleName: `${rel.target.lawName}第${rel.target.articleNumber}条`,
          isSuperseded: true,
          supersededBy: `${rel.source.lawName}第${rel.source.articleNumber}条`,
        });
        if (!items.has(rel.source.id)) {
          items.set(rel.source.id, {
            articleId: rel.source.id,
            articleName: `${rel.source.lawName}第${rel.source.articleNumber}条`,
            isSuperseded: false,
          });
        }
      }
    }

    return Array.from(items.values());
  }

  /**
   * 加载法条关系数据，用于推理引擎
   */
  private static async loadRelationsData(articleIds: string[]): Promise<{
    nodes: Map<string, ArticleNode>;
    relations: Map<string, ArticleRelation>;
  }> {
    const [articles, relations] = await Promise.all([
      prisma.lawArticle.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, lawName: true, articleNumber: true, status: true, effectiveDate: true },
      }),
      prisma.lawArticleRelation.findMany({
        where: {
          OR: [
            { sourceId: { in: articleIds } },
            { targetId: { in: articleIds } },
          ],
          verificationStatus: VerificationStatus.VERIFIED,
        },
        select: { id: true, sourceId: true, targetId: true, relationType: true, strength: true },
        take: 200,
      }),
    ]);

    const nodes = new Map<string, ArticleNode>(
      articles.map(a => [
        a.id,
        {
          id: a.id,
          lawName: a.lawName,
          articleNumber: a.articleNumber,
          status: a.status ?? 'ACTIVE',
          effectiveDate: a.effectiveDate ?? undefined,
        },
      ])
    );

    const relationsMap = new Map<string, ArticleRelation>(
      relations.map(r => [
        r.id,
        {
          id: r.id,
          sourceId: r.sourceId,
          targetId: r.targetId,
          relationType: r.relationType,
          strength: Number(r.strength ?? 0.5),
          verificationStatus: 'VERIFIED',
        },
      ])
    );

    return { nodes, relations: relationsMap };
  }

  /**
   * 运行推理引擎
   */
  private static async runReasoning(
    articleIds: string[],
    relationsData: { nodes: Map<string, ArticleNode>; relations: Map<string, ArticleRelation> }
  ): Promise<InferenceResult[]> {
    if (articleIds.length === 0) return [];

    try {
      const engine = new RuleEngine();
      engine.registerRule(new TransitiveSupersessionRule());
      engine.registerRule(new ConflictPropagationRule());
      engine.registerRule(new CompletionChainRule());

      const context = {
        nodes: relationsData.nodes,
        relations: relationsData.relations,
        sourceArticleId: articleIds[0],
        maxDepth: 3,
        visited: new Set<string>(),
      };

      const result = await engine.runReasoning(context, {
        maxDepth: 3,
        minConfidence: 0.3,
        includeMediumConfidence: true,
        includeLowConfidence: false,
      });

      return result.inferences
        .filter(inf => inf.confidence >= 0.4)
        .sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      logger.error('案件推理引擎执行失败', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * 构建图谱可视化数据
   */
  private static async buildGraphData(
    articleIds: string[],
    conflicts: ConflictInfo[],
    recommendedIds: string[]
  ): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
    // 需要加载的所有法条 ID
    const allIds = [
      ...new Set([
        ...articleIds,
        ...conflicts.flatMap(c => [c.sourceId, c.targetId]),
        ...recommendedIds,
      ]),
    ].slice(0, 50);

    const [articles, relations] = await Promise.all([
      prisma.lawArticle.findMany({
        where: { id: { in: allIds } },
        select: { id: true, lawName: true, articleNumber: true, category: true },
      }),
      prisma.lawArticleRelation.findMany({
        where: {
          OR: [
            { sourceId: { in: allIds }, targetId: { in: allIds } },
          ],
          verificationStatus: VerificationStatus.VERIFIED,
        },
        select: {
          sourceId: true,
          targetId: true,
          relationType: true,
          strength: true,
          confidence: true,
        },
        take: 100,
      }),
    ]);

    const conflictIds = new Set([
      ...conflicts.map(c => c.sourceId),
      ...conflicts.map(c => c.targetId),
    ]);
    const recommendedSet = new Set(recommendedIds);

    const nodes: GraphNode[] = articles.map(a => ({
      id: a.id,
      lawName: a.lawName,
      articleNumber: a.articleNumber,
      category: articleIds.includes(a.id)
        ? NODE_COLORS.case_article
        : conflictIds.has(a.id)
          ? NODE_COLORS.conflict
          : recommendedSet.has(a.id)
            ? NODE_COLORS.supplement
            : a.category,
      level: articleIds.includes(a.id) ? 0 : 1,
    }));

    const links: GraphLink[] = relations.map(r => ({
      source: r.sourceId,
      target: r.targetId,
      relationType: r.relationType,
      strength: Number(r.strength ?? 0.5),
      confidence: Number(r.confidence ?? 0.5),
    }));

    return { nodes, links };
  }
}
