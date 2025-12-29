/**
 * 规则验证器
 *
 * 验证策略的逻辑一致性和可行性
 */

import type { AIStrategyResponse, RuleValidationResult } from "./types";
import { logger } from "../security/logger";

// =============================================================================
// 规则验证器类
// =============================================================================

export class RuleValidator {
  private config: {
    minSWOTItems: number;
    minStrategies: number;
    minStrategySteps: number;
    minRisks: number;
    enableStrictValidation: boolean;
  };

  constructor() {
    this.config = {
      minSWOTItems: 3,
      minStrategies: 3,
      minStrategySteps: 3,
      minRisks: 3,
      enableStrictValidation: true,
    };
  }

  /**
   * 验证策略
   */
  validate(strategy: AIStrategyResponse): RuleValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    logger.info("开始规则验证", {
      strategiesCount: strategy.strategies.length,
      risksCount: strategy.risks.length,
    });

    // 验证SWOT分析
    this.validateSWOT(strategy.swotAnalysis, violations, warnings);

    // 验证策略建议
    this.validateStrategies(
      strategy.strategies,
      violations,
      warnings,
      suggestions,
    );

    // 验证风险评估
    this.validateRisks(strategy.risks, violations, warnings);

    // 生成改进建议
    this.generateSuggestions(strategy, suggestions);

    const isValid = violations.length === 0;
    logger.info("规则验证完成", {
      isValid,
      violationsCount: violations.length,
      warningsCount: warnings.length,
      suggestionsCount: suggestions.length,
    });

    return {
      valid: isValid,
      violations,
      warnings,
      suggestions,
    };
  }

  /**
   * 验证SWOT分析
   */
  private validateSWOT(
    swot: any,
    violations: string[],
    warnings: string[],
  ): void {
    const swotItems = ["strengths", "weaknesses", "opportunities", "threats"];

    for (const item of swotItems) {
      if (!Array.isArray(swot[item])) {
        violations.push(`SWOT分析中${item}字段必须是数组`);
        continue;
      }

      if (swot[item].length < this.config.minSWOTItems) {
        warnings.push(
          `${item}项目数量不足，当前${swot[item].length}个，建议至少${this.config.minSWOTItems}个`,
        );
      }

      // 检查内容质量
      for (let i = 0; i < swot[item].length; i++) {
        const content = swot[item][i];
        if (
          !content ||
          typeof content !== "string" ||
          content.trim().length < 5
        ) {
          warnings.push(`${item}第${i + 1}项内容过于简短或为空`);
        }
      }
    }
  }

  /**
   * 验证策略建议
   */
  private validateStrategies(
    strategies: any[],
    violations: string[],
    warnings: string[],
    suggestions: string[],
  ): void {
    if (strategies.length < this.config.minStrategies) {
      violations.push(
        `策略建议数量不足，当前${strategies.length}个，要求至少${this.config.minStrategies}个`,
      );
    }

    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];

      // 验证必需字段
      if (!strategy.strategy || typeof strategy.strategy !== "string") {
        violations.push(`第${i + 1}条策略缺少strategy字段`);
      }

      if (!strategy.rationale || typeof strategy.rationale !== "string") {
        violations.push(`第${i + 1}条策略缺少rationale字段`);
      }

      if (!Array.isArray(strategy.implementationSteps)) {
        violations.push(`第${i + 1}条策略缺少implementationSteps数组`);
      } else if (
        strategy.implementationSteps.length < this.config.minStrategySteps
      ) {
        warnings.push(
          `第${i + 1}条策略实施步骤不足，当前${strategy.implementationSteps.length}个，建议至少${this.config.minStrategySteps}个`,
        );
      }

      if (
        !strategy.expectedOutcome ||
        typeof strategy.expectedOutcome !== "string"
      ) {
        violations.push(`第${i + 1}条策略缺少expectedOutcome字段`);
      }

      // 检查内容质量
      if (strategy.strategy && strategy.strategy.length < 10) {
        warnings.push(`第${i + 1}条策略描述过于简短`);
      }

      if (
        strategy.implementationSteps &&
        strategy.implementationSteps.length > 0
      ) {
        const validSteps = strategy.implementationSteps.filter(
          (step: string) => step && step.trim().length > 5,
        );

        if (validSteps.length < strategy.implementationSteps.length) {
          warnings.push(`第${i + 1}条策略存在过短或空的实施步骤`);
        }
      }
    }
  }

  /**
   * 验证风险评估
   */
  private validateRisks(
    risks: any[],
    violations: string[],
    warnings: string[],
  ): void {
    if (risks.length < this.config.minRisks) {
      warnings.push(
        `风险因素数量不足，当前${risks.length}个，建议至少${this.config.minRisks}个`,
      );
    }

    for (let i = 0; i < risks.length; i++) {
      const risk = risks[i];

      // 验证必需字段
      if (!risk.factor || typeof risk.factor !== "string") {
        violations.push(`第${i + 1}个风险缺少factor字段`);
      }

      if (!risk.impact || typeof risk.impact !== "string") {
        violations.push(`第${i + 1}个风险缺少impact字段`);
      } else if (!["low", "medium", "high"].includes(risk.impact)) {
        violations.push(`第${i + 1}个风险的impact值无效，应为low/medium/high`);
      }

      if (
        typeof risk.probability !== "number" ||
        risk.probability < 0 ||
        risk.probability > 1
      ) {
        violations.push(
          `第${i + 1}个风险的probability值无效，应为0.0-1.0之间的小数`,
        );
      }

      if (!risk.mitigation || typeof risk.mitigation !== "string") {
        violations.push(`第${i + 1}个风险缺少mitigation字段`);
      }

      // 检查内容质量
      if (risk.factor && risk.factor.length < 10) {
        warnings.push(`第${i + 1}个风险因素描述过于简短`);
      }

      if (risk.mitigation && risk.mitigation.length < 10) {
        warnings.push(`第${i + 1}个风险的应对措施过于简短`);
      }
    }
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(
    strategy: AIStrategyResponse,
    suggestions: string[],
  ): void {
    // SWOT分析改进建议
    if (strategy.swotAnalysis.strengths.length === this.config.minSWOTItems) {
      suggestions.push("建议补充更多优势分析，以全面评估案件");
    }

    if (strategy.swotAnalysis.weaknesses.length === this.config.minSWOTItems) {
      suggestions.push("建议深入分析潜在劣势，提前做好应对准备");
    }

    // 策略建议改进建议
    if (strategy.strategies.length === this.config.minStrategies) {
      suggestions.push("建议提供更多备选策略，增强方案灵活性");
    }

    // 优先级分配建议
    const hasHighPriority = strategy.strategies.some(
      (s: any) => s.priority === "high",
    );
    if (!hasHighPriority) {
      suggestions.push("建议明确标记高优先级策略，便于快速决策");
    }

    // 风险评估改进建议
    const highImpactRisks = strategy.risks.filter(
      (r: any) => r.impact === "high",
    );
    if (highImpactRisks.length > 0) {
      suggestions.push(
        `识别到${highImpactRisks.length}个高影响风险，建议重点关注`,
      );
    }
  }

  /**
   * 更新配置
   */
  configure(config: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...config };
    logger.info("RuleValidator配置已更新", { config: this.config });
  }

  /**
   * 获取配置
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }
}
