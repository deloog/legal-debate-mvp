/**
 * 合同审查服务 - AI驱动的合同风险识别
 * 使用 DeepSeek 两阶段审查：
 *   第一阶段：识别所有风险条目 + 综合评分
 *   第二阶段：针对识别出的风险生成修改建议
 * 每阶段独立输出，各自最多 8192 token，解决单次输出不够的问题。
 */

import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import type {
  RiskItem,
  Suggestion,
  ReviewReport,
} from '@/types/contract-review';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
});

const MODEL = () => process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

// ─── 第一阶段：风险识别 ────────────────────────────────────────────────────────

const PHASE1_SYSTEM = `你是一名经验丰富的中国法律顾问，专注于合同审查与风险识别。
请对合同文本进行全面审查，识别所有潜在法律风险，并给出综合评分。

严格按照以下JSON格式返回，不得输出任何其他内容：
{
  "overallScore": <0-100整数，综合评分>,
  "riskScore": <0-100整数，风险评分，越高表示风险越低>,
  "complianceScore": <0-100整数，合规评分>,
  "risks": [
    {
      "type": "<DISPUTE_RESOLUTION|CONFIDENTIALITY|LIABILITY|INTELLECTUAL_PROPERTY|FINANCIAL|TERMINATION|FORCE_MAJEURE|GOVERNING_LAW|OTHER>",
      "level": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "title": "<风险标题，不超过20字>",
      "description": "<风险描述，不超过100字>",
      "originalText": "<触发该风险的合同原文片段，缺失条款则为空字符串>",
      "impact": "<可能造成的影响，不超过60字>",
      "probability": <0到1之间的小数>
    }
  ]
}

审查要点：
1. 主体资格与签署权限
2. 合同标的与权利义务是否清晰
3. 付款条款（金额、方式、时间、条件）
4. 违约责任与赔偿标准
5. 合同解除与终止条件
6. 争议解决方式与管辖法院/仲裁机构
7. 保密条款
8. 知识产权归属
9. 不可抗力条款
10. 适用法律
11. 格式条款是否存在显失公平
12. 是否存在违反强制性法律规定的条款`;

type Phase1Result = {
  overallScore: number;
  riskScore: number;
  complianceScore: number;
  risks: Array<{
    type: string;
    level: string;
    title: string;
    description: string;
    originalText: string;
    impact: string;
    probability: number;
  }>;
};

// ─── 第二阶段：修改建议 ────────────────────────────────────────────────────────

const PHASE2_SYSTEM = `你是一名经验丰富的中国法律顾问。
根据提供的合同风险清单，为每个风险生成具体的修改建议。

严格按照以下JSON格式返回，不得输出任何其他内容：
{
  "suggestions": [
    {
      "riskType": "<对应的风险type值>",
      "type": "<ADD|MODIFY|DELETE>",
      "title": "<建议标题，不超过20字>",
      "description": "<建议说明，不超过80字>",
      "suggestedText": "<建议增加或替换的具体合同文字>",
      "priority": "<HIGH|MEDIUM|LOW>",
      "reason": "<给出此建议的原因，不超过60字>"
    }
  ]
}

要求：
- 每个 CRITICAL/HIGH 风险至少给出一条建议
- MEDIUM/LOW 风险视情况给出建议
- suggestedText 需为可直接使用的合同条款文字`;

type Phase2Result = {
  suggestions: Array<{
    riskType: string;
    type: string;
    title: string;
    description: string;
    suggestedText: string;
    priority: string;
    reason: string;
  }>;
};

// ─── 主函数 ────────────────────────────────────────────────────────────────────

export async function reviewContract(
  _contractId: string,
  _filePath: string,
  content: string
): Promise<
  Omit<
    ReviewReport,
    | 'id'
    | 'contractId'
    | 'fileName'
    | 'fileSize'
    | 'uploadedAt'
    | 'reviewedAt'
    | 'status'
  >
