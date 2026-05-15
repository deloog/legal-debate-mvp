import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import { getDefaultModel } from '@/lib/ai/config';
import { logger } from '@/lib/logger';

/**
 * 案件提炼使用的 AI 模型。
 * 优先读取环境变量 CASE_EXTRACTION_MODEL，
 * 否则使用 DeepSeek 默认 chat 模型（deepseek-chat）。
 */
const EXTRACTION_MODEL =
  process.env.CASE_EXTRACTION_MODEL ?? getDefaultModel('deepseek', 'chat');

// ── 公共类型 ───────────────────────────────────────────────────────────────────

export interface CaseExtractionSnapshot {
  summary: string | null;
  plaintiffName: string | null;
  defendantName: string | null;
  establishedFacts: string[];
  uncertainFacts: string[];
  disputeFocuses: string[];
  sourceDocumentIds: string[];
  generatedAt: string;
}

interface DocumentAnalysisData {
  extractedData?: {
    parties?: Array<{ type: string; name: string }>;
    claims?: Array<{ content?: string; text?: string; type?: string }>;
    summary?: string;
    keyFacts?: Array<{ description?: string; date?: string } | string>;
    core_disputes?: string[];
  };
  confidence?: number;
}

// ── 内部：从多份文档分析结果聚合原始素材 ────────────────────────────────────────

interface RawMaterial {
  plaintiffName: string | null;
  defendantName: string | null;
  summaries: string[];
  allClaims: string[];
  allKeyFacts: string[];
  allDisputes: string[];
}

function parseAnalysisResult(raw: unknown): DocumentAnalysisData | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as DocumentAnalysisData;
}

function aggregateRawMaterial(
  docs: Array<{ id: string; analysisResult: unknown }>
): RawMaterial & { docIds: string[] } {
  const material: RawMaterial = {
    plaintiffName: null,
    defendantName: null,
    summaries: [],
    allClaims: [],
    allKeyFacts: [],
    allDisputes: [],
  };
  const docIds: string[] = [];

  for (const doc of docs) {
    const parsed = parseAnalysisResult(doc.analysisResult);
    if (!parsed?.extractedData) continue;
    docIds.push(doc.id);
    const d = parsed.extractedData;

    if (d.summary) material.summaries.push(d.summary);

    for (const p of d.parties ?? []) {
      if (p.type === 'plaintiff' && !material.plaintiffName) {
        material.plaintiffName = p.name;
      }
      if (p.type === 'defendant' && !material.defendantName) {
        material.defendantName = p.name;
      }
    }

    for (const c of d.claims ?? []) {
      const text = c.content ?? c.text ?? '';
      if (text) material.allClaims.push(text);
    }

    for (const f of d.keyFacts ?? []) {
      const text = typeof f === 'string' ? f : (f.description ?? '');
      if (text) material.allKeyFacts.push(text);
    }

    for (const dispute of d.core_disputes ?? []) {
      if (dispute) material.allDisputes.push(dispute);
    }
  }

  return { ...material, docIds };
}

// ── 内部：使用 AI 对素材做结构化提炼 ───────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `你是专业的法律案件分析助手。
根据给定的卷宗材料片段，提炼出案件核心信息，以 JSON 格式返回，不要有其他说明文字。
返回结构：
{
  "summary": "案件总体摘要（2-3句话）",
  "establishedFacts": ["已确认事实1", "已确认事实2"],
  "uncertainFacts": ["存疑事实1", "存疑事实2"],
  "disputeFocuses": ["争议焦点1", "争议焦点2"]
}`;

async function aiExtract(
  material: RawMaterial,
  caseTitle: string
): Promise<
  Pick<
    CaseExtractionSnapshot,
    'summary' | 'establishedFacts' | 'uncertainFacts' | 'disputeFocuses'
  >
> {
  const contextText = [
    `案件名称：${caseTitle}`,
    material.plaintiffName ? `原告：${material.plaintiffName}` : '',
    material.defendantName ? `被告：${material.defendantName}` : '',
    material.summaries.length
      ? `文档摘要：\n${material.summaries.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
      : '',
    material.allClaims.length
      ? `诉讼请求：\n${material.allClaims.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`
      : '',
    material.allKeyFacts.length
      ? `关键事实：\n${material.allKeyFacts.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}`
      : '',
    material.allDisputes.length
      ? `文档内争议点：\n${material.allDisputes.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const aiService = await AIServiceFactory.getInstance();
  const response = await aiService.chatCompletion({
    model: EXTRACTION_MODEL,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请对以下卷宗材料进行案情提炼：\n\n${contextText}`,
      },
    ],
    temperature: 0.1,
    maxTokens: 1500,
  });

  const rawText = response.choices[0]?.message?.content ?? '';

  // 解析 AI 返回的 JSON
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : rawText;
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('AI 未返回有效 JSON');
  }
  const parsed = JSON.parse(jsonStr.slice(start, end + 1)) as {
    summary?: string;
    establishedFacts?: unknown[];
    uncertainFacts?: unknown[];
    disputeFocuses?: unknown[];
  };

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    establishedFacts: Array.isArray(parsed.establishedFacts)
      ? (parsed.establishedFacts as string[]).filter(s => typeof s === 'string')
      : [],
    uncertainFacts: Array.isArray(parsed.uncertainFacts)
      ? (parsed.uncertainFacts as string[]).filter(s => typeof s === 'string')
      : [],
    disputeFocuses: Array.isArray(parsed.disputeFocuses)
      ? (parsed.disputeFocuses as string[]).filter(s => typeof s === 'string')
      : [],
  };
}

