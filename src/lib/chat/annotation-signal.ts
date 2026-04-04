/**
 * 批注信号处理器
 *
 * 批注是用户认知状态的显式信号，也是 SCP 元认知系统的学习起点。
 * 写入批注后异步调用此模块，将用户认知反馈融合进案情晶体。
 *
 * 信号映射：
 *   QUESTION / REJECT → 移入 uncertain_facts + open_questions（AI 需重新审视）
 *   CONFIRM           → 移入 established_facts（不再重复确认）
 *   IMPORTANT         → 标记为 core_dispute 候选（优先关注）
 *   USE_IN_DOC        → 不影响晶体（已提取到文书）
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface CaseFact {
  fact: string;
  source: string;
  confidence: number;
}

interface CaseCrystal {
  version: number;
  updatedAt: string;
  case_type: string | null;
  parties: { plaintiff: string | null; defendant: string | null };
  core_dispute: string | null;
  established_facts: CaseFact[];
  uncertain_facts: CaseFact[];
  applicable_law_areas: string[];
  current_position: string | null;
  open_questions: string[];
  // SCP 扩展：用户质疑过的观点（注入下一轮 system prompt）
  user_challenged: string[];
}

export type AnnotationType =
  | 'CONFIRM'
  | 'QUESTION'
  | 'REJECT'
  | 'IMPORTANT'
  | 'USE_IN_DOC';

/**
 * 生成用户追问指令文本（前端填入输入框，用户确认后发送）
 */
export function buildFollowUpPrompt(
  type: AnnotationType,
  selectedText: string,
  note?: string
): string | null {
  const excerpt =
    selectedText.length > 60 ? selectedText.slice(0, 60) + '…' : selectedText;

  switch (type) {
    case 'QUESTION':
      return note
        ? `你在上文提到"${excerpt}"，我对此存疑：${note}。请重新分析并说明法律依据。`
        : `你在上文提到"${excerpt}"，请进一步说明该观点的法律依据，并指出可能存在的例外情形。`;

    case 'REJECT':
      return note
        ? `我认为"${excerpt}"这一表述有误：${note}。请重新分析这个问题。`
        : `我认为"${excerpt}"这一判断值得商榷，请重新审视并给出更准确的分析。`;

    case 'IMPORTANT':
      return `请针对"${excerpt}"这一关键点展开深入分析，包括：法律规定、司法实践倾向、举证要点。`;

    case 'CONFIRM':
    case 'USE_IN_DOC':
      return null; // 认可和入文书不需要追问
  }
}

/**
 * 将批注信号融合进案情晶体（异步，不阻塞 API 响应）
 */
export async function applyAnnotationToCrystal(
  conversationId: string,
  selectedText: string,
  type: AnnotationType,
  note?: string | null
): Promise<void> {
  // USE_IN_DOC 不影响晶体
  if (type === 'USE_IN_DOC') return;

  try {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId },
      select: { caseContext: true },
    });

    if (!conv?.caseContext || typeof conv.caseContext !== 'object') return;

    const crystal = conv.caseContext as unknown as CaseCrystal;
    const excerpt = selectedText.slice(0, 200);
    const now = new Date().toISOString();

    // 初始化 SCP 扩展字段
    if (!Array.isArray(crystal.user_challenged)) crystal.user_challenged = [];

    switch (type) {
      case 'QUESTION': {
        // 移入 uncertain_facts，加入 open_questions
        const newFact: CaseFact = {
          fact: excerpt,
          source: '用户存疑',
          confidence: 0.3,
        };
        crystal.uncertain_facts = [...(crystal.uncertain_facts ?? []), newFact];
        const question = note
          ? `关于"${excerpt.slice(0, 40)}…"：${note}`
          : `"${excerpt.slice(0, 60)}…" — 用户标记存疑`;
        crystal.open_questions = [...(crystal.open_questions ?? []), question];
        crystal.user_challenged = [
          ...crystal.user_challenged,
          excerpt.slice(0, 80),
        ];
        break;
      }

      case 'REJECT': {
        // 置信度归零，标记为用户否定
        const existing = crystal.established_facts?.find(f =>
          f.fact.includes(excerpt.slice(0, 30))
        );
        if (existing) existing.confidence = 0.1;
        crystal.user_challenged = [
          ...crystal.user_challenged,
          excerpt.slice(0, 80),
        ];
        const question = note
          ? `用户否定："${excerpt.slice(0, 40)}…" — 理由：${note}`
          : `用户否定："${excerpt.slice(0, 60)}…"`;
        crystal.open_questions = [...(crystal.open_questions ?? []), question];
        break;
      }

      case 'CONFIRM': {
        // 提升置信度或加入 established_facts
        const alreadyConfirmed = crystal.established_facts?.some(f =>
          f.fact.includes(excerpt.slice(0, 30))
        );
        if (!alreadyConfirmed) {
          const newFact: CaseFact = {
            fact: excerpt,
            source: '用户确认',
            confidence: 0.95,
          };
          crystal.established_facts = [
            ...(crystal.established_facts ?? []),
            newFact,
          ];
        }
        break;
      }

      case 'IMPORTANT': {
        // 标记为核心争议候选（若 core_dispute 为空则直接填入）
        if (!crystal.core_dispute) {
          crystal.core_dispute = excerpt.slice(0, 100);
        } else if (!crystal.core_dispute.includes(excerpt.slice(0, 20))) {
          crystal.core_dispute =
            crystal.core_dispute + '；' + excerpt.slice(0, 60);
        }
        break;
      }
    }

    crystal.version = (crystal.version ?? 0) + 1;
    crystal.updatedAt = now;

    await prisma.conversation.update({
      where: { id: conversationId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { caseContext: crystal as any },
    });

    logger.info('批注信号已融合进晶体', {
      conversationId,
      type,
      crystalVersion: crystal.version,
    });
  } catch (err) {
    // 晶体更新失败不影响批注本身
    logger.warn('批注→晶体融合失败', { conversationId, err });
  }
}
