/**
 * 基于规则的关系检测器
 * 使用正则表达式模式匹配来检测法条之间的关系
 */

import type { LawArticle, RelationType } from '@prisma/client';
import {
  CITE_PATTERNS,
  HIERARCHY_PATTERNS,
  CONFLICT_PATTERNS,
  SUPERSEDE_PATTERNS,
} from './patterns';
import type {
  CitesRelation,
  HierarchicalRelation,
  ConflictRelation,
  SupersedesRelation,
  DetectionResult,
} from './types';

export class RuleBasedDetector {
  /**
   * 检测引用关系
   * 识别法条中明确引用其他法条的情况
   */
  static detectCitesRelation(article: LawArticle): CitesRelation[] {
    const relations: CitesRelation[] = [];
    const fullText = article.fullText || '';

    for (const pattern of CITE_PATTERNS) {
      // 重置正则表达式的lastIndex
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(fullText)) !== null) {
        const lawName = match[1]?.trim();
        const articleNumber = match[2]?.trim();

        if (lawName && articleNumber) {
          relations.push({
            lawName,
            articleNumber,
            evidence: match[0],
            confidence: 0.95,
          });
        }
      }
    }

    return relations;
  }

  /**
   * 检测层级关系（上位法/下位法）
   * 识别实施细则与上位法的关系
   */
  static detectHierarchicalRelation(
    article: LawArticle
  ): HierarchicalRelation[] {
    const relations: HierarchicalRelation[] = [];
    const fullText = article.fullText || '';

    for (const pattern of HIERARCHY_PATTERNS) {
      // 重置正则表达式的lastIndex
      pattern.lastIndex = 0;

      const match = pattern.exec(fullText);
      if (match && match[1]) {
        const parentLawName = match[1].trim();

        relations.push({
          parentLawName,
          relationType: 'IMPLEMENTS',
          confidence: 0.85,
          evidence: match[0],
        });
      }
    }

    return relations;
  }

  /**
   * 检测冲突关系
   * 识别法条之间的冲突或矛盾
   */
  static detectConflictsRelation(article: LawArticle): ConflictRelation[] {
    const conflicts: ConflictRelation[] = [];
    const fullText = article.fullText || '';

    for (const pattern of CONFLICT_PATTERNS) {
      // 重置正则表达式的lastIndex
      pattern.lastIndex = 0;

      const match = pattern.exec(fullText);
      if (match && match[1]) {
        const targetLawName = match[1].trim();

        conflicts.push({
          targetLawName,
          confidence: 0.8,
          evidence: match[0],
        });
      }
    }

    return conflicts;
  }

  /**
   * 检测替代关系（新法替旧法）
   * 识别同一法律的不同版本之间的替代关系
   */
  static detectSupersedesRelation(
    articles: LawArticle[]
  ): SupersedesRelation[] {
    const relations: SupersedesRelation[] = [];

    // 按lawName分组
    const grouped = new Map<string, LawArticle[]>();
    for (const article of articles) {
      const lawName = article.lawName;
      if (!grouped.has(lawName)) {
        grouped.set(lawName, []);
      }
      grouped.get(lawName)!.push(article);
    }

    // 对每组法律，按生效日期排序，建立替代关系
    for (const [_lawName, versions] of grouped.entries()) {
      // 过滤掉没有生效日期的法律
      const validVersions = versions.filter(v => v.effectiveDate);

      if (validVersions.length < 2) {
        continue;
      }

      // 按effectiveDate排序
      const sorted = validVersions.sort((a, b) => {
        const dateA = a.effectiveDate ? a.effectiveDate.getTime() : 0;
        const dateB = b.effectiveDate ? b.effectiveDate.getTime() : 0;
        return dateA - dateB;
      });

      // 相邻版本建立替代关系
      for (let i = 1; i < sorted.length; i++) {
        const newLaw = sorted[i];
        const oldLaw = sorted[i - 1];

        relations.push({
          sourceId: newLaw.id,
          targetId: oldLaw.id,
          relationType: 'SUPERSEDES' as RelationType,
          confidence: 0.9,
          evidence: `${newLaw.version || '新版本'} 替代 ${oldLaw.version || '旧版本'}`,
        });
      }
    }

    // 检测文本中明确提到的废止关系
    for (const article of articles) {
      const fullText = article.fullText || '';

      for (const pattern of SUPERSEDE_PATTERNS) {
        // 重置正则表达式的lastIndex
        pattern.lastIndex = 0;

        const match = pattern.exec(fullText);
        if (match && match[1]) {
          const oldLawName = match[1].trim();

          // 查找被废止的法律
          const oldLaw = articles.find(a => a.lawName === oldLawName);
          if (oldLaw && oldLaw.id !== article.id) {
            relations.push({
              sourceId: article.id,
              targetId: oldLaw.id,
              relationType: 'SUPERSEDES' as RelationType,
              confidence: 0.95,
              evidence: match[0],
            });
          }
        }
      }
    }

    return relations;
  }

  /**
   * 批量检测所有关系
   * 同时检测引用、层级和冲突关系
   */
  static async detectAllRelations(
    article: LawArticle
  ): Promise<DetectionResult> {
    return {
      cites: this.detectCitesRelation(article),
      hierarchical: this.detectHierarchicalRelation(article),
      conflicts: this.detectConflictsRelation(article),
    };
  }
}
