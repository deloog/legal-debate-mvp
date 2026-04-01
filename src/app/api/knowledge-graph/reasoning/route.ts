/**
 * 知识图谱推理规则API
 *
 * 功能：
 * 1. 执行法条关系推理
 * 2. 返回推断结果和推理摘要
 * 3. 支持自定义推理参数
 */

import { NextRequest, NextResponse } from 'next/server';
import { RuleEngine } from '@/lib/knowledge-graph/reasoning/rule-engine';
import { TransitiveSupersessionRule } from '@/lib/knowledge-graph/reasoning/rules/transitive-supersession-rule';
import { ConflictPropagationRule } from '@/lib/knowledge-graph/reasoning/rules/conflict-propagation-rule';
import { CompletionChainRule } from '@/lib/knowledge-graph/reasoning/rules/completion-chain-rule';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import {
  ArticleNode,
  ArticleRelation,
  ReasoningContext,
  RuleExecutionOptions,
  RuleType,
} from '@/lib/knowledge-graph/reasoning/types';

/**
 * POST请求体接口
 */
interface ReasoningRequest {
  /** 源法条ID */
  sourceArticleId: string;
  /** 法条节点列表 */
  nodes?: ArticleNode[];
  /** 法条关系列表 */
  relations?: ArticleRelation[];
  /** 执行选项 */
  options?: RuleExecutionOptions;
  /** 指定应用的规则类型（可选） */
  ruleTypes?: RuleType[];
}

/**
 * POST /api/knowledge-graph/reasoning
 *
 * 执行法条关系推理
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    let body: ReasoningRequest;
    try {
      body = await request.json();
    } catch {
      logger.warn('推理请求缺少请求体');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_BODY',
            message: '请提供请求体，包含 sourceArticleId 和相关数据',
          },
        },
        { status: 400 }
      );
    }

    // 验证必填字段
    if (!body.sourceArticleId) {
      logger.warn('推理请求缺少 sourceArticleId');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FIELD',
            message: '缺少必填字段：sourceArticleId',
          },
        },
        { status: 400 }
      );
    }

    // 创建规则引擎
    const ruleEngine = new RuleEngine();

    // 注册规则
    ruleEngine.registerRule(new TransitiveSupersessionRule());
    ruleEngine.registerRule(new ConflictPropagationRule());
    ruleEngine.registerRule(new CompletionChainRule());

    // 构建推理上下文
    const nodes = new Map<string, ArticleNode>(
      (body.nodes || []).map(node => [node.id, node])
    );
    const relations = new Map<string, ArticleRelation>(
      (body.relations || []).map(relation => [relation.id, relation])
    );

    const context: ReasoningContext = {
      nodes,
      relations,
      sourceArticleId: body.sourceArticleId,
      maxDepth: body.options?.maxDepth || 5,
      visited: new Set(),
    };

    // 执行推理
    const result = await ruleEngine.runReasoning(
      context,
      body.options,
      body.ruleTypes
    );

    logger.info('推理API调用成功', {
      sourceArticleId: body.sourceArticleId,
      inferenceCount: result.inferences.length,
      executionTimeMs: result.totalExecutionTimeMs,
    });

    // 返回结果
    return NextResponse.json(
      {
        success: true,
        data: {
          sourceArticleId: result.sourceArticleId,
          appliedRules: result.appliedRules,
          inferences: result.inferences,
          summary: result.summary,
          executionTimeMs: result.totalExecutionTimeMs,
        },
      },
      { status: 200 }
    );
  } catch (_error: unknown) {
    const errorMessage = '未知错误';

    logger.error('推理API调用失败', {
      error: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge-graph/reasoning
 *
 * 获取已注册的规则列表
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const ruleEngine = new RuleEngine();

    // 注册规则
    const transitiveRule = new TransitiveSupersessionRule();
    const conflictRule = new ConflictPropagationRule();
    const completionRule = new CompletionChainRule();

    ruleEngine.registerRule(transitiveRule);
    ruleEngine.registerRule(conflictRule);
    ruleEngine.registerRule(completionRule);

    const rules = ruleEngine.getRegisteredRules();

    return NextResponse.json(
      {
        success: true,
        data: {
          rules: rules.map(rule => ({
            type: rule.metadata.type,
            name: rule.metadata.name,
            description: rule.metadata.description,
            priority: rule.metadata.priority,
            enabled: rule.metadata.enabled,
            applicableRelationTypes: rule.metadata.applicableRelationTypes,
          })),
          totalRules: rules.length,
        },
      },
      { status: 200 }
    );
  } catch (_error: unknown) {
    const errorMessage = '未知错误';

    logger.error('获取规则列表失败', {
      error: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
