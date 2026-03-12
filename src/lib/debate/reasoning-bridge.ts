/**
 * 辩论推理桥接层
 *
 * 连接辩论系统与知识图谱推理引擎，
 * 根据辩论涉及的法条运行推理规则，
 * 输出可注入 Prompt 的推理分析文本。
 */

import { prisma } from '@/lib/db/prisma';
import { VerificationStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { RuleEngine } from '@/lib/knowledge-graph/reasoning/rule-engine';
import { TransitiveSupersessionRule } from '@/lib/knowledge-graph/reasoning/rules/transitive-supersession-rule';
import { ConflictPropagationRule } from '@/lib/knowledge-graph/reasoning/rules/conflict-propagation-rule';
import { CompletionChainRule } from '@/lib/knowledge-graph/reasoning/rules/completion-chain-rule';
import type {
  ReasoningContext,
  InferenceResult,
  ReasoningExecutionResult,
  ArticleNode,
  ArticleRelation,
} from '@/lib/knowledge-graph/reasoning/types';
import { RuleType } from '@/lib/knowledge-graph/reasoning/types';

/** 推理引擎执行超时（毫秒） */
const REASONING_TIMEOUT_MS = 2000;

/** 关系类型中文标签 */
const RELATION_TYPE_LABELS: Record<string, string> = {
  SUPERSEDES: '替代',
  SUPERSEDED_BY: '被替代',
  CONFLICTS: '冲突',
  COMPLETES: '补全',
  COMPLETED_BY: '被补全',
  IMPLEMENTS: '实施',
  IMPLEMENTED_BY: '被实施',
  CITES: '引用',
  CITED_BY: '被引用',
  RELATED: '相关',
};

/** 推理规则中文名 */
const RULE_LABELS: Record<RuleType, string> = {
  [RuleType.TRANSITIVE_SUPERSESSION]: '传递性替代',
  [RuleType.CONFLICT_PROPAGATION]: '冲突传播',
  [RuleType.COMPLETION_CHAIN]: '补全关系链',
};

/**
 * 创建已配置三条规则的推理引擎
 */
function createConfiguredRuleEngine(): RuleEngine {
  const engine = new RuleEngine();
  engine.registerRule(new TransitiveSupersessionRule());
  engine.registerRule(new ConflictPropagationRule());
  engine.registerRule(new CompletionChainRule());
  return engine;
}

/**
 * 从数据库加载法条节点和关系，构建推理上下文
 */
async function buildReasoningContext(
  articleIds: string[],
  sourceArticleId: string
): Promise<ReasoningContext | null> {
  if (articleIds.length === 0) return null;

  try {
    // 批量加载法条
    const articles = await prisma.lawArticle.findMany({
      where: { id: { in: articleIds } },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        status: true,
        effectiveDate: true,
      },
    });

    // 加载法条之间的关系
    const relations = await prisma.lawArticleRelation.findMany({
      where: {
        OR: [
          { sourceId: { in: articleIds } },
          { targetId: { in: articleIds } },
        ],
        verificationStatus: VerificationStatus.VERIFIED,
      },
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relationType: true,
        strength: true,
      },
    });

    // 构建节点 Map
    const nodes = new Map<string, ArticleNode>();
    for (const a of articles) {
      nodes.set(a.id, {
        id: a.id,
        lawName: a.lawName,
        articleNumber: a.articleNumber,
        status: a.status ?? 'ACTIVE',
        effectiveDate: a.effectiveDate ?? undefined,
      });
    }

    // 构建关系 Map
    const relationsMap = new Map<string, ArticleRelation>();
    for (const r of relations) {
      relationsMap.set(r.id, {
        id: r.id,
        sourceId: r.sourceId,
        targetId: r.targetId,
        relationType: r.relationType,
        strength: Number(r.strength ?? 0.5),
        verificationStatus: 'VERIFIED',
      });
    }

    return {
      nodes,
      relations: relationsMap,
      sourceArticleId,
      maxDepth: 3,
      visited: new Set<string>(),
    };
  } catch (error) {
    logger.error(
      '构建推理上下文失败',
      error instanceof Error ? error : undefined,
      {
        articleIds: articleIds.slice(0, 5),
      }
    );
    return null;
  }
}

/**
 * 对辩论涉及的法条执行推理分析
 *
 * @param articleIds 辩论相关法条 ID 列表（不超过 20 条）
 * @param sourceArticleId 主要法条 ID（作为推理起点）
 * @returns 推理执行结果，超时或失败时返回 null
 */
export async function runDebateReasoning(
  articleIds: string[],
  sourceArticleId: string
): Promise<ReasoningExecutionResult | null> {
  if (articleIds.length === 0) return null;

  const safeIds = articleIds.slice(0, 20);

  const reasoningPromise = (async () => {
    const context = await buildReasoningContext(safeIds, sourceArticleId);
    if (!context) return null;

    const engine = createConfiguredRuleEngine();
    return engine.runReasoning(context, {
      maxDepth: 3,
      minConfidence: 0.3,
      includeMediumConfidence: true,
      includeLowConfidence: false,
    });
  })();

  // 带超时保护
  return Promise.race([
    reasoningPromise,
    new Promise<null>(resolve =>
      setTimeout(() => {
        logger.warn('辩论推理超时', { articleCount: safeIds.length });
        resolve(null);
      }, REASONING_TIMEOUT_MS)
    ),
  ]);
}

/**
 * 将推理结果格式化为可注入 Prompt 的文本
 *
 * 只包含置信度 >= 0.5 的推断，最多输出 5 条
 */
export function formatReasoningForPrompt(
  result: ReasoningExecutionResult | null
): string {
  if (!result || result.inferences.length === 0) return '';

  const highConfidenceInferences = result.inferences
    .filter(inf => inf.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  if (highConfidenceInferences.length === 0) return '';

  const lines: string[] = [];
  lines.push('## 法条推理链分析');
  lines.push('（以下为基于知识图谱推理引擎的自动分析，置信度 ≥ 50%）\n');

  for (const inf of highConfidenceInferences) {
    const ruleName = RULE_LABELS[inf.ruleType] ?? inf.ruleType;
    const relationLabel =
      RELATION_TYPE_LABELS[inf.inferredRelation] ?? inf.inferredRelation;
    const confidencePct = Math.round(inf.confidence * 100);
    lines.push(
      `- 【${ruleName}】${inf.explanation}（推断关系：${relationLabel}，置信度 ${confidencePct}%）`
    );
  }

  if (result.summary.warnings.length > 0) {
    lines.push('\n**推理警告**：');
    result.summary.warnings.forEach(w => lines.push(`- ${w}`));
  }

  return lines.join('\n');
}

/**
 * 提取关键推理结论（用于前端展示）
 */
export function extractKeyInferences(
  result: ReasoningExecutionResult | null,
  limit = 5
): InferenceResult[] {
  if (!result) return [];
  return result.inferences
    .filter(inf => inf.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}
