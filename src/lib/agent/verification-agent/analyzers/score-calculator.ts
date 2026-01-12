/**
 * 综合评分计算器
 * 根据三重验证的结果计算综合评分
 */
import {
  FactualVerificationResult,
  LogicalVerificationResult,
  CompletenessVerificationResult,
  VerificationConfig,
  DEFAULT_VERIFICATION_CONFIG,
} from '../types';

/**
 * 评分计算器类
 */
export class ScoreCalculator {
  private config: VerificationConfig;

  constructor(config?: Partial<VerificationConfig>) {
    this.config = {
      ...DEFAULT_VERIFICATION_CONFIG,
      ...config,
    };
  }

  /**
   * 计算综合评分
   */
  calculateOverallScore(
    factualResult: FactualVerificationResult,
    logicalResult: LogicalVerificationResult,
    completenessResult: CompletenessVerificationResult
  ): number {
    // 使用加权平均计算综合评分
    const score =
      factualResult.score * this.config.weights.factual +
      logicalResult.score * this.config.weights.logical +
      completenessResult.score * this.config.weights.completeness;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * 检查是否通过验证
   */
  checkPassed(
    overallScore: number,
    factualResult: FactualVerificationResult,
    logicalResult: LogicalVerificationResult,
    completenessResult: CompletenessVerificationResult
  ): boolean {
    return (
      overallScore >= this.config.thresholds.overall &&
      factualResult.passed &&
      logicalResult.passed &&
      completenessResult.passed
    );
  }

  /**
   * 计算改进潜力分数
   */
  calculateImprovementPotential(
    factualResult: FactualVerificationResult,
    logicalResult: LogicalVerificationResult,
    completenessResult: CompletenessVerificationResult
  ): {
    overall: number;
    factual: number;
    logical: number;
    completeness: number;
  } {
    const factualPotential = 1 - factualResult.score;
    const logicalPotential = 1 - logicalResult.score;
    const completenessPotential = 1 - completenessResult.score;

    const overallPotential =
      factualPotential * this.config.weights.factual +
      logicalPotential * this.config.weights.logical +
      completenessPotential * this.config.weights.completeness;

    return {
      overall: overallPotential,
      factual: factualPotential,
      logical: logicalPotential,
      completeness: completenessPotential,
    };
  }

  /**
   * 获取评分等级
   */
  getScoreLevel(score: number): string {
    if (score >= 0.95) {
      return '优秀';
    }
    if (score >= 0.9) {
      return '良好';
    }
    if (score >= 0.8) {
      return '及格';
    }
    if (score >= 0.7) {
      return '待改进';
    }
    return '不合格';
  }

  /**
   * 获取详细评分报告
   */
  getDetailedScoreReport(
    overallScore: number,
    factualResult: FactualVerificationResult,
    logicalResult: LogicalVerificationResult,
    completenessResult: CompletenessVerificationResult
  ): {
    overall: { score: number; level: string; passed: boolean };
    factual: { score: number; passed: boolean; issues: string[] };
    logical: { score: number; passed: boolean; issues: string[] };
    completeness: { score: number; passed: boolean; issues: string[] };
  } {
    return {
      overall: {
        score: overallScore,
        level: this.getScoreLevel(overallScore),
        passed: overallScore >= this.config.thresholds.overall,
      },
      factual: {
        score: factualResult.score,
        passed: factualResult.passed,
        issues: this.extractFactualIssues(factualResult),
      },
      logical: {
        score: logicalResult.score,
        passed: logicalResult.passed,
        issues: this.extractLogicalIssues(logicalResult),
      },
      completeness: {
        score: completenessResult.score,
        passed: completenessResult.passed,
        issues: this.extractCompletenessIssues(completenessResult),
      },
    };
  }

  /**
   * 提取事实准确性问题
   */
  private extractFactualIssues(result: FactualVerificationResult): string[] {
    const issues: string[] = [];

    if (!result.details.partyCheck.passed) {
      issues.push('当事人信息验证未通过');
    }
    if (result.details.partyCheck.issues.length > 0) {
      issues.push(...result.details.partyCheck.issues);
    }

    if (!result.details.amountCheck.passed) {
      issues.push('金额数据验证未通过');
    }
    if (result.details.amountCheck.issues.length > 0) {
      issues.push(...result.details.amountCheck.issues);
    }

    if (!result.details.dateCheck.passed) {
      issues.push('日期时间验证未通过');
    }
    if (result.details.dateCheck.issues.length > 0) {
      issues.push(...result.details.dateCheck.issues);
    }

    if (!result.details.consistencyCheck.passed) {
      issues.push('数据一致性验证未通过');
    }
    if (result.details.consistencyCheck.issues.length > 0) {
      issues.push(...result.details.consistencyCheck.issues);
    }

    return issues;
  }

  /**
   * 提取逻辑一致性问题
   */
  private extractLogicalIssues(result: LogicalVerificationResult): string[] {
    const issues: string[] = [];

    if (result.details.claimFactMatch < this.config.thresholds.logical) {
      issues.push('诉讼请求与事实匹配度不足');
    }

    if (result.details.reasoningChain.gaps.length > 0) {
      issues.push(...result.details.reasoningChain.gaps);
    }

    if (result.details.reasoningChain.loops.length > 0) {
      issues.push(...result.details.reasoningChain.loops);
    }

    if (!result.details.legalLogic.valid) {
      issues.push('法条引用无效');
    }
    if (!result.details.legalLogic.relevant) {
      issues.push('法条引用相关性不足');
    }

    if (result.details.contradictions.hasContradictions) {
      issues.push(
        `检测到${result.details.contradictions.contradictions.length}个矛盾`
      );
    }

    return issues;
  }

  /**
   * 提取完成度问题
   */
  private extractCompletenessIssues(
    result: CompletenessVerificationResult
  ): string[] {
    const issues: string[] = [];

    if (
      result.details.requiredFields.missingFields &&
      result.details.requiredFields.missingFields.length > 0
    ) {
      issues.push(
        `缺少${result.details.requiredFields.missingFields.length}个必填字段`
      );
    }

    if (
      result.details.businessRules.violatedRules &&
      result.details.businessRules.violatedRules.length > 0
    ) {
      issues.push(
        `违反${result.details.businessRules.violatedRules.length}个业务规则`
      );
    }

    if (result.details.formatCheck.formatErrors.length > 0) {
      issues.push(
        `存在${result.details.formatCheck.formatErrors.length}个格式错误`
      );
    }

    const failedThresholds = Object.entries(
      result.details.qualityCheck.thresholds
    ).filter(([, v]) => !v.passed);

    if (failedThresholds.length > 0) {
      issues.push(`${failedThresholds.length}个质量指标未达标`);
    }

    return issues;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VerificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): VerificationConfig {
    return { ...this.config };
  }
}
