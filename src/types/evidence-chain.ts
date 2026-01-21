/**
 * 证据链类型定义
 *
 * 功能：定义证据链分析所需的所有类型
 */

/**
 * 证据关系类型枚举（扩展自EvidenceRelationType）
 */
export enum EvidenceChainRelationType {
  /**
   * 支撑 - 证据A支撑证据B
   */
  SUPPORTS = 'SUPPORTS',

  /**
   * 反驳 - 证据A反驳证据B
   */
  REFUTES = 'REFUTES',

  /**
   * 补充 - 证据A补充证据B
   */
  SUPPLEMENTS = 'SUPPLEMENTS',

  /**
   * 矛盾 - 证据A与证据B矛盾
   */
  CONTRADICTS = 'CONTRADICTS',

  /**
   * 独立 - 证据A与证据B独立
   */
  INDEPENDENT = 'INDEPENDENT',
}

/**
 * 证据关系强度等级
 */
export enum EvidenceRelationStrength {
  VERY_WEAK = 1,
  WEAK = 2,
  MODERATE = 3,
  STRONG = 4,
  VERY_STRONG = 5,
}

/**
 * 证据链节点类型
 */
export interface EvidenceChainNode {
  /**
   * 证据ID
   */
  evidenceId: string;

  /**
   * 证据名称
   */
  evidenceName: string;

  /**
   * 证据类型
   */
  evidenceType: string;

  /**
   * 证据状态
   */
  status: string;

  /**
   * 相关性评分
   */
  relevanceScore: number | null;

  /**
   * 从此节点出发的关系
   */
  outgoingRelations: EvidenceChainEdge[];

  /**
   * 指向此节点的关系
   */
  incomingRelations: EvidenceChainEdge[];

  /**
   * 元数据
   */
  metadata?: Record<string, unknown>;
}

/**
 * 证据链边（关系）
 */
export interface EvidenceChainEdge {
  /**
   * 关系ID
   */
  id: string;

  /**
   * 源证据ID
   */
  fromEvidenceId: string;

  /**
   * 目标证据ID
   */
  toEvidenceId: string;

  /**
   * 关系类型
   */
  relationType: EvidenceChainRelationType;

  /**
   * 关系强度（1-5）
   */
  strength: EvidenceRelationStrength;

  /**
   * 关系描述
   */
  description?: string;

  /**
   * 置信度（0-1）
   */
  confidence: number;

  /**
   * 关联的法条/论点ID
   */
  relatedId?: string;

  /**
   * 关联类型
   */
  relatedType?: string;

  /**
   * 元数据
   */
  metadata?: Record<string, unknown>;
}

/**
 * 证据链图结构
 */
export interface EvidenceChainGraph {
  /**
   * 图中的所有节点（证据）
   */
  nodes: EvidenceChainNode[];

  /**
   * 图中的所有边（关系）
   */
  edges: EvidenceChainEdge[];

  /**
   * 核心证据（入度和出度最高的证据）
   */
  coreEvidences: string[];

  /**
   * 孤立证据（无任何关系的证据）
   */
  isolatedEvidences: string[];

  /**
   * 证据链统计
   */
  statistics: EvidenceChainStatistics;
}

/**
 * 证据链统计信息
 */
export interface EvidenceChainStatistics {
  /**
   * 总证据数
   */
  totalEvidences: number;

  /**
   * 总关系数
   */
  totalRelations: number;

  /**
   * 平均关系强度
   */
  averageRelationStrength: number;

  /**
   * 证据链完整性（0-100）
   */
  chainCompleteness: number;

  /**
   * 关系类型分布
   */
  relationTypeDistribution: Record<EvidenceChainRelationType, number>;

  /**
   * 证据效力评分
   */
  effectivenessScore: number;

  /**
   * 需要补充的证据
   */
  missingEvidenceTypes: string[];
}

/**
 * 证据链路径
 */
export interface EvidenceChainPath {
  /**
   * 路径中的证据ID序列
   */
  evidenceIds: string[];