// ── 主入口：对案件执行提炼并写回 metadata ───────────────────────────────────────

/**
 * 执行案件提炼并将结果写入 Case.metadata.extractionSnapshot。
 * 返回写入后的快照，若不满足阈值则返回 null。
 */
export async function runCaseExtraction(
  caseId: string
): Promise<CaseExtractionSnapshot | null> {
  // 1. 取案件信息
  const caseRow = await prisma.case.findUnique({
    where: { id: caseId, deletedAt: null },
    select: {
      title: true,
      plaintiffName: true,
      defendantName: true,
      metadata: true,
    },
  });
  if (!caseRow) {
    logger.warn(`[case-extraction] 案件不存在: ${caseId}`);
    return null;
  }

  // 2. 取所有已分析完成的文档
  const completedDocs = await prisma.document.findMany({
    where: { caseId, analysisStatus: 'COMPLETED', deletedAt: null },
    select: { id: true, analysisResult: true },
    orderBy: { createdAt: 'asc' },
  });

  if (completedDocs.length === 0) {
    logger.info(`[case-extraction] 案件 ${caseId} 无已完成文档，跳过`);
    return null;
  }

  // 3. 聚合原始素材
  const { docIds, ...material } = aggregateRawMaterial(completedDocs);

  // 4. 使用 Case 字段补充当事人（如文档中未提取到）
  if (!material.plaintiffName && caseRow.plaintiffName) {
    material.plaintiffName = caseRow.plaintiffName;
  }
  if (!material.defendantName && caseRow.defendantName) {
    material.defendantName = caseRow.defendantName;
  }

  // 5. AI 提炼（失败时直接抛出，由调用方决定如何处理）
  const aiResult = await aiExtract(material, caseRow.title);

  // 6. 构造快照
  const snapshot: CaseExtractionSnapshot = {
    ...aiResult,
    plaintiffName: material.plaintiffName,
    defendantName: material.defendantName,
    sourceDocumentIds: docIds,
    generatedAt: new Date().toISOString(),
  };

  // 7. 写回 Case.metadata.extractionSnapshot
  const existingMeta =
    caseRow.metadata && typeof caseRow.metadata === 'object'
      ? (caseRow.metadata as Record<string, unknown>)
      : {};

  await prisma.case.update({
    where: { id: caseId },
    data: {
      metadata: {
        ...existingMeta,
        extractionSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      } as Prisma.InputJsonValue,
    },
  });

  logger.info(
    `[case-extraction] 案件 ${caseId} 提炼完成，来源文档数: ${docIds.length}`
  );

  // 提炼完成后，异步触发风险评估（fire-and-forget，不阻断提炼返回）
  import('@/lib/case/case-risk-pipeline')
    .then(({ runCaseRiskAssessment }) => runCaseRiskAssessment(caseId))
    .catch(err => {
      logger.warn(
        `[case-extraction] 风险评估 fire-and-forget 失败 [${caseId}]:`,
        err
      );
    });

  return snapshot;
}

// ── 阈值判断：是否满足自动触发条件 ───────────────────────────────────────────

/**
 * 核心材料类型关键词映射。
 * 每种类型至少对应一个有实质内容的材料类别（如起诉状、借条、流水、聊天记录）。
 */
const CORE_MATERIAL_TYPES: Record<string, RegExp> = {
  overview: /概览|overview/i,
  complaint: /起诉状|答辩状|complaint/i,
  agreement: /协议|借条|合同|agreement/i,
  bankStatement: /流水|银行|statement/i,
  chat: /聊天|微信|wechat|chat/i,
};

/** 按文件名判断文档命中的材料类型集合 */
export function detectMaterialTypes(filenames: string[]): Set<string> {
  const found = new Set<string>();
  for (const name of filenames) {
    for (const [type, re] of Object.entries(CORE_MATERIAL_TYPES)) {
      if (re.test(name)) found.add(type);
    }
  }
  return found;
}

/**
 * 判断案件是否满足自动触发提炼的最低物料阈值。
 *
 * 优先条件（精准）：
 *   已覆盖 2 类及以上核心材料类型（起诉状、借条、流水、聊天记录、案件概览）
 *
 * 次级 fallback（粗糙）：
 *   文档数 >= 5 且其中至少 1 份 analysisResult.extractedData.summary 非空
 *
 * 这样可以避免仅上传同类文档（如 3 份聊天记录）就过早触发提炼。
 */
export async function shouldTriggerExtraction(
  caseId: string
): Promise<boolean> {
  const docs = await prisma.document.findMany({
    where: { caseId, analysisStatus: 'COMPLETED', deletedAt: null },
    select: { filename: true, analysisResult: true },
  });

  if (docs.length === 0) return false;

  // 优先条件：核心材料类型覆盖度 >= 2
  const foundTypes = detectMaterialTypes(docs.map(d => d.filename));
  if (foundTypes.size >= 2) return true;

  // 次级 fallback：文档数 >= 5 且有摘要
  if (docs.length >= 5) {
    const hasSummary = docs.some(doc => {
      const parsed = doc.analysisResult as {
        extractedData?: { summary?: string };
      } | null;
      return (
        typeof parsed?.extractedData?.summary === 'string' &&
        parsed.extractedData.summary.trim().length > 0
      );
    });
    if (hasSummary) return true;
  }

  return false;
}
