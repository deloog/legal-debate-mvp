/**
 * 增量分析系统类型定义
 * 实现基于新增资料的增量分析，避免重复分析，提升效率
 */

/**
 * 资料类型
 */
export type MaterialType = "DOCUMENT" | "LAW_ARTICLE" | "EVIDENCE" | "ARGUMENT";

/**
 * 资料接口
 */
export interface Material {
  id: string;
  type: MaterialType;
  content: string;
  fingerprint: string; // 内容哈希
  metadata: {
    source: string;
    uploadTime: Date;
    round?: number; // 所属轮次
    [key: string]: unknown;
  };
}

/**
 * 差异结果
 */
export interface DiffResult {
  added: Material[]; // 新增的资料
  modified: Material[]; // 修改的资料
  deleted: Material[]; // 删除的资料
  unchanged: Material[]; // 未变更的资料
}

/**
 * 增量分析输入
 */
export interface IncrementalAnalysisInput {
  // 历史上下文
  historicalContext: {
    materials: Material[];
    analysisResults: {
      documents?: DocumentAnalysisOutput[];
      lawArticles?: LawArticleApplicabilityResult[];
      evidence?: EvidenceAnalysisResult[];
    };
  };

  // 新增资料
  newMaterials: Material[];

  // 配置选项
  config?: {
    enableDiffDetection?: boolean; // 启用差异检测
    enableIncrementalAnalysis?: boolean; // 启用增量分析
    mergeStrategy?: "append" | "replace" | "merge"; // 合并策略
    conflictResolution?: "new-priority" | "old-priority" | "manual"; // 冲突解决策略
  };
}

/**
 * 文档分析输出（参考DocAnalyzer）
 */
export interface DocumentAnalysisOutput {
  parties: Array<{
    name: string;
    role: "plaintiff" | "defendant" | "other";
    confidence: number;
  }>;
  claims: Array<{
    type: string;
    content: string;
    amount?: number;
    confidence: number;
  }>;
  facts: string[];
  keyDates: Array<{
    date: Date;
    event: string;
    importance: number;
  }>;
  extractedAt: string;
}

/**
 * 法条适用性分析结果（参考ApplicabilityAnalyzer）
 */
export interface LawArticleApplicabilityResult {
  articleId: string;
  lawName: string;
  articleNumber: string;
  applicable: boolean;
  score: number;
  reasons: string[];
  warnings: string[];
}

/**
 * 证据分析结果
 */
export interface EvidenceAnalysisResult {
  evidenceId: string;
  content: string;
  relevance: number; // 相关性 0-1
  strength: number; // 证据强度 0-10
  credibility: number; // 可信度 0-10
  relatedClaims: string[]; // 关联的诉讼请求
  analyzedAt: string;
}

/**
 * 增量分析结果
 */
export interface IncrementalAnalysisResult {
  // 差异检测
  diff: DiffResult;

  // 增量分析结果
  incrementalAnalysis: {
    newDocuments: DocumentAnalysisOutput[];
    newLawArticles: LawArticleApplicabilityResult[];
    newEvidence: EvidenceAnalysisResult[];
  };

  // 合并后的上下文
  mergedContext: {
    materials: Material[];
    analysisResults: {
      documents: DocumentAnalysisOutput[];
      lawArticles: LawArticleApplicabilityResult[];
      evidence: EvidenceAnalysisResult[];
    };
  };

  // 统计信息
  statistics: {
    totalMaterials: number;
    newMaterials: number;
    reusedMaterials: number;
    reuseRate: number; // 复用率
    analysisTime: number;
    timeSaved: number; // 节省的时间
  };
}

/**
 * 上下文合并结果
 */
export interface MergeResult {
  success: boolean;
  mergedContext: {
    materials: Material[];
    analysisResults: {
      documents: DocumentAnalysisOutput[];
      lawArticles: LawArticleApplicabilityResult[];
      evidence: EvidenceAnalysisResult[];
    };
  };
  conflicts: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
    resolution: "new-priority" | "old-priority" | "merged" | "conflict";
  }>;
  warnings: string[];
}

/**
 * 分析类型
 */
export type AnalysisType =
  | "DOCUMENT_ANALYSIS"
  | "LAW_SEARCH"
  | "EVIDENCE_ANALYSIS";

/**
 * 分析任务
 */
export interface AnalysisTask {
  id: string;
  type: AnalysisType;
  material: Material;
  priority: "high" | "medium" | "low";
}

/**
 * 增量分析配置
 */
export interface IncrementalAnalysisConfig {
  // 差异检测配置
  diffDetection: {
    enabled: boolean;
    algorithm: "fingerprint" | "semantic" | "hybrid";
    similarityThreshold: number; // 相似度阈值 0-1
  };

  // 分析配置
  analysis: {
    maxConcurrent: number; // 最大并发分析数
    timeout: number; // 超时时间（毫秒）
    retryCount: number; // 重试次数
  };

  // 合并配置
  merge: {
    strategy: "append" | "replace" | "merge";
    conflictResolution: "new-priority" | "old-priority" | "manual";
    enableConflictDetection: boolean;
  };

  // 缓存配置
  cache: {
    enabled: boolean;
    ttl: number; // 缓存过期时间（秒）
  };
}

/**
 * 默认配置
 */
export const DEFAULT_INCREMENTAL_CONFIG: IncrementalAnalysisConfig = {
  diffDetection: {
    enabled: true,
    algorithm: "fingerprint",
    similarityThreshold: 0.9,
  },
  analysis: {
    maxConcurrent: 5,
    timeout: 60000,
    retryCount: 3,
  },
  merge: {
    strategy: "merge",
    conflictResolution: "new-priority",
    enableConflictDetection: true,
  },
  cache: {
    enabled: true,
    ttl: 300, // 5分钟
  },
};
