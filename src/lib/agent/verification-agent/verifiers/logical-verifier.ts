/**
 * 逻辑一致性验证器（Facade）
 * 集成4个检查器：诉讼请求匹配、推理链、法条引用、矛盾检测
 */
import {
  LogicalVerificationResult,
  IssueType,
  IssueSeverity,
  VerificationIssue,
  IssueCategory,
  Contradiction,
} from "../types";
import { ClaimFactMatcher } from "./claim-fact-matcher";
import { ReasoningChainChecker } from "./reasoning-chain-checker";
import { LegalLogicChecker } from "./legal-logic-checker";
import { ContradictionDetector } from "./contradiction-detector";

/**
 * 待验证数据接口
 */
interface DataToVerify {
  claims?: string[]; // 诉讼请求
  facts?: string[]; // 事实理由
  arguments?: string[]; // 论点
  legalBasis?: Array<{ lawName: string; articleNumber: string }>; // 法律依据
  reasoning?: string; // 推理过程
  dates?: Array<{ field: string; value: string }>;
  [key: string]: unknown;
}

/**
 * 验证配置
 */
interface LogicalVerifierConfig {
  claimFactCheckEnabled: boolean;
  reasoningChainCheckEnabled: boolean;
  legalLogicCheckEnabled: boolean;
  contradictionCheckEnabled: boolean;
  aiAssistanceEnabled: boolean;
  thresholds: {
    claimFactMatchThreshold: number;
    reasoningChainThreshold: number;
    legalLogicThreshold: number;
    contradictionThreshold: number;
  };
}

/**
 * 默认验证配置
 */
const DEFAULT_CONFIG: LogicalVerifierConfig = {
  claimFactCheckEnabled: true,
  reasoningChainCheckEnabled: true,
  legalLogicCheckEnabled: true,
  contradictionCheckEnabled: true,
  aiAssistanceEnabled: true,
  thresholds: {
    claimFactMatchThreshold: 0.8,
    reasoningChainThreshold: 0.85,
    legalLogicThreshold: 0.9,
    contradictionThreshold: 1.0,
  },
};

/**
 * 逻辑一致性验证器类（Facade）
 */
export class LogicalVerifier {
  private config: LogicalVerifierConfig;
  private claimFactMatcher: ClaimFactMatcher;
  private reasoningChainChecker: ReasoningChainChecker;
  private legalLogicChecker: LegalLogicChecker;
  private contradictionDetector: ContradictionDetector;

  constructor(config?: Partial<LogicalVerifierConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.claimFactMatcher = new ClaimFactMatcher();
    this.reasoningChainChecker = new ReasoningChainChecker();
    this.legalLogicChecker = new LegalLogicChecker();
    this.contradictionDetector = new ContradictionDetector();
  }

  /**
   * 执行完整的逻辑一致性验证
   */
  async verify(data: DataToVerify): Promise<LogicalVerificationResult> {
    const startTime = Date.now();

    // 并行执行各项检查
    const [claimFactMatch, reasoningChain, legalLogic, contradictions] =
      await Promise.all([
        this.config.claimFactCheckEnabled
          ? this.claimFactMatcher.check(data)
          : 0,
        this.config.reasoningChainCheckEnabled
          ? this.reasoningChainChecker.check(data)
          : this.reasoningChainChecker.getEmptyResult(),
        this.config.legalLogicCheckEnabled
          ? this.legalLogicChecker.check(data)
          : this.legalLogicChecker.getEmptyResult(),
        this.config.contradictionCheckEnabled
          ? this.contradictionDetector.detect(data)
          : this.contradictionDetector.getEmptyResult(),
      ]);

    // 计算综合评分
    const score = this.calculateLogicalScore(
      claimFactMatch,
      reasoningChain,
      legalLogic,
      contradictions,
    );

    const passed =
      score >= this.config.thresholds.claimFactMatchThreshold &&
      !contradictions.hasContradictions;

    const verificationTime = Date.now() - startTime;

    return {
      score,
      passed,
      details: {
        claimFactMatch,
        reasoningChain,
        legalLogic,
        contradictions,
      },
      verificationTime,
    } as LogicalVerificationResult;
  }

  /**
   * 计算逻辑一致性综合评分
   */
  private calculateLogicalScore(
    claimFactMatch: number,
    reasoningChain: { score: number },
    legalLogic: { score: number },
    contradictions: {
      hasContradictions: boolean;
      contradictions: Contradiction[];
    },
  ): number {
    let score = 0;

    // 诉讼请求与事实匹配度 (40%)
    score += claimFactMatch * 0.4;

    // 推理链完整性 (30%)
    score += reasoningChain.score * 0.3;

    // 法条引用逻辑性 (20%)
    score += legalLogic.score * 0.2;

    // 矛盾检测 (10%)
    if (contradictions.hasContradictions) {
      score -= contradictions.contradictions.length * 0.05;
    } else {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 将验证结果转换为问题列表
   */
  convertToIssues(result: LogicalVerificationResult): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    // 推理链缺口问题
    for (const gap of result.details.reasoningChain.gaps) {
      issues.push({
        id: `issue-logical-gap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.LOGICAL_ERROR,
        severity: IssueSeverity.MEDIUM,
        category: IssueCategory.LOGICAL,
        message: gap,
        detectedBy: "logical",
      });
    }

    // 循环推理问题
    for (const loop of result.details.reasoningChain.loops) {
      issues.push({
        id: `issue-logical-loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.LOGICAL_ERROR,
        severity: IssueSeverity.MEDIUM,
        category: IssueCategory.LOGICAL,
        message: loop,
        detectedBy: "logical",
      });
    }

    // 矛盾问题
    for (const contradiction of result.details.contradictions.contradictions) {
      issues.push({
        id: `issue-logical-contradiction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.CONTRADICTION,
        severity: contradiction.severity,
        category: IssueCategory.LOGICAL,
        message: contradiction.description,
        suggestion: "请检查并修正矛盾的陈述",
        detectedBy: "logical",
      });
    }

    // 法条引用问题
    if (result.details.legalLogic.score < 0.8) {
      issues.push({
        id: `issue-legal-logic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.LOGICAL_ERROR,
        severity: IssueSeverity.MEDIUM,
        category: IssueCategory.LOGICAL,
        message: "法条引用逻辑性不足，请检查法条的有效性和相关性",
        detectedBy: "logical",
      });
    }

    return issues;
  }
}
