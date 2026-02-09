/**
 * 关系发现类型定义
 * 定义规则引擎使用的数据结构
 */

import { RelationType } from '@prisma/client';

/**
 * 引用关系检测结果
 */
export interface CitesRelation {
  /** 被引用的法律名称 */
  lawName: string;
  /** 被引用的条款号 */
  articleNumber: string;
  /** 证据文本（匹配到的原文） */
  evidence: string;
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * 层级关系检测结果
 */
export interface HierarchicalRelation {
  /** 上位法名称 */
  parentLawName: string;
  /** 关系类型 */
  relationType: 'IMPLEMENTS';
  /** 置信度 (0-1) */
  confidence: number;
  /** 证据文本 */
  evidence?: string;
}

/**
 * 冲突关系检测结果
 */
export interface ConflictRelation {
  /** 冲突的法律名称 */
  targetLawName: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 证据文本 */
  evidence?: string;
}

/**
 * 替代关系检测结果
 */
export interface SupersedesRelation {
  /** 源法条ID */
  sourceId: string;
  /** 目标法条ID */
  targetId: string;
  /** 关系类型 */
  relationType: RelationType;
  /** 置信度 (0-1) */
  confidence: number;
  /** 证据文本 */
  evidence: string;
}

/**
 * 关系检测结果汇总
 */
export interface DetectionResult {
  /** 引用关系列表 */
  cites: CitesRelation[];
  /** 层级关系列表 */
  hierarchical: HierarchicalRelation[];
  /** 冲突关系列表 */
  conflicts: ConflictRelation[];
}

/**
 * 正则模式匹配结果
 */
export interface PatternMatch {
  /** 匹配的完整文本 */
  fullMatch: string;
  /** 捕获组1（通常是法律名称） */
  group1?: string;
  /** 捕获组2（通常是条款号） */
  group2?: string;
  /** 匹配位置 */
  index: number;
}

/**
 * 案例推导 - 共现关系
 */
export interface CoOccurrenceRelation {
  /** 源法条ID */
  sourceId: string;
  /** 目标法条ID */
  targetId: string;
  /** 关系类型 */
  relationType: RelationType;
  /** 关系强度 (0-1) */
  strength: number;
  /** 置信度 (0-1) */
  confidence: number;
  /** 发现方式 */
  discoveryMethod: string;
  /** 证据描述 */
  evidence: string;
}

/**
 * 案例推导 - 使用模式
 */
export interface UsagePattern {
  /** 法条ID */
  articleId: string;
  /** 频繁一起使用的法条列表 */
  frequentlyUsedWith: Array<{
    /** 关联法条ID */
    articleId: string;
    /** 共现频率 */
    frequency: number;
    /** 典型使用顺序 */
    typicalOrder: 'before' | 'after';
  }>;
}

/**
 * 共现统计信息
 */
export interface CoOccurrenceStats {
  /** 总共现对数 */
  totalPairs: number;
  /** 平均共现次数 */
  avgCoOccurrence: number;
  /** 最大共现次数 */
  maxCoOccurrence: number;
  /** 最小共现次数 */
  minCoOccurrence: number;
}

/**
 * 频繁模式
 */
export interface FrequentPattern {
  /** 法条ID列表 */
  articleIds: string[];
  /** 出现频率 */
  frequency: number;
  /** 支持度 */
  support: number;
}
