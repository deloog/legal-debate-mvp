/**
 * AI案件评估服务
 *
 * 该服务只负责调用真实 AI 并校验结构化输出。AI 不可用或返回无效 JSON 时直接抛出，
 * 由路由层向用户返回友好错误，不再使用关键词规则兜底。
 */

import { AIServiceFactory } from '@/lib/ai/service-refactored';
import { logger } from '@/lib/logger';
import { AIAssessment } from '@/types/consultation';

/**
 * 案件评估输入参数
 */
export interface CaseAssessmentInput {
  caseType?: string;
  caseSummary: string;
  clientDemand?: string;
  consultationType?: string;
}

type DifficultyLevel = AIAssessment['difficulty'];
type RiskLevel = AIAssessment['riskLevel'];

const ASSESSMENT_MODEL =
  process.env.CONSULTATION_ASSESSMENT_MODEL ?? 'deepseek-chat';

const SYSTEM_PROMPT = `你是一名资深中国执业律师，负责对潜在咨询案件做初步法律评估。

请严格返回 JSON，不要输出 Markdown，不要输出解释性前后缀。
JSON 结构必须为：
{
  "winRate": 0.55,
  "winRateReasoning": "胜诉率理由",
  "difficulty": "EASY|MEDIUM|HARD",
  "difficultyFactors": ["难度因素"],
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskFactors": ["风险因素"],
  "suggestedFeeMin": 5000,
  "suggestedFeeMax": 15000,
  "feeReasoning": "费用建议理由",
  "keyLegalPoints": [{"point": "法律要点", "relevantLaw": "相关法律依据"}],
  "suggestions": ["律师处理建议"],
  "similarCases": [{"caseName": "可为空", "result": "可为空", "similarity": 0.7}],
  "confidence": 0.8
}

要求：
- winRate 和 confidence 使用 0 到 1 的小数。
- difficulty 只能是 EASY、MEDIUM、HARD。
- riskLevel 只能是 LOW、MEDIUM、HIGH。
- keyLegalPoints、suggestions 必须给出专业、谨慎、可执行的内容。
- 不得编造具体案号或不存在的案例；没有类似案例时 similarCases 返回空数组。`;

function extractJson(rawText: string): unknown {
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : rawText;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('AI 未返回有效 JSON');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function clamp(value: unknown, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string): string[] {
  if (!Array.isArray(value)) return [fallback];
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
  return items.length ? items : [fallback];
}

function asDifficulty(value: unknown): DifficultyLevel {
  return value === 'EASY' || value === 'MEDIUM' || value === 'HARD'
    ? value
    : 'MEDIUM';
}

function asRiskLevel(value: unknown): RiskLevel {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH'
    ? value
    : 'MEDIUM';
}

function normalizeAssessment(parsed: unknown): AIAssessment {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 评估结果不是对象');
  }

  const data = parsed as Record<string, unknown>;
  const suggestedFeeMin = Math.round(clamp(data.suggestedFeeMin, 0, 1_000_000));
  const suggestedFeeMax = Math.round(
    Math.max(suggestedFeeMin, clamp(data.suggestedFeeMax, 0, 2_000_000))
  );

  const keyLegalPoints = Array.isArray(data.keyLegalPoints)
    ? data.keyLegalPoints
        .map(item => {
          if (!item || typeof item !== 'object') return null;
          const point = asString((item as Record<string, unknown>).point, '');
          const relevantLaw = asString(
            (item as Record<string, unknown>).relevantLaw,
            ''
          );
          return point && relevantLaw ? { point, relevantLaw } : null;
        })
        .filter(
          (item): item is { point: string; relevantLaw: string } =>
            item !== null
        )
    : [];

  const similarCases = Array.isArray(data.similarCases)
    ? data.similarCases
        .map(item => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          const caseName = asString(row.caseName, '');
          const result = asString(row.result, '');
          if (!caseName || !result) return null;
          return {
            caseName,
            result,
            similarity: clamp(row.similarity, 0, 1),
          };
        })
        .filter(
          (
            item
          ): item is { caseName: string; result: string; similarity: number } =>
            item !== null
        )
    : [];

  return {
    winRate: clamp(data.winRate, 0, 1),
    winRateReasoning: asString(data.winRateReasoning, 'AI 未提供胜诉率理由'),
    difficulty: asDifficulty(data.difficulty),
    difficultyFactors: asStringArray(
      data.difficultyFactors,
      'AI 未提供难度因素'
    ),
    riskLevel: asRiskLevel(data.riskLevel),
    riskFactors: asStringArray(data.riskFactors, 'AI 未提供风险因素'),
    suggestedFeeMin,
    suggestedFeeMax,
    feeReasoning: asString(data.feeReasoning, 'AI 未提供费用建议理由'),
    keyLegalPoints: keyLegalPoints.length
      ? keyLegalPoints
      : [{ point: '需进一步分析案情', relevantLaw: '根据具体事实确定' }],
    suggestions: asStringArray(data.suggestions, '建议补充材料后再评估'),
    similarCases,
    confidence: clamp(data.confidence, 0, 1),
    verifiedStatus: 'pending',
  };
}

/**
 * 案件评估服务类
 */
export class CaseAssessmentService {
  /**
   * 执行案件评估
   */
  public async assess(input: CaseAssessmentInput): Promise<AIAssessment> {
    try {
      const aiService = await AIServiceFactory.getInstance();
      const response = await aiService.chatCompletion({
        model: ASSESSMENT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              `咨询方式：${input.consultationType || '未提供'}`,
              `案件类型：${input.caseType || '未提供'}`,
              `案情摘要：${input.caseSummary}`,
              `客户诉求：${input.clientDemand || '未提供'}`,
            ].join('\n'),
          },
        ],
        temperature: 0.1,
        maxTokens: 1800,
      });

      const rawText = response.choices[0]?.message?.content ?? '';
      return normalizeAssessment(extractJson(rawText));
    } catch (error) {
      logger.error('AI案件评估失败:', error);
      throw error instanceof Error ? error : new Error('AI案件评估失败');
    }
  }
}

/**
 * 创建案件评估服务实例
 */
export function createCaseAssessmentService(): CaseAssessmentService {
  return new CaseAssessmentService();
}
