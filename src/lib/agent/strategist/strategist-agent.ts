/**
 * StrategistAgent - 策略制定智能体主类
 *
 * 实现"AI生成+规则验证+风险评估"三层架构
 */

import { BaseAgent } from "../base-agent";
import { AgentType, AgentContext } from "../../../types/agent";
import type { StrategyInput, StrategyOutput } from "./types";
import { AIStrategyGenerator } from "./ai-strategy-generator";
import { RuleValidator } from "./rule-validator";
import { RiskAssessor } from "./risk-assessor";
import { logger } from "../security/logger";
import { AIServiceFactory } from "../../ai/service";

// =============================================================================
// StrategistAgent类
// =============================================================================

export class StrategistAgent extends BaseAgent {
  public readonly name = "Strategist";
  public readonly type = AgentType.STRATEGIST;
  public readonly version = "1.0.0";
  public readonly description =
    "策略制定智能体，实现AI生成+规则验证+风险评估三层架构";

  private aiGenerator: AIStrategyGenerator;
  private ruleValidator: RuleValidator;
  private riskAssessor: RiskAssessor;

  constructor() {
    super();
    this.aiGenerator = new AIStrategyGenerator();
    this.ruleValidator = new RuleValidator();
    this.riskAssessor = new RiskAssessor();
  }

  getCapabilities(): string[] {
    return [
      "SWOT_ANALYSIS",
      "STRATEGY_GENERATION",
      "RISK_ASSESSMENT",
      "LEGAL_STRATEGY",
    ];
  }

  getSupportedTasks(): string[] {
    return ["GENERATE_STRATEGY", "SWOT_ANALYSIS", "RISK_ASSESSMENT"];
  }

  getDependencies(): AgentType[] {
    return [AgentType.RESEARCHER];
  }

  getRequiredConfig(): string[] {
    return [];
  }

  getOptionalConfig(): string[] {
    return ["temperature", "maxTokens", "enableStrictValidation"];
  }

  getProcessingSteps(): string[] {
    return [
      "输入验证",
      "第一层：AI策略生成",
      "第二层：规则验证",
      "第三层：风险评估",
      "输出格式化",
    ];
  }

  /**
   * 初始化Agent
   */
  async initialize(): Promise<void> {
    logger.info("StrategistAgent初始化", { version: this.version });

    // 初始化AI服务
    try {
      const aiService = await AIServiceFactory.getInstance("strategist", {
        clients: [
          {
            provider: "deepseek",
            apiKey: process.env.DEEPSEEK_API_KEY || "",
            baseURL:
              process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
          },
        ],
        loadBalancer: {
          strategy: "provider_priority",
          healthCheckInterval: 60000,
          healthCheckTimeout: 5000,
          failureThreshold: 3,
          recoveryThreshold: 2,
          weights: {
            zhipu: 0,
            deepseek: 1,
            openai: 0,
            anthropic: 0,
          },
        },
        monitor: {
          enabled: true,
          metricsInterval: 60000,
          logLevel: "info",
          persistMetrics: false,
        },
        fallback: {
          enabled: true,
          strategies: [],
          cacheFallback: {
            enabled: true,
            ttl: 300000,
            maxAge: 3600000,
          },
          simplifiedMode: {
            enabled: false,
            maxTokens: 1000,
            simplifiedPrompts: true,
          },
          localProcessing: {
            enabled: false,
            capabilities: [],
          },
        },
      });

      await this.aiGenerator.initialize(aiService);
      logger.info("AI服务初始化成功");
    } catch (error) {
      logger.warn("AI服务初始化失败，使用模拟模式", error);
    }
  }

