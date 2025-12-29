/**
 * FilterProcessor - 第一层快速过滤处理器
 *
 * 核心功能：
 * - OCR文本质量检查
 * - 文档类型分类
 * - 基础格式校验
 *
 * 性能目标：<10ms
 */

import { logger } from "../../../agent/security/logger";
import type { CaseType } from "../core/types";

// =============================================================================
// 接口定义
// =============================================================================

export interface FilterResult {
  passed: boolean;
  filteredText: string;
  documentType: CaseType;
  qualityScore: number;
  warnings: string[];
  reason?: string;
}

export interface FilterConfig {
  minWordCount: number;
  minChineseChars: number;
  maxGarbageRatio: number;
  minQualityScore: number;
}

// =============================================================================
// FilterProcessor 类
// =============================================================================

export class FilterProcessor {
  private config: FilterConfig;
  private readonly GARBAGE_PATTERNS: RegExp[];
  private readonly DOCUMENT_TYPE_PATTERNS: Record<CaseType, RegExp[]>;

  constructor(config?: Partial<FilterConfig>) {
    this.config = {
      minWordCount: 15,
      minChineseChars: 30,
      maxGarbageRatio: 0.3,
      minQualityScore: 0.5,
      ...config,
    };

    this.GARBAGE_PATTERNS = [
      /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, // 替换字符和控制字符
    ];

    this.DOCUMENT_TYPE_PATTERNS = {
      civil: [
        /民事|原告|被告|诉讼请求|判令/gi,
        /借款合同|买卖合同|租赁合同/gi, // 移除劳动合同，避免与labor冲突
        /返还|赔偿|违约|履行/gi,
      ],
      criminal: [
        /被告人|公诉机关|检察院|刑事判决/gi,
        /盗窃|诈骗|抢劫|故意伤害|寻衅滋事/gi,
        /有期徒刑|拘役|罚金|没收财产/gi,
      ],
      administrative: [
        /行政复议|行政诉讼|行政行为|行政机关/gi,
        /处罚|强制措施|行政许可/gi,
      ],
      commercial: [
        /公司|企业|股东|股权|破产清算/gi,
        /董事会|股东大会|公司章程/gi,
      ],
      labor: [
        /劳动争议|工伤|社会保险/gi,
        /劳动仲裁|劳动报酬|经济补偿金/gi, // 劳动仲裁比仲裁更具体
        /解除劳动合同|终止劳动合同/gi,
      ],
      intellectual: [
        /著作权|专利权|商标权|侵权|知识产权/gi,
        /不正当竞争|商业秘密/gi,
      ],
      other: [],
    };
  }

  /**
   * 处理文档过滤
   */
  public async process(text: string): Promise<FilterResult> {
    const startTime = Date.now();

    // 1. OCR质量检查
    const qualityCheck = this.checkOCRQuality(text);
    if (!qualityCheck.passed) {
      const processingTime = Date.now() - startTime;
      logger.warn("OCR质量检查未通过", {
        reason: qualityCheck.reason,
        processingTime,
      });
      return {
        passed: false,
        filteredText: text,
        documentType: "other",
        qualityScore: qualityCheck.score,
        warnings: qualityCheck.warnings,
        reason: qualityCheck.reason,
      };
    }

    // 2. 文档类型分类
    const documentType = this.classifyDocument(text);

    // 3. 基础格式校验
    const formatCheck = this.validateFormat(text, documentType);
    if (!formatCheck.valid) {
      const processingTime = Date.now() - startTime;
      logger.warn("格式校验未通过", {
        reason: formatCheck.reason,
        processingTime,
      });
      return {
        passed: false,
        filteredText: text,
        documentType,
        qualityScore: qualityCheck.score,
        warnings: [...qualityCheck.warnings, ...formatCheck.warnings],
        reason: formatCheck.reason,
      };
    }

    // 4. 清理文本（去除多余空白）
    const filteredText = this.cleanText(text);

    const processingTime = Date.now() - startTime;
    logger.info("过滤检查通过", {
      documentType,
      qualityScore: qualityCheck.score,
      processingTime,
    });

    return {
      passed: true,
      filteredText,
      documentType,
      qualityScore: qualityCheck.score,
      warnings: [...qualityCheck.warnings, ...formatCheck.warnings],
    };
  }