> {
  const startTime = Date.now();

  // 限制输入长度，避免超出模型上下文窗口（DeepSeek-chat 64K context）
  const truncatedContent =
    content.length > 30000
      ? content.slice(0, 30000) + '\n\n[内容已截断，仅展示前30000字]'
      : content;

  // ── 第一阶段：识别风险 ────────────────────────────────────────────────────
  logger.info('[contract-reviewer] 第一阶段：风险识别');
  const phase1Msg = await client.chat.completions.create({
    model: MODEL(),
    max_tokens: 8192,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PHASE1_SYSTEM },
      { role: 'user', content: `请审查以下合同文本：\n\n${truncatedContent}` },
    ],
  });

  const phase1Raw = phase1Msg.choices[0]?.message?.content ?? '';
  if (!phase1Raw) throw new Error('AI第一阶段未返回结果');
  const phase1 = JSON.parse(phase1Raw) as Phase1Result;

  if (!Array.isArray(phase1.risks) || phase1.risks.length === 0) {
    // 无风险的合同直接返回，跳过第二阶段
    return {
      overallScore: phase1.overallScore ?? 100,
      riskScore: phase1.riskScore ?? 100,
      complianceScore: phase1.complianceScore ?? 100,
      totalRisks: 0,
      criticalRisks: 0,
      highRisks: 0,
      mediumRisks: 0,
      lowRisks: 0,
      risks: [],
      suggestions: [],
      reviewTime: Date.now() - startTime,
    };
  }

  // ── 第二阶段：生成修改建议 ─────────────────────────────────────────────────
  logger.info(
    `[contract-reviewer] 第二阶段：生成建议（共 ${phase1.risks.length} 个风险）`
  );
  const riskSummary = phase1.risks
    .map(r => `[${r.type}/${r.level}] ${r.title}：${r.description}`)
    .join('\n');

  const phase2Msg = await client.chat.completions.create({
    model: MODEL(),
    max_tokens: 8192,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PHASE2_SYSTEM },
      {
        role: 'user',
        content: `合同风险清单如下，请逐一给出修改建议：\n\n${riskSummary}`,
      },
    ],
  });

  const phase2Raw = phase2Msg.choices[0]?.message?.content ?? '';
  if (!phase2Raw) throw new Error('AI第二阶段未返回结果');
  const phase2 = JSON.parse(phase2Raw) as Phase2Result;

  // ── 映射为标准类型 ─────────────────────────────────────────────────────────
  const risks: RiskItem[] = phase1.risks.map((r, i) => ({
    id: `risk-${startTime}-${i}`,
    type: r.type as RiskItem['type'],
    level: r.level as RiskItem['level'],
    title: r.title,
    description: r.description,
    location: { page: 1, paragraph: 1 },
    originalText: r.originalText ?? '',
    impact: r.impact,
    probability: r.probability,
  }));

  const suggestions: Suggestion[] = (phase2.suggestions ?? []).map((s, i) => {
    const matchedRisk = risks.find(r => r.type === s.riskType);
    return {
      id: `suggestion-${startTime}-${i}`,
      riskId: matchedRisk?.id ?? `risk-${startTime}-0`,
      type: s.type as Suggestion['type'],
      title: s.title,
      description: s.description,
      suggestedText: s.suggestedText,
      priority: s.priority as Suggestion['priority'],
      reason: s.reason,
    };
  });

  return {
    overallScore: phase1.overallScore,
    riskScore: phase1.riskScore,
    complianceScore: phase1.complianceScore,
    totalRisks: risks.length,
    criticalRisks: risks.filter(r => r.level === 'CRITICAL').length,
    highRisks: risks.filter(r => r.level === 'HIGH').length,
    mediumRisks: risks.filter(r => r.level === 'MEDIUM').length,
    lowRisks: risks.filter(r => r.level === 'LOW').length,
    risks,
    suggestions,
    reviewTime: Date.now() - startTime,
  };
}
