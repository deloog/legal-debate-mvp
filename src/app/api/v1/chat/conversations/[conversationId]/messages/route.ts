/**
 * GET  /api/v1/chat/conversations/[conversationId]/messages  — 获取消息列表
 * POST /api/v1/chat/conversations/[conversationId]/messages  — 发送消息并获取 AI 回复
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { AIServiceFactory } from '@/lib/ai/service-refactored';

type Params = { params: Promise<{ conversationId: string }> };

const SYSTEM_PROMPT = `你是律伴，一个专业的法律 AI 助手，服务于中国执业律师和企业法务。

你的核心能力：
1. 读取并理解当事人的卷宗、合同、法律文书，提炼案情要点
2. 基于中国法律法规和司法实践，分析案件或合同中的法律问题
3. 帮助律师构建论点、识别对方论据的薄弱点
4. 起草起诉状、答辩状、法律意见书、合同条款等法律文书

回复要求：
- 使用专业、严谨的法律语言
- 引用具体法条时注明法律名称和条款编号
- 如有不确定之处，明确告知，不捏造法条或案例
- 起草文书时使用标准格式（Markdown 标题/列表）
- 回复语言：中文`;

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

    // 验证对话归属
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

    // 验证对话归属
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: authUser.userId },
    });
    if (!conv) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }

    const body = (await request.json()) as { content: string };
    const content = (body.content ?? '').trim();
    if (!content) {
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
    await prisma.message.create({
      data: { conversationId, role: 'user', content },
    });

    // 自动更新对话标题（首条消息，取前 30 字）
    if (conv.title === '新对话') {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title: content.slice(0, 30) },
      });
    }

    // 取历史消息构造上下文（最近 20 条，避免超 token 限制）
    const history = await prisma.message.findMany({
      where: { conversationId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    // 调用 AI
    const aiService = await AIServiceFactory.getInstance();
    const aiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const aiResponse = await aiService.chatCompletion({
      model: 'glm-4-flash',
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

    return NextResponse.json(
      { success: true, data: assistantMessage },
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
