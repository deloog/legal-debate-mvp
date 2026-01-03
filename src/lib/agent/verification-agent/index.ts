/**
 * VerificationAgent主类
 * 统一三重验证流程，提供完整的验证服务
 */
import {
  VerificationResult,
  VerificationConfig,
  DEFAULT_VERIFICATION_CONFIG,
  FactualVerificationResult,
  LogicalVerificationResult,
  CompletenessVerificationResult,
  IssueType,
  IssueSeverity,
  IssueCategory,
} from "./types";
import { FactualVerifier } from "./verifiers/factual-verifier";
import { LogicalVerifier } from "./verifiers/logical-verifier";
import { CompletenessVerifier } from "./verifiers/completeness-verifier";
import { ScoreCalculator } from "./analyzers/score-calculator";
import { IssueCollector } from "./analyzers/issue-collector";
import { SuggestionGenerator } from "./analyzers/suggestion-generator";

/**
 * 待验证数据接口
 */
interface DataToVerify {
  parties?: {
    plaintiff?: string | { name: string };
    defendant?: string | { name: string };
  };
  amounts?: Array<{ field: string; value: string | number }>;
  dates?: Array<{ field: string; value: string }>;
  claims?: string[];
  facts?: string[];
  arguments?: string[];
  legalBasis?: Array<{ lawName: string; articleNumber: string }>;
  reasoning?: string;
  title?: string;
  description?: string;
  type?: string;
  [key: string]: unknown;
}

/**
 * 源数据接口（用于对比验证）
 */
interface SourceData {
  parties?: {
    plaintiff?: { name?: string; id?: string };
    defendant?: { name?: string; id?: string };
  };
  amounts?: Array<{ field: string; value: string | number }>;
  dates?: Array<{ field: string; value: string }>;
  rawData?: Record<string, unknown>;
}

/**
 * VerificationAgent主类
 */
export class VerificationAgent {
  private factualVerifier: FactualVerifier;
  private logicalVerifier: LogicalVerifier;
  private completenessVerifier: CompletenessVerifier;
  private scoreCalculator: ScoreCalculator;
  private issueCollector: IssueCollector;
  private suggestionGenerator: SuggestionGenerator;
  private config: VerificationConfig;

  constructor(config?: Partial<VerificationConfig>) {
    this.config = {
      ...DEFAULT_VERIFICATION_CONFIG,
      ...config,
    };

    // 初始化各验证器和分析器
    this.factualVerifier = new FactualVerifier();
    this.logicalVerifier = new LogicalVerifier();
    this.completenessVerifier = new CompletenessVerifier();
    this.scoreCalculator = new ScoreCalculator(this.config);
    this.issueCollector = new IssueCollector();
    this.suggestionGenerator = new SuggestionGenerator();
  }