  /**
   * 路径总强度（各边强度之和）
   */
  totalStrength: number;

  /**
   * 路径平均置信度
   */
  averageConfidence: number;

  /**
   * 路径长度
   */
  length: number;

  /**
   * 路径类型
   */
  pathType: 'supporting' | 'refuting' | 'mixed';
}

/**
 * 证据效力评估结果
 */
export interface EvidenceEffectivenessEvaluation {
  /**
   * 证据ID
   */
  evidenceId: string;

  /**
   * 整体效力评分（0-100）
   */
  effectivenessScore: number;

  /**
   * 效力等级
   */
  effectivenessLevel: EffectivenessLevel;

  /**
   * 各项指标评分
   */
  scores: EvidenceEffectivenessScores;

  /**
   * 改进建议
   */
  suggestions: string[];

  /**
   * 关联法条支持度
   */
  legalSupportScore: number;

  /**
   * 判例支持度
   */
  caseSupportScore: number;
}

/**
 * 效力等级
 */
export enum EffectivenessLevel {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

/**
 * 证据效力各项指标评分
 */
export interface EvidenceEffectivenessScores {
  /**
   * 相关性评分（0-100）
   */
  relevance: number;

  /**
   * 可靠性评分（0-100）
   */
  reliability: number;

  /**
   * 完整性评分（0-100）
   */
  completeness: number;

  /**
   * 合法性评分（0-100）
   */
  legality: number;

  /**
   * 证据链位置评分（0-100）
   */
  chainPosition: number;
}

/**
 * AI证据关系识别结果
 */
export interface AIEvidenceRelationshipResult {
  /**
   * 证据A ID
   */
  evidenceAId: string;

  /**
   * 证据B ID
   */
  evidenceBId: string;

  /**
   * 关系类型
   */
  relationType: EvidenceChainRelationType;

  /**
   * 关系强度（1-5）
   */
  strength: EvidenceRelationStrength;

  /**
   * 置信度（0-1）
   */
  confidence: number;

  /**
   * 关系描述
   */
  description: string;

  /**
   * 关联法条/论点
   */
  relatedId?: string;

  /**
   * AI使用的推理依据
   */
  reasoning: string;
}

/**
 * 证据链分析请求
 */
export interface EvidenceChainAnalysisRequest {
  /**
   * 案件ID
   */
  caseId: string;

  /**
   * 证据列表
   */
  evidences: Array<{
    id: string;
    name: string;
    type: string;
    content?: string;
    description?: string;
    status: string;
    relevanceScore?: number | null;
  }>;

  /**
   * 现有证据关系
   */
  existingRelations?: Array<{
    evidenceId: string;
    relationType: string;
    relatedId: string;
    description?: string;
  }>;

  /**
   * 分析选项
   */
  options?: EvidenceChainAnalysisOptions;
}

/**
 * 证据链分析选项
 */
export interface EvidenceChainAnalysisOptions {
  /**
   * 是否使用AI进行关系识别
   */
  useAI?: boolean;

  /**
   * 关系置信度阈值
   */
  confidenceThreshold?: number;

  /**
   * 是否包含效力评估
   */
  includeEffectiveness?: boolean;

  /**
   * 是否查找最长证据链
   */
  findLongestChain?: boolean;

  /**
   * 最大关系数（限制计算复杂度）
   */
  maxRelations?: number;
}

/**
 * 证据链分析响应
 */
export interface EvidenceChainAnalysisResponse {
  /**
   * 证据链图
   */
  chainGraph: EvidenceChainGraph;

  /**
   * 证据链路径
   */
  chains: EvidenceChainPath[];

  /**
   * 证据效力评估
   */
  effectivenessEvaluations: Map<string, EvidenceEffectivenessEvaluation>;

  /**
   * 分析摘要
   */
  summary: EvidenceChainSummary;

  /**
   * 分析耗时（毫秒）
   */
  executionTime: number;
}

/**
 * 证据链分析摘要
 */
export interface EvidenceChainSummary {
  /**
   * 总证据数
   */
  totalEvidences: number;

