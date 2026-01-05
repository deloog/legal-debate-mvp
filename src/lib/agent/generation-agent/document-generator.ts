// 文书生成器：基于模板生成法律文书

import {
  DocumentType,
  DocumentGenerationConfig,
  GenerationOutput,
  GenerationMetadata,
} from "./types";
import type { LawArticle } from "@prisma/client";
import { CaseInfo } from "@/types/debate";

/**
 * 文书模板库
 */
const DOCUMENT_TEMPLATES: Record<DocumentType, string> = {
  complaint: `
民事起诉状

原告：{{plaintiffName}}
被告：{{defendantName}}

一、诉讼请求
{{claims}}

二、事实与理由
{{facts}}

三、法律依据
{{legalBasis}}

四、证据和证据来源
{{evidence}}

此致
{{court}}

具状人：{{plaintiffName}}
{{date}}
`,
  answer: `
民事答辩状

答辩人：{{defendantName}}

被答辩人：{{plaintiffName}}

一、答辩意见
{{defensePoints}}

二、事实与理由
{{facts}}

三、法律依据
{{legalBasis}}

此致
{{court}}

答辩人：{{defendantName}}
{{date}}
`,
  evidence: `
证据清单

案件编号：{{caseNumber}}
原告：{{plaintiffName}}
被告：{{defendantName}}

一、证据列表
{{evidenceList}}

二、证据说明
{{evidenceDescription}}

制作人：{{author}}
{{date}}
`,
  appeal: `
上诉状

上诉人（原审{{role}}）：{{name}}
被上诉人（原审{{opponentRole}}）：{{opponentName}}

一、上诉请求
{{appealRequests}}

二、上诉理由
{{appealReasons}}

三、事实与理由
{{facts}}

四、法律依据
{{legalBasis}}

此致
{{court}}

上诉人：{{name}}
{{date}}
`,
};

/**
 * 文书生成器类
 */
export class DocumentGenerator {
  private config: Partial<DocumentGenerationConfig>;

  constructor(config: Partial<DocumentGenerationConfig> = {}) {
    this.config = config;
  }

  /**
   * 生成起诉状
   */
  generateComplaint(
    caseInfo: CaseInfo,
    lawArticles: LawArticle[],
    options?: Partial<DocumentGenerationConfig>,
  ): GenerationOutput {
    const startTime = Date.now();

    const template = DOCUMENT_TEMPLATES.complaint;
    const content = this.applyTemplate(template, {
      plaintiffName:
        caseInfo.description.split("原告")[1]?.split("被告")[0].trim() || "",
      defendantName:
        caseInfo.description.split("被告")[1]?.split("。")[0].trim() || "",
      claims: this.extractClaims(caseInfo.description),
      facts: caseInfo.description,
      legalBasis: this.formatLegalBasis(lawArticles),
      evidence: "详见证据清单",
      court: caseInfo.court || "人民法院",
      date: this.formatDate(new Date()),
    });

    const metadata = this.createMetadata("complaint", startTime);

    return {
      content: this.formatContent(content, options),
      type: "complaint",
      qualityScore: this.calculateQualityScore(content),
      metadata,
    };
  }

  /**
   * 生成答辩状
   */
  generateAnswer(
    caseInfo: CaseInfo,
    lawArticles: LawArticle[],
    options?: Partial<DocumentGenerationConfig>,
  ): GenerationOutput {
    const startTime = Date.now();

    const template = DOCUMENT_TEMPLATES.answer;
    const content = this.applyTemplate(template, {
      plaintiffName:
        caseInfo.description.split("原告")[1]?.split("被告")[0].trim() || "",
      defendantName:
        caseInfo.description.split("被告")[1]?.split("。")[0].trim() || "",
      defensePoints: "1. 不同意原告的诉讼请求\n2. 原告的主张缺乏事实和法律依据",
      facts: caseInfo.description,
      legalBasis: this.formatLegalBasis(lawArticles),
      court: caseInfo.court || "人民法院",
      date: this.formatDate(new Date()),
    });

    const metadata = this.createMetadata("answer", startTime);

    return {
      content: this.formatContent(content, options),
      type: "answer",
      qualityScore: this.calculateQualityScore(content),
      metadata,
    };
  }

