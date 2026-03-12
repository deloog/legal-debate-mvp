// Agent降级策略配置
// 为各个Agent定义降级处理逻辑

import type { AgentContext } from '../../../types/agent';
import { logger } from '@/lib/logger';

// =============================================================================
// 降级策略返回类型定义
// =============================================================================

/**
 * 文档分析器降级返回类型
 */
export interface DocAnalyzerFallbackResult {
  summary: string;
  keyPoints: string[];
  analysis: {
    fallback: boolean;
    method: string;
    confidence: number;
    warnings: string[];
  };
}

/**
 * 证据分析器降级返回类型
 */
export interface EvidenceAnalyzerFallbackResult {
  credibility: string;
  strength: string;
  relevance: string;
  notes: string;
  fallback: boolean;
  warnings: string[];
}

/**
 * 研究员降级返回类型
 */
export interface ResearcherFallbackResult {
  sources: unknown[];
  summary: string;
  alternativeAction: string;
  fallback: boolean;
  warnings: string[];
}

/**
 * 策略师降级返回类型
 */
export interface StrategistFallbackResult {
  strategy: string;
  priority: string;
  keyActions: string[];
  recommendations: string[];
  fallback: boolean;
  warnings: string[];
}

/**
 * 撰写人降级返回类型
 */
export interface WriterFallbackResult {
  content: string;
  format: string;
  template: boolean;
  warnings: string[];
  fallback: boolean;
}

/**
 * 审查员降级返回类型
 */
export interface ReviewerFallbackResult {
  issues: unknown[];
  score: number;
  status: string;
  checklist: string[];
  recommendation: string;
  fallback: boolean;
  warnings: string[];
}

/**
 * 调度器降级返回类型
 */
export interface SchedulerFallbackResult {
  schedule: unknown[];
  optimization: string;
  notes: string;
  fallback: boolean;
  warnings: string[];
}

/**
 * 汇报人降级返回类型
 */
export interface ReporterFallbackResult {
  summary: string;
  metrics: Record<string, unknown>;
  recommendations: string[];
  fallback: boolean;
  warnings: string[];
}

/**
 * 总结员降级返回类型
 */
export interface SummarizerFallbackResult {
  summary: string;
  keyPoints: string[];
  fallback: boolean;
  warnings: string[];
}

/**
 * 协调器降级返回类型
 */
export interface CoordinatorFallbackResult {
  plan: unknown[];
  status: string;
  recommendation: string;
  fallback: boolean;
  warnings: string[];
}

// =============================================================================
// 降级策略类型定义
// =============================================================================

/**
 * 文档分析器降级策略
 * 当AI分析失败时，使用基础规则提取
 */
export function createDocAnalyzerFallbackStrategy() {
  return async (error: unknown): Promise<DocAnalyzerFallbackResult> => {
    logger.warn('[DocAnalyzer] AI分析失败，使用降级策略:', error);

    // 返回基础分析结果
    return {
      summary:
        '文档已接收，但AI分析服务暂时不可用。系统将使用基础规则进行分析。',
      keyPoints: [
        '文档结构已识别',
        '主要法律条款已提取',
        '建议人工复核分析结果',
      ],
      analysis: {
        fallback: true,
        method: 'RULE_BASED',
        confidence: 0.5,
        warnings: ['AI服务不可用，使用基础规则'],
      },
    };
  };
}

/**
 * 证据分析器降级策略
 * 使用简化的证据评估
 */
export function createEvidenceAnalyzerFallbackStrategy() {
  return async (error: unknown): Promise<EvidenceAnalyzerFallbackResult> => {
    logger.warn('[EvidenceAnalyzer] 证据分析失败，使用降级策略:', error);

    return {
      credibility: '未知',
      strength: '中等',
      relevance: '需要人工评估',
      notes: 'AI评估服务暂不可用，建议人工审查证据材料',
      fallback: true,
      warnings: ['AI评估服务不可用'],
    };
  };
}

/**
 * 研究员降级策略
 * 使用本地知识库
 */
export function createResearcherFallbackStrategy() {
  return async (error: unknown): Promise<ResearcherFallbackResult> => {
    logger.warn('[Researcher] 法律检索失败，使用降级策略:', error);

    return {
      sources: [],
      summary: 'AI法律检索服务暂不可用，建议使用传统法律数据库进行查询',
      alternativeAction: '建议使用中国裁判文书网、北大法宝等传统数据库',
      fallback: true,
      warnings: ['AI检索服务不可用'],
    };
  };
}

/**
 * 策略师降级策略
 * 返回基础策略建议
 */
export function createStrategistFallbackStrategy() {
  return async (error: unknown): Promise<StrategistFallbackResult> => {
    logger.warn('[Strategist] 策略生成失败，使用降级策略:', error);

    return {
      strategy: '基础策略',
      priority: '需要人工制定详细策略',
      keyActions: [
        '1. 仔细分析案件事实',
        '2. 梳理法律适用问题',
        '3. 准备充分的证据材料',
        '4. 考虑替代解决方案',
      ],
      recommendations: [
        'AI策略生成服务暂不可用',
        '建议咨询专业律师制定详细策略',
      ],
      fallback: true,
      warnings: ['AI策略服务不可用'],
    };
  };
}

/**
 * 撰写人降级策略
 * 返回模板化文书
 */