  /**
   * 执行完整验证
   */
  async verify(
    data: DataToVerify,
    source?: SourceData,
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      // 并行执行三重验证
      const [factualResult, logicalResult, completenessResult] =
        await Promise.all([
          this.factualVerifier.verify(data, source),
          this.logicalVerifier.verify(data),
          this.completenessVerifier.verify(data),
        ]);

      // 计算综合评分
      const overallScore = this.scoreCalculator.calculateOverallScore(
        factualResult,
        logicalResult,
        completenessResult,
      );

      // 检查是否通过
      const passed = this.scoreCalculator.checkPassed(
        overallScore,
        factualResult,
        logicalResult,
        completenessResult,
      );

      // 收集问题
      const issues = this.issueCollector.collectAllIssues(
        factualResult,
        logicalResult,
        completenessResult,
      );

      // 生成建议
      const suggestions = this.suggestionGenerator.generateSuggestions(issues);

      const verificationTime = Date.now() - startTime;

      // 构建验证结果
      return {
        overallScore,
        factualAccuracy: factualResult.score,
        logicalConsistency: logicalResult.score,
        taskCompleteness: completenessResult.score,
        passed,
        issues,
        suggestions,
        verificationTime,
        metadata: {
          factualDetails: factualResult,
          logicalDetails: logicalResult,
          completenessDetails: completenessResult,
        },
      };
    } catch (error) {
      // 验证失败时返回错误结果
      return {
        overallScore: 0,
        factualAccuracy: 0,
        logicalConsistency: 0,
        taskCompleteness: 0,
        passed: false,
        issues: [
          {
            id: Date.now().toString(),
            type: IssueType.VALIDATION_ERROR,
            severity: IssueSeverity.CRITICAL,
            category: IssueCategory.FACTUAL,
            message: `验证过程出错: ${error instanceof Error ? error.message : "未知错误"}`,
            detectedBy: "system",
          },
        ],
        suggestions: [],
        verificationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 仅验证事实准确性
   */
  async verifyFactual(
    data: DataToVerify,
    source?: SourceData,
  ): Promise<FactualVerificationResult> {
    return this.factualVerifier.verify(data, source);
  }

  /**
   * 仅验证逻辑一致性
   */
  async verifyLogical(data: DataToVerify): Promise<LogicalVerificationResult> {
    return this.logicalVerifier.verify(data);
  }

  /**
   * 仅验证完成度
   */
  async verifyCompleteness(
    data: DataToVerify,
  ): Promise<CompletenessVerificationResult> {
    return this.completenessVerifier.verify(data);
  }

  /**
   * 生成详细报告
   */
  async generateReport(
    data: DataToVerify,
    source?: SourceData,
  ): Promise<{
    summary: string;
    scores: Record<string, { score: number; level: string }>;
    issues: {
      total: number;
      bySeverity: Record<string, number>;
      byCategory: Record<string, number>;
    };
    suggestions: {
      total: number;
      byPriority: Record<string, number>;
      plan: string;
    };
  }> {
    const result = await this.verify(data, source);

    // 生成摘要
    const level = this.scoreCalculator.getScoreLevel(result.overallScore);
    const summary = `综合评分: ${result.overallScore.toFixed(2)} (${level}) - ${result.passed ? "通过" : "未通过"}`;

    // 生成评分详情
    const scores: Record<string, { score: number; level: string }> = {
      overall: {
        score: result.overallScore,
        level,
      },
      factual: {
        score: result.factualAccuracy,
        level: this.scoreCalculator.getScoreLevel(result.factualAccuracy),
      },
      logical: {
        score: result.logicalConsistency,
        level: this.scoreCalculator.getScoreLevel(result.logicalConsistency),
      },
      completeness: {
        score: result.taskCompleteness,
        level: this.scoreCalculator.getScoreLevel(result.taskCompleteness),
      },
    };

    // 生成问题统计
    const issueStats = this.issueCollector.getIssueStatistics(result.issues);

    // 生成建议统计
    const suggestionSummary = this.suggestionGenerator.generateSummary(
      result.suggestions,
    );

    return {
      summary,
      scores,
      issues: {
        total: issueStats.total,
        bySeverity: issueStats.bySeverity,
        byCategory: issueStats.byCategory,
      },
      suggestions: {
        total: suggestionSummary.total,
        byPriority: {
          urgent: suggestionSummary.urgent,
          high: suggestionSummary.high,
          medium: suggestionSummary.medium,
          low: suggestionSummary.low,
        },
        plan: suggestionSummary.summary,
      },
    };
  }

  /**
   * 获取改进计划
   */
  async getImprovementPlan(
    data: DataToVerify,
    source?: SourceData,
  ): Promise<
    Array<{
      priority: string;
      count: number;
      estimatedTime: string;
      items: Array<{
        type: string;
        action: string;
        reason: string;
        impact: string;
      }>;
    }>
  > {
    const result = await this.verify(data, source);
    const plan = this.suggestionGenerator.generateImprovementPlan(
      result.suggestions,
    );

    return plan.map((item) => ({
      priority: item.priority,
      count: item.suggestions.length,
      estimatedTime: item.estimatedTime,
      items: item.suggestions.map((s) => ({
        type: s.type,
        action: s.action,
        reason: s.reason,
        impact: s.estimatedImpact,
      })),
    }));
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VerificationConfig>): void {
    this.config = { ...this.config, ...config };
    this.scoreCalculator.updateConfig(this.config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): VerificationConfig {
    return { ...this.config };
  }

  /**
   * 获取问题收集器实例
   */
  getIssueCollector(): IssueCollector {
    return this.issueCollector;
  }

  /**
   * 获取建议生成器实例
   */
  getSuggestionGenerator(): SuggestionGenerator {
    return this.suggestionGenerator;
  }
}

// 导出所有必要类型和类
export type {
  VerificationResult,
  VerificationConfig,
  VerificationIssue,
  VerificationSuggestion,
  FactualVerificationResult,
  LogicalVerificationResult,
  CompletenessVerificationResult,
} from "./types";
export {
  DEFAULT_VERIFICATION_CONFIG,
  IssueType,
  IssueSeverity,
  IssueCategory,
  SuggestionType,
  SuggestionPriority,
} from "./types";

export { FactualVerifier } from "./verifiers/factual-verifier";
export { LogicalVerifier } from "./verifiers/logical-verifier";
export { CompletenessVerifier } from "./verifiers/completeness-verifier";
export { ScoreCalculator } from "./analyzers/score-calculator";
export { IssueCollector } from "./analyzers/issue-collector";
export { SuggestionGenerator } from "./analyzers/suggestion-generator";
