/**
 * 辩论论点元认知服务
 *
 * 语义晶体元认知思想在法律辩论中的应用：
 * - 状态画像：将论点可靠性状态具象化（STRONG/CONTESTED/WEAK/REBUTTED）
 * - 反驳压力：追踪论点被反驳的累积效应
 * - 置信度演化：记录论点置信度随时间和反馈的变迁
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * 论点可靠性状态（语义晶体的"状态画像"概念）
 */
export type ArgumentReliabilityState =
  | 'STRONG' // 强论点：高逻辑分 + 高法律分，无争议
  | 'CONTESTED' // 有争议：被对方质疑或存在逻辑漏洞
  | 'WEAK' // 弱论点：缺乏法律依据或逻辑薄弱
  | 'REBUTTED'; // 被驳倒：已被对方论点压制

/**
 * 元认知画像结果
 */
export interface ArgumentMetacognitionProfile {
  argumentId: string;

  // 状态画像（核心）
  reliabilityState: ArgumentReliabilityState;
  label: string;
  description: string;

  // 原始评分
  logicScore: number;
  legalScore: number;
  overallScore: number;

  // 反驳追踪
  rebuttalCount: number; // 被反驳次数
  rebuttalPressure: number; // 反驳压力值 (0-1)
  lastRebuttalAt: Date | null; // 最后被反驳时间

  // 置信度演化
  initialConfidence: number; // AI生成时的初始置信度
  currentConfidence: number; // 当前置信度
  confidenceTrend: 'rising' | 'stable' | 'declining';
  confidenceHistory: Array<{
    timestamp: Date;
    confidence: number;
    event: 'created' | 'rebutted' | 'supported' | 'reviewed';
  }>;

  // 风险提示
  warnings: string[];

  // 决策依据
  decisionFactors: {
    scoreBased: number; // 基于评分的可靠性
    rebuttalBased: number; // 基于反驳的可靠性
    feedbackBased: number; // 基于反馈的可靠性
  };
}

/**
 * 论点元认知服务
 */
export class ArgumentMetacognition {
  private readonly config = {
    // 反驳压力阈值
    lowRebuttalPressure: 0.2,
    highRebuttalPressure: 0.5,

    // 评分阈值
    highScoreThreshold: 0.75,
    lowScoreThreshold: 0.4,

    // 反驳权重
    rebuttalWeight: 0.3,
    scoreWeight: 0.5,
    feedbackWeight: 0.2,

    // 置信度衰减
    rebuttalDecay: 0.15, // 每次被反驳降低15%
    supportBoost: 0.1, // 每次支持增加10%

    // 批量处理限制
    maxBatchSize: 100,
  };

  /**
   * 分析单个论点的元认知状态
   * @param argumentId 论点ID
   * @param userId 可选的 用户ID，用于权限检查
   */
  public async analyzeArgument(
    argumentId: string,
    _userId?: string
  ): Promise<ArgumentMetacognitionProfile | null> {
    // 输入验证
    if (!argumentId || typeof argumentId !== 'string') {
      logger.warn('Invalid argumentId', { argumentId });
      return null;
    }

    // 长度限制 - 防止注入
    if (argumentId.length > 64) {
      logger.warn('ArgumentId too long', { argumentId: argumentId.length });
      return null;
    }

    try {
      // 获取论点及关联的反驳
      const argument = await prisma.argument.findUnique({
        where: { id: argumentId },
        include: {
          round: {
            include: {
              debate: {
                include: {
                  case: true,
                },
              },
            },
          },
        },
      });

      if (!argument) {
        logger.warn('Argument not found', { argumentId });
        return null;
      }

      // 获取该论点被反驳的情况
      const rebuttals = await this.getRebuttalsForArgument(argumentId);

      // 计算反驳压力
      const { pressure, count, lastRebuttalAt } =
        this.calculateRebuttalPressure(
          argument.overallScore || 0.5,
          argument.logicScore || 0,
          argument.legalScore || 0,
          rebuttals
        );

      // 计算置信度演化
      const { currentConfidence, trend, history } =
        this.calculateConfidenceEvolution(
          argument.confidence || 0.5,
          argument.createdAt,
          rebuttals
        );

      // 确定可靠性状态
      const reliabilityState = this.determineReliabilityState(
        argument.overallScore || 0,
        argument.logicScore || 0,
        argument.legalScore || 0,
        pressure,
        rebuttals.length
      );

      // 计算各维度分数
      const scoreBased = this.calculateScoreBasedReliability(
        argument.overallScore || 0,
        argument.logicScore || 0,
        argument.legalScore || 0
      );
      const rebuttalBased = this.calculateRebuttalBasedReliability(
        pressure,
        rebuttals.length
      );
      const feedbackBased = this.calculateFeedbackBasedReliability(rebuttals);

      // 生成警示信息
      const warnings = this.generateWarnings(
        reliabilityState,
        pressure,
        rebuttals.length,
        argument.overallScore || 0
      );

      return {
        argumentId,
        reliabilityState,
        label: this.getLabel(reliabilityState),
        description: this.getDescription(reliabilityState),
        logicScore: argument.logicScore || 0,
        legalScore: argument.legalScore || 0,
        overallScore: argument.overallScore || 0,
        rebuttalCount: count,
        rebuttalPressure: pressure,
        lastRebuttalAt,
        initialConfidence: argument.confidence || 0.5,
        currentConfidence,
        confidenceTrend: trend,
        confidenceHistory: history,
        warnings,
        decisionFactors: {
          scoreBased,
          rebuttalBased,
          feedbackBased,
        },
      };
    } catch (error) {
      logger.error('Error analyzing argument metacognition', {
        argumentId,
        error,
      });
      return null;
    }
  }

