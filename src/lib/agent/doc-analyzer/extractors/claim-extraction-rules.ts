// =============================================================================
// DocAnalyzer 诉讼请求提取规则库
// 从主提取器拆分，控制文件行数在200行以内
// =============================================================================

import type { ClaimType } from "../core/types";

// =============================================================================
// 接口定义
// =============================================================================

export interface CompoundClaimMatch {
  originalText: string;
  types: ClaimType[];
  amounts?: number[];
}

export interface ClaimRule {
  type: ClaimType;
  patterns: RegExp[];
  synonyms: string[];
  hiddenPatterns: RegExp[];
}

// =============================================================================
// 诉讼请求规则定义
// =============================================================================

/**
 * 复合请求模式
 * 用于识别和拆解包含多个诉讼请求的复合表达
 */
export const COMPOUND_CLAIM_PATTERNS: CompoundClaimMatch[] = [
  {
    originalText: "本金.*利息",
    types: ["PAY_PRINCIPAL", "PAY_INTEREST"],
  },
  {
    originalText: "本金.*违约金",
    types: ["PAY_PRINCIPAL", "PAY_PENALTY"],
  },
  {
    originalText: "利息.*违约金",
    types: ["PAY_INTEREST", "PAY_PENALTY"],
  },
  {
    originalText: "本金.*利息.*共计",
    types: ["PAY_PRINCIPAL", "PAY_INTEREST"],
  },
  {
    originalText: "偿还.*及.*利息",
    types: ["PAY_PRINCIPAL", "PAY_INTEREST"],
  },
  {
    originalText: "本金.*利息.*违约金",
    types: ["PAY_PRINCIPAL", "PAY_INTEREST", "PAY_PENALTY"],
  },
  {
    originalText: "偿还本金.*支付利息.*及.*违约金",
    types: ["PAY_PRINCIPAL", "PAY_INTEREST", "PAY_PENALTY"],
  },
  {
    originalText: "支付货款.*并承担.*资金占用费",
    types: ["PAY_PRINCIPAL", "PAY_INTEREST"],
  },
  {
    originalText: "本金.*从.*之日.*至.*之日止",
    types: ["PAY_PRINCIPAL", "PAY_INTEREST"],
  },
  {
    originalText: "解除.*合同.*赔偿.*损失.*承担.*诉讼费",
    types: ["TERMINATION", "PAY_DAMAGES", "LITIGATION_COST"],
  },
];

/**
 * 诉讼请求类型规则库
 */
