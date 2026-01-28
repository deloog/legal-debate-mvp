// LegalAgent类型定义

// =============================================================================
// 法律检索相关类型
// =============================================================================

/**
 * 法律检索查询
 */
export interface LegalQuery {
  /** 关键词列表 */
  keywords: string[];
  /** 案件类型（民事、刑事、行政等） */
  caseType?: string;
  /** 法律类型（民事、刑事、行政等） */
  lawType?: string;
  /** 返回结果数量限制 */
  limit?: number;
  /** 是否启用向量搜索 */
  enableVectorSearch?: boolean;
}

/**
 * 法条信息
 */
export interface LawArticle {
  /** 法条唯一标识 */
  id: string;
  /** 法律名称 */
  lawName: string;
  /** 条款编号 */
  articleNumber: string;
  /** 法条内容 */
  content: string;
  /** 分类（民事、刑事、行政等） */
  category: string;
  /** 生效日期 */
  effectiveDate?: string;
  /** 相关性评分（0-1） */
  relevanceScore?: number;
  /** 是否废止 */
  deprecated?: boolean;
  /** 适用范围 */
  scope?: string[];
  /** 法律层级（宪法>法律>行政法规>部门规章>地方性法规） */
  level?: 'constitution' | 'law' | 'administrative' | 'regulation' | 'local';
  /** 关键词列表 */
  keywords?: string[];
}

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 相关法条列表 */
  articles: LawArticle[];
  /** 总数量 */
  total: number;
  /** 搜索来源（local/external） */
  source: 'local' | 'external' | 'mixed';
  /** 执行时间（毫秒） */
  executionTime: number;
}

// =============================================================================
// 适用性分析相关类型
// =============================================================================

/**
 * 案件信息
 */
export interface CaseInfo {
  /** 案件描述 */
  description?: string;
  /** 争议焦点 */
  disputeFocus?: string[];
  /** 证据列表 */
  evidences?: Array<{
    id: string;
    summary: string;
    type: string;
  }>;
  /** 案件地点/地域 */
  location?: string;
  /** 案件类型 */
  caseType?: string;
  /** 当事人信息 */
  parties?: {
    plaintiff?: { name: string; role: string };
    defendant?: { name: string; role: string };
  };
}

/**
 * 适用性分析输入
 */
export interface ApplicabilityAnalysisInput {
  /** 待分析的法条 */
  articles: LawArticle[];
  /** 案件信息 */
  caseInfo: CaseInfo;
  /** 当事人信息 */
  parties?: {
    plaintiff?: { name: string; role: string };
    defendant?: { name: string; role: string };
  };
}

/**
 * 语义匹配结果
 */
export interface SemanticMatchResult {
  /** 法条ID */
  articleId: string;
  /** 语义相似度评分（0-1） */
  score: number;
  /** 匹配的关键词 */
  matchedKeywords: string[];
}

/**
 * 规则验证结果
 */
export interface RuleValidationResult {
  /** 法条ID */
  articleId: string;
  /** 是否通过验证 */
  passed: boolean;
  /** 时效性检查 */
  时效性检查: {
    valid: boolean;
    reason?: string;
  };
  /** 适用范围检查 */
  适用范围检查: {
    valid: boolean;
    reason?: string;
  };
  /** 法条层级检查 */
  法条层级检查: {
    valid: boolean;
    reason?: string;
  };
}

/**
 * AI审查结果
 */
export interface AIReviewResult {
  /** 适用的法条 */
  applicable: LawArticle[];
  /** 不适用的法条 */
  notApplicable: LawArticle[];
  /** 审查评分（0-1） */
  score: number;
  /** 审查意见 */
  comments: string[];
}

/**
 * 适用性分析结果
 */
export interface ApplicabilityResult {
  /** 适用的法条 */
  applicableArticles: LawArticle[];
  /** 不适用的法条 */
  notApplicableArticles: LawArticle[];
  /** 语义匹配评分 */
  semanticScores: Map<string, number>;
  /** 规则验证结果 */
  validation: Map<string, RuleValidationResult>;
  /** AI审查结果 */
  aiReview: AIReviewResult;
  /** 综合评分（0-1） */
  overallScore: number;
  /** 分析时间（毫秒） */
  analysisTime: number;
}

// =============================================================================
// 论点生成相关类型
// =============================================================================

/**
 * 法律依据
 */