  /**
   * 执行策略生成逻辑
   */
  protected async executeLogic(context: AgentContext): Promise<StrategyOutput> {
    const input = context.data as StrategyInput;
    const startTime = Date.now();

    try {
      // 验证输入
      const inputValidation = this.validateInput(input);
      if (!inputValidation.valid) {
        throw new Error(`输入验证失败: ${inputValidation.errors?.join(", ")}`);
      }

      logger.info("开始策略生成", {
        caseType: input.caseInfo.caseType,
        partiesCount: input.caseInfo.parties.length,
        claimsCount: input.caseInfo.claims.length,
        lawsCount: input.legalAnalysis.applicableLaws.length,
      });

      // 格式化输入数据为字符串
      const caseInfoStr = this.formatCaseInfo(input.caseInfo);
      const legalAnalysisStr = this.formatLegalAnalysis(input.legalAnalysis);
      const contextStr = this.formatContext(input.context);

      // 第一层：AI策略生成
      const aiResponse = await this.aiGenerator.generateStrategy(
        caseInfoStr,
        legalAnalysisStr,
        contextStr,
      );

      // 第二层：规则验证
      const ruleValidation = this.ruleValidator.validate(aiResponse);

      if (
        !ruleValidation.valid &&
        this.config.enableStrictValidation !== false
      ) {
        logger.warn("策略验证未通过", {
          violations: ruleValidation.violations,
          warnings: ruleValidation.warnings,
        });
      }

      // 记录验证结果
      logger.info("规则验证完成", {
        valid: ruleValidation.valid,
        violationsCount: ruleValidation.violations.length,
        warningsCount: ruleValidation.warnings.length,
        suggestionsCount: ruleValidation.suggestions.length,
      });

      // 第三层：风险评估
      const riskAssessment = this.riskAssessor.assessRisks(aiResponse);

      // 构建策略建议（添加优先级）
      const strategyRecommendations = aiResponse.strategies.map(
        (strategy, index) => ({
          strategy: strategy.strategy,
          rationale: strategy.rationale,
          implementationSteps: strategy.implementationSteps,
          expectedOutcome: strategy.expectedOutcome,
          priority: (index === 0 ? "high" : index === 1 ? "medium" : "low") as
            | "high"
            | "medium"
            | "low",
        }),
      );

      // 构建输出
      const output: StrategyOutput = {
        success: true,
        swotAnalysis: {
          strengths: aiResponse.swotAnalysis.strengths,
          weaknesses: aiResponse.swotAnalysis.weaknesses,
          opportunities: aiResponse.swotAnalysis.opportunities,
          threats: aiResponse.swotAnalysis.threats,
        },
        strategyRecommendations,
        riskAssessment,
        processingTime: Date.now() - startTime,
        confidence: riskAssessment.confidence,
      };

      logger.info("策略生成完成", {
        processingTime: output.processingTime,
        swotItemsCount:
          output.swotAnalysis.strengths.length +
          output.swotAnalysis.weaknesses.length +
          output.swotAnalysis.opportunities.length +
          output.swotAnalysis.threats.length,
        strategiesCount: output.strategyRecommendations.length,
        overallRisk: output.riskAssessment.overallRisk,
        confidence: output.confidence,
      });

      return output;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error("策略生成失败", error, {
        processingTime,
        caseId: input.caseInfo?.caseTypeCode,
      });

      throw new Error(
        `策略生成失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 验证输入（public方法以符合Agent接口）
   */
  public validateInput(input: StrategyInput): {
    valid: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];

    // 验证案件信息
    if (!input.caseInfo) {
      errors.push("案件信息不能为空");
    } else {
      if (
        !input.caseInfo.caseType ||
        typeof input.caseInfo.caseType !== "string"
      ) {
        errors.push("案件类型必须是非空字符串");
      }
      if (
        !Array.isArray(input.caseInfo.parties) ||
        input.caseInfo.parties.length === 0
      ) {
        errors.push("当事人信息必须是非空数组");
      }
      if (
        !Array.isArray(input.caseInfo.claims) ||
        input.caseInfo.claims.length === 0
      ) {
        errors.push("诉讼请求必须是非空数组");
      }
      if (
        !Array.isArray(input.caseInfo.facts) ||
        input.caseInfo.facts.length === 0
      ) {
        errors.push("案件事实必须是非空数组");
      }
    }

    // 验证法条分析
    if (!input.legalAnalysis) {
      errors.push("法条分析结果不能为空");
    } else {
      if (
        !Array.isArray(input.legalAnalysis.applicableLaws) ||
        input.legalAnalysis.applicableLaws.length === 0
      ) {
        errors.push("适用法条必须是非空数组");
      }
    }

    if (errors.length > 0) {
      logger.debug("输入验证失败", { errors });
      return { valid: false, errors };
    }

    logger.debug("输入验证通过", { caseType: input.caseInfo.caseType });
    return { valid: true };
  }

  /**
   * 格式化案件信息
   */
  private formatCaseInfo(caseInfo: any): string {
    let info = `案件类型：${caseInfo.caseType}\n\n`;
    info += `当事人：\n`;
    caseInfo.parties.forEach((party: any) => {
      info += `- ${party.role === "plaintiff" ? "原告" : "被告"}：${party.name}`;
      if (party.representative) {
        info += `（代理人：${party.representative}）`;
      }
      info += `\n`;
    });
    info += `\n诉讼请求：\n`;
    caseInfo.claims.forEach((claim: string, i: number) => {
      info += `${i + 1}. ${claim}\n`;
    });
    info += `\n关键事实：\n`;
    caseInfo.facts.forEach((fact: string, i: number) => {
      info += `${i + 1}. ${fact}\n`;
    });

    return info;
  }

  /**
   * 格式化法条分析
   */
  private formatLegalAnalysis(legalAnalysis: any): string {
    let info = `适用法条：\n`;
    legalAnalysis.applicableLaws.forEach((law: any, i: number) => {
      info += `${i + 1}. ${law.law}`;
      if (law.relevance) {
        info += `（相关性：${(law.relevance * 100).toFixed(0)}%）`;
      }
      if (law.article) {
        info += `【${law.article}】`;
      }
      info += `\n`;
    });

    if (legalAnalysis.precedents && legalAnalysis.precedents.length > 0) {
      info += `\n相似案例：\n`;
      legalAnalysis.precedents.forEach((precedent: any, i: number) => {
        info += `${i + 1}. ${precedent.case}`;
        if (precedent.similarity) {
          info += `（相似度：${(precedent.similarity * 100).toFixed(0)}%）`;
        }
        if (precedent.outcome) {
          info += `【${precedent.outcome}】`;
        }
        info += `\n`;
      });
    }

    return info;
  }

  /**
   * 格式化上下文
   */
  private formatContext(context?: any): string | undefined {
    if (!context) {
      return undefined;
    }

    let info = `案件上下文：\n`;
    info += `- 管辖：${context.jurisdiction || "未指定"}\n`;
    info += `- 审级：${context.courtLevel || "未指定"}\n`;
    info += `- 复杂度：${context.complexity || "medium"}\n`;
    if (context.estimatedDuration) {
      info += `- 预计审理时长：${context.estimatedDuration}\n`;
    }

    return info;
  }

  async cleanup(): Promise<void> {
    logger.info("StrategistAgent清理");
  }
}
