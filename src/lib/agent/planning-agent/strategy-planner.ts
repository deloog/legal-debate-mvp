// 策略规划器（整合Strategist）

import type { CaseInfo } from "./types";
import {
  type Strategy,
  type SWOTAnalysis,
  type PlanningResult,
  type PlanningConfig,
  type PlanningError,
  PlanningErrorType,
} from "./types";

// =============================================================================
// StrategyPlanner类
// =============================================================================

export class StrategyPlanner {
  private config: PlanningConfig;

  constructor(
    config: PlanningConfig = {
      enableSWOTAnalysis: true,
      strategyCount: 3,
      riskThreshold: 0.7,
    },
  ) {
    this.config = config;
  }

  // 主规划方法
  public async plan(caseInfo: CaseInfo): Promise<PlanningResult> {
    try {
      // 生成多个候选策略
      const strategies: Strategy[] = [];

      // 策略1：标准策略
      strategies.push(await this.generateStandardStrategy());

      // 策略2：激进策略
      strategies.push(await this.generateAggressiveStrategy());

      // 策略3：保守策略
      strategies.push(await this.generateConservativeStrategy());

      // 如果启用了SWOT分析，增强策略
      if (this.config.enableSWOTAnalysis) {
        for (const strategy of strategies) {
          strategy.swotAnalysis = await this.performSWOTAnalysis(caseInfo);
        }
      }

      // 评估和排序策略
      const evaluatedStrategies = this.evaluateStrategies(strategies);

      // 选择最优策略
      const bestStrategy = this.selectBestStrategy(evaluatedStrategies);

      return {
        strategy: bestStrategy,
        alternativeStrategies: evaluatedStrategies.filter(
          (s) => s.name !== bestStrategy.name,
        ),
        selectedReason: this.generateSelectionReason(bestStrategy),
      };
    } catch (error) {
      throw this.createError(
        PlanningErrorType.STRATEGY_GENERATION_FAILED,
        error instanceof Error ? error.message : "Strategy generation failed",
        { originalError: error },
      );
    }
  }

  // 生成标准策略
  private async generateStandardStrategy(): Promise<Strategy> {
    return {
      name: "标准策略",
      description: "平衡各方利益，追求最大成功概率",
      swotAnalysis: {
        strengths: ["证据完整", "法条适用"],
        weaknesses: ["诉讼请求偏高", "时间紧迫"],
        opportunities: ["调解可能性大", "法官态度友好"],
        threats: ["对方反诉风险", "法条变更风险"],
      },
      recommendations: [
        "加强证据链的完整性",
        "适当降低诉讼请求金额",
        "准备调解方案",
      ],
      riskLevel: "medium",
      feasibilityScore: 0.75,
      confidence: 0.8,
    };
  }

  // 生成激进策略
  private async generateAggressiveStrategy(): Promise<Strategy> {
    return {
      name: "激进策略",
      description: "追求最高赔偿，承担较高风险",
      swotAnalysis: {
        strengths: ["证据确凿", "法条支持强"],
        weaknesses: ["对方抗辩能力", "法律风险"],
        opportunities: ["高赔偿判决", "树立威信"],
        threats: ["诉讼成本高", "时间周期长"],
      },
      recommendations: ["强化证据证明力", "预判对方策略", "准备应对反诉"],
      riskLevel: "high",
      feasibilityScore: 0.65,
      confidence: 0.7,
    };
  }

  // 生成保守策略
  private async generateConservativeStrategy(): Promise<Strategy> {
    return {
      name: "保守策略",
      description: "稳妥第一，追求确定的成功",
      swotAnalysis: {
        strengths: ["事实清楚", "争议焦点少"],
        weaknesses: ["索赔金额低", "法律关系简单"],
        opportunities: ["快速结案", "成本低"],
        threats: ["时效问题", "证据缺失"],
      },
      recommendations: ["完善证据材料", "核实时效要求", "快速推进程序"],
      riskLevel: "low",
      feasibilityScore: 0.85,
      confidence: 0.9,
    };
  }

  // 执行SWOT分析
  private async performSWOTAnalysis(caseInfo: CaseInfo): Promise<SWOTAnalysis> {
    // 分析优势
    const strengths = this.analyzeStrengths(caseInfo);

    // 分析劣势
    const weaknesses = this.analyzeWeaknesses(caseInfo);

    // 分析机会
    const opportunities = this.analyzeOpportunities(caseInfo);

    // 分析威胁
    const threats = this.analyzeThreats(caseInfo);

    return {
      strengths,
      weaknesses,
      opportunities,
      threats,
    };
  }

