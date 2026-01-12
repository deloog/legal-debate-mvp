/**
 * MemoryAgent - 记忆层Agent类型定义
 * 基于Manus三层记忆架构
 */

import { MemoryType } from '@prisma/client';

/**
 * Memory - 记忆实体
 */
export interface Memory {
  memoryId: string;
  memoryType: MemoryType;
  memoryKey: string;
  memoryValue: unknown;
  importance: number;
  accessCount: number;
  lastAccessedAt: Date;
  expiresAt?: Date;
  compressed: boolean;
  compressionRatio?: number;
  createdAt: Date;
}

/**
 * MemoryWithMetadata - 包含额外元数据的记忆实体
 */
export interface MemoryWithMetadata extends Memory {
  userId: string | null;
  caseId: string | null;
  debateId: string | null;
}

/**
 * KeyInfo - 关键信息
 */
export interface KeyInfo {
  field: string;
  value: unknown;
  importance: number;
}

/**
 * CompressedMemory - 压缩后的记忆
 */
export interface CompressedMemory {
  originalMemory: Memory;
  summary: string;
  keyInfo: KeyInfo[];
  ratio: number;
  originalSize: number;
  compressedSize: number;
}

/**
 * ErrorPattern - 错误模式
 */
export interface ErrorPattern {
  patternId: string;
  errorType: string;
  frequency: number;
  commonCauses: string[];
  rootCause: string;
}

/**
 * PreventionMeasure - 预防措施
 */
export interface PreventionMeasure {
  measureId: string;
  description: string;
  priority: number;
  implementation: string;
  estimatedEffectiveness: number;
}

/**
 * LearningResult - 学习结果
 */
export interface LearningResult {
  learningId: string;
  errorId: string;
  pattern: ErrorPattern;
  learningNotes: string;
  preventionMeasures: PreventionMeasure[];
  knowledgeUpdated: boolean;
  learnedAt: Date;
}

/**
 * StoreMemoryInput - 存储记忆输入
 */
export interface StoreMemoryInput {
  memoryType: MemoryType;
  memoryKey: string;
  memoryValue: unknown;
  importance?: number;
  ttl?: number; // 自定义TTL（秒）
}

/**
 * GetMemoryInput - 获取记忆输入
 */
export interface GetMemoryInput {
  memoryType: MemoryType;
  memoryKey: string;
}

/**
 * CompressMemoryInput - 压缩记忆输入
 */
export interface CompressMemoryInput {
  memoryId: string;
  targetRatio?: number; // 目标压缩比（0-1）
}

/**
 * LearnFromErrorInput - 从错误学习输入
 */
export interface LearnFromErrorInput {
  errorId: string;
  autoUpdateKnowledgeBase?: boolean;
}

/**
 * MemoryStats - 记忆统计信息
 */
export interface MemoryStats {
  workingMemoryCount: number;
  hotMemoryCount: number;
  coldMemoryCount: number;
  totalMemoryCount: number;
  averageImportance: number;
  expiredMemoryCount: number;
  compressedMemoryCount: number;
}

/**
 * CompressionResult - 压缩结果
 */
export interface CompressionResult {
  success: boolean;
  summary?: string;
  keyInfo?: KeyInfo[];
  ratio?: number;
  error?: string;
}

/**
 * MigrationResult - 迁移结果
 */
export interface MigrationResult {
  migratedCount: number;
  skippedCount: number;
  failedCount: number;
  executionTime: number;
}

/**
 * ErrorAnalysis - 错误分析结果
 */
export interface ErrorAnalysis {
  errorId: string;
  errorType: string;
  frequency: number;
  pattern: string;
  suggestedActions: string[];
}