  /**
   * OCR质量检查
   */
  private checkOCRQuality(text: string): {
    passed: boolean;
    score: number;
    warnings: string[];
    reason?: string;
  } {
    const warnings: string[] = [];
    let score = 1.0;

    // 检查文本长度
    if (text.length < this.config.minWordCount) {
      warnings.push(
        `文本长度过短：${text.length}字符（最低要求${this.config.minWordCount}）`,
      );
      score -= 0.5; // 提高扣分权重
    }

    // 检查中文字符数量
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    if (chineseChars < this.config.minChineseChars) {
      warnings.push(
        `中文字符过少：${chineseChars}个（最低要求${this.config.minChineseChars}）`,
      );
      score -= 0.5; // 提高扣分权重，确保中文字符过少时会fail
    }

    // 检查乱码比例
    const garbageChars = this.countGarbageChars(text);
    const garbageRatio = garbageChars / text.length;
    if (garbageRatio > this.config.maxGarbageRatio) {
      warnings.push(
        `乱码比例过高：${(garbageRatio * 100).toFixed(1)}%（最高允许${(this.config.maxGarbageRatio * 100).toFixed(1)}%）`,
      );
      score -= 0.4 * (garbageRatio / this.config.maxGarbageRatio);
    }

    // 检查是否为空或只有空白
    if (!text.trim()) {
      return {
        passed: false,
        score: 0,
        warnings: ["文档内容为空"],
        reason: "OCR质量不合格：文档内容为空",
      };
    }

    // 综合评估
    const passed = score >= this.config.minQualityScore;
    const reason = !passed
      ? `OCR质量不合格（得分：${score.toFixed(2)}）`
      : undefined;

    return {
      passed,
      score: Math.max(0, score),
      warnings,
      reason,
    };
  }

  /**
   * 统计乱码字符数量
   */
  private countGarbageChars(text: string): number {
    let count = 0;
    for (const pattern of this.GARBAGE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  }

  /**
   * 文档类型分类
   */
  private classifyDocument(text: string): CaseType {
    const scores: Record<CaseType, number> = {
      civil: 0,
      criminal: 0,
      administrative: 0,
      commercial: 0,
      labor: 0,
      intellectual: 0,
      other: 0,
    };

    // 计算每种类型的匹配得分
    for (const [type, patterns] of Object.entries(
      this.DOCUMENT_TYPE_PATTERNS,
    )) {
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          scores[type as CaseType] += matches.length;
        }
      }
    }

    // 找出得分最高的类型
    let maxScore = 0;
    let maxType: CaseType = "other";
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxType = type as CaseType;
      }
    }

    // 如果没有任何匹配，返回other
    if (maxScore === 0) {
      return "other";
    }

    logger.debug("文档类型分类结果", {
      type: maxType,
      score: maxScore,
      scores,
    });
    return maxType;
  }

  /**
   * 基础格式校验
   */
  private validateFormat(
    text: string,
    docType: CaseType,
  ): {
    valid: boolean;
    warnings: string[];
    reason?: string;
  } {
    const warnings: string[] = [];

    // 检查必要的基本元素
    const hasTitle = /.*?案/g.test(text) || /.*?诉/g.test(text);
    const hasContent = text.length > 50;

    if (!hasTitle) {
      warnings.push("文档缺少标题或案由");
    }

    if (!hasContent) {
      warnings.push("文档内容过短");
    }

    // 检查通用的原告或被告信息（不限于civil）
    const hasPlaintiffDefendant = /原告|被告/g.test(text);
    if (!hasPlaintiffDefendant) {
      warnings.push("文档缺少原告或被告信息");
    }

    // 根据文档类型检查特定元素
    if (docType === "criminal") {
      const hasDefendant = /被告人/g.test(text);
      if (!hasDefendant) {
        warnings.push("刑事文档缺少被告人信息");
      }
    }

    // 检查是否有过多的特殊字符
    const specialCharRatio = this.countGarbageChars(text) / text.length;
    if (specialCharRatio > this.config.maxGarbageRatio) {
      warnings.push(
        `特殊字符比例过高：${(specialCharRatio * 100).toFixed(1)}%`,
      );
    }

    // 综合判断
    const valid = warnings.length < 2;
    const reason = !valid ? `格式校验失败：${warnings.join("、")}` : undefined;

    return {
      valid,
      warnings,
      reason,
    };
  }

  /**
   * 清理文本
   */
  private cleanText(text: string): string {
    // 将连续的多个空格替换为单个空格
    let cleaned = text.replace(/[ \t]+/g, " ");
    // 去除段落首尾空格
    cleaned = cleaned.replace(/^ +/gm, "").replace(/ +$/gm, "");

    // 将多个连续换行替换为单个换行
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    // 去除控制字符（保留换行）
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

    // 标准化换行符
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    return cleaned.trim();
  }

  /**
   * 获取配置
   */
  public getConfig(): FilterConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<FilterConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("FilterProcessor配置已更新", { config: this.config });
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建默认FilterProcessor实例
 */
export function createFilterProcessor(
  config?: Partial<FilterConfig>,
): FilterProcessor {
  return new FilterProcessor(config);
}
