/**
 * 辩论系统类型定义
 */

// =============================================================================
// 核心类型定义
// =============================================================================

/**
 * 案件信息
 */
export interface CaseInfo {
  title: string;
  description: string;
  type?: string;
  cause?: string;
  amount?: number;
  court?: string;
  caseNumber?: string;
}

/**
 * 论点
 */
export interface Argument {
  side: 'plaintiff' | 'defendant';
  content: string;
  legalBasis?: string;
  reasoning?: string;
  score?: number;
  evidenceRefs?: string[];
}

/**
 * 辩论轮次
 */
export interface DebateRound {
  id: string;
  debateId: string;
  roundNumber: number;
  plaintiffArguments: Argument[];
  defendantArguments: Argument[];
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 辩论
 */
export interface Debate {
  id: string;
  caseId: string;
  title: string;
  description: string;
  rounds: DebateRound[];
  currentRound: number;
  status: 'pending' | 'in_progress' | 'completed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 法律参考
 */
export interface LegalReference {
  lawName: string;
  articleNumber: string;
  fullText: string;
  relevanceScore?: number;
  applicabilityScore?: number;
}

// =============================================================================
// 生成参数类型
// =============================================================================

/**
 * 生成辩论的参数
 */
export interface GenerateDebateParams {
  caseId: string;
  caseInfo: CaseInfo;
  legalReferences?: LegalReference[];
  roundNumber?: number;
}

/**
 * 辩论生成结果
 */
export interface DebateGenerationResult {
  plaintiffArguments: Argument[];
  defendantArguments: Argument[];
  legalBasis: LegalReference[];
  metadata: {
    generatedAt: Date;
    model: string;
    tokensUsed: number;
    confidence: number;
    executionTime?: number; // 可选的执行时间字段
  };
}

// =============================================================================
// 评估类型
// =============================================================================

/**
 * 论点评估
 */
export interface ArgumentEvaluation {
  argument: Argument;
  logicalScore: number;
  factualAccuracy: number;
  completeness: number;
  issues: string[];
  suggestions: string[];
}

/**
 * 辩论质量评估
 */
export interface DebateQualityEvaluation {
  overallScore: number;
  logicalConsistency: number;
  factualAccuracy: number;
  balanceScore: number;
  evaluations: ArgumentEvaluation[];
  recommendations: string[];
}
