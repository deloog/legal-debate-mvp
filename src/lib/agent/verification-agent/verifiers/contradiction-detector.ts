/**
 * 矛盾检测器
 * 检测事实矛盾、逻辑矛盾和时间矛盾
 */
import {
  ContradictionCheck,
  Contradiction,
  ContradictionType,
  IssueSeverity,
} from "../types";

/**
 * 待验证数据接口
 */
interface DataToVerify {
  facts?: string[]; // 事实理由
  arguments?: string[]; // 论点
  dates?: Array<{ field: string; value: string }>;
  [key: string]: unknown;
}

/**
 * 矛盾检测器类
 */
export class ContradictionDetector {
  /**
   * 检测矛盾
   */
  async detect(data: DataToVerify): Promise<ContradictionCheck> {
    const contradictions: Contradiction[] = [];

    // 检测事实矛盾
    if (data.facts && data.facts.length > 1) {
      for (let i = 0; i < data.facts.length; i++) {
        for (let j = i + 1; j < data.facts.length; j++) {
          if (this.hasFactualContradiction(data.facts[i], data.facts[j])) {
            contradictions.push({
              id: `contradiction-fact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: ContradictionType.FACTUAL,
              description: `事实${i + 1}与事实${j + 1}存在矛盾`,
              statements: [data.facts[i], data.facts[j]],
              severity: IssueSeverity.HIGH,
            });
          }
        }
      }
    }

    // 检测逻辑矛盾
    if (data.arguments && data.arguments.length > 1) {
      for (let i = 0; i < data.arguments.length; i++) {
        for (let j = i + 1; j < data.arguments.length; j++) {
          if (
            this.hasLogicalContradiction(data.arguments[i], data.arguments[j])
          ) {
            contradictions.push({
              id: `contradiction-logic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: ContradictionType.LOGICAL,
              description: `论点${i + 1}与论点${j + 1}存在逻辑矛盾`,
              statements: [data.arguments[i], data.arguments[j]],
              severity: IssueSeverity.HIGH,
            });
          }
        }
      }
    }

    // 检测时间矛盾
    if (data.dates && Array.isArray(data.dates) && data.dates.length > 1) {
      const sortedDates = [...data.dates].sort(
        (a, b) => new Date(a.value).getTime() - new Date(b.value).getTime(),
      );

      for (let i = 0; i < sortedDates.length - 1; i++) {
        const date1 = new Date(sortedDates[i].value);
        const date2 = new Date(sortedDates[i + 1].value);

        if (date1.getTime() === date2.getTime()) {
          contradictions.push({
            id: `contradiction-time-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: ContradictionType.TEMPORAL,
            description: `${sortedDates[i].field}与${sortedDates[i + 1].field}时间相同`,
            statements: [sortedDates[i].value, sortedDates[i + 1].value],
            severity: IssueSeverity.MEDIUM,
          });
        }
      }
    }

    return {
      hasContradictions: contradictions.length > 0,
      contradictions,
    };
  }

  /**
   * 检测事实矛盾
   */
  private hasFactualContradiction(fact1: string, fact2: string): boolean {
    // 检查否定词
    const negationWords1 = ["不", "没有", "未", "非"];
    const negationWords2 = ["是", "有", "存在"];

    const words1 = fact1.split(/[^a-zA-Z0-9\u4e00-\u9fa5]/);
    const words2 = fact2.split(/[^a-zA-Z0-9\u4e00-\u9fa5]/);

    // 查找相同的核心词
    const commonWords = words1.filter(
      (word) => words2.includes(word) && word.length > 1,
    );

    if (commonWords.length > 0) {
      const hasNegation1 = negationWords1.some((word) => fact1.includes(word));
      const hasNegation2 = negationWords2.some((word) => fact2.includes(word));

      return hasNegation1 && hasNegation2;
    }

    return false;
  }

  /**
   * 检测逻辑矛盾
   */
  private hasLogicalContradiction(arg1: string, arg2: string): boolean {
    const contradictionPairs = [
      ["一定", "不一定"],
      ["必须", "不必"],
      ["肯定", "可能不"],
      ["完全", "部分"],
      ["所有", "有些"],
    ];

    for (const [word1, word2] of contradictionPairs) {
      if (arg1.includes(word1) && arg2.includes(word2)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 创建空的矛盾检测结果
   */
  async getEmptyResult(): Promise<ContradictionCheck> {
    return {
      hasContradictions: false,
      contradictions: [],
    };
  }
}