export function createWriterFallbackStrategy() {
  return async (
    error: unknown,
    context: AgentContext
  ): Promise<WriterFallbackResult> => {
    logger.warn('[Writer] 文书生成失败，使用降级策略:', error);

    const caseType = context.data?.caseType || '通用';
    return {
      content: `[${caseType}文书模板]\n\n注意：AI文书生成服务暂不可用，以下为基础模板，请根据实际情况修改。\n\n[请在人工协助下完成详细文书撰写]`,
      format: 'TEXT',
      template: true,
      warnings: ['AI文书生成服务不可用', '需要人工完成详细撰写'],
      fallback: true,
    };
  };
}

/**
 * 审查员降级策略
 * 提供基础检查清单
 */
export function createReviewerFallbackStrategy() {
  return async (error: unknown): Promise<ReviewerFallbackResult> => {
    logger.warn('[Reviewer] 文书审查失败，使用降级策略:', error);

    return {
      issues: [],
      score: 0.5,
      status: '需要人工审查',
      checklist: [
        '检查法律条文引用准确性',
        '检查事实陈述一致性',
        '检查逻辑论证完整性',
        '检查格式规范',
      ],
      recommendation: 'AI审查服务暂不可用，建议由资深律师进行人工审查',
      fallback: true,
      warnings: ['AI审查服务不可用'],
    };
  };
}

/**
 * 调度器降级策略
 * 使用基础优先级排序
 */
export function createSchedulerFallbackStrategy() {
  return async (error: unknown): Promise<SchedulerFallbackResult> => {
    logger.warn('[Scheduler] 任务调度失败，使用降级策略:', error);

    return {
      schedule: [],
      optimization: '基础优先级',
      notes: 'AI任务优化服务暂不可用，使用基础调度',
      fallback: true,
      warnings: ['AI调度优化服务不可用'],
    };
  };
}

/**
 * 汇报人降级策略
 * 返回基础统计报告
 */
export function createReporterFallbackStrategy() {
  return async (error: unknown): Promise<ReporterFallbackResult> => {
    logger.warn('[Reporter] 汇报生成失败，使用降级策略:', error);

    return {
      summary: '基础汇报',
      metrics: {},
      recommendations: ['AI汇报生成服务暂不可用，建议人工生成详细报告'],
      fallback: true,
      warnings: ['AI汇报服务不可用'],
    };
  };
}

/**
 * 总结员降级策略
 * 提供基础摘要
 */
export function createSummarizerFallbackStrategy() {
  return async (error: unknown): Promise<SummarizerFallbackResult> => {
    logger.warn('[Summarizer] 总结生成失败，使用降级策略:', error);

    return {
      summary: 'AI总结服务暂不可用',
      keyPoints: ['需要人工总结'],
      fallback: true,
      warnings: ['AI总结服务不可用'],
    };
  };
}

/**
 * 协调器降级策略
 * 使用基础协调逻辑
 */
export function createCoordinatorFallbackStrategy() {
  return async (error: unknown): Promise<CoordinatorFallbackResult> => {
    logger.warn('[Coordinator] 任务协调失败，使用降级策略:', error);

    return {
      plan: [],
      status: '需要人工协调',
      recommendation: 'AI任务协调服务暂不可用，建议人工指定任务执行顺序',
      fallback: true,
      warnings: ['AI协调服务不可用'],
    };
  };
}

// =============================================================================
// 降级策略映射
// =============================================================================

/**
 * 降级策略映射表
 * 根据Agent类型返回对应的降级策略
 */
const FALLBACK_STRATEGIES: Record<
  string,
  () => (
    error: unknown,
    context: AgentContext
  ) => Promise<
    | DocAnalyzerFallbackResult
    | EvidenceAnalyzerFallbackResult
    | ResearcherFallbackResult
    | StrategistFallbackResult
    | WriterFallbackResult
    | ReviewerFallbackResult
    | SchedulerFallbackResult
    | ReporterFallbackResult
    | SummarizerFallbackResult
    | CoordinatorFallbackResult
  >
> = {
  doc_analyzer: createDocAnalyzerFallbackStrategy,
  evidence_analyzer: createEvidenceAnalyzerFallbackStrategy,
  researcher: createResearcherFallbackStrategy,
  strategist: createStrategistFallbackStrategy,
  writer: createWriterFallbackStrategy,
  reviewer: createReviewerFallbackStrategy,
  scheduler: createSchedulerFallbackStrategy,
  reporter: createReporterFallbackStrategy,
  summarizer: createSummarizerFallbackStrategy,
  coordinator: createCoordinatorFallbackStrategy,
};

/**
 * 获取Agent的降级策略
 * @param agentType Agent类型
 * @returns 降级策略函数
 */
export function getFallbackStrategy(
  agentType: string
):
  | ((
      error: unknown,
      context: AgentContext
    ) => Promise<
      | DocAnalyzerFallbackResult
      | EvidenceAnalyzerFallbackResult
      | ResearcherFallbackResult
      | StrategistFallbackResult
      | WriterFallbackResult
      | ReviewerFallbackResult
      | SchedulerFallbackResult
      | ReporterFallbackResult
      | SummarizerFallbackResult
      | CoordinatorFallbackResult
    >)
  | undefined {
  const strategyFactory = FALLBACK_STRATEGIES[agentType];
  return strategyFactory ? strategyFactory() : undefined;
}

/**
 * 检查Agent是否有降级策略
 * @param agentType Agent类型
 * @returns 是否存在降级策略
 */
export function hasFallbackStrategy(agentType: string): boolean {
  return agentType in FALLBACK_STRATEGIES;
}

/**
 * 获取所有支持降级的Agent类型
 * @returns Agent类型列表
 */
export function getAgentsWithFallback(): string[] {
  return Object.keys(FALLBACK_STRATEGIES);
}
