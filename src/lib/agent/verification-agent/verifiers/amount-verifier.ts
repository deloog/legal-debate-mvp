/**
 * 金额数据验证器
 * 验证金额的格式、范围、单位和货币正确性
 */
import {
  AmountVerification,
  IssueType,
  IssueSeverity,
  VerificationIssue,
  IssueCategory,
} from "../types";

/**
 * 源数据接口（用于对比验证）
 */
interface SourceData {
  amounts?: Array<{ field: string; value: string | number }>;
}

/**
 * 待验证数据接口
 */
interface DataToVerify {
  amounts?: Array<{ field: string; value: string | number }>;
}

/**
 * 金额验证器类
 */
export class AmountVerifier {
  /**
   * 验证金额数据
   */
  async verify(
    data: DataToVerify,
    source?: SourceData,
  ): Promise<AmountVerification> {
    const issues: string[] = [];
    const details = {
      formatValid: true,
      rangeValid: true,
      unitValid: true,
      currencyValid: true,
    };

    if (!data.amounts || data.amounts.length === 0) {
      return {
        passed: false,
        details,
        issues: ["未提供金额数据"],
      };
    }

    for (const amount of data.amounts) {
      // 格式验证
      const amountValue = parseFloat(String(amount.value));
      if (isNaN(amountValue)) {
        details.formatValid = false;
        issues.push(`字段${amount.field}的金额格式无效`);
      }

      // 范围验证（金额应为正数，且不超过合理上限）
      if (amountValue < 0) {
        details.rangeValid = false;
        issues.push(`字段${amount.field}的金额不能为负数`);
      }
      if (amountValue > 1e10) {
        details.rangeValid = false;
        issues.push(`字段${amount.field}的金额超过合理上限`);
      }

      // 单位验证（检查是否包含单位）
      const valueStr = String(amount.value);
      if (!/[元￥¥CNY]/.test(valueStr) && amountValue > 0) {
        details.unitValid = false;
        issues.push(`字段${amount.field}缺少货币单位`);
      }

      // 与源数据对比
      if (source?.amounts) {
        const sourceAmount = source.amounts.find(
          (a) => a.field === amount.field,
        );
        if (
          sourceAmount &&
          amountValue !== parseFloat(String(sourceAmount.value))
        ) {
          details.currencyValid = false;
          issues.push(
            `字段${amount.field}金额不一致：期望"${sourceAmount.value}"，实际"${amount.value}"`,
          );
        }
      }
    }

    const passed =
      issues.length === 0 &&
      details.formatValid &&
      details.rangeValid &&
      details.unitValid &&
      details.currencyValid;

    return {
      passed,
      details,
      issues,
    };
  }

  /**
   * 创建空的金额验证结果
   */
  async getEmptyResult(): Promise<AmountVerification> {
    return {
      passed: true,
      details: {
        formatValid: true,
        rangeValid: true,
        unitValid: true,
        currencyValid: true,
      },
      issues: [],
    };
  }

  /**
   * 将验证结果转换为问题列表
   */
  convertToIssues(result: AmountVerification): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    for (const issue of result.issues) {
      issues.push({
        id: `factual-amount-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.INCORRECT_DATA,
        severity: IssueSeverity.HIGH,
        category: IssueCategory.FACTUAL,
        message: issue,
        detectedBy: "factual",
      });
    }

    return issues;
  }
}
