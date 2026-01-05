// 内容优化器：优化生成内容的质量和可读性

import {
  OptimizationOptions,
  OptimizationResult,
  QualityAssessment,
  QualityMetrics,
} from "./types";

/**
 * 内容优化器类
 */
export class ContentOptimizer {
  private options: OptimizationOptions;

  constructor(options?: Partial<OptimizationOptions>) {
    this.options = {
      clarityLevel: options?.clarityLevel ?? "medium",
      logicCheck: options?.logicCheck ?? true,
      formatStandard: options?.formatStandard ?? "legal",
      maxLength: options?.maxLength,
    };
  }

  /**
   * 优化内容
   */
  optimize(content: string): OptimizationResult {
    const originalScore = this.assessQuality(content).metrics.overall;
    let optimizedContent = content;

    // 应用优化
    if (this.options.clarityLevel !== "low") {
      optimizedContent = this.improveClarity(optimizedContent);
    }

    if (this.options.logicCheck) {
      optimizedContent = this.checkAndFixLogic(optimizedContent);
    }

    if (this.options.formatStandard === "legal") {
      optimizedContent = this.standardizeLegalFormat(optimizedContent);
    }

    if (this.options.maxLength) {
      optimizedContent = this.truncateIfNeeded(
        optimizedContent,
        this.options.maxLength,
      );
    }

    const optimizedScore = this.assessQuality(optimizedContent).metrics.overall;
    const improvements = this.detectImprovements(content, optimizedContent);

    return {
      optimizedContent,
      originalScore,
      optimizedScore,
      improvements,
    };
  }

  /**
   * 评估内容质量
   */
  assessQuality(content: string): QualityAssessment {
    const metrics = this.calculateQualityMetrics(content);
    const issues = this.detectIssues(content, metrics);
    const suggestions = this.generateSuggestions(issues);

    const passed = metrics.overall >= 0.7;

    return {
      metrics,
      passed,
      issues,
      suggestions,
    };
  }

  /**
   * 批量优化
   */
  batchOptimize(contents: string[]): OptimizationResult[] {
    return contents.map((content) => this.optimize(content));
  }

  /**
   * 计算质量指标
   */
  private calculateQualityMetrics(content: string): QualityMetrics {
    const clarity = this.calculateClarity(content);
    const logic = this.calculateLogic(content);
    const completeness = this.calculateCompleteness(content);
    const format = this.calculateFormat(content);

    const overall = (clarity + logic + completeness + format) / 4;

    return {
      clarity,
      logic,
      completeness,
      format,
      overall,
    };
  }

  /**
   * 提高清晰度
   */
  private improveClarity(content: string): string {
    let improved = content;

    // 移除重复的句子
    improved = this.removeDuplicates(improved);

    // 简化复杂句子
    improved = this.simplifySentences(improved);

    // 添加适当的分隔符
    improved = this.addSeparators(improved);

    return improved;
  }

  /**
   * 检查并修复逻辑问题
   */
  private checkAndFixLogic(content: string): string {
    let fixed = content;

    // 检查逻辑连接词
    fixed = this.addLogicalConnectors(fixed);

    // 确保因果关系清晰
    fixed = this.clarifyCausality(fixed);

    return fixed;
  }

  /**
   * 标准化法律格式
   */
  private standardizeLegalFormat(content: string): string {
    let standardized = content;

    // 确保法律条文格式正确
    standardized = this.formatLegalReferences(standardized);

    // 统一称谓
    standardized = this.unifyLegalTerms(standardized);

    // 标准化日期格式
    standardized = this.standardizeDates(standardized);

    return standardized;
  }

  /**
   * 如果需要则截断
   */
  private truncateIfNeeded(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    // 在句子边界截断
    let truncated = content.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf("。");
    if (lastPeriod > 0) {
      truncated = truncated.substring(0, lastPeriod + 1);
    }

    return truncated;
  }

  /**
   * 计算清晰度
   */
  private calculateClarity(content: string): number {
    let score = 0;

    // 基于句子长度
    const sentences = content
      .split(/[。！？]/)
      .filter((s) => s.trim().length > 0);
    const avgSentenceLength =
      sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

    if (avgSentenceLength < 50) score += 0.3;
    else if (avgSentenceLength < 100) score += 0.2;
    else if (avgSentenceLength < 150) score += 0.1;

    // 基于段落结构
    const paragraphs = content
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 0);
    if (paragraphs.length > 1) score += 0.3;

    // 基于标点符号使用
    if (content.includes("，") || content.includes("、")) score += 0.2;

    // 基于重复内容
    if (!this.hasExcessiveRepetition(content)) score += 0.2;