  // 分析优势
  private analyzeStrengths(caseInfo: CaseInfo): string[] {
    const strengths: string[] = [];

    if (caseInfo.evidenceCount && caseInfo.evidenceCount > 5) {
      strengths.push("证据充足");
    }

    if (caseInfo.claims && caseInfo.claims.length <= 3) {
      strengths.push("诉讼请求明确");
    }

    if (caseInfo.description?.includes("合同")) {
      strengths.push("法律关系明确");
    }

    return strengths;
  }

  // 分析劣势
  private analyzeWeaknesses(caseInfo: CaseInfo): string[] {
    const weaknesses: string[] = [];

    if (caseInfo.evidenceCount && caseInfo.evidenceCount < 3) {
      weaknesses.push("证据不足");
    }

    if (caseInfo.parties && caseInfo.parties.length > 2) {
      weaknesses.push("当事人关系复杂");
    }

    if (caseInfo.description?.includes("口头约定")) {
      weaknesses.push("证据形式不足");
    }

    return weaknesses;
  }

  // 分析机会
  private analyzeOpportunities(caseInfo: CaseInfo): string[] {
    const opportunities: string[] = [];

    if (caseInfo.type?.includes("民事")) {
      opportunities.push("调解可能性大");
    }

    if (caseInfo.claims?.includes("返还")) {
      opportunities.push("胜诉概率高");
    }

    return opportunities;
  }

  // 分析威胁
  private analyzeThreats(caseInfo: CaseInfo): string[] {
    const threats: string[] = [];

    if (caseInfo.description?.includes("超过两年")) {
      threats.push("诉讼时效风险");
    }

    if (caseInfo.parties?.some((p) => p.role === "defendant")) {
      threats.push("对方反诉风险");
    }

    return threats;
  }

  // 评估策略
  private evaluateStrategies(strategies: Strategy[]): Strategy[] {
    return strategies.map((strategy) => {
      // 计算综合得分
      const score = this.calculateStrategyScore(strategy);

      // 更新可行性得分
      strategy.feasibilityScore = score;

      // 更新风险等级
      strategy.riskLevel = this.determineRiskLevel(score);

      return strategy;
    });
  }

  // 计算策略得分
  private calculateStrategyScore(strategy: Strategy): number {
    const swot = strategy.swotAnalysis;

    // 优势得分（正向）
    const strengthScore = swot.strengths.length * 0.1;

    // 劣势得分（负向）
    const weaknessScore = swot.weaknesses.length * -0.1;

    // 机会得分（正向）
    const opportunityScore = swot.opportunities.length * 0.08;

    // 威胁得分（负向）
    const threatScore = swot.threats.length * -0.12;

    // 基础得分
    let totalScore =
      0.5 + strengthScore + weaknessScore + opportunityScore + threatScore;

    // 限制在0-1范围内
    totalScore = Math.max(0, Math.min(1, totalScore));

    return totalScore;
  }

  // 确定风险等级
  private determineRiskLevel(score: number): "low" | "medium" | "high" {
    if (score >= 0.8) {
      return "low";
    }
    if (score >= 0.6) {
      return "medium";
    }
    return "high";
  }

  // 选择最优策略
  private selectBestStrategy(strategies: Strategy[]): Strategy {
    // 按可行性得分排序
    const sorted = [...strategies].sort(
      (a, b) => b.feasibilityScore - a.feasibilityScore,
    );

    // 过滤掉风险过高的策略
    const viableStrategies = sorted.filter(
      (s) => s.feasibilityScore >= this.config.riskThreshold,
    );

    // 返回第一个可行策略
    return viableStrategies.length > 0 ? viableStrategies[0] : sorted[0];
  }

  // 生成选择原因
  private generateSelectionReason(strategy: Strategy): string {
    const reasons: string[] = [];

    if (strategy.feasibilityScore > 0.8) {
      reasons.push("可行性得分高");
    }

    if (strategy.riskLevel === "low") {
      reasons.push("风险可控");
    }

    if (strategy.confidence > 0.85) {
      reasons.push("信心度高");
    }

    if (
      strategy.swotAnalysis.strengths.length >
      strategy.swotAnalysis.weaknesses.length
    ) {
      reasons.push("优势多于劣势");
    }

    return reasons.length > 0 ? reasons.join("，") : "策略符合当前需求";
  }

  // 创建错误
  private createError(
    type: PlanningErrorType,
    message: string,
    details?: unknown,
  ): PlanningError {
    return {
      type,
      message,
      details,
    };
  }

  // 更新配置
  public updateConfig(config: Partial<PlanningConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 获取当前配置
  public getConfig(): PlanningConfig {
    return { ...this.config };
  }
}
