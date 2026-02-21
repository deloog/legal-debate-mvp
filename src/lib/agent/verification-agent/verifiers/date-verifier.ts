/**
 * 日期时间验证器
 * 验证日期的格式、逻辑正确性和时间顺序
 */
import {
  DateVerification,
  IssueType,
  IssueSeverity,
  VerificationIssue,
  IssueCategory,
} from '../types';

/**
 * 源数据接口（用于对比验证）
 */
interface SourceData {
  dates?: Array<{ field: string; value: string }>;
}

/**
 * 待验证数据接口
 */
interface DataToVerify {
  dates?: Array<{ field: string; value: string }>;
}

/**
 * 日期验证器类
 */
export class DateVerifier {
  /**
   * 验证日期时间
   */
  async verify(
    data: DataToVerify,
    _source?: SourceData
  ): Promise<DateVerification> {
    const issues: string[] = [];
    const details = {
      formatValid: true,
      logicalValid: true,
      chronologicalValid: true,
    };

    if (!data.dates || data.dates.length === 0) {
      return {
        passed: false,
        details,
        issues: ['未提供日期数据'],
      };
    }

    const parsedDates: Array<{ field: string; date: Date }> = [];

    for (const dateItem of data.dates) {
      // 格式验证
      const date = new Date(dateItem.value);
      if (isNaN(date.getTime())) {
        details.formatValid = false;
        issues.push(`字段${dateItem.field}的日期格式无效`);
        continue;
      }

      // 逻辑验证（日期不能在未来）
      if (date > new Date()) {
        details.logicalValid = false;
        issues.push(`字段${dateItem.field}的日期在未来`);
      }

      // 逻辑验证（日期不能过早）
      if (date < new Date('1900-01-01')) {
        details.logicalValid = false;
        issues.push(`字段${dateItem.field}的日期过早`);
      }

      parsedDates.push({ field: dateItem.field, date });
    }

    // 时间顺序验证
    if (parsedDates.length > 1) {
      for (let i = 0; i < parsedDates.length - 1; i++) {
        if (parsedDates[i].date > parsedDates[i + 1].date) {
          details.chronologicalValid = false;
          issues.push(
            `时间顺序错误：${parsedDates[i].field}晚于${parsedDates[i + 1].field}`
          );
        }
      }
    }

    const passed =
      issues.length === 0 &&
      details.formatValid &&
      details.logicalValid &&
      details.chronologicalValid;

    return {
      passed,
      details,
      issues,
    };
  }

  /**
   * 创建空的日期验证结果
   */
  async getEmptyResult(): Promise<DateVerification> {
    return {
      passed: true,
      details: {
        formatValid: true,
        logicalValid: true,
        chronologicalValid: true,
      },
      issues: [],
    };
  }

  /**
   * 将验证结果转换为问题列表
   */
  convertToIssues(result: DateVerification): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    for (const issue of result.issues) {
      issues.push({
        id: `factual-date-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.INCORRECT_DATA,
        severity: IssueSeverity.MEDIUM,
        category: IssueCategory.FACTUAL,
        message: issue,
        detectedBy: 'factual',
      });
    }

    return issues;
  }
}