  /**
   * 批量分析多个论点的元认知状态
   * @param argumentIds 论点ID数组
   * @param userId 可选的 用户ID，用于权限检查
   */
  public async batchAnalyze(
    argumentIds: string[],
    userId?: string
  ): Promise<ArgumentMetacognitionProfile[]> {
    // 输入验证 - 限制批量大小，防止内存溢出
    if (!Array.isArray(argumentIds)) {
      logger.warn('Invalid argumentIds type');
      return [];
    }

    const validIds = argumentIds
      .filter(id => typeof id === 'string' && id.length > 0 && id.length <= 64)
      .slice(0, this.config.maxBatchSize); // 限制最大批量数

    if (validIds.length === 0) {
      return [];
    }

    const results = await Promise.all(
      validIds.map(id => this.analyzeArgument(id, userId))
    );
    return results.filter((r): r is ArgumentMetacognitionProfile => r !== null);
  }

  /**
   * 获取论点被反驳的情况
   * 假设存在 rebuttalRelations 表或类似的反驳关系记录
   * TODO: 根据实际数据模型调整
   */
  private async getRebuttalsForArgument(_argumentId: string): Promise<
    Array<{
      id: string;
      timestamp: Date;
      type: 'rebuttal' | 'support';
    }>
  > {
    // TODO: 根据实际数据库结构实现
    // 目前返回空数组，实际需要查询反驳关系表
    // 例如：prisma.rebuttalRelation.findMany({ where: { targetArgumentId: argumentId } })
    return [];
  }

  /**
   * 计算反驳压力
   */
  private calculateRebuttalPressure(
    overallScore: number,
    logicScore: number,
    legalScore: number,
    rebuttals: Array<{ type: 'rebuttal' | 'support'; timestamp: Date }>
  ): {
    pressure: number;
    count: number;
    lastRebuttalAt: Date | null;
  } {
    const rebuttalCount = rebuttals.filter(r => r.type === 'rebuttal').length;
    const supportCount = rebuttals.filter(r => r.type === 'support').length;

    // 反驳压力 = 反驳次数 * 权重 - 支持次数 * 权重
    let pressure =
      rebuttalCount * this.config.rebuttalWeight -
      supportCount * this.config.supportBoost;

    // 基础分：根据论点质量调整
    const baseScore = (overallScore + logicScore + legalScore) / 3;
    pressure = pressure * (1 - baseScore * 0.5); // 高质量论点更能抵抗反驳

    pressure = Math.max(0, Math.min(1, pressure));

    const lastRebuttal = rebuttals
      .filter(r => r.type === 'rebuttal')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    return {
      pressure: Math.round(pressure * 1000) / 1000,
      count: rebuttalCount,
      lastRebuttalAt: lastRebuttal?.timestamp || null,
    };
  }

