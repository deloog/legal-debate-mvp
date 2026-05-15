import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import { getDefaultModel } from '@/lib/ai/config';
import { logger } from '@/lib/logger';
import type { CaseExtractionSnapshot } from '@/lib/case/case-extraction-service';

// ── 公共类型（与 package-builder §5 的 RiskMetadata 对齐）────────────────────

export interface RiskAssessmentSnapshot {
  winRate: number;
  difficulty: string;
  riskLevel: string;
  aiAssessment: {
    summary: string;
    keyRisks: string[];
    generatedAt: string;
  };
}

// ── AI 模型配置 ──────────────────────────────────────────────────────────────

const RISK_MODEL =
  process.env.CASE_RISK_MODEL ?? getDefaultModel('deepseek', 'chat');

// ── 提示词 ───────────────────────────────────────────────────────────────────

const RISK_SYSTEM_PROMPT = `你是专业的法律风险评估助手。
根据给定的案件信息，评估案件的胜诉风险，以 JSON 格式返回，不要有其他说明文字。
返回结构：
{
  "winRate": 0.65,
  "difficulty": "中等",
  "riskLevel": "MEDIUM",
  "summary": "案件风险综合评估摘要（2-3句话）",
  "keyRisks": ["关键风险点1", "关键风险点2", "关键风险点3"]
}
字段说明：
- winRate: 0-1 之间的数字，代表原告胜诉概率
- difficulty: "简单" | "中等" | "复杂"
- riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
- summary: 风险总结
- keyRisks: 最多5条主要风险点`;

// ── 内部：从提炼快照构建 AI 输入文本 ─────────────────────────────────────────

function buildRiskContext(
  snapshot: CaseExtractionSnapshot,
  caseTitle: string
): string {
  return [
    `案件名称：${caseTitle}`,
    snapshot.plaintiffName ? `原告：${snapshot.plaintiffName}` : '',
    snapshot.defendantName ? `被告：${snapshot.defendantName}` : '',
    snapshot.summary ? `案件摘要：${snapshot.summary}` : '',
    snapshot.establishedFacts.length
      ? `已确认事实：\n${snapshot.establishedFacts.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}`
      : '',
    snapshot.uncertainFacts.length
      ? `存疑事实：\n${snapshot.uncertainFacts.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}`
      : '',
    snapshot.disputeFocuses.length
      ? `争议焦点：\n${snapshot.disputeFocuses.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ── 内部：解析 AI 返回的 JSON ────────────────────────────────────────────────

function parseAIRiskResponse(rawText: string): Omit<
  RiskAssessmentSnapshot,
  'aiAssessment'
> & {
  summary: string;
  keyRisks: string[];
} {
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : rawText;
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('AI 未返回有效 JSON');
  }
  const parsed = JSON.parse(jsonStr.slice(start, end + 1)) as {
    winRate?: unknown;
    difficulty?: unknown;
    riskLevel?: unknown;
    summary?: unknown;
    keyRisks?: unknown;
  };

  const winRate =
    typeof parsed.winRate === 'number'
      ? Math.max(0, Math.min(1, parsed.winRate))
      : 0.5;
  const difficulty =
    typeof parsed.difficulty === 'string' ? parsed.difficulty : '中等';
  const riskLevel =
    typeof parsed.riskLevel === 'string' ? parsed.riskLevel : 'MEDIUM';
  const summary =
    typeof parsed.summary === 'string' ? parsed.summary : '暂无评估';
  const keyRisks = Array.isArray(parsed.keyRisks)
    ? (parsed.keyRisks as string[])
        .filter(r => typeof r === 'string')
        .slice(0, 5)
    : [];

  return { winRate, difficulty, riskLevel, summary, keyRisks };
}

// ── 主入口：执行风险评估并写入 metadata ──────────────────────────────────────

/**
 * 执行案件风险评估，结果写入 Case.metadata.riskAssessment。
 * 依赖 Case.metadata.extractionSnapshot 已存在；若不存在则返回 null。
 */
export async function runCaseRiskAssessment(
  caseId: string
): Promise<RiskAssessmentSnapshot | null> {
  // 1. 读取案件信息和提炼快照
  const caseRow = await prisma.case.findUnique({
    where: { id: caseId, deletedAt: null },
    select: { title: true, metadata: true },
  });
  if (!caseRow) {
    logger.warn(`[risk-pipeline] 案件不存在: ${caseId}`);
    return null;
  }

  const meta =
    caseRow.metadata && typeof caseRow.metadata === 'object'
      ? (caseRow.metadata as Record<string, unknown>)
      : {};

  const snapshot = meta['extractionSnapshot'] as
    | CaseExtractionSnapshot
    | undefined;
  if (!snapshot || !snapshot.generatedAt) {
    logger.info(`[risk-pipeline] 案件 ${caseId} 尚无提炼快照，跳过风险评估`);
    return null;
  }

  // 2. 构建 AI 输入
  const contextText = buildRiskContext(snapshot, caseRow.title);

  // 3. AI 风险评估（失败时直接抛出，由调用方决定如何处理）
  const aiService = await AIServiceFactory.getInstance();
  const response = await aiService.chatCompletion({
    model: RISK_MODEL,
    messages: [
      { role: 'system', content: RISK_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请对以下案件进行法律风险评估：\n\n${contextText}`,
      },
    ],
    temperature: 0.1,
    maxTokens: 1000,
  });
  const rawText = response.choices[0]?.message?.content ?? '';
  const aiParsed = parseAIRiskResponse(rawText);

  // 4. 构造快照
  const riskSnapshot: RiskAssessmentSnapshot = {
    winRate: aiParsed.winRate,
    difficulty: aiParsed.difficulty,
    riskLevel: aiParsed.riskLevel,
    aiAssessment: {
      summary: aiParsed.summary,
      keyRisks: aiParsed.keyRisks,
      generatedAt: new Date().toISOString(),
    },
  };

  // 5. 写回 Case.metadata.riskAssessment（保留其他字段）
  await prisma.case.update({
    where: { id: caseId },
    data: {
      metadata: {
        ...meta,
        riskAssessment: riskSnapshot as unknown as Prisma.InputJsonValue,
      } as Prisma.InputJsonValue,
    },
  });

  logger.info(
    `[risk-pipeline] 案件 ${caseId} 风险评估完成: ${riskSnapshot.riskLevel}`
  );
  return riskSnapshot;
}