export const CLAIM_TYPE_RULES: ClaimRule[] = [
  {
    type: "PAY_PRINCIPAL",
    patterns: [
      /偿还本金|支付本金|归还本金/gi,
      /判令被告支付(.*?)(货款|本金|欠款)/gi,
      /承担本金|本金.*万元/gi,
      /偿还.*万元(?!利息)/gi,
    ],
    synonyms: [
      "货款",
      "欠款",
      "借款",
      "贷款",
      "垫付款",
      "预付款",
      "货款支付",
      "货款偿还",
      "借款偿还",
      "借款支付",
      "欠款支付",
      "欠款偿还",
    ],
    hiddenPatterns: [
      /货款/gi,
      /欠款/gi,
      /借款/gi,
      /贷款/gi,
      /垫付款/gi,
      /预付款/gi,
      /货款.*支付/gi,
      /货款.*偿还/gi,
      /借款.*偿还/gi,
      /借款.*支付/gi,
      /欠款.*支付/gi,
      /欠款.*偿还/gi,
      /至今未还本金/gi,
      /判令被告偿还本金/gi,
      /承担.*万元/gi,
    ],
  },
  {
    type: "PAY_INTEREST",
    patterns: [
      /支付利息|承担利息|支付利息/gi,
      /利息.*年利率|年利率.*利息/gi,
      /利息.*万元/gi,
      /支付.*利息/gi,
      /资金占用费/gi,
      /支付资金占用费/gi,
      /资金.*年利率/gi,
    ],
    synonyms: [
      "利息计算",
      "利息支付",
      "利息承担",
      "利息偿还",
      "年利率利息",
      "月利率利息",
    ],
    hiddenPatterns: [
      /利息|利率|年利率|月利率|资金占用费/gi,
      /利息.*计算/gi,
      /利息.*支付/gi,
      /利息.*承担/gi,
      /利息.*偿还/gi,
      /年利率.*利息/gi,
      /月利率.*利息/gi,
      /资金占用费/gi,
      /支付资金占用费/gi,
      /资金.*年利率/gi,
    ],
  },
  {
    type: "PAY_PENALTY",
    patterns: [
      /支付违约金|承担违约金/gi,
      /违约金.*万元/gi,
      /罚息/gi,
      /滞纳金/gi,
      /逾期罚息/gi,
    ],
    synonyms: [
      "罚金",
      "罚款",
      "违约罚金",
      "逾期违约金",
      "迟延履行金",
      "赔偿金违约",
      "违约赔偿",
      "罚息支付",
      "罚息承担",
      "滞纳金支付",
      "滞纳金承担",
    ],
    hiddenPatterns: [
      /罚金/gi,
      /罚款/gi,
      /违约罚金/gi,
      /逾期违约金/gi,
      /迟延履行金/gi,
      /赔偿金.*违约/gi,
      /违约.*赔偿/gi,
      /罚息.*支付/gi,
      /罚息.*承担/gi,
      /滞纳金.*支付/gi,
      /滞纳金.*承担/gi,
      /违约金/gi,
      /罚息/gi,
      /滞纳金/gi,
      /逾期罚息/gi,
    ],
  },
  {
    type: "PAY_DAMAGES",
    patterns: [/赔偿损失|承担损失/gi, /赔偿.*万元/gi, /经济损失/gi],
    synonyms: ["财产损失", "直接损失", "间接损失", "实际损失", "精神损害"],
    hiddenPatterns: [
      /经济损失/gi,
      /财产损失/gi,
      /直接损失/gi,
      /间接损失/gi,
      /实际损失/gi,
    ],
  },
  {
    type: "LITIGATION_COST",
    patterns: [
      /诉讼费用.*承担/gi,
      /本案.*诉讼费/gi,
      /由.*承担.*诉讼费/gi,
      /诉讼费.*被告/gi,
    ],
    synonyms: [
      "案件受理费",
      "保全费",
      "鉴定费",
      "公告费",
      "执行费",
      "律师费",
      "代理费",
      "公证费",
      "翻译费",
      "差旅费",
      "费用诉讼",
      "诉讼费用",
      "本案费",
      "案件费用",
      "律师费承担",
      "代理费承担",
      "差旅费承担",
    ],
    hiddenPatterns: [
      /诉讼费/gi,
      /案件受理费/gi,
      /保全费/gi,
      /鉴定费/gi,
      /公告费/gi,
      /执行费/gi,
      /律师费/gi,
      /代理费/gi,
      /公证费/gi,
      /翻译费/gi,
      /差旅费/gi,
      /费用.*诉讼/gi,
      /诉讼.*费用/gi,
      /本案.*费/gi,
      /案件费用/gi,
      /律师费.*承担/gi,
      /代理费.*承担/gi,
      /差旅费.*承担/gi,
      /诉讼费用.*承担/gi,
      /本案.*诉讼费/gi,
      /由.*承担.*诉讼费/gi,
      /诉讼费.*被告/gi,
      /判令被告/gi,
    ],
  },
  {
    type: "PERFORMANCE",
    patterns: [/履行义务|继续履行/gi, /履行合同/gi],
    synonyms: ["继续履行合同", "履行合同义务"],
    hiddenPatterns: [],
  },
  {
    type: "TERMINATION",
    patterns: [/解除合同|终止合同/gi, /解除.*合同/gi],
    synonyms: ["解除合同关系", "终止合同关系"],
    hiddenPatterns: [],
  },
  {
    type: "OTHER",
    patterns: [/判令被告/gi, /诉讼请求/gi],
    synonyms: ["其他诉讼请求"],
    hiddenPatterns: [],
  },
];

/**
 * 获取指定类型的正则表达式模式
 */
export function getClaimPatterns(type: ClaimType): RegExp[] {
  const rule = CLAIM_TYPE_RULES.find((r) => r.type === type);
  return rule?.patterns || [];
}

/**
 * 获取指定类型的隐藏模式
 */
export function getHiddenPatterns(type: ClaimType): RegExp[] {
  const rule = CLAIM_TYPE_RULES.find((r) => r.type === type);
  return rule?.hiddenPatterns || [];
}

