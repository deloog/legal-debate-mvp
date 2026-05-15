/**
 * GET  /api/v1/chat/conversations/[conversationId]/messages  — 获取消息列表
 * POST /api/v1/chat/conversations/[conversationId]/messages  — 发送消息并获取 AI 回复
 *
 * 上下文架构（见 docs/CHAT_AI_CONTEXT_ARCHITECTURE.md）：
 *   system prompt（阶段感知）+ 案情晶体（caseContext）+ 知识库检索结果 + 最近 N 轮对话
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import {
  retrieveKnowledge,
  formatKnowledgeForContext,
} from '@/lib/chat/knowledge-retriever';
import {
  extractFileText,
  validateMagicBytes,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/chat/file-extractor';
import { redactPII, type RedactionResult } from '@/lib/chat/pii-redactor';
import { Prisma } from '@prisma/client';
const CHAT_UPLOADS_DIR = resolve(process.cwd(), 'private_uploads', 'chat');

// 从环境变量读取模型名和 provider，确保两者绑定一致
const CHAT_MODEL = process.env.CHAT_AI_MODEL ?? 'deepseek-chat';
const CHAT_PROVIDER = (process.env.CHAT_AI_PROVIDER ?? 'deepseek') as
  | 'zhipu'
  | 'deepseek'
  | 'openai';

type Params = { params: Promise<{ conversationId: string }> };

// ─── System Prompt（阶段感知版） ────────────────────────────────────────────

const SYSTEM_PROMPT = `你是律伴，中国执业律师和企业法务的 AI 工作伙伴，基于中国法律体系提供专业支持。

【工作模式 — 根据对话阶段自动切换】

▌阶段一：案情接收（用户首次陈述案情）
- 用结构化方式整理案情，明确呈现：
  ① 当事人及法律关系
  ② 核心争议事实（按时间线排列）
  ③ 用户诉求
  ④ 初步判断的法律领域（劳动法/合同法/侵权/刑事等）
- 区分"已确认事实"与"需核实事项"，对不清楚的关键事实主动追问

▌阶段二：分析论证
- 援引具体法条，格式：《法律名称》第X条（第X款）
- 识别对方论据的薄弱点，提示举证难点
- 明确区分"法律规定"与"司法实践中的普遍倾向"
- 复杂问题：先给结论，再展开论证（结论优先原则）
- 涉及诉讼风险时主动提示，不回避不利因素

▌阶段三：文书起草
- 使用 Markdown 标准格式（# 标题 / ## 章节 / - 列表）
- 生成结构完整的初稿
- 需用户补充的信息用【待填写：说明】标记
- **文书正文必须用以下标记包裹，标记单独占一行：**
  :::DOCUMENT_START:::
  （文书正文内容）
  :::DOCUMENT_END:::
- 标记之外可以有前言说明和后续谈判提示，但文书正文只出现在标记内
- 完成后提示哪些条款需要律师根据具体情况调整

【回复规范】
- 专业严谨，不用口语化表达
- 不确定的法条或案例明确说明"建议核实"，不捏造
- 不知道时直说，不编造权威性表述

【上下文利用】
若对话上下文中包含【案情晶体】，以晶体中已确认事实为分析基础，不重复询问已确认信息，直接在已知框架上深入分析。`;

// ─── 案情晶体提取 Prompt ────────────────────────────────────────────────────

const CRYSTAL_EXTRACTION_PROMPT = `根据以下对话内容，提取结构化案情信息。
规则：只提取对话中明确提及的信息，不推断、不补全。
返回严格的 JSON，不要任何额外说明：

{
  "version": 1,
  "case_type": "案件类型（如：劳动争议/合同纠纷/刑事/婚姻家事等，不确定则填null）",
  "parties": {
    "plaintiff": "原告/申请人信息，不确定则null",
    "defendant": "被告/被申请人信息，不确定则null"
  },
  "core_dispute": "一句话描述核心争议，不确定则null",
  "established_facts": [
    { "fact": "已确认事实", "confidence": "CONFIRMED" }
  ],
  "uncertain_facts": [
    { "fact": "未确认或存疑事实", "confidence": "UNCERTAIN" }
  ],
  "applicable_law_areas": ["相关法律领域"],
  "current_position": "当前用户立场/诉求，不确定则null",
  "open_questions": ["尚待确认的关键问题"]
}`;

// ─── 案情晶体类型 ───────────────────────────────────────────────────────────

interface CaseFact {
  fact: string;
  confidence: 'CONFIRMED' | 'UNCERTAIN';
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
}

// ─── 格式化晶体为可读文本注入上下文 ────────────────────────────────────────

function formatCrystalForContext(
  crystal: CaseCrystal & { user_challenged?: string[] }
): string {
  const lines: string[] = ['【案情晶体】'];
  if (crystal.case_type) lines.push(`案件类型：${crystal.case_type}`);
  if (crystal.core_dispute) lines.push(`核心争议：${crystal.core_dispute}`);
  if (crystal.parties.plaintiff || crystal.parties.defendant) {
    lines.push(
      `当事人：${crystal.parties.plaintiff ?? '—'} vs ${crystal.parties.defendant ?? '—'}`
    );
  }
  if (crystal.current_position)
    lines.push(`当前立场：${crystal.current_position}`);

  const confirmed = crystal.established_facts ?? [];
  if (confirmed.length > 0) {
    lines.push(`已确认事实：${confirmed.map(f => f.fact).join('；')}`);
  }

  const uncertain = crystal.uncertain_facts ?? [];
  if (uncertain.length > 0) {
    lines.push(`待核实：${uncertain.map(f => f.fact).join('；')}`);
  }

  if (crystal.open_questions?.length > 0) {
    lines.push(`待明确问题：${crystal.open_questions.join('；')}`);
  }

  if (crystal.applicable_law_areas?.length > 0) {
    lines.push(`涉及法律领域：${crystal.applicable_law_areas.join('、')}`);
  }

  // SCP 信号：用户已明确质疑的观点，AI 须重新审视
  const challenged = crystal.user_challenged ?? [];
  if (challenged.length > 0) {
    lines.push(`\n⚠️ 用户已质疑以下观点（请重新审视，不可沿用原有结论）：`);
    challenged.slice(-3).forEach(c => lines.push(`  - "${c}"`));
  }

  return lines.join('\n');
}

// ─── 异步提取并更新案情晶体（不阻塞用户响应） ──────────────────────────────

async function extractAndSaveCrystal(
  conversationId: string,
  history: { role: string; content: string }[]
): Promise<void> {
  try {
    const aiService = await AIServiceFactory.getInstance();

    const dialogText = history
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
      .join('\n\n');

    const response = await aiService.chatCompletion({
      model: CHAT_MODEL,
      provider: CHAT_PROVIDER,
      messages: [
        {
          role: 'user',
          content: `${CRYSTAL_EXTRACTION_PROMPT}\n\n对话内容：\n${dialogText}`,
        },
      ],
      temperature: 0.1,
      maxTokens: 1000,
    });

    const raw = response.choices[0]?.message?.content ?? '';

    // 提取 JSON：兼容 AI 用 ```json 包裹 或 直接输出 的两种情况
    const jsonMatch =
      raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ??
      raw.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) return;

    const crystal = JSON.parse(
      jsonMatch[1] ?? jsonMatch[0]
    ) as Partial<CaseCrystal>;

    // 读取已有晶体，合并 version
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId },
      select: { caseContext: true },
    });

    const prevVersion =
      existing?.caseContext &&
      typeof existing.caseContext === 'object' &&
      'version' in (existing.caseContext as Record<string, unknown>)
        ? ((existing.caseContext as Record<string, unknown>).version as number)
        : 0;

    const ruleBasedLawAreas: string[] = [];
    const aiLawAreas = crystal.applicable_law_areas ?? [];
    const mergedLawAreas = [...new Set([...aiLawAreas, ...ruleBasedLawAreas])];

    const updated: CaseCrystal = {
      version: prevVersion + 1,
      updatedAt: new Date().toISOString(),
      case_type: crystal.case_type ?? null,
      parties: crystal.parties ?? { plaintiff: null, defendant: null },
      core_dispute: crystal.core_dispute ?? null,
      established_facts: crystal.established_facts ?? [],
      uncertain_facts: crystal.uncertain_facts ?? [],
      applicable_law_areas: mergedLawAreas,
      current_position: crystal.current_position ?? null,
      open_questions: crystal.open_questions ?? [],
    };

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { caseContext: updated as unknown as Prisma.InputJsonValue },
    });

    logger.info(`案情晶体已更新 v${updated.version}`, { conversationId });
  } catch (err) {
    // 晶体提取失败不影响主流程，静默记录
    logger.warn('案情晶体提取失败（降级为无晶体模式）', {
      conversationId,
      err,
    });
  }
}

// ─── 自动生成对话标题 ─────────────────────────────────────────────────────────

async function autoGenerateTitle(
  conversationId: string,
  userFirstMessage: string,
  aiFirstMessage: string
): Promise<void> {
  try {
    // 先检查标题是否已被自定义（不是默认值）
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId },
      select: { title: true, caseContext: true },
    });
    if (!conv || !['新对话', 'New Conversation', ''].includes(conv.title))
      return;

    let title: string | null = null;

    // 优先从晶体取（更准确）
    if (conv.caseContext && typeof conv.caseContext === 'object') {
      const crystal = conv.caseContext as Record<string, unknown>;
      const caseType = crystal.case_type as string | null;
      const dispute = crystal.core_dispute as string | null;
      if (caseType) {
        title = dispute ? `${caseType}·${dispute.slice(0, 15)}` : caseType;
      }
    }

    // 晶体暂无信息时，用 AI 从首轮对话提炼 10 字标题
    if (!title) {
      const aiService = await AIServiceFactory.getInstance();
      const resp = await aiService.chatCompletion({
        model: CHAT_MODEL,
        provider: CHAT_PROVIDER,
        messages: [
          {
            role: 'user',
            content: `根据以下法律咨询的首轮对话，生成一个简洁的对话标题，要求：
- 10 字以内
- 直接输出标题文字，不加引号或任何说明
- 体现案件类型或核心问题

用户：${userFirstMessage.slice(0, 200)}
AI：${aiFirstMessage.slice(0, 200)}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 30,
      });
      title = resp.choices[0]?.message?.content?.trim().slice(0, 20) ?? null;
    }

    if (title) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });
      logger.info('对话标题已自动生成', { conversationId, title });
    }
  } catch (err) {
    logger.warn('自动生成标题失败', { conversationId, err });
  }
}

// ─── GET /messages ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { conversationId } = await params;

    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: authUser.userId },
    });
    if (!conv) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }

    const messages = await prisma.message.findMany({
      where: { conversationId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      include: {
        attachments: true,
        annotations: {
          where: { userId: authUser.userId },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    logger.error('获取消息列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}

// ─── POST /messages ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { conversationId } = await params;

    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: authUser.userId },
    });
    if (!conv) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }

    // ── 解析请求体（JSON 或 multipart） ────────────────────────────────────
    const contentType = request.headers.get('content-type') ?? '';
    const isMultipart = contentType.includes('multipart/form-data');

    let content = '';
    const extractedAttachments: {
      fileName: string;
      text: string;
      fileUrl: string;
      fileSize: number;
      fileType: string;
    }[] = [];

    if (isMultipart) {
      const formData = await request.formData();
      content = ((formData.get('content') as string | null) ?? '').trim();
      const uploadedFiles = formData.getAll('files') as File[];

      // 并行提取所有文件文本
      await mkdir(CHAT_UPLOADS_DIR, { recursive: true });

      await Promise.allSettled(
        uploadedFiles.map(async file => {
          if (file.size > MAX_FILE_SIZE) return;
          if (!ALLOWED_MIME_TYPES.includes(file.type)) return;

          const buffer = Buffer.from(await file.arrayBuffer());
          if (!validateMagicBytes(buffer, file.type)) return;

          // 保存文件
          const ext = file.name.split('.').pop() ?? 'bin';
          const storedName = `${randomUUID()}.${ext}`;
          await writeFile(join(CHAT_UPLOADS_DIR, storedName), buffer);
          const fileUrl = `/private_uploads/chat/${storedName}`;

          // 提取文本
          const text = await extractFileText(buffer, file.type, file.name);
          extractedAttachments.push({
            fileName: file.name,
            text,
            fileUrl,
            fileSize: file.size,
            fileType: file.type,
          });
        })
      );
    } else {
      const body = (await request.json()) as { content: string };
      content = (body.content ?? '').trim();
    }

    if (!content && extractedAttachments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: '消息内容不能为空' },
        },
        { status: 400 }
      );
    }
    if (content.length > 20000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: '消息内容不能超过 20000 字符',
          },
        },
        { status: 400 }
      );
    }

    // 保存用户消息
    const displayContent =
      content || extractedAttachments.map(a => a.fileName).join('、');

    const userMessage = await prisma.message.create({
      data: { conversationId, role: 'user', content: displayContent },
    });

    // 保存附件记录
    if (extractedAttachments.length > 0) {
      await prisma.messageAttachment.createMany({
        data: extractedAttachments.map(a => ({
          messageId: userMessage.id,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          fileSize: a.fileSize,
          extractedText: a.text || null,
        })),
      });
    }

    // 自动更新对话标题（首条消息）
    if (conv.title === '新对话') {
      const titleBase =
        content || extractedAttachments[0]?.fileName || '新对话';
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title: titleBase.slice(0, 30) },
      });
    }

    // 取历史消息（最近 20 条，不含本轮刚保存的用户消息，避免重复）
    // 注意：用户消息已保存，history 取最近 20 条后，本轮消息在最后一条
    // 我们在 aiMessages 里单独追加本轮内容（含附件），所以 history 去掉最后一条
    const rawHistory = await prisma.message.findMany({
      where: { conversationId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      take: 21,
      select: { role: true, content: true },
    });
    // 去掉最后一条（即本轮刚保存的用户消息）
    const history = rawHistory.slice(0, -1);

    // ── 组装 AI 上下文 ────────────────────────────────────────────────────
    // 策略：system prompt + [案情晶体] + [知识库检索] + 历史消息
    // 第 1 轮：无晶体，直接对话；知识检索始终执行
    // 第 2 轮起：前置晶体，AI 在已知框架上深入
    const isFirstExchange =
      history.filter(m => m.role === 'assistant').length === 0;

    const crystal =
      !isFirstExchange && conv.caseContext
        ? (conv.caseContext as unknown as CaseCrystal)
        : null;

    // 并行：构建晶体文本 + 检索知识库
    const caseType = crystal?.case_type ?? null;
    const [crystalText, knowledgeCtx] = await Promise.all([
      Promise.resolve(crystal ? formatCrystalForContext(crystal) : ''),
      retrieveKnowledge(content, caseType),
    ]);

    const knowledgeText = formatKnowledgeForContext(knowledgeCtx);

    // 拼接 system content
    const systemParts = [SYSTEM_PROMPT];
    if (crystalText) systemParts.push('---', crystalText);
    if (knowledgeText) systemParts.push('---', knowledgeText);

    const systemContent = systemParts.join('\n\n');

    // 构造本轮用户消息：文本 + 附件内容拼接
    const attachmentBlock =
      extractedAttachments.length > 0
        ? extractedAttachments
            .filter(a => a.text)
            .map(a => `【附件：${a.fileName}】\n${a.text}`)
            .join('\n\n---\n\n')
        : '';

    const rawUserTurnContent =
      [attachmentBlock, content].filter(Boolean).join('\n\n') || displayContent;

    // ── PII 脱敏（仅影响发往 AI 的内容，数据库存原始值） ────────────────────
    // 对当前消息脱敏
    let piiResult: RedactionResult = {
      text: rawUserTurnContent,
      count: 0,
      types: [],
    };
    try {
      piiResult = redactPII(rawUserTurnContent);
    } catch (err) {
      logger.warn('PII 脱敏异常，使用原始内容兜底', { conversationId, err });
    }
    const userTurnContent = piiResult.text;

    if (piiResult.count > 0) {
      logger.info('发送前 PII 脱敏完成', {
        conversationId,
        piiCount: piiResult.count,
        piiTypes: piiResult.types,
      });
    }

    // 对历史中的用户消息脱敏（DB 中存原始值，发往 AI 前需处理）
    const redactedHistory = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content:
        m.role === 'user'
          ? (() => {
              try {
                return redactPII(m.content).text;
              } catch {
                return m.content;
              }
            })()
          : m.content,
    }));

    const aiMessages = [
      { role: 'system' as const, content: systemContent },
      ...redactedHistory,
      { role: 'user' as const, content: userTurnContent },
    ];

    // 调用 AI
    const aiService = await AIServiceFactory.getInstance();
    const aiResponse = await aiService.chatCompletion({
      model: CHAT_MODEL,
      provider: CHAT_PROVIDER,
      messages: aiMessages,
      temperature: 0.3,
      maxTokens: 4000,
    });

    const aiContent =
      aiResponse.choices[0]?.message?.content ??
      '抱歉，AI 暂时无法回复，请稍后重试。';

    // 保存 AI 消息
    const assistantMessage = await prisma.message.create({
      data: { conversationId, role: 'assistant', content: aiContent },
      include: { attachments: true, annotations: true },
    });

    // 更新对话 updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // ── 异步提取案情晶体（不阻塞响应） ────────────────────────────────────
    // 每 2 轮更新一次（第 1 轮结束后提取，之后每 2 条 assistant 消息更新一次）
    const assistantCount =
      history.filter(m => m.role === 'assistant').length + 1;
    const shouldUpdateCrystal =
      assistantCount === 1 || assistantCount % 2 === 0;

    if (shouldUpdateCrystal) {
      const fullHistory = [
        ...history,
        { role: 'user', content: displayContent },
        { role: 'assistant', content: aiContent },
      ];
      void extractAndSaveCrystal(conversationId, fullHistory);
    }

    // 第一轮对话后自动生成标题
    if (assistantCount === 1) {
      void autoGenerateTitle(conversationId, displayContent, aiContent);
    }

    return NextResponse.json(
      {
        success: true,
        data: assistantMessage,
        // 脱敏统计（count > 0 时前端展示提示）
        piiRedacted:
          piiResult.count > 0
            ? { count: piiResult.count, types: piiResult.types }
            : null,
        // 当前 AI 提供商（用于前端透明展示）
        provider: CHAT_PROVIDER,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('发送消息失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
