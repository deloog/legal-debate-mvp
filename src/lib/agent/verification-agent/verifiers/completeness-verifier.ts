/**
 * 任务完成度验证器（Facade）
 * 集成4个检查器：必填字段、业务规则、格式检查、质量阈值
 */
import {
  CompletenessVerificationResult,
  IssueType,
  IssueSeverity,
  VerificationIssue,
  IssueCategory,
} from '../types';
import { RequiredFieldsChecker } from './required-fields-checker';
import { BusinessRulesChecker } from './business-rules-checker';
import { FormatChecker } from './format-checker';
import { QualityThresholdChecker } from './quality-threshold-checker';

/**
 * 待验证数据接口
 */
interface DataToVerify {
  [key: string]: unknown;
}

/**
 * 验证配置
 */
interface CompletenessVerifierConfig {
  requiredFieldsCheckEnabled: boolean;
  businessRulesCheckEnabled: boolean;
  formatCheckEnabled: boolean;
  qualityCheckEnabled: boolean;
  thresholds: {
    completenessThreshold: number;
  };
}

/**
 * 默认验证配置
 */
const DEFAULT_CONFIG: CompletenessVerifierConfig = {
  requiredFieldsCheckEnabled: true,
  businessRulesCheckEnabled: true,
  formatCheckEnabled: true,
  qualityCheckEnabled: true,
  thresholds: {
    completenessThreshold: 0.9,
  },
};

/**
 * 任务完成度验证器类（Facade）
 */
export class CompletenessVerifier {
  private config: CompletenessVerifierConfig;
  private requiredFieldsChecker: RequiredFieldsChecker;
  private businessRulesChecker: BusinessRulesChecker;
  private formatChecker: FormatChecker;
  private qualityThresholdChecker: QualityThresholdChecker;

  constructor(config?: Partial<CompletenessVerifierConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.requiredFieldsChecker = new RequiredFieldsChecker();
    this.businessRulesChecker = new BusinessRulesChecker();
    this.formatChecker = new FormatChecker();
    this.qualityThresholdChecker = new QualityThresholdChecker();
  }

  /**
   * 执行完整的任务完成度验证
   */
  async verify(data: DataToVerify): Promise<CompletenessVerificationResult> {
    const startTime = Date.now();

    // 并行执行各项检查
    const [requiredFields, businessRules, formatCheck, qualityCheck] =
      await Promise.all([
        this.config.requiredFieldsCheckEnabled
          ? this.requiredFieldsChecker.check(data)
          : this.requiredFieldsChecker.getEmptyResult(),
        this.config.businessRulesCheckEnabled
          ? this.businessRulesChecker.check(data)
          : this.businessRulesChecker.getEmptyResult(),
        this.config.formatCheckEnabled
          ? this.formatChecker.check(data)
          : this.formatChecker.getEmptyResult(),
        this.config.qualityCheckEnabled
          ? this.qualityThresholdChecker.check(data)
          : this.qualityThresholdChecker.getEmptyResult(),
      ]);

    // 计算综合评分
    const score = this.calculateCompletenessScore(
      requiredFields,
      businessRules,
      formatCheck,
      qualityCheck
    );

    const passed =
      score >= this.config.thresholds.completenessThreshold &&
      requiredFields.passed &&
      businessRules.passed &&
      formatCheck.passed;

    const verificationTime = Date.now() - startTime;

    return {
      score,
      passed,
      details: {
        requiredFields,
        businessRules,
        formatCheck,
        qualityCheck,
      },
      verificationTime,
    } as CompletenessVerificationResult;
  }

  /**
   * 计算完成度综合评分
   */
  private calculateCompletenessScore(
    requiredFields: { score: number },
    businessRules: { passed: boolean },
    formatCheck: { passed: boolean },
    qualityCheck: { score: number }
  ): number {
    let score = 0;

    // 必填字段完整性 (40%)
    score += requiredFields.score * 0.4;

    // 业务规则符合性 (30%)
    score += (businessRules.passed ? 1 : 0) * 0.3;

    // 格式正确性 (15%)
    score += (formatCheck.passed ? 1 : 0) * 0.15;

    // 质量阈值 (15%)
    score += qualityCheck.score * 0.15;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 将验证结果转换为问题列表
   */
  convertToIssues(result: CompletenessVerificationResult): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    // 必填字段问题
    for (const field of result.details.requiredFields.missingFields) {
      issues.push({
        id: `issue-complete-field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.MISSING_DATA,
        severity: IssueSeverity.HIGH,
        category: IssueCategory.COMPLETENESS,
        field: field,
        message: `缺少必填字段: ${field}`,
        detectedBy: 'completeness',
      });
    }

    // 业务规则违反问题
    for (const rule of result.details.businessRules.violatedRules) {
      issues.push({
        id: `issue-complete-rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.BUSINESS_RULE_VIOLATION,
        severity: IssueSeverity.HIGH,
        category: IssueCategory.COMPLETENESS,
        message: rule,
        detectedBy: 'completeness',
      });
    }

    // 格式错误问题
    for (const error of result.details.formatCheck.formatErrors) {
      issues.push({
        id: `issue-complete-format-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.FORMAT_ERROR,
        severity: IssueSeverity.MEDIUM,
        category: IssueCategory.FORMAT,
        field: error.field,
        message: `${error.field}格式错误: ${error.error}`,
        suggestion: `期望格式: ${error.expected}`,
        detectedBy: 'completeness',
      });
    }

    // 质量阈值问题
    for (const [name, threshold] of Object.entries(
      result.details.qualityCheck.thresholds
    )) {
      if (!threshold.passed) {
        issues.push({
          id: `issue-complete-quality-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: IssueType.QUALITY_BELOW_THRESHOLD,
          severity: IssueSeverity.MEDIUM,
          category: IssueCategory.QUALITY,
          message: `${name}质量低于阈值: 实际${threshold.actual}, 期望${threshold.threshold}`,
          detectedBy: 'completeness',
        });
      }
    }

    return issues;
  }
}
