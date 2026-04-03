/**
 * POST /api/v1/chat/messages/[messageId]/regenerate
 *
 * 重新生成 AI 回复。
 * - 软删除 messageId（必须是 assistant 消息）及之后的所有消息
 * - 以截止到上一条用户消息的上下文重新请求 AI
 * - 保存新 AI 消息并返回
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { AIServiceFactory } from '@/lib/ai/service-refactored';

type Params = { params: Promise<{ messageId: string }> };

const SYSTEM_PROMPT = `你是律伴，一个专业的法律 AI 助手，服务于中国执业律师和企业法务。
使用专业、严谨的法律语言。引用法条时注明法律名称和条款编号。
如有不确定之处，明确告知，不捏造法条或案例。
起草文书时使用标准 Markdown 格式。回复语言：中文。`;

export async function POST(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { messageId } = await params;

    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: {
        conversation: { select: { userId: true, id: true } },
      },
    });

    if (!message || message.conversation.userId !== authUser.userId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '消息不存在' } },
        { status: 404 }
      );
    }

    if (message.role !== 'assistant') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: '只能重新生成 AI 消息' },
        },
        { status: 400 }
      );
    }

    const conversationId = message.conversation.id;

    // 软删除该条及之后所有消息
    await prisma.message.updateMany({
      where: {
        conversationId,
        createdAt: { gte: message.createdAt },
        isDeleted: false,
      },
      data: { isDeleted: true },
    });

    // 取剩余历史作为上下文（最近 20 条）
    const history = await prisma.message.findMany({
      where: { conversationId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    if (history.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: '没有可供上下文的消息' },
        },
        { status: 400 }
      );
    }

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
      temperature: 0.5, // 重新生成时略提高多样性
      maxTokens: 4000,
    });

    const aiContent =
      aiResponse.choices[0]?.message?.content ??
      '抱歉，AI 暂时无法回复，请稍后重试。';

    const newMessage = await prisma.message.create({
      data: { conversationId, role: 'assistant', content: aiContent },
      include: { attachments: true, annotations: true },
    });

    return NextResponse.json(
      { success: true, data: newMessage },
      { status: 201 }
    );
  } catch (error) {
    logger.error('重新生成消息失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