  /**
   * 检测到的关系数
   */
  detectedRelations: number;

  /**
   * 主要证据链数量
   */
  chainCount: number;

  /**
   * 最强证据链长度
   */
  longestChainLength: number;

  /**
   * 平均证据效力
   */
  averageEffectiveness: number;

  /**
   * 关键发现
   */
  keyFindings: string[];
}

/**
 * 证据关系查询参数
 */
export interface EvidenceRelationQuery {
  /**
   * 案件ID
   */
  caseId: string;

  /**
   * 源证据ID
   */
  fromEvidenceId?: string;

  /**
   * 目标证据ID
   */
  toEvidenceId?: string;

  /**
   * 关系类型
   */
  relationType?: EvidenceChainRelationType;

  /**
   * 最小强度
   */
  minStrength?: EvidenceRelationStrength;

  /**
   * 最小置信度
   */
  minConfidence?: number;
}

/**
 * 类型守卫：验证证据链关系类型
 */
export function isValidEvidenceChainRelationType(
  value: unknown
): value is EvidenceChainRelationType {
  return (
    typeof value === 'string' &&
    Object.values(EvidenceChainRelationType).includes(
      value as EvidenceChainRelationType
    )
  );
}

/**
 * 类型守卫：验证证据关系强度
 */
export function isValidEvidenceRelationStrength(
  value: unknown
): value is EvidenceRelationStrength {
  return (
    typeof value === 'number' &&
    value >= 1 &&
    value <= 5 &&
    Number.isInteger(value)
  );
}

/**
 * 类型守卫：验证效力等级
 */
export function isValidEffectivenessLevel(
  value: unknown
): value is EffectivenessLevel {
  return (
    typeof value === 'string' &&
    Object.values(EffectivenessLevel).includes(value as EffectivenessLevel)
  );
}

/**
 * 获取证据关系类型的中文名称
 */
export function getEvidenceChainRelationTypeLabel(
  type: EvidenceChainRelationType
): string {
  const labels: Record<EvidenceChainRelationType, string> = {
    [EvidenceChainRelationType.SUPPORTS]: '支撑',
    [EvidenceChainRelationType.REFUTES]: '反驳',
    [EvidenceChainRelationType.SUPPLEMENTS]: '补充',
    [EvidenceChainRelationType.CONTRADICTS]: '矛盾',
    [EvidenceChainRelationType.INDEPENDENT]: '独立',
  };
  return labels[type] || '未知';
}

/**
 * 获取证据关系强度的中文名称
 */
export function getEvidenceRelationStrengthLabel(
  strength: EvidenceRelationStrength
): string {
  const labels: Record<EvidenceRelationStrength, string> = {
    [EvidenceRelationStrength.VERY_WEAK]: '非常弱',
    [EvidenceRelationStrength.WEAK]: '弱',
    [EvidenceRelationStrength.MODERATE]: '中等',
    [EvidenceRelationStrength.STRONG]: '强',
    [EvidenceRelationStrength.VERY_STRONG]: '非常强',
  };
  return labels[strength] || '未知';
}

/**
 * 获取效力等级的中文名称
 */
export function getEffectivenessLevelLabel(level: EffectivenessLevel): string {
  const labels: Record<EffectivenessLevel, string> = {
    [EffectivenessLevel.VERY_LOW]: '非常低',
    [EffectivenessLevel.LOW]: '低',
    [EffectivenessLevel.MODERATE]: '中等',
    [EffectivenessLevel.HIGH]: '高',
    [EffectivenessLevel.VERY_HIGH]: '非常高',
  };
  return labels[level] || '未知';
}

/**
 * 计算平均效力评分
 */
export function calculateAverageEffectiveness(
  evaluations: EvidenceEffectivenessEvaluation[]
): number {
  if (evaluations.length === 0) {
    return 0;
  }

  const totalScore = evaluations.reduce(
    (sum, evaluation) => sum + evaluation.effectivenessScore,
    0
  );
  return Math.round((totalScore / evaluations.length) * 100) / 100;
}
