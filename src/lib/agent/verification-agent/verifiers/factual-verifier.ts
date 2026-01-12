/**
 * 事实准确性验证器（Facade）
 * 集成4个验证器：当事人、金额、日期、一致性验证
 */
import {
  FactualVerificationResult,
  PartyVerification,
  AmountVerification,
  DateVerification,
  ConsistencyVerification,
} from '../types';
import { PartyVerifier } from './party-verifier';
import { AmountVerifier } from './amount-verifier';
import { DateVerifier } from './date-verifier';
import { ConsistencyVerifier } from './consistency-verifier';

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
 * 待验证数据接口
 */
interface DataToVerify {
  parties?: {
    plaintiff?: string | { name: string };
    defendant?: string | { name: string };
  };
  amounts?: Array<{ field: string; value: string | number }>;
  dates?: Array<{ field: string; value: string }>;
  [key: string]: unknown;
}

/**
 * 验证配置
 */
interface FactualVerifierConfig {
  partyCheckEnabled: boolean;
  amountCheckEnabled: boolean;
  dateCheckEnabled: boolean;
  consistencyCheckEnabled: boolean;
  thresholds: {
    partyThreshold: number;
    amountThreshold: number;
    dateThreshold: number;
    consistencyThreshold: number;
  };
}

/**
 * 默认验证配置
 */
const DEFAULT_CONFIG: FactualVerifierConfig = {
  partyCheckEnabled: true,
  amountCheckEnabled: true,
  dateCheckEnabled: true,
  consistencyCheckEnabled: true,
  thresholds: {
    partyThreshold: 0.9,
    amountThreshold: 0.85,
    dateThreshold: 0.9,
    consistencyThreshold: 0.85,
  },
};

/**
 * 事实准确性验证器类（Facade）
 */
export class FactualVerifier {
  private config: FactualVerifierConfig;
  private partyVerifier: PartyVerifier;
  private amountVerifier: AmountVerifier;
  private dateVerifier: DateVerifier;
  private consistencyVerifier: ConsistencyVerifier;

  constructor(config?: Partial<FactualVerifierConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.partyVerifier = new PartyVerifier();
    this.amountVerifier = new AmountVerifier();
    this.dateVerifier = new DateVerifier();
    this.consistencyVerifier = new ConsistencyVerifier();
  }

  /**
   * 执行完整的事实准确性验证
   */
  async verify(
    data: DataToVerify,
    source?: SourceData
  ): Promise<FactualVerificationResult> {
    const startTime = Date.now();

    // 并行执行各项检查
    const [partyCheck, amountCheck, dateCheck, consistencyCheck] =
      await Promise.all([
        this.config.partyCheckEnabled
          ? this.partyVerifier.verify(data, source)
          : this.partyVerifier.getEmptyResult(),
        this.config.amountCheckEnabled
          ? this.amountVerifier.verify(data, source)
          : this.amountVerifier.getEmptyResult(),
        this.config.dateCheckEnabled
          ? this.dateVerifier.verify(data, source)
          : this.dateVerifier.getEmptyResult(),
        this.config.consistencyCheckEnabled
          ? this.consistencyVerifier.verify(data, source)
          : this.consistencyVerifier.getEmptyResult(),
      ]);

    // 计算综合评分
    const score = this.calculateFactualScore(
      partyCheck,
      amountCheck,
      dateCheck,
      consistencyCheck
    );

    const passed =
      score >= this.config.thresholds.partyThreshold &&
      partyCheck.passed &&
      amountCheck.passed &&
      dateCheck.passed &&
      consistencyCheck.passed;

    const verificationTime = Date.now() - startTime;

    return {
      score,
      passed,
      details: {
        partyCheck,
        amountCheck,
        dateCheck,
        consistencyCheck,
      },
      verificationTime,
    } as FactualVerificationResult;
  }

  /**
   * 计算事实准确性综合评分
   */
  private calculateFactualScore(
    partyCheck: PartyVerification,
    amountCheck: AmountVerification,
    dateCheck: DateVerification,
    consistencyCheck: ConsistencyVerification
  ): number {
    const scores: number[] = [];

    // 当事人验证评分
    scores.push(partyCheck.passed ? 1 : 0);
    if (partyCheck.issues.length > 0) {
      scores.push(1 - partyCheck.issues.length * 0.1);
    }

    // 金额验证评分
    scores.push(amountCheck.passed ? 1 : 0);
    if (amountCheck.issues.length > 0) {
      scores.push(1 - amountCheck.issues.length * 0.1);
    }

    // 日期验证评分
    scores.push(dateCheck.passed ? 1 : 0);
    if (dateCheck.issues.length > 0) {
      scores.push(1 - dateCheck.issues.length * 0.1);
    }

    // 一致性验证评分
    scores.push(consistencyCheck.passed ? 1 : 0);
    if (consistencyCheck.issues.length > 0) {
      scores.push(1 - consistencyCheck.issues.length * 0.1);
    }

    // 计算平均分
    const sum = scores.reduce((acc, score) => acc + Math.max(0, score), 0);
    const average = sum / scores.length;

    return Math.min(1, Math.max(0, average));
  }

  /**
   * 将验证结果转换为问题列表
   */
  convertToIssues(result: FactualVerificationResult) {
    const issues = [
      ...this.partyVerifier.convertToIssues(result.details.partyCheck),
      ...this.amountVerifier.convertToIssues(result.details.amountCheck),
      ...this.dateVerifier.convertToIssues(result.details.dateCheck),
      ...this.consistencyVerifier.convertToIssues(
        result.details.consistencyCheck
      ),
    ];
    return issues;
  }
}
