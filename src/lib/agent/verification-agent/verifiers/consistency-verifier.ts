/**
 * 数据一致性验证器
 * 验证数据与源数据的一致性、内部一致性和冲突检测
 */
import {
  ConsistencyVerification,
  IssueType,
  IssueSeverity,
  VerificationIssue,
  IssueCategory,
} from "../types";

/**
 * 源数据接口（用于对比验证）
 */
interface SourceData {
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
 * 一致性验证器类
 */
export class ConsistencyVerifier {
  /**
   * 验证数据一致性
   */
  async verify(
    data: DataToVerify,
    source?: SourceData,
  ): Promise<ConsistencyVerification> {
    const issues: string[] = [];
    const details = {
      dataConsistent: true,
      noConflicts: true,
      matchesSource: true,
    };

    // 与源数据对比
    if (source?.rawData && Object.keys(source.rawData).length > 0) {
      const inconsistencies: string[] = [];

      for (const [key, value] of Object.entries(source.rawData)) {
        if (data[key] !== undefined && data[key] !== value) {
          inconsistencies.push(
            `字段${key}不一致：期望"${value}"，实际"${data[key]}"`,
          );
        }
      }

      if (inconsistencies.length > 0) {
        details.dataConsistent = false;
        details.matchesSource = false;
        issues.push(...inconsistencies);
      }
    } else {
      // 无源数据时，检查数据内部一致性
      if (data.parties && data.amounts && data.dates) {
        // 检查必填字段是否完整
        const requiredFields = ["plaintiff", "defendant"];
        const missingFields = requiredFields.filter(
          (field) => !data.parties![field],
        );

        if (missingFields.length > 0) {
          details.dataConsistent = false;
          issues.push(`缺少必填字段：${missingFields.join(", ")}`);
        }
      }
    }

    // 检查数据冲突
    if (data.amounts) {
      const duplicateFields = data.amounts.filter(
        (item, index, arr) =>
          arr.findIndex((i) => i.field === item.field) !== index,
      );

      if (duplicateFields.length > 0) {
        details.noConflicts = false;
        issues.push(
          `存在重复字段：${duplicateFields.map((d) => d.field).join(", ")}`,
        );
      }
    }

    const passed =
      issues.length === 0 &&
      details.dataConsistent &&
      details.noConflicts &&
      details.matchesSource;

    return {
      passed,
      details,
      issues,
    };
  }

  /**
   * 创建空的一致性验证结果
   */
  async getEmptyResult(): Promise<ConsistencyVerification> {
    return {
      passed: true,
      details: {
        dataConsistent: true,
        noConflicts: true,
        matchesSource: true,
      },
      issues: [],
    };
  }

  /**
   * 将验证结果转换为问题列表
   */
  convertToIssues(result: ConsistencyVerification): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    for (const issue of result.issues) {
      issues.push({
        id: `factual-consistency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.INCONSISTENT_DATA,
        severity: IssueSeverity.HIGH,
        category: IssueCategory.FACTUAL,
        message: issue,
        detectedBy: "factual",
      });
    }

    return issues;
  }
}
