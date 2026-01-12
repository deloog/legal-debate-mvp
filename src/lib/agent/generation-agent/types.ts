// GenerationAgent类型定义

import { CaseInfo } from '@/types/debate';
import type { LawArticle } from '@prisma/client';

/**
 * 文书类型
 */
export type DocumentType = 'complaint' | 'answer' | 'evidence' | 'appeal';

/**
 * 文书模板
 */
export interface DocumentTemplate {
  id: string;
  type: DocumentType;
  name: string;
  content: string;
  placeholders: string[];
}

/**
 * 生成选项
 */
export interface GenerationOptions {
  includeLegalBasis?: boolean;
  includeEvidence?: boolean;
  includeSummary?: boolean;
  format?: 'legal' | 'general';
  language?: 'zh-CN' | 'en-US';
}

/**
 * 生成输入
 */
export interface GenerationInput {
  type: DocumentType | 'debate';
  caseInfo: CaseInfo;
  lawArticles?: LawArticle[];
  template?: DocumentTemplate;
  options?: GenerationOptions;
}

/**
 * 生成元数据
 */
export interface GenerationMetadata {
  generatedAt: string;
  generatedBy: string;
  generationTime: number;
  aiProvider?: string;
  templateId?: string;
  wordCount: number;
  qualityScore: number;
}

/**
 * 生成输出
 */
export interface GenerationOutput {
  content: string;
  type: DocumentType | 'debate';
  qualityScore: number;
  metadata: GenerationMetadata;
}

/**
 * 流式生成配置
 */
export interface StreamConfig {
  chunkSize: number;
  delayMs: number;
  format: 'sse' | 'json';
  maxChunks?: number;
}

/**
 * SSE消息格式
 */
export interface SSEMessage {
  data: string;
  event?: 'chunk' | 'done' | 'error';
  id?: string;
  retry?: number;
}

/**
 * 内容优化选项
 */
export interface OptimizationOptions {
  clarityLevel: 'low' | 'medium' | 'high';
  logicCheck: boolean;
  formatStandard: 'legal' | 'general';
  maxLength?: number;
}

/**
 * 优化结果
 */
export interface OptimizationResult {
  optimizedContent: string;
  originalScore: number;
  optimizedScore: number;
  improvements: string[];
}

/**
 * GenerationAgent配置
 */
export interface GenerationAgentConfig {
  defaultTemplate?: string;
  defaultFormat: 'legal' | 'general';
  enableStream: boolean;
  streamChunkSize: number;
  streamDelayMs: number;
  autoOptimize: boolean;
  optimizationLevel: 'low' | 'medium' | 'high';
  aiProvider: string;
  temperature: number;
  maxTokens: number;
}

/**
 * 文书生成配置
 */
export interface DocumentGenerationConfig {
  documentType: DocumentType;
  template?: string;
  format: 'legal' | 'general';
  includeHeader: boolean;
  includeFooter: boolean;
  dateFormat: 'zh-CN' | 'en-US' | 'ISO';
}

/**
 * 辩论生成配置
 */
export interface DebateGenerationConfig {
  balanceStrictness: 'low' | 'medium' | 'high';
  includeLegalAnalysis: boolean;
  maxArgumentsPerSide: number;
  qualityThreshold: number;
}

/**
 * 质量评分标准
 */
export interface QualityMetrics {
  clarity: number;
  logic: number;
  completeness: number;
  format: number;
  overall: number;
}

/**
 * 内容质量评估结果
 */
export interface QualityAssessment {
  metrics: QualityMetrics;
  passed: boolean;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  suggestions: string[];
}

/**
 * 默认配置
 */
export const DEFAULT_GENERATION_CONFIG: GenerationAgentConfig = {
  defaultFormat: 'legal',
  enableStream: true,
  streamChunkSize: 200,
  streamDelayMs: 100,
  autoOptimize: true,
  optimizationLevel: 'medium',
  aiProvider: 'deepseek',
  temperature: 0.7,
  maxTokens: 2000,
};

/**
 * 默认流式配置
 */
export const DEFAULT_STREAM_CONFIG: StreamConfig = {
  chunkSize: 200,
  delayMs: 100,
  format: 'sse',
};

/**
 * 默认优化选项
 */
export const DEFAULT_OPTIMIZATION_OPTIONS: OptimizationOptions = {
  clarityLevel: 'medium',
  logicCheck: true,
  formatStandard: 'legal',
};
