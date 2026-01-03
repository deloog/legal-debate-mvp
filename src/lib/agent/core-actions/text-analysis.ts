/**
 * 文本分析模块（Text Analysis）
 * 包含：analyze_text、classify_content、generate_summary
 */

import type {
  TextAnalysisResult,
  ClassificationResult,
  GenerateSummaryResult,
  GenerateSummaryParams,
} from "./types";

/**
 * 1. analyze_text - 文本分析
 * 分析文本的基本属性和关键信息
 */
export async function analyze_text(text: string): Promise<TextAnalysisResult> {
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  const hasNumbers = /\d/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);

  const lines = text === "" ? [] : text.split("\n");
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  let keyPhrases: string[] = [];
  if (hasChinese) {
    keyPhrases = extractChinesePhrases(text);
  }

  let language: "zh" | "en" | "unknown" = "unknown";
  if (hasChinese) {
    language = "zh";
  } else if (hasEnglish) {
    language = "en";
  }

  return {
    text,
    length: text.length,
    language,
    containsChinese: hasChinese,
    containsNumbers: hasNumbers,
    wordCount: words.length,
    lineCount: lines.length,
    keyPhrases,
  };
}

/**
 * extractChinesePhrases - 提取中文短语
 */
function extractChinesePhrases(text: string): string[] {
  const phrases: string[] = [];
  const commonPatterns = [
    /法律纠纷/g,
    /合同纠纷/g,
    /劳动纠纷/g,
    /侵权责任/g,
    /民事案件/g,
    /刑事案件/g,
    /行政案件/g,
    /合同违约/g,
    /金额/g,
  ];

  for (const pattern of commonPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      phrases.push(...matches);
    }
  }

  return [...new Set(phrases)];
}

/**
 * 2. classify_content - 内容分类
 * 对内容进行分类并返回置信度
 */
export async function classify_content(
  content: string,
  classificationType: "case_type" | "document_type" | "topic",
): Promise<ClassificationResult> {
  let category = "未分类";
  let confidence = 0.5;

  if (classificationType === "case_type") {
    const result = classifyCaseType(content);
    category = result.category;
    confidence = result.confidence;
  } else if (classificationType === "document_type") {
    const result = classifyDocumentType(content);
    category = result.category;
    confidence = result.confidence;
  } else if (classificationType === "topic") {
    category = "法律咨询";
    confidence = 0.6;
  }

  const alternativeCategories: Array<{ category: string; confidence: number }> =
    [];

  // 为其他可能的分类生成备选项
  if (classificationType === "case_type") {
    const keywords = {
      合同纠纷: ["合同", "违约", "买卖", "租赁"],
      劳动纠纷: ["劳动", "工资", "工伤", "解雇"],
      侵权纠纷: ["侵权", "损害赔偿", "人身伤害"],
      婚姻家庭: ["离婚", "抚养", "赡养", "继承"],
    };

    for (const [altCategory, words] of Object.entries(keywords)) {
      if (altCategory !== category) {
        let score = 0;
        for (const word of words) {
          if (content.includes(word)) {
            score += 1;
          }
        }
        if (score > 0) {
          const altConfidence = Math.min(0.3 + score * 0.1, 0.8);
          alternativeCategories.push({
            category: altCategory,
            confidence: altConfidence,
          });
        }
      }
    }
  }

  return {
    category,
    confidence,
    alternativeCategories,
  };
}

/**
 * classifyCaseType - 案件类型分类
 */
function classifyCaseType(content: string): {
  category: string;
  confidence: number;
} {
  const keywords = {
    合同纠纷: ["合同", "违约", "买卖", "租赁"],
    劳动纠纷: ["劳动", "工资", "工伤", "解雇"],
    侵权纠纷: ["侵权", "损害赔偿", "人身伤害"],
    婚姻家庭: ["离婚", "抚养", "赡养", "继承"],
  };

  let bestMatch = "未分类";
  let maxScore = 0;

  for (const [category, words] of Object.entries(keywords)) {
    let score = 0;
    for (const word of words) {
      if (content.includes(word)) {
        score += 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = category;
    }
  }

  const confidence = maxScore > 0 ? Math.min(0.5 + maxScore * 0.15, 1) : 0.5;
  return { category: bestMatch, confidence };
}

/**
 * classifyDocumentType - 文档类型分类
 */
function classifyDocumentType(content: string): {
  category: string;
  confidence: number;
} {
  if (content.includes("起诉状") || content.includes("民事起诉状")) {
    return { category: "起诉状", confidence: 0.9 };
  }
  if (content.includes("答辩状")) {
    return { category: "答辩状", confidence: 0.9 };
  }
  if (content.includes("判决书") || content.includes("法院判决")) {
    return { category: "判决书", confidence: 0.9 };
  }
  if (content.includes("调解书") || content.includes("调解协议")) {
    return { category: "调解书", confidence: 0.85 };
  }

  return { category: "法律文书", confidence: 0.6 };
}

/**
 * 4. generate_summary - 摘要生成
 * 生成文本摘要并提取关键点
 */
export async function generate_summary(
  contentOrParams: string | GenerateSummaryParams,
  maxLengthOrTargetRatio?: number,
  preserveKeyInfo?: boolean,
): Promise<GenerateSummaryResult> {
  let content: string;
  let maxLength: number | undefined;
  let targetRatio: number | undefined;
  let shouldPreserveKeyInfo: boolean = true;

  if (typeof contentOrParams === "string") {
    content = contentOrParams;
    maxLength = maxLengthOrTargetRatio;
    shouldPreserveKeyInfo = preserveKeyInfo ?? true;
  } else {
    content = contentOrParams.content;
    maxLength = contentOrParams.maxLength;
    targetRatio = contentOrParams.targetRatio;
    shouldPreserveKeyInfo = contentOrParams.preserveKeyInfo ?? true;
  }

  const originalLength = content.length;
  let summary = content;

  if (maxLength && content.length > maxLength) {
    const actualMaxLength = maxLength > 3 ? maxLength - 3 : 0;
    summary = content.slice(0, actualMaxLength) + "...";
  } else if (targetRatio && targetRatio < 1) {
    const targetLength = Math.floor(content.length * targetRatio);
    summary = content.slice(0, Math.max(targetLength, 50)) + "...";
  }

  const keyPoints = extractKeyPoints(content, shouldPreserveKeyInfo);

  return {
    summary,
    originalLength,
    summaryLength: summary.length,
    compressionRatio: summary.length / originalLength,
    keyPoints,
  };
}

/**
 * extractKeyPoints - 提取关键点
 */
function extractKeyPoints(content: string, preserveKeyInfo: boolean): string[] {
  const keyPoints: string[] = [];

  if (preserveKeyInfo) {
    const sentences = content
      .split(/[。！？\n]/)
      .filter((s) => s.trim().length > 10);
    keyPoints.push(...sentences.slice(0, 3));
  } else {
    const words = content.split(/\s+/);
    keyPoints.push(...words.slice(0, 5));
  }

  return keyPoints;
}