/**
 * 检查文本是否包含指定类型的诉讼请求
 */
export function textContainsClaimType(text: string, type: ClaimType): boolean {
  const patterns = getClaimPatterns(type);
  const hiddenPatterns = getHiddenPatterns(type);

  return (
    patterns.some((pattern) => pattern.test(text)) ||
    hiddenPatterns.some((pattern) => pattern.test(text))
  );
}

/**
 * 检查文本是否可能包含诉讼费用（隐藏请求推断）
 */
export function likelyHasLitigationCost(text: string): boolean {
  const patterns = [
    /诉讼费用.*承担/,
    /本案.*诉讼费/,
    /由.*承担.*费用/,
    /诉讼费.*被告/,
    /费用.*由.*承担/,
    /本案全部诉讼费/,
    /承担本案.*费用/,
    /诉讼费用由/,
    /全部诉讼费用/,
    /判令被告/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * 检查文本是否可能包含本金
 */
export function likelyHasPrincipal(text: string): boolean {
  const patterns = [
    /本金/gi,
    /借款本金/gi,
    /货款本金/gi,
    /货款/gi,
    /欠款/gi,
    /支付货款/gi,
    /偿还货款/gi,
    /判令被告支付货款/gi,
    /判令被告偿还货款/gi,
    /至今未还本金/gi,
    /判令被告偿还本金/gi,
    /承担.*万元/gi,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * 检查文本是否可能包含利息
 */
export function likelyHasInterest(text: string): boolean {
  const patterns = [/利息|利率|年利率|月利率|资金占用费/];
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * 检查文本是否可能包含违约金
 */
export function likelyHasPenalty(text: string): boolean {
  const patterns = [/违约金|罚息|滞纳金/];
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * 检查文本是否应推断诉讼费用
 * 根据上下文判断是否应该补充诉讼费用请求
 */
export function shouldInferLitigationCost(text: string): boolean {
  const hasJudgeCommand = /判令被告/.test(text);
  const hasExplicitLitigationCost = /诉讼费用|本案.*诉讼费|全部诉讼费用/.test(
    text,
  );

  if (hasJudgeCommand && !hasExplicitLitigationCost) {
    return true;
  }

  const hasCost = /承担.*费用|费用.*由.*承担/.test(text);
  if (hasCost && !hasExplicitLitigationCost) {
    return true;
  }

  return false;
}

/**
 * 检查文本是否应推断利息请求
 */
export function shouldInferInterest(text: string): boolean {
  const hasPrincipal = /本金/.test(text);
  const hasExplicitInterest =
    /支付利息|承担利息|利息.*年利率|年利率.*利息/.test(text);

  if (hasPrincipal && !hasExplicitInterest) {
    const hasOverdue = /逾期|未按期|迟延/.test(text);
    if (hasOverdue) {
      return true;
    }
  }

  return false;
}

/**
 * 检查文本是否应推断违约金请求
 */
export function shouldInferPenalty(text: string): boolean {
  const hasBreach = /违约|违反.*合同|未履行/.test(text);
  const hasExplicitPenalty = /支付违约金|承担违约金|违约金.*万元/.test(text);

  if (hasBreach && !hasExplicitPenalty) {
    return true;
  }

  return false;
}

/**
 * 识别复合请求中的各个组成部分
 */
export function identifyCompoundClaims(text: string): ClaimType[] {
  const identifiedTypes: ClaimType[] = [];

  for (const pattern of COMPOUND_CLAIM_PATTERNS) {
    if (
      pattern.originalText &&
      new RegExp(pattern.originalText, "i").test(text)
    ) {
      for (const type of pattern.types) {
        if (!identifiedTypes.includes(type)) {
          identifiedTypes.push(type);
        }
      }
    }
  }

  return identifiedTypes;
}

/**
 * 获取诉讼请求类型标签
 */
export function getClaimTypeLabel(type: ClaimType): string {
  const labels: Record<ClaimType, string> = {
    PAY_PRINCIPAL: "偿还本金",
    PAY_INTEREST: "支付利息",
    PAY_PENALTY: "支付违约金",
    LITIGATION_COST: "承担诉讼费用",
    PAY_DAMAGES: "赔偿损失",
    PERFORMANCE: "履行义务",
    TERMINATION: "解除合同",
    OTHER: "其他",
  };
  return labels[type] || type;
}
