import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import { getDefaultModel } from '@/lib/ai/config';
import type { Prisma } from '@prisma/client';

const NORMALIZE_MODEL =
  process.env.EVIDENCE_NORMALIZE_MODEL ?? getDefaultModel('deepseek', 'chat');

// ── 類型定義 ──────────────────────────────────────────────────────────────────

export type EvidenceDraftSourceKind =
  | 'claim'
  | 'disputeFocus'
  | 'keyFact'
  | 'filename';

export type EvidenceDraft = {
  normalizedName: string;
  type: 'DOCUMENT';
  description: string | null;
  sourceDocumentIds: string[];
  sourceFilenames: string[];
  sourceKinds: EvidenceDraftSourceKind[];
  evidenceHints: string[];
  supportsFacts: string[];
  supportsDisputes: string[];
  confidence: number;
};

// ── 原始線索（收集階段，未規範化）──────────────────────────────────────────────

interface RawHint {
  text: string;
  kind: EvidenceDraftSourceKind;
  docId: string;
  docFilename: string;
  supportsFact?: string;
  supportsDispute?: string;
}

// ── analysisResult 結構解析 ────────────────────────────────────────────────────

interface ParsedExtractedData {
  claims?: Array<{ evidence?: unknown }>;
  disputeFocuses?: Array<{
    evidence?: unknown;
    coreIssue?: unknown;
    description?: unknown;
  }>;
  keyFacts?: Array<{ evidence?: unknown; description?: unknown }>;
}

function parseAnalysisResult(raw: unknown): ParsedExtractedData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ed = r['extractedData'];
  if (!ed || typeof ed !== 'object') return null;
  return ed as ParsedExtractedData;
}

function safeStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );
}