  /**
   * 生成证据清单
   */
  generateEvidence(
    caseInfo: CaseInfo,
    evidenceData: unknown[],
    options?: Partial<DocumentGenerationConfig>,
  ): GenerationOutput {
    const startTime = Date.now();

    const template = DOCUMENT_TEMPLATES.evidence;
    const evidenceList = Array.isArray(evidenceData)
      ? evidenceData.map((e, i) => `${i + 1}. ${JSON.stringify(e)}`).join("\n")
      : "无证据";

    const content = this.applyTemplate(template, {
      caseNumber: caseInfo.caseNumber || "",
      plaintiffName:
        caseInfo.description.split("原告")[1]?.split("被告")[0].trim() || "",
      defendantName:
        caseInfo.description.split("被告")[1]?.split("。")[0].trim() || "",
      evidenceList,
      evidenceDescription: "详见案件描述",
      author: "律伴助手",
      date: this.formatDate(new Date()),
    });

    const metadata = this.createMetadata("evidence", startTime);

    return {
      content: this.formatContent(content, options),
      type: "evidence",
      qualityScore: this.calculateQualityScore(content),
      metadata,
    };
  }

  /**
   * 生成上诉状
   */
  generateAppeal(
    caseInfo: CaseInfo,
    lawArticles: LawArticle[],
    options?: Partial<DocumentGenerationConfig>,
  ): GenerationOutput {
    const startTime = Date.now();

    const template = DOCUMENT_TEMPLATES.appeal;
    const content = this.applyTemplate(template, {
      name:
        caseInfo.description.split("原告")[1]?.split("被告")[0].trim() || "",
      role: "原告",
      opponentName:
        caseInfo.description.split("被告")[1]?.split("。")[0].trim() || "",
      opponentRole: "被告",
      appealRequests: "1. 撤销一审判决\n2. 依法改判或发回重审",
      appealReasons: caseInfo.description,
      facts: caseInfo.description,
      legalBasis: this.formatLegalBasis(lawArticles),
      court: "上级人民法院",
      date: this.formatDate(new Date()),
    });

    const metadata = this.createMetadata("appeal", startTime);

    return {
      content: this.formatContent(content, options),
      type: "appeal",
      qualityScore: this.calculateQualityScore(content),
      metadata,
    };
  }

  /**
   * 应用模板
   */
  private applyTemplate(
    template: string,
    placeholders: Record<string, string>,
  ): string {
    let content = template;

    for (const [key, value] of Object.entries(placeholders)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      content = content.replace(regex, value);
    }

    return content;
  }

  /**
   * 提取诉讼请求
   */
  private extractClaims(description: string): string {
    const claimsMatch = description.match(/请求[：:](.*?)(?=\n|一、|二、|$)/);
    return claimsMatch ? claimsMatch[1].trim() : description.substring(0, 100);
  }

  /**
   * 格式化法律依据
   */
  private formatLegalBasis(lawArticles: LawArticle[]): string {
    if (!lawArticles || lawArticles.length === 0) {
      return "暂无法律依据";
    }

    return lawArticles
      .slice(0, 5)
      .map(
        (article) =>
          `《${article.lawName}》${article.articleNumber} ${article.fullText?.substring(0, 100)}...`,
      )
      .join("\n");
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}年${month}月${day}日`;
  }

  /**
   * 格式化内容
   */
  private formatContent(
    content: string,
    options?: Partial<DocumentGenerationConfig>,
  ): string {
    let formatted = content.trim();

    if (options?.includeHeader) {
      formatted = `法律文书\n${formatted}`;
    }

    if (options?.includeFooter) {
      formatted = `${formatted}\n\n---\n生成时间：${new Date().toISOString()}`;
    }

    return formatted;
  }

  /**
   * 创建元数据
   */
  private createMetadata(
    type: DocumentType,
    startTime: number,
  ): GenerationMetadata {
    const generationTime = Date.now() - startTime;

    return {
      generatedAt: new Date().toISOString(),
      generatedBy: "GenerationAgent",
      generationTime,
      aiProvider: "deepseek",
      wordCount: 0,
      qualityScore: 0,
    };
  }

  /**
   * 计算质量分数
   */
  private calculateQualityScore(content: string): number {
    let score = 0;

    // 内容长度
    if (content.length > 100) score += 20;
    if (content.length > 500) score += 20;

    // 包含法律依据
    if (content.includes("法律依据")) score += 20;

    // 包含事实描述
    if (content.includes("事实")) score += 20;

    // 包含日期
    if (/\d{4}年\d{1,2}月\d{1,2}日/.test(content)) score += 20;

    return Math.min(1, score / 100);
  }

  /**
   * 获取模板
   */
  getTemplate(type: DocumentType): string {
    return DOCUMENT_TEMPLATES[type];
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DocumentGenerationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): Partial<DocumentGenerationConfig> {
    return { ...this.config };
  }
}