    return Math.min(1, score);
  }

  /**
   * 计算逻辑性
   */
  private calculateLogic(content: string): number {
    let score = 0.5;

    // 检查逻辑连接词
    const connectors = ["因此", "所以", "然而", "但是", "因为", "由于"];
    const hasConnectors = connectors.some((c) => content.includes(c));
    if (hasConnectors) score += 0.2;

    // 检查论证结构
    if (content.includes("一、") || content.includes("二、")) score += 0.15;

    // 检查结论
    if (content.includes("综上所述") || content.includes("综上")) score += 0.15;

    return Math.min(1, score);
  }

  /**
   * 计算完整性
   */
  private calculateCompleteness(content: string): number {
    let score = 0.5;

    // 检查是否有标题
    if (content.includes("诉状") || content.includes("答辩状")) score += 0.2;

    // 检查是否有诉讼请求
    if (content.includes("请求") || content.includes("诉求")) score += 0.2;

    // 检查是否有事实描述
    if (content.includes("事实") || content.includes("理由")) score += 0.1;

    return Math.min(1, score);
  }

  /**
   * 计算格式
   */
  private calculateFormat(content: string): number {
    let score = 0.5;

    // 检查是否有签名
    if (content.includes("具状人") || content.includes("答辩人")) score += 0.2;

    // 检查是否有日期
    if (/\d{4}年\d{1,2}月\d{1,2}日/.test(content)) score += 0.3;

    return Math.min(1, score);
  }

  /**
   * 检测问题
   */
  private detectIssues(
    content: string,
    metrics: QualityMetrics,
  ): QualityAssessment["issues"] {
    const issues: QualityAssessment["issues"] = [];

    if (metrics.clarity < 0.6) {
      issues.push({
        type: "clarity",
        severity: "medium",
        description: "内容清晰度不足，建议简化句子结构",
      });
    }

    if (metrics.logic < 0.6) {
      issues.push({
        type: "logic",
        severity: "high",
        description: "逻辑性不足，建议加强逻辑连接",
      });
    }

    if (metrics.completeness < 0.6) {
      issues.push({
        type: "completeness",
        severity: "medium",
        description: "内容不完整，缺少必要部分",
      });
    }

    if (metrics.format < 0.6) {
      issues.push({
        type: "format",
        severity: "low",
        description: "格式不规范，建议标准化格式",
      });
    }

    return issues;
  }

  /**
   * 生成建议
   */
  private generateSuggestions(issues: QualityAssessment["issues"]): string[] {
    const suggestions: string[] = [];

    issues.forEach((issue) => {
      switch (issue.type) {
        case "clarity":
          suggestions.push("使用简洁明了的语言表达");
          break;
        case "logic":
          suggestions.push("添加逻辑连接词，确保论证连贯");
          break;
        case "completeness":
          suggestions.push("补充完整的诉讼请求和事实理由");
          break;
        case "format":
          suggestions.push("遵循标准法律文书格式");
          break;
      }
    });

    return suggestions;
  }

  /**
   * 检测改进
   */
  private detectImprovements(original: string, optimized: string): string[] {
    const improvements: string[] = [];

    if (optimized.length > original.length) {
      improvements.push("增加了内容完整性");
    }

    if (
      !this.hasExcessiveRepetition(optimized) &&
      this.hasExcessiveRepetition(original)
    ) {
      improvements.push("减少了重复内容");
    }

    return improvements;
  }

  /**
   * 检查是否有过多重复
   */
  private hasExcessiveRepetition(content: string): boolean {
    const words = content.split(/[\s，。、！？]+/);
    const uniqueWords = new Set(words);
    const ratio = uniqueWords.size / words.length;
    return ratio < 0.7;
  }

  /**
   * 移除重复内容
   */
  private removeDuplicates(content: string): string {
    const sentences = content.split(/[。！？]/);
    const uniqueSentences = new Set(sentences);
    return Array.from(uniqueSentences).join("。");
  }

  /**
   * 简化句子
   */
  private simplifySentences(content: string): string {
    return content
      .replace(/非常十分特别/g, "非常")
      .replace(/在...的情况下/g, "在...时")
      .replace(/对于...来说/g, "对于...");
  }

  /**
   * 添加分隔符
   */
  private addSeparators(content: string): string {
    return content.replace(/([。！？])([^\n])/g, "$1\n\n$2");
  }

  /**
   * 添加逻辑连接词
   */
  private addLogicalConnectors(content: string): string {
    return content.replace(/，([一二三四五六七八九十]+、)/g, "。因此$1");
  }

  /**
   * 澄清因果关系
   */
  private clarifyCausality(content: string): string {
    return content.replace(/因此，所以/g, "因此");
  }

  /**
   * 格式化法律引用
   */
  private formatLegalReferences(content: string): string {
    return content.replace(/《(.+?)》([^\d])/g, "《$1》$2");
  }

  /**
   * 统一法律术语
   */
  private unifyLegalTerms(content: string): string {
    return content
      .replace(/被告方/g, "被告")
      .replace(/原告方/g, "原告")
      .replace(/法院方/g, "法院");
  }

  /**
   * 标准化日期
   */
  private standardizeDates(content: string): string {
    return content.replace(/\d{4}-\d{2}-\d{2}/g, (match) => {
      const date = new Date(match);
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    });
  }

  /**
   * 更新选项
   */
  updateOptions(options: Partial<OptimizationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 获取选项
   */
  getOptions(): OptimizationOptions {
    return { ...this.options };
  }

  /**
   * 重置选项为默认值
   */
  resetOptions(): void {
    this.options = {
      clarityLevel: "medium",
      logicCheck: true,
      formatStandard: "legal",
      maxLength: undefined,
    };
  }
}
