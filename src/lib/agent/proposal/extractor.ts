import { AIServiceFactory } from '@/lib/ai/service-refactored';
import { logger } from '@/lib/logger';
import type {
  ActionType,
  CaseProposalExtractedData,
  FieldMeta,
  SuggestedAction,
} from '@/types/proposal';

const CHAT_MODEL = process.env.CHAT_AI_MODEL ?? 'deepseek-chat';
const CHAT_PROVIDER = (process.env.CHAT_AI_PROVIDER ?? 'deepseek') as
  | 'zhipu'
  | 'deepseek'
  | 'openai';

// 检测对话是否包含足够的建案信号（至少有当事人 + 案件类型迹象）
const CASE_DETECTION_PROMPT = `分析以下对话，判断是否包含足够信息创建一个新法律案件档案。
返回严格的 JSON，不要任何额外说明：
{
  "shouldCreate": true/false,
  "reason": "判断原因（一句话）"
}

判断标准（满足以下条件返回 true）：
- 提到了当事人姓名（客户或对方）
- 提到了案件类型或法律纠纷性质
- 有明确的法律诉求或争议

仅当信息明显不足时返回 false（如只是法律咨询、没有具体当事人、纯学术讨论）。`;

const CASE_EXTRACTION_PROMPT = `从以下对话/文件内容中提取建案所需的结构化信息。
规则：
- 只提取明确提及的信息，不推断、不补全
- 置信度（confidence）：0-1，信息明确时接近 1，模糊时低于 0.7
- 当事人 role：CLIENT=委托方，OPPONENT=对方当事人，WITNESS=证人，OTHER=其他
- 返回严格的 JSON，不要任何额外说明

{
  "parties": [
    {
      "name": "姓名",
      "role": "CLIENT|OPPONENT|WITNESS|OTHER",
      "meta": {
        "confidence": 0.9,
        "needsConfirmation": false,
        "sourceQuote": "原文片段（不超过 100 字）"
      }
    }
  ],
  "caseType": "案件类型（如：离婚纠纷/劳动争议/合同纠纷等）",
  "caseTypeMeta": { "confidence": 0.85, "needsConfirmation": false, "sourceQuote": "" },
  "claims": [
    { "text": "诉求描述", "meta": { "confidence": 0.9, "needsConfirmation": false, "sourceQuote": "" } }
  ],
  "keyDates": [
    {
      "date": "ISO8601日期（仅日期部分，如 2026-05-01，无法确定时用今天）",
      "description": "日期说明",
      "type": "CONSULT|INCIDENT|DEADLINE|HEARING|OTHER",
      "meta": { "confidence": 0.8, "needsConfirmation": false, "sourceQuote": "" }
    }
  ],
  "disputeFocuses": [
    { "text": "争议焦点", "meta": { "confidence": 0.7, "needsConfirmation": true, "sourceQuote": "" } }
  ],
  "claimAmount": 20000000
}
注意：claimAmount 为可选字段，单位元，纯数字；金额模糊（如"两千多万"）时取下限整数（20000000）；无法确定时省略该字段。`;

function buildDefaultMeta(
  confidence = 0.8,
  needsConfirmation = false
): FieldMeta {
  return { confidence, needsConfirmation };
}

// 将 AI 提取的中文案件类型映射到 Prisma CaseType 枚举
function mapCaseType(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('刑') || s.includes('criminal')) return 'CRIMINAL';
  if (s.includes('行政') || s.includes('administr')) return 'ADMINISTRATIVE';
  if (s.includes('劳动') || s.includes('labor') || s.includes('labour'))
    return 'LABOR';
  if (
    s.includes('知识产权') ||
    s.includes('专利') ||
    s.includes('商标') ||
    s.includes('版权') ||
    s.includes('intellect')
  )
    return 'INTELLECTUAL';
  if (
    s.includes('合同') ||
    s.includes('商事') ||
    s.includes('commercial') ||
    s.includes('建设工程')
  )
    return 'COMMERCIAL';
  if (
    s.includes('民') ||
    s.includes('civil') ||
    s.includes('婚姻') ||
    s.includes('继承')
  ) {
    return 'CIVIL';
  }
  return 'OTHER';
}

