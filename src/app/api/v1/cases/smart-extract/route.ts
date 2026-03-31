/**
 * 案件信息智能提取 API
 *
 * POST /api/v1/cases/smart-extract
 *
 * 功能：
 * - mode=text：从粘贴的案件文字中提取结构化字段
 * - mode=image：从上传的图片（base64）中 OCR 并提取结构化字段
 *
 * 安全约束：
 * - 图片大小不超过 10MB（base64 后约 13.3MB）
 * - 仅允许 JPEG / PNG / WEBP 三种图片格式
 * - 文字内容不超过 50,000 字符
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

interface ExtractedCaseFields {
  title?: string;
  plaintiffName?: string;
  defendantName?: string;
  cause?: string;
  court?: string;
  amount?: string;
  description?: string;
  caseNumber?: string;
}

/** 允许的图片 MIME 类型 */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** 图片原始大小上限：10 MB */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** base64 字符串到字节数的近似换算（每个 base64 字符 ≈ 0.75 字节） */
const base64ToApproxBytes = (b64: string) => Math.ceil(b64.length * 0.75);

/** 文字输入上限 */
const MAX_TEXT_LENGTH = 50_000;

const EXTRACT_SYSTEM_PROMPT = `你是一个专业的法律案件信息提取助手。
请从用户提供的案件材料中提取关键信息，并以 JSON 格式返回。
返回的 JSON 必须包含以下字段（如无法提取则省略该字段）：
{
  "title": "案件标题（如：张三诉李四民间借贷纠纷案）",
  "plaintiffName": "原告/申请人姓名或单位名称",
  "defendantName": "被告/被申请人姓名或单位名称",
  "cause": "案由（如：民间借贷纠纷）",
  "court": "审理法院名称",
  "amount": "标的金额，仅数字，单位元（如：50000）",
  "caseNumber": "案号（如：（2024）京0105民初1234号）",
  "description": "案件经过的简要描述"
}
只返回 JSON，不要有任何其他说明文字。`;

/**
 * 从 AI 返回的原始文本中提取 JSON 对象。
 * 优先匹配 ```json ... ``` 代码块，其次匹配第一个完整的 { ... } 对象。
 */
function parseJsonFromAI(rawText: string): ExtractedCaseFields {
  // 优先匹配 markdown 代码块
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1]) as ExtractedCaseFields;
  }

  // 找到第一个 '{' 和最后一个 '}' 之间的内容（最短合法 JSON 对象）
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return JSON.parse(rawText.slice(start, end + 1)) as ExtractedCaseFields;
  }

  throw new Error('AI 响应中未找到 JSON 对象');
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as {
      mode: string;
      content: string;
      mimeType?: string;
    };
    const { mode, content, mimeType } = body;

    if (!mode || !content) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数 mode 和 content' },
        { status: 400 }
      );
    }

    if (mode !== 'text' && mode !== 'image') {
      return NextResponse.json(
        { success: false, error: 'mode 必须为 text 或 image' },
        { status: 400 }
      );
    }

    // ── 文字模式验证 ──────────────────────────────────────────────────────────
    if (mode === 'text') {
      if (content.length > MAX_TEXT_LENGTH) {
        return NextResponse.json(
          { success: false, error: `文字内容不能超过 ${MAX_TEXT_LENGTH} 字符` },
          { status: 400 }
        );
      }
    }

    // ── 图片模式验证 ──────────────────────────────────────────────────────────
    if (mode === 'image') {
      // 验证 MIME 类型
      const effectiveMime = mimeType || 'image/jpeg';
      if (!ALLOWED_MIME_TYPES.has(effectiveMime)) {
        return NextResponse.json(
          { success: false, error: '仅支持 JPEG、PNG、WEBP 格式的图片' },
          { status: 400 }
        );
      }

      // 验证文件大小（base64 近似还原为字节数）
      // content 可能已含 data: 前缀，取逗号后的纯 base64 部分
      const rawBase64 = content.includes(',')
        ? (content.split(',')[1] ?? content)
        : content;
      if (base64ToApproxBytes(rawBase64) > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { success: false, error: '图片文件不能超过 10MB' },
          { status: 400 }
        );
      }
    }

    const aiService = await AIServiceFactory.getInstance();

    type MultimodalContent = Array<{
      type: string;
      text?: string;
      image_url?: { url: string };
    }>;

    type MessageLike = {
      role: 'user' | 'assistant' | 'system';
      content: string | MultimodalContent;
    };

    let messages: MessageLike[];

    if (mode === 'text') {
      messages = [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        { role: 'user', content: `请从以下案件材料中提取信息：\n\n${content}` },
      ];
    } else {
      // 图片模式：构建 OpenAI 兼容的 multimodal 消息（GLM-4V 支持）
      const imageUrl = content.startsWith('data:')
        ? content
        : `data:${mimeType || 'image/jpeg'};base64,${content}`;

      messages = [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: '请从图片中的案件材料识别并提取信息：' },
          ] satisfies MultimodalContent,
        },
      ];
    }

    const model = mode === 'image' ? 'glm-4v' : 'glm-4-flash';

    const response = await aiService.chatCompletion({
      model,
      // request-executor 以 `as unknown` 透传 messages，multimodal 数组可正常到达底层 SDK
      messages: messages as Parameters<
        typeof aiService.chatCompletion
      >[0]['messages'],
      temperature: 0.1,
      maxTokens: 1000,
    });

    const rawText = response.choices[0]?.message?.content ?? '';

    // ── 解析 JSON 响应 ────────────────────────────────────────────────────────
    let extracted: ExtractedCaseFields = {};
    try {
      extracted = parseJsonFromAI(rawText);
    } catch {
      logger.warn(
        '[smart-extract] AI 返回内容无法解析为 JSON，原文:',
        rawText.slice(0, 200)
      );
      // 降级：将返回文字整体放入 description，至少部分有用
      if (rawText.trim()) {
        extracted = { description: rawText.trim() };
      }
    }

    // 确保 extracted 只含预期字段（防止 AI 注入多余 key）
    const safe: ExtractedCaseFields = {};
    const allowedKeys: (keyof ExtractedCaseFields)[] = [
      'title',
      'plaintiffName',
      'defendantName',
      'cause',
      'court',
      'amount',
      'description',
      'caseNumber',
    ];
    for (const key of allowedKeys) {
      if (typeof extracted[key] === 'string' && extracted[key]) {
        safe[key] = extracted[key] as string;
      }
    }

    return NextResponse.json({ success: true, data: safe });
  } catch (error) {
    logger.error('[smart-extract] 提取失败:', error);
    return NextResponse.json(
      { success: false, error: '提取失败，请稍后重试' },
      { status: 500 }
    );
  }
}