  /**
   * 计算置信度演化
   */
  private calculateConfidenceEvolution(
    initialConfidence: number,
    createdAt: Date,
    rebuttals: Array<{ type: 'rebuttal' | 'support'; timestamp: Date }>
  ): {
    currentConfidence: number;
    trend: 'rising' | 'stable' | 'declining';
    history: Array<{
      timestamp: Date;
      confidence: number;
      event: 'created' | 'rebutted' | 'supported' | 'reviewed';
    }>;
  } {
    // 初始历史记录
    const history: Array<{
      timestamp: Date;
      confidence: number;
      event: 'created' | 'rebutted' | 'supported' | 'reviewed';
    }> = [
      { timestamp: createdAt, confidence: initialConfidence, event: 'created' },
    ];

    // 累积计算当前置信度
    let currentConfidence = initialConfidence;

    // 按时间顺序处理每次反驳/支持
    const sortedEvents = rebuttals
      .map(r => ({ timestamp: r.timestamp, type: r.type }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (const event of sortedEvents) {
      if (event.type === 'rebuttal') {
        currentConfidence = currentConfidence * (1 - this.config.rebuttalDecay);
        history.push({
          timestamp: event.timestamp,
          confidence: currentConfidence,
          event: 'rebutted',
        });
      } else {
        currentConfidence = Math.min(
          1,
          currentConfidence + this.config.supportBoost
        );
        history.push({
          timestamp: event.timestamp,
          confidence: currentConfidence,
          event: 'supported',
        });
      }
    }

    // 确定趋势
    let trend: 'rising' | 'stable' | 'declining';
    if (history.length < 2) {
      trend = 'stable';
    } else {
      const first = history[0].confidence;
      const last = history[history.length - 1].confidence;
      if (last - first > 0.1) {
        trend = 'rising';
      } else if (first - last > 0.1) {
        trend = 'declining';
      } else {
        trend = 'stable';
      }
    }

    return {
      currentConfidence: Math.round(currentConfidence * 1000) / 1000,
      trend,
      history,
    };
  }

  /**
   * 确定可靠性状态
   */
  private determineReliabilityState(
    overallScore: number,
    logicScore: number,
    legalScore: number,
    rebuttalPressure: number,
    rebuttalCount: number
  ): ArgumentReliabilityState {
    // 已被驳倒
    if (
      rebuttalPressure >= this.config.highRebuttalPressure ||
      rebuttalCount >= 3
    ) {
      return 'REBUTTED';
    }

    // 弱论点
    if (overallScore < this.config.lowScoreThreshold) {
      return 'WEAK';
    }

    // 有争议
    if (
      rebuttalPressure >= this.config.lowRebuttalPressure ||
      rebuttalCount > 0
    ) {
      return 'CONTESTED';
    }

    // 强论点
    if (
      overallScore >= this.config.highScoreThreshold &&
      logicScore >= this.config.highScoreThreshold &&
      legalScore >= this.config.highScoreThreshold
    ) {
      return 'STRONG';
    }

    // 默认：有争议（需要更多验证）
    return 'CONTESTED';
  }

  /**
   * 计算基于评分的可靠性
   */
  private calculateScoreBasedReliability(
    overall: number,
    logic: number,
    legal: number
  ): number {
    return overall * 0.4 + logic * 0.3 + legal * 0.3;
  }

  /**
   * 计算基于反驳的可靠性
   */
  private calculateRebuttalBasedReliability(
    pressure: number,
    _count: number
  ): number {
    // 高压力 = 低可靠性
    return Math.max(0, 1 - pressure);
  }

  /**
   * 计算基于反馈的可靠性
   */
  private calculateFeedbackBasedReliability(
    rebuttals: Array<{ type: 'rebuttal' | 'support' }>
  ): number {
    const total = rebuttals.length;
    if (total === 0) return 0.5;

    const support = rebuttals.filter(r => r.type === 'support').length;
    const ratio = support / total;

    return Math.min(1, ratio + 0.3); // 基础分0.3
  }

  /**
   * 生成警示信息
   */
  private generateWarnings(
    state: ArgumentReliabilityState,
    pressure: number,
    count: number,
    score: number
  ): string[] {
    const warnings: string[] = [];

    if (state === 'REBUTTED') {
      warnings.push('⚠️ 该论点已被对方驳倒，建议撤回或修正');
    }

    if (state === 'WEAK') {
      warnings.push('⚠️ 该论点缺乏足够的法律依据或逻辑支撑');
    }

    if (pressure >= this.config.highRebuttalPressure) {
      warnings.push(
        `⚠️ 反驳压力较高（${Math.round(pressure * 100)}%），论点可能存在漏洞`
      );
    }

    if (count > 0 && state !== 'REBUTTED') {
      warnings.push(`⚠️ 该论点已被反驳${count}次，请注意`);
    }

    if (score < this.config.lowScoreThreshold) {
      warnings.push(
        `⚠️ 论点综合评分较低（${Math.round(score * 100)}%），建议加强论证`
      );
    }

    return warnings;
  }

  /**
   * 获取状态标签
   */
  private getLabel(state: ArgumentReliabilityState): string {
    const labels = {
      STRONG: '强论点',
      CONTESTED: '有争议',
      WEAK: '弱论点',
      REBUTTED: '已驳倒',
    };
    return labels[state];
  }

  /**
   * 获取状态描述
   */
  private getDescription(state: ArgumentReliabilityState): string {
    const descriptions = {
      STRONG: '该论点逻辑清晰、法律依据充分，尚未被有效反驳',
      CONTESTED: '该论点存在争议或被对方质疑，需要进一步论证',
      WEAK: '该论点缺乏足够支撑，建议补充法律依据或加强逻辑',
      REBUTTED: '该论点已被对方有效驳倒，建议撤回或重新构建',
    };
    return descriptions[state];
  }

  /**
   * 生成人类可读的解释
   */
  public async generateExplanation(argumentId: string): Promise<string | null> {
    const profile = await this.analyzeArgument(argumentId);
    if (!profile) return null;

    const statements: Record<ArgumentReliabilityState, string> = {
      STRONG: `该论点评分较高（逻辑${Math.round(profile.logicScore * 100)}%，法律${Math.round(profile.legalScore * 100)}%），目前未被反驳，置信度${Math.round(profile.currentConfidence * 100)}%。`,
      CONTESTED: `该论点存在争议。综合评分${Math.round(profile.overallScore * 100)}%，反驳压力${Math.round(profile.rebuttalPressure * 100)}%。${profile.warnings.join(' ')}`,
      WEAK: `该论点评分较低（综合${Math.round(profile.overallScore * 100)}%），缺乏足够的法律依据支持。建议加强论证。`,
      REBUTTED: `该论点已被对方驳倒。反驳次数${profile.rebuttalCount}次，当前置信度仅${Math.round(profile.currentConfidence * 100)}%。建议撤回或重新构建论点。`,
    };

    return statements[profile.reliabilityState];
  }
}

/**
 * 便捷函数：获取单个论点的元认知画像
 * @param argumentId 论点ID
 * @param userId 可选的 用户ID，用于权限检查
 */
export async function getArgumentMetacognition(
  argumentId: string,
  userId?: string
): Promise<ArgumentMetacognitionProfile | null> {
  // 输入验证
  if (!argumentId || typeof argumentId !== 'string' || argumentId.length > 64) {
    return null;
  }
  const metacog = new ArgumentMetacognition();
  return metacog.analyzeArgument(argumentId, userId);
}

/**
 * 便捷函数：批量获取论点的元认知画像
 * @param argumentIds 论点ID数组
 * @param userId 可选的 用户ID，用于权限检查
 */
export async function getBatchArgumentMetacognition(
  argumentIds: string[],
  userId?: string
): Promise<ArgumentMetacognitionProfile[]> {
  // 输入验证
  if (!Array.isArray(argumentIds)) {
    return [];
  }
  const metacog = new ArgumentMetacognition();
  return metacog.batchAnalyze(argumentIds, userId);
}

/**
 * 获取论点的可靠性统计
 * @param argumentIds 论点ID数组
 * @param userId 可选的 用户ID，用于权限检查
 */
export async function getArgumentReliabilityStats(
  argumentIds: string[],
  _userId?: string
): Promise<{
  strong: number;
  contested: number;
  weak: number;
  rebutted: number;
  total: number;
}> {
  // 输入验证
  if (!Array.isArray(argumentIds)) {
    return { strong: 0, contested: 0, weak: 0, rebutted: 0, total: 0 };
  }
  const metacog = new ArgumentMetacognition();
  const profiles = await metacog.batchAnalyze(argumentIds);

  return {
    strong: profiles.filter(p => p.reliabilityState === 'STRONG').length,
    contested: profiles.filter(p => p.reliabilityState === 'CONTESTED').length,
    weak: profiles.filter(p => p.reliabilityState === 'WEAK').length,
    rebutted: profiles.filter(p => p.reliabilityState === 'REBUTTED').length,
    total: profiles.length,
  };
}