function buildSuggestedActions(
  data: Omit<CaseProposalExtractedData, 'suggestedActions'>,
  _proposalId: string
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  const client = data.parties.find(p => p.role === 'CLIENT');
  const opponent = data.parties.find(p => p.role === 'OPPONENT');

  if (client) {
    actions.push({
      actionType: 'CREATE_CLIENT' as ActionType,
      label: `创建客户档案（${client.name}）`,
      params: { name: client.name },
      sequence: 0,
      required: true,
      revertStatus: 'PENDING',
    });
  }

  actions.push({
    actionType: 'CREATE_CASE' as ActionType,
    label: `创建案件（${data.caseType || '未知类型'}）`,
    params: {
      title: `${client?.name ?? '委托人'}${data.caseType ? ' - ' + data.caseType : ''}案`,
      type: mapCaseType(data.caseType),
      description: data.claims.map(c => c.text).join('；') || '',
      plaintiffName: client?.name ?? undefined,
      defendantName: opponent?.name ?? undefined,
      cause: data.caseType || undefined,
      amount: data.claimAmount ?? undefined,
    },
    sequence: 1,
    dependsOnSequence: client ? 0 : undefined,
    required: true,
    revertStatus: 'PENDING',
  });

  if (data.keyDates.length > 0) {
    actions.push({
      actionType: 'ADD_TIMELINE_EVENT' as ActionType,
      label: `建立案件时间线（${data.keyDates.length} 个事件）`,
      params: { events: data.keyDates },
      sequence: 2,
      dependsOnSequence: 1,
      required: true,
      revertStatus: 'PENDING',
    });
  }

  return actions;
}

export interface ExtractionResult {
  shouldCreate: boolean;
  reason: string;
  data?: CaseProposalExtractedData;
}

export async function detectAndExtractCaseProposal(
  userContent: string,
  attachmentTexts: string[],
  messageId: string,
  proposalId: string,
  today: string = new Date().toISOString().slice(0, 10)
): Promise<ExtractionResult> {
  const aiService = await AIServiceFactory.getInstance();

  const fullContent = [
    userContent,
    ...attachmentTexts.map((t, i) => `【附件 ${i + 1}】\n${t}`),
  ]
    .filter(Boolean)
    .join('\n\n');

  // 第一步：检测是否应该建案
  let shouldCreate = false;
  let reason = '';
  try {
    const detectResp = await aiService.chatCompletion({
      model: CHAT_MODEL,
      provider: CHAT_PROVIDER,
      messages: [
        {
          role: 'user',
          content: `${CASE_DETECTION_PROMPT}\n\n对话内容：\n${fullContent}`,
        },
      ],
      temperature: 0.1,
      maxTokens: 200,
    });

    const raw = detectResp.choices[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as {
        shouldCreate: boolean;
        reason: string;
      };
      shouldCreate = parsed.shouldCreate;
      reason = parsed.reason;
    }
  } catch (err) {
    logger.warn('建案检测失败，跳过', { err });
    return { shouldCreate: false, reason: '检测失败' };
  }

  if (!shouldCreate) {
    return { shouldCreate: false, reason };
  }

  // 第二步：提取结构化数据
  try {
    const extractResp = await aiService.chatCompletion({
      model: CHAT_MODEL,
      provider: CHAT_PROVIDER,
      messages: [
        {
          role: 'user',
          content: `${CASE_EXTRACTION_PROMPT}\n\n今天日期：${today}\n\n对话内容：\n${fullContent}`,
        },
      ],
      temperature: 0.1,
      maxTokens: 2000,
    });

    const raw = extractResp.choices[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      logger.warn('提案提取：AI 未返回有效 JSON', {
        conversationContent: fullContent.slice(0, 200),
      });
      return { shouldCreate: false, reason: '提取失败' };
    }

    const parsed = JSON.parse(match[0]) as Partial<CaseProposalExtractedData>;

    // 补全缺失字段和 meta 默认值
    const parties = (parsed.parties ?? []).map(p => ({
      ...p,
      meta: { ...buildDefaultMeta(0.8), ...p.meta, sourceMessageId: messageId },
    }));

    const caseType = parsed.caseType ?? '其他';
    const caseTypeMeta: FieldMeta = {
      ...buildDefaultMeta(0.8),
      ...parsed.caseTypeMeta,
      sourceMessageId: messageId,
    };

    const claims = (parsed.claims ?? []).map(c => ({
      ...c,
      meta: { ...buildDefaultMeta(0.8), ...c.meta, sourceMessageId: messageId },
    }));

    const keyDates = (parsed.keyDates ?? []).map(d => ({
      ...d,
      meta: {
        ...buildDefaultMeta(0.75),
        ...d.meta,
        sourceMessageId: messageId,
      },
    }));

    const disputeFocuses = (parsed.disputeFocuses ?? []).map(f => ({
      ...f,
      meta: {
        ...buildDefaultMeta(0.7, true),
        ...f.meta,
        sourceMessageId: messageId,
      },
    }));

    const claimAmount =
      typeof parsed.claimAmount === 'number' && parsed.claimAmount > 0
        ? parsed.claimAmount
        : undefined;

    const base = {
      parties,
      caseType,
      caseTypeMeta,
      claims,
      keyDates,
      disputeFocuses,
      claimAmount,
    };
    const suggestedActions = buildSuggestedActions(base, proposalId);

    const data: CaseProposalExtractedData = { ...base, suggestedActions };

    return { shouldCreate: true, reason, data };
  } catch (err) {
    logger.error(
      '提案提取失败',
      err instanceof Error ? err : new Error(String(err))
    );
    return { shouldCreate: false, reason: '提取异常' };
  }
}