function safeString(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

// ── AI 批量規範化 ──────────────────────────────────────────────────────────────

interface HintRequest {
  id: string;
  text: string;
  isFilename?: boolean;
}

interface NormalizationResult {
  id: string;
  normalizedName: string | null;
}

export async function normalizeEvidenceHintsWithAI(
  hints: HintRequest[]
): Promise<Map<string, string | null>> {
  if (hints.length === 0) return new Map();

  const aiService = await AIServiceFactory.getInstance();

  const inputJson = JSON.stringify(
    hints.map(h => ({
      id: h.id,
      text: h.text,
      ...(h.isFilename ? { isFilename: true } : {}),
    }))
  );

  const response = await aiService.chatCompletion({
    model: NORMALIZE_MODEL,
    messages: [
      {
        role: 'system',
        content:
          '你是法律证据分类专家，请直接输出JSON数组，不要有任何其他文字。',
      },
      {
        role: 'user',
        content: `请将以下证据线索文本规范化为标准证据名称。

规则：
1. 输出格式：[{"id": "...", "normalizedName": "标准名称或null"}]
2. normalizedName 为 null 的情况：文本明显不是证据材料（如律师内部备忘录、程序性说明、工作笔记、内部函件）
3. 相似证据用相同规范名称（如"借条""借款凭证""借款协议"统一为"借条与借款协议"）
4. isFilename=true 时额外判断：文件名是否表明这是一份证据性材料，不是则返回null
5. 规范名称举例：起诉状、答辩状、借条与借款协议、银行转账流水、聊天记录、证据目录、鉴定报告、劳动合同、工资流水

输入：
${inputJson}`,
      },
    ],
    temperature: 0.1,
    maxTokens: 2000,
  });

  const raw = response.choices?.[0]?.message?.content ?? '[]';

  let parsed: NormalizationResult[];
  try {
    const codeMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonText = codeMatch
      ? codeMatch[1]
      : (raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]');
    parsed = JSON.parse(jsonText) as NormalizationResult[];
  } catch (err) {
    throw new Error(
      `AI 证据名称规范化响应解析失败: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const result = new Map<string, string | null>();
  for (const item of parsed) {
    result.set(item.id, item.normalizedName || null);
  }
  return result;
}

// ── confidence 計算 ────────────────────────────────────────────────────────────

function computeConfidence(kinds: EvidenceDraftSourceKind[]): number {
  if (kinds.includes('claim') && kinds.includes('keyFact')) return 0.85;
  if (kinds.length >= 2 && !kinds.every(k => k === 'filename')) return 0.8;
  if (kinds[0] === 'filename') return 0.55;
  return 0.72;
}

// ── 主函數 ────────────────────────────────────────────────────────────────────

export async function generateAutoEvidenceDrafts(
  caseId: string
): Promise<EvidenceDraft[]> {
  const documents = await prisma.document.findMany({
    where: { caseId, analysisStatus: 'COMPLETED', deletedAt: null },
    select: { id: true, filename: true, analysisResult: true },
  });

  if (documents.length === 0) {
    logger.info(`[autoEvidence] 案件 ${caseId} 无已完成文档，跳过`);
    return [];
  }

  // Step 1: 收集所有原始線索
  const allHints: RawHint[] = [];

  for (const doc of documents) {
    const parsed = parseAnalysisResult(doc.analysisResult);
    const docHints: RawHint[] = [];

    if (parsed) {
      for (const claim of parsed.claims ?? []) {
        for (const h of safeStringArray(claim.evidence)) {
          docHints.push({
            text: h,
            kind: 'claim',
            docId: doc.id,
            docFilename: doc.filename,
          });
        }
      }

      for (const focus of parsed.disputeFocuses ?? []) {
        const label =
          safeString(focus.coreIssue) || safeString(focus.description);
        for (const h of safeStringArray(focus.evidence)) {
          docHints.push({
            text: h,
            kind: 'disputeFocus',
            docId: doc.id,
            docFilename: doc.filename,
            supportsDispute: label || undefined,
          });
        }
      }

      for (const fact of parsed.keyFacts ?? []) {
        const label = safeString(fact.description);
        for (const h of safeStringArray(fact.evidence)) {
          docHints.push({
            text: h,
            kind: 'keyFact',
            docId: doc.id,
            docFilename: doc.filename,
            supportsFact: label || undefined,
          });
        }
      }
    }

    // 無結構化線索時回退文件名（由 AI 決定是否有效）
    if (docHints.length === 0) {
      docHints.push({
        text: doc.filename,
        kind: 'filename',
        docId: doc.id,
        docFilename: doc.filename,
      });
    }

    allHints.push(...docHints);
  }

  if (allHints.length === 0) return [];

  // Step 2: 唯一化 hint 文本，構建 AI 請求
  const uniqueTexts = new Map<string, { id: string; isFilename: boolean }>();
  let idxCounter = 0;
  for (const h of allHints) {
    if (!uniqueTexts.has(h.text)) {
      uniqueTexts.set(h.text, {
        id: `h${idxCounter++}`,
        isFilename: h.kind === 'filename',
      });
    }
  }

  const hintRequests: HintRequest[] = Array.from(uniqueTexts.entries()).map(
    ([text, { id, isFilename }]) => ({
      id,
      text,
      ...(isFilename ? { isFilename } : {}),
    })
  );

  // Step 3: AI 批量規範化
  const normalizedMap = await normalizeEvidenceHintsWithAI(hintRequests);

  // Step 4: 按 normalizedName 聚合成 EvidenceDraft
  const draftMap = new Map<string, EvidenceDraft>();

  for (const hint of allHints) {
    const meta = uniqueTexts.get(hint.text);
    if (!meta) continue;

    const normalizedName = normalizedMap.get(meta.id);
    if (!normalizedName) continue; // AI 判定不是有效證據材料，跳過

    const existing = draftMap.get(normalizedName);
    if (!existing) {
      draftMap.set(normalizedName, {
        normalizedName,
        type: 'DOCUMENT',
        description: null,
        sourceDocumentIds: [hint.docId],
        sourceFilenames: [hint.docFilename],
        sourceKinds: [hint.kind],
        evidenceHints: [hint.text],
        supportsFacts: hint.supportsFact ? [hint.supportsFact] : [],
        supportsDisputes: hint.supportsDispute ? [hint.supportsDispute] : [],
        confidence: computeConfidence([hint.kind]),
      });
      continue;
    }

    if (!existing.sourceDocumentIds.includes(hint.docId))
      existing.sourceDocumentIds.push(hint.docId);
    if (!existing.sourceFilenames.includes(hint.docFilename))
      existing.sourceFilenames.push(hint.docFilename);
    if (!existing.sourceKinds.includes(hint.kind))
      existing.sourceKinds.push(hint.kind);
    if (!existing.evidenceHints.includes(hint.text))
      existing.evidenceHints.push(hint.text);
    if (
      hint.supportsFact &&
      !existing.supportsFacts.includes(hint.supportsFact)
    )
      existing.supportsFacts.push(hint.supportsFact);
    if (
      hint.supportsDispute &&
      !existing.supportsDisputes.includes(hint.supportsDispute)
    )
      existing.supportsDisputes.push(hint.supportsDispute);

    existing.confidence = Math.max(
      existing.confidence,
      computeConfidence(existing.sourceKinds)
    );
  }

  return Array.from(draftMap.values());
}

// ── Phase 2: 落库与幂等 ────────────────────────────────────────────────────────

interface EvidenceAutoMetadata {
  autoGenerated: true;
  sourceKinds: EvidenceDraftSourceKind[];
  evidenceHints: string[];
  supportsFacts: string[];
  supportsDisputes: string[];
  sourceFilenames: string[];
}

export type PersistResult = {
  created: number;
  updated: number;
  skippedManual: number;
};

function parseStoredMetadata(raw: unknown): EvidenceAutoMetadata | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (m['autoGenerated'] !== true) return null;
  return {
    autoGenerated: true,
    sourceKinds: (Array.isArray(m['sourceKinds'])
      ? m['sourceKinds']
      : []
    ).filter(
      (v): v is string => typeof v === 'string'
    ) as EvidenceDraftSourceKind[],
    evidenceHints: (Array.isArray(m['evidenceHints'])
      ? m['evidenceHints']
      : []
    ).filter((v): v is string => typeof v === 'string'),
    supportsFacts: (Array.isArray(m['supportsFacts'])
      ? m['supportsFacts']
      : []
    ).filter((v): v is string => typeof v === 'string'),
    supportsDisputes: (Array.isArray(m['supportsDisputes'])
      ? m['supportsDisputes']
      : []
    ).filter((v): v is string => typeof v === 'string'),
    sourceFilenames: (Array.isArray(m['sourceFilenames'])
      ? m['sourceFilenames']
      : []
    ).filter((v): v is string => typeof v === 'string'),
  };
}

function dedup<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * 将内存中的 EvidenceDraft[] 幂等写入数据库。
 * 以 caseId + name 为唯一键：
 * - 不存在 → create
 * - 已存在且 metadata.autoGenerated === true（自动草稿）→ update 合并
 * - 已存在且非自动草稿（人工证据）→ 跳过，计入 skippedManual，不修改任何字段
 *
 * 设计注记：EvidenceRelation.relatedId 目前存放 documentId 做来源追踪，
 * 与"证据-论点/法条"业务关系混用了同一张表，是已知技术债务，
 * 待后续证据关系图规划时统一迁移至 metadata.sourceDocumentIds。
 */
export async function persistAutoEvidenceDrafts(
  caseId: string,
  drafts: EvidenceDraft[]
): Promise<PersistResult> {
  if (drafts.length === 0) return { created: 0, updated: 0, skippedManual: 0 };

  const existingEvidence = await prisma.evidence.findMany({
    where: { caseId, deletedAt: null },
    select: {
      id: true,
      name: true,
      relevanceScore: true,
      metadata: true,
      relations: { select: { relatedId: true, relationType: true } },
    },
  });

  const existingByName = new Map(existingEvidence.map(e => [e.name, e]));

  let created = 0;
  let updated = 0;
  let skippedManual = 0;

  for (const draft of drafts) {
    const existing = existingByName.get(draft.normalizedName);

    if (!existing) {
      const newMeta: EvidenceAutoMetadata = {
        autoGenerated: true,
        sourceKinds: draft.sourceKinds,
        evidenceHints: draft.evidenceHints,
        supportsFacts: draft.supportsFacts,
        supportsDisputes: draft.supportsDisputes,
        sourceFilenames: draft.sourceFilenames,
      };
      await prisma.evidence.create({
        data: {
          caseId,
          type: 'DOCUMENT',
          name: draft.normalizedName,
          description: draft.description ?? undefined,
          status: 'PENDING',
          relevanceScore: draft.confidence,
          metadata: newMeta as unknown as Prisma.InputJsonValue,
          relations: {
            create: draft.sourceDocumentIds.map(docId => ({
              relationType: 'OTHER' as const,
              relatedId: docId,
              description: '自动从文档分析结果生成',
            })),
          },
        },
      });
      created++;
    } else {
      const storedMeta = parseStoredMetadata(existing.metadata);

      // 人工证据保护：非 autoGenerated 的记录不允许被自动流程覆盖
      if (!storedMeta) {
        skippedManual++;
        continue;
      }

      const existingRelatedIds = new Set(
        existing.relations
          .filter(r => r.relationType === 'OTHER')
          .map(r => r.relatedId)
      );
      const newDocIds = draft.sourceDocumentIds.filter(
        id => !existingRelatedIds.has(id)
      );

      const mergedMeta: EvidenceAutoMetadata = {
        autoGenerated: true,
        sourceKinds: dedup([...storedMeta.sourceKinds, ...draft.sourceKinds]),
        evidenceHints: dedup([
          ...storedMeta.evidenceHints,
          ...draft.evidenceHints,
        ]),
        supportsFacts: dedup([
          ...storedMeta.supportsFacts,
          ...draft.supportsFacts,
        ]),
        supportsDisputes: dedup([
          ...storedMeta.supportsDisputes,
          ...draft.supportsDisputes,
        ]),
        sourceFilenames: dedup([
          ...storedMeta.sourceFilenames,
          ...draft.sourceFilenames,
        ]),
      };

      await prisma.evidence.update({
        where: { id: existing.id },
        data: {
          relevanceScore: Math.max(
            existing.relevanceScore ?? 0,
            draft.confidence
          ),
          metadata: mergedMeta as unknown as Prisma.InputJsonValue,
          ...(newDocIds.length > 0
            ? {
                relations: {
                  create: newDocIds.map(docId => ({
                    relationType: 'OTHER' as const,
                    relatedId: docId,
                    description: '自动从文档分析结果生成',
                  })),
                },
              }
            : {}),
        },
      });
      updated++;
    }
  }

  return { created, updated, skippedManual };
}

/**
 * 生成并落库自动证据草稿（幂等）。
 * 先调用 generateAutoEvidenceDrafts 生成草稿，再调用 persistAutoEvidenceDrafts 写入数据库。
 */
export async function upsertAutoEvidenceDrafts(
  caseId: string
): Promise<{ drafts: EvidenceDraft[] } & PersistResult> {
  const drafts = await generateAutoEvidenceDrafts(caseId);
  const { created, updated, skippedManual } = await persistAutoEvidenceDrafts(
    caseId,
    drafts
  );
  logger.info(
    `[autoEvidence] 案件 ${caseId} 证据草稿落库完成 — 新建: ${created}，更新: ${updated}，跳过人工: ${skippedManual}`
  );
  return { drafts, created, updated, skippedManual };
}
