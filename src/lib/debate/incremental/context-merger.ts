/**
 * 上下文合并器（ContextMerger）
 * 负责将新旧上下文合并，保持一致性
 */

import {
  Material,
  DiffResult,
  DocumentAnalysisOutput,
  LawArticleApplicabilityResult,
  EvidenceAnalysisResult,
  IncrementalAnalysisConfig,
  DEFAULT_INCREMENTAL_CONFIG,
  MergeResult,
} from "./types";

/**
 * 上下文合并器类
 */
export class ContextMerger {
  private config: IncrementalAnalysisConfig["merge"];

  constructor(config?: Partial<IncrementalAnalysisConfig["merge"]>) {
    this.config = {
      ...DEFAULT_INCREMENTAL_CONFIG.merge,
      ...config,
    };
  }

  /**
   * 合并资料列表
   */
  private mergeMaterials(
    oldMaterials: Material[],
    diff: DiffResult,
  ): Material[] {
    const materialMap = new Map<string, Material>();

    // 添加旧资料（排除删除的）
    for (const material of oldMaterials) {
      const isDeleted = diff.deleted.some((d) => d.id === material.id);
      if (!isDeleted) {
        materialMap.set(material.id, material);
      }
    }

    // 添加新资料和修改的资料
    for (const material of [...diff.added, ...diff.modified]) {
      materialMap.set(material.id, material);
    }

    return Array.from(materialMap.values());
  }

  /**
   * 合并文档分析结果
   */
  private mergeDocuments(
    oldDocuments: DocumentAnalysisOutput[],
    newDocuments: DocumentAnalysisOutput[],
  ): DocumentAnalysisOutput[] {
    const documentMap = new Map<string, DocumentAnalysisOutput>();

    // 添加旧文档
    for (const doc of oldDocuments) {
      const key = `${doc.extractedAt}`;
      documentMap.set(key, doc);
    }

    // 合并新文档
    for (const newDoc of newDocuments) {
      const key = `${newDoc.extractedAt}`;
      documentMap.set(key, newDoc);
    }

    return Array.from(documentMap.values());
  }

  /**
   * 合并法条分析结果
   */
  private mergeLawArticles(
    oldLawArticles: LawArticleApplicabilityResult[],
    newLawArticles: LawArticleApplicabilityResult[],
  ): LawArticleApplicabilityResult[] {
    const lawArticleMap = new Map<string, LawArticleApplicabilityResult>();

    // 添加旧法条
    for (const law of oldLawArticles) {
      const key = `${law.articleId}_${law.articleNumber}`;
      lawArticleMap.set(key, law);
    }

    // 合并新法条
    for (const newLaw of newLawArticles) {
      const key = `${newLaw.articleId}_${newLaw.articleNumber}`;
      lawArticleMap.set(key, newLaw);
    }

    return Array.from(lawArticleMap.values());
  }

  /**
   * 合并证据分析结果
   */
  private mergeEvidence(
    oldEvidence: EvidenceAnalysisResult[],
    newEvidenceList: EvidenceAnalysisResult[],
  ): EvidenceAnalysisResult[] {
    const evidenceMap = new Map<string, EvidenceAnalysisResult>();

    // 添加旧证据
    for (const evidence of oldEvidence) {
      evidenceMap.set(evidence.evidenceId, evidence);
    }

    // 合并新证据
    for (const newEvidence of newEvidenceList) {
      evidenceMap.set(newEvidence.evidenceId, newEvidence);
    }

    return Array.from(evidenceMap.values());
  }

  /**
   * 解决冲突
   */
  private resolveConflict():
    | "new-priority"
    | "old-priority"
    | "merged"
    | "conflict" {
    switch (this.config.conflictResolution) {
      case "new-priority":
        return "new-priority";
      case "old-priority":
        return "old-priority";
      case "manual":
        return "conflict";
      default:
        return "new-priority";
    }
  }

  /**
   * 执行合并（主入口）
   */
  merge(
    diff: DiffResult,
    historicalContext: {
      materials: Material[];
      analysisResults: {
        documents?: DocumentAnalysisOutput[];
        lawArticles?: LawArticleApplicabilityResult[];
        evidence?: EvidenceAnalysisResult[];
      };
    },
    incrementalAnalysis: {
      newDocuments: DocumentAnalysisOutput[];
      newLawArticles: LawArticleApplicabilityResult[];
      newEvidence: EvidenceAnalysisResult[];
    },
  ): MergeResult {
    const oldDocs = historicalContext.analysisResults.documents || [];
    const oldLawArticles = historicalContext.analysisResults.lawArticles || [];
    const oldEvidence = historicalContext.analysisResults.evidence || [];

    // 合并资料
    const mergedMaterials = this.mergeMaterials(
      historicalContext.materials,
      diff,
    );

    // 根据合并策略合并分析结果
    let mergedDocuments: DocumentAnalysisOutput[];
    let mergedLawArticles: LawArticleApplicabilityResult[];
    let mergedEvidence: EvidenceAnalysisResult[];

    switch (this.config.strategy) {
      case "append":
        mergedDocuments = [...oldDocs, ...incrementalAnalysis.newDocuments];
        mergedLawArticles = [
          ...oldLawArticles,
          ...incrementalAnalysis.newLawArticles,
        ];
        mergedEvidence = [...oldEvidence, ...incrementalAnalysis.newEvidence];
        break;

      case "replace":
        mergedDocuments = [...incrementalAnalysis.newDocuments];
        mergedLawArticles = [...incrementalAnalysis.newLawArticles];
        mergedEvidence = [...incrementalAnalysis.newEvidence];
        break;

      case "merge":
      default:
        mergedDocuments = this.mergeDocuments(
          oldDocs,
          incrementalAnalysis.newDocuments,
        );
        mergedLawArticles = this.mergeLawArticles(
          oldLawArticles,
          incrementalAnalysis.newLawArticles,
        );
        mergedEvidence = this.mergeEvidence(
          oldEvidence,
          incrementalAnalysis.newEvidence,
        );
        break;
    }

    const newContext = {
      materials: mergedMaterials,
      analysisResults: {
        documents: mergedDocuments,
        lawArticles: mergedLawArticles,
        evidence: mergedEvidence,
      },
    };

    const conflicts: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
      resolution: "new-priority" | "old-priority" | "merged" | "conflict";
    }> = [];

    const warnings: string[] = [];
    if (conflicts.length > 0) {
      warnings.push(`检测到 ${conflicts.length} 个冲突，已根据配置自动解决`);
    }

    return {
      success: true,
      mergedContext: newContext,
      conflicts,
      warnings,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IncrementalAnalysisConfig["merge"]>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): IncrementalAnalysisConfig["merge"] {
    return { ...this.config };
  }
}