export interface LegalBasis {
  /** 适用法条 */
  articles: LawArticle[];
  /** 案件事实 */
  facts: string[];
  /** 当事人信息 */
  parties?: {
    plaintiff: { name: string; role: string };
    defendant: { name: string; role: string };
  };
}

/**
 * 论点方向
 */
export type ArgumentSide = 'PLAINTIFF' | 'DEFENDANT';

/**
 * 论点类型
 */
export type ArgumentType =
  | 'main'
  | 'supporting'
  | 'legal_reference'
  | 'rebuttal';

/**
 * 论点信息
 */
export interface Argument {
  /** 论点唯一标识 */
  id: string;
  /** 论点类型 */
  type: ArgumentType;
  /** 论点内容 */
  content: string;
  /** 法律依据 */
  legalBasis: LawArticle[];
  /** 事实依据 */
  factBasis?: string[];
  /** 论点强度（0-1） */
  strength: number;
  /** 论点方向（原告/被告） */
  side: ArgumentSide;
  /** 生成时间 */
  createdAt: number;
}

/**
 * 论点生成结果
 */
export interface ArgumentGenerationResult {
  /** 生成的论点列表 */
  arguments: Argument[];
  /** 主论点数量 */
  mainArgumentCount: number;
  /** 支持论据数量 */
  supportingArgumentCount: number;
  /** 法律引用数量 */
  legalReferenceCount: number;
  /** 平均论点强度 */
  averageStrength: number;
  /** 生成时间（毫秒） */
  generationTime: number;
}

// =============================================================================
// 法律推理相关类型
// =============================================================================

/**
 * 事实信息
 */
export interface Fact {
  /** 事实ID */
  id: string;
  /** 事实内容 */
  content: string;
  /** 事实类型（争议事实/无争议事实） */
  type: 'disputed' | 'undisputed';
  /** 相关性 */
  relevance: number;
}

/**
 * 推理步骤
 */
export interface ReasoningStep {
  /** 步骤ID */
  id: string;
  /** 步骤序号 */
  order: number;
  /** 步骤内容 */
  content: string;
  /** 涉及的法条 */
  law: LawArticle;
  /** 涉及的事实 */
  facts: Fact[];
  /** 逻辑类型（演绎/归纳/类比） */
  logicType: 'deductive' | 'inductive' | 'analogical';
  /** 置信度（0-1） */
  confidence: number;
}

/**
 * 推理链
 */
export interface ReasoningChain {
  /** 涉及的事实 */
  facts: Fact[];
  /** 涉及的法条 */
  laws: LawArticle[];
  /** 推理步骤 */
  steps: ReasoningStep[];
  /** 结论 */
  conclusion: string;
  /** 整体逻辑评分（0-1） */
  logicScore: number;
  /** 逻辑完整性 */
  completeness: number;
  /** 构建时间（毫秒） */
  buildTime: number;
}

/**
 * 逻辑验证结果
 */
export interface LogicValidationResult {
  /** 是否通过验证 */
  passed: boolean;
  /** 逻辑评分（0-1） */
  score: number;
  /** 发现的逻辑问题 */
  issues: {
    type:
      | 'contradiction'
      | 'missing_premise'
      | 'invalid_inference'
      | 'weak_argument';
    description: string;
    severity: 'high' | 'medium' | 'low';
  }[];
}

// =============================================================================
// LegalAgent配置
// =============================================================================

/**
 * LegalAgent配置
 */
export interface LegalAgentConfig {
  /** 最大搜索结果数量 */
  maxSearchResults: number;
  /** 是否启用外部API搜索 */
  enableExternalSearch: boolean;
  /** 外部API搜索阈值（本地结果少于多少时触发） */
  externalSearchThreshold: number;
  /** 向量搜索维度 */
  vectorDimension: number;
  /** 适用性分析阈值（低于此值认为不适用） */
  applicabilityThreshold: number;
  /** 论点生成数量 */
  argumentCount: {
    main: number;
    supporting: number;
    legalReference: number;
  };
  /** 推理链最大步数 */
  maxReasoningSteps: number;
}

/**
 * 默认配置
 */
export const DEFAULT_LEGAL_AGENT_CONFIG: LegalAgentConfig = {
  maxSearchResults: 10,
  enableExternalSearch: true,
  externalSearchThreshold: 5,
  vectorDimension: 1536,
  applicabilityThreshold: 0.6,
  argumentCount: {
    main: 3,
    supporting: 5,
    legalReference: 2,
  },
  maxReasoningSteps: 10,
};
