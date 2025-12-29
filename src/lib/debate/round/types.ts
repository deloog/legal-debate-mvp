// 类型定义：轮次管理系统

/**
 * 轮次配置
 */
export interface RoundConfig {
  /**
   * 最大论点数量（每方）
   */
  maxArguments?: number;

  /**
   * 论点深度（1=浅层，3=深度）
   */
  argumentDepth?: 1 | 2 | 3;

  /**
   * 是否启用论点递进
   */
  enableProgression?: boolean;

  /**
   * 递进策略
   */
  progressionStrategy?: "depth" | "breadth" | "refutation";
}

/**
 * 轮次摘要
 */
export interface RoundSummary {
  /**
   * 轮次ID
   */
  roundId: string;

  /**
   * 轮次编号
   */
  roundNumber: number;

  /**
   * 原告论点摘要
   */
  plaintiffSummary: {
    argumentCount: number;
    keyPoints: string[];
    averageScore: number;
  };

  /**
   * 被告论点摘要
   */
  defendantSummary: {
    argumentCount: number;
    keyPoints: string[];
    averageScore: number;
  };

  /**
   * 主要争议焦点
   */
  disputeFocus: string[];

  /**
   * 完成时间
   */
  completedAt: Date;
}

/**
 * 历史上下文
 */
export interface HistoricalContext {
  /**
   * 历史轮次数量
   */
  roundCount: number;

  /**
   * 每轮关键点
   */
  keyPointsPerRound: Array<{
    roundNumber: number;
    plaintiffPoints: string[];
    defendantPoints: string[];
  }>;

  /**
   * 争议焦点演进
   */
  disputeFocusEvolution: string[];

  /**
   * 已覆盖的法律角度
   */
  coveredLegalAngles: string[];

  /**
   * 已覆盖的事实角度
   */
  coveredFactAngles: string[];
}

/**
 * 争议焦点
 */
export interface DisputeFocus {
  /**
   * 焦点ID
   */
  id: string;

  /**
   * 焦点描述
   */
  description: string;

  /**
   * 相关轮次
   */
  relatedRounds: number[];

  /**
   * 原告观点
   */
  plaintiffView: string;

  /**
   * 被告观点
   */
  defendantView: string;
}

/**
 * 正反方立场摘要
 */
export interface PositionSummary {
  /**
   * 原告主要论点
   */
  plaintiffMainPoints: string[];

  /**
   * 被告主要论点
   */
  defendantMainPoints: string[];

  /**
   * 双方共同认知
   */
  commonGround: string[];

  /**
   * 核心分歧点
   */
  coreDisagreements: string[];
}

/**
 * 轮次上下文
 */
export interface RoundContext {
  /**
   * 辩论ID
   */
  debateId: string;

  /**
   * 当前轮次编号
   */
  currentRoundNumber: number;

  /**
   * 历史上下文
   */
  historicalContext: HistoricalContext;

  /**
   * 争议焦点
   */
  disputeFocus: DisputeFocus[];

  /**
   * 正反方立场摘要
   */
  positionSummary: PositionSummary;

  /**
   * 递进指导
   */
  progressionGuidance?: ProgressionGuidance;

  /**
   * 构建时间
   */
  builtAt: Date;
}

/**
 * 未覆盖角度
 */
export interface UncoveredAngle {
  /**
   * 角度类型
   */
  type: "legal" | "factual" | "procedural" | "evidential";

  /**
   * 角度描述
   */
  description: string;

  /**
   * 优先级
   */
  priority: "high" | "medium" | "low";

  /**
   * 建议探索方向
   */
  suggestedDirection: string;
}

/**
 * 递进指导
 */
export interface ProgressionGuidance {
  /**
   * 优先关注角度
   */
  priorityAngles: UncoveredAngle[];

  /**
   * 深度递进建议
   */
  depthSuggestions: string[];

  /**
   * 广度拓展建议
   */
  breadthSuggestions: string[];

  /**
   * 反驳策略建议
   */
  refutationSuggestions: string[];

  /**
   * 新证据整合建议（如果有）
   */
  newEvidenceSuggestions?: string[];

  /**
   * 应避免的重复内容
   */
  avoidRepetition: string[];
}

/**
 * 论点分析
 */
export interface ArgumentAnalysis {
  /**
   * 总论点数
   */
  totalArguments: number;

  /**
   * 原告论点数
   */
  plaintiffArguments: number;

  /**
   * 被告论点数
   */
  defendantArguments: number;

  /**
   * 已覆盖的法律角度
   */
  coveredLegalAngles: Set<string>;

  /**
   * 已覆盖的事实角度
   */
  coveredFactAngles: Set<string>;

  /**
   * 已使用的法条
   */
  usedLawArticles: Set<string>;

  /**
   * 论点类型分布
   */
  argumentTypeDistribution: Map<string, number>;
}

/**
 * 新颖性评分
 */
export interface NoveltyScore {
  /**
   * 新颖度（0-1）
   */
  score: number;

  /**
   * 评级
   */
  rating: "high" | "medium" | "low";

  /**
   * 分析详情
   */
  details: {
    /**
     * 内容新颖度
     */
    contentNovelty: number;

    /**
     * 角度新颖度
     */
    angleNovelty: number;

    /**
     * 法条新颖度
     */
    legalNovelty: number;

    /**
     * 相似历史论点
     */
    similarArguments: Array<{
      roundNumber: number;
      side: string;
      similarity: number;
    }>;
  };
}

/**
 * 轮次验证结果
 */
export interface RoundValidationResult {
  /**
   * 是否有效
   */
  valid: boolean;

  /**
   * 错误信息
   */
  errors: Array<{
    field: string;
    message: string;
  }>;

  /**
   * 警告信息
   */
  warnings: string[];
}
