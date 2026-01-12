/**
 * 建议生成器（Facade）
 * 集成3个生成器：事实、逻辑、质量
 */
import {
  VerificationSuggestion,
  SuggestionType,
  SuggestionPriority,
  VerificationIssue,
} from '../types';
import { FactBasedSuggestionGenerator } from './fact-based-suggestion-generator';
import { LogicBasedSuggestionGenerator } from './logic-based-suggestion-generator';
import { QualityBasedSuggestionGenerator } from './quality-based-suggestion-generator';

/**
 * 建议生成器类（Facade）
 */
export class SuggestionGenerator {
  private factBasedGenerator: FactBasedSuggestionGenerator;
  private logicBasedGenerator: LogicBasedSuggestionGenerator;
  private qualityBasedGenerator: QualityBasedSuggestionGenerator;

  constructor() {
    this.factBasedGenerator = new FactBasedSuggestionGenerator();
    this.logicBasedGenerator = new LogicBasedSuggestionGenerator();
    this.qualityBasedGenerator = new QualityBasedSuggestionGenerator();
  }

  /**
   * 生成所有建议
   */
  generateSuggestions(issues: VerificationIssue[]): VerificationSuggestion[] {
    const suggestions: VerificationSuggestion[] = [];

    // 为每个问题生成对应的建议
    for (const issue of issues) {
      // 尝试从各个生成器中获取建议
      const suggestion =
        this.factBasedGenerator.generate(issue) ||
        this.logicBasedGenerator.generate(issue) ||
        this.qualityBasedGenerator.generate(issue);

      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // 去重
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);

    // 按优先级排序
    return this.sortByPriority(uniqueSuggestions);
  }

  /**
   * 按类型分组建议
   */
  groupByType(
    suggestions: VerificationSuggestion[]
  ): Map<SuggestionType, VerificationSuggestion[]> {
    const groups = new Map<SuggestionType, VerificationSuggestion[]>();

    for (const suggestion of suggestions) {
      if (!groups.has(suggestion.type)) {
        groups.set(suggestion.type, []);
      }
      groups.get(suggestion.type)!.push(suggestion);
    }

    return groups;
  }

  /**
   * 按优先级分组建议
   */
  groupByPriority(
    suggestions: VerificationSuggestion[]
  ): Map<SuggestionPriority, VerificationSuggestion[]> {
    const groups = new Map<SuggestionPriority, VerificationSuggestion[]>();

    for (const suggestion of suggestions) {
      if (!groups.has(suggestion.priority)) {
        groups.set(suggestion.priority, []);
      }
      groups.get(suggestion.priority)!.push(suggestion);
    }

    return groups;
  }

  /**
   * 过滤建议
   */
  filterSuggestions(
    suggestions: VerificationSuggestion[],
    filters: {
      type?: SuggestionType[];
      priority?: SuggestionPriority[];
      target?: string[];
    }
  ): VerificationSuggestion[] {
    return suggestions.filter(suggestion => {
      if (filters.type && !filters.type.includes(suggestion.type)) {
        return false;
      }
      if (filters.priority && !filters.priority.includes(suggestion.priority)) {
        return false;
      }
      if (filters.target && !filters.target.includes(suggestion.target || '')) {
        return false;
      }
      return true;
    });
  }

  /**
   * 生成建议摘要
   */
  generateSummary(suggestions: VerificationSuggestion[]): {
    total: number;
    urgent: number;
    high: number;
    medium: number;
    low: number;
    byType: Record<SuggestionType, number>;
    summary: string;
  } {
    const byType: Record<SuggestionType, number> = {
      [SuggestionType.DATA_COMPLETION]: 0,
      [SuggestionType.DATA_CORRECTION]: 0,
      [SuggestionType.LOGIC_IMPROVEMENT]: 0,
      [SuggestionType.FORMAT_STANDARDIZATION]: 0,
      [SuggestionType.VALIDATION_ENHANCEMENT]: 0,
      [SuggestionType.RISK_MITIGATION]: 0,
    };

    let urgent = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const suggestion of suggestions) {
      byType[suggestion.type]++;

      switch (suggestion.priority) {
        case SuggestionPriority.URGENT:
          urgent++;
          break;
        case SuggestionPriority.HIGH:
          high++;
          break;
        case SuggestionPriority.MEDIUM:
          medium++;
          break;
        case SuggestionPriority.LOW:
          low++;
          break;
      }
    }

    const summary: string[] = [];
    if (urgent > 0) {
      summary.push(`${urgent}个紧急建议`);
    }
    if (high > 0) {
      summary.push(`${high}个高优先级建议`);
    }
    if (medium > 0) {
      summary.push(`${medium}个中等优先级建议`);
    }
    if (low > 0) {
      summary.push(`${low}个低优先级建议`);
    }

    return {
      total: suggestions.length,
      urgent,
      high,
      medium,
      low,
      byType,
      summary: summary.join('，'),
    };
  }

  /**
   * 生成改进计划
   */
  generateImprovementPlan(suggestions: VerificationSuggestion[]): Array<{
    priority: SuggestionPriority;
    suggestions: VerificationSuggestion[];
    estimatedTime: string;
  }> {
    const plan: Array<{
      priority: SuggestionPriority;
      suggestions: VerificationSuggestion[];
      estimatedTime: string;
    }> = [];

    const byPriority = this.groupByPriority(suggestions);

    const priorityOrder: SuggestionPriority[] = [
      SuggestionPriority.URGENT,
      SuggestionPriority.HIGH,
      SuggestionPriority.MEDIUM,
      SuggestionPriority.LOW,
    ];

    for (const priority of priorityOrder) {
      const group = byPriority.get(priority);
      if (group && group.length > 0) {
        plan.push({
          priority,
          suggestions: group,
          estimatedTime: this.estimateTime(priority, group.length),
        });
      }
    }

    return plan;
  }

  /**
   * 估计修复时间
   */
  private estimateTime(priority: SuggestionPriority, count: number): string {
    const timePerItem: Record<SuggestionPriority, number> = {
      urgent: 10,
      high: 15,
      medium: 20,
      low: 30,
    };

    const minutes = timePerItem[priority] * count;

    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    if (minutes < 180) {
      return `${Math.round(minutes / 60)}小时`;
    }
    return `${Math.round(minutes / 60)}小时以上`;
  }

  /**
   * 去重建议
   */
  private deduplicateSuggestions(
    suggestions: VerificationSuggestion[]
  ): VerificationSuggestion[] {
    const seen = new Set<string>();
    const unique: VerificationSuggestion[] = [];

    for (const suggestion of suggestions) {
      const key = `${suggestion.type}-${suggestion.target}-${suggestion.action}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    return unique;
  }

  /**
   * 按优先级排序
   */
  private sortByPriority(
    suggestions: VerificationSuggestion[]
  ): VerificationSuggestion[] {
    const priorityOrder: Record<SuggestionPriority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...suggestions].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }
}
