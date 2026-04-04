/**
 * GET /api/v1/chat/conversations/[conversationId]/related
 * 查询与当前对话案情相似的历史对话（跨对话知识复用）
 * 匹配逻辑：相同 case_type 或 core_dispute 含相同关键词
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

type Params = { params: Promise<{ conversationId: string }> };

interface CaseCrystal {
  case_type?: string | null;
  core_dispute?: string | null;
}

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

    // 读取当前对话的晶体
    const current = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: authUser.userId },
      select: { caseContext: true },
    });
    if (!current) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }

    const crystal =
      current.caseContext && typeof current.caseContext === 'object'
        ? (current.caseContext as unknown as CaseCrystal)
        : null;

    // 没有晶体或缺少案情信息，返回空
    if (!crystal?.case_type && !crystal?.core_dispute) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 查询用户所有其他对话（有晶体的）
    const others = await prisma.conversation.findMany({
      where: {
        userId: authUser.userId,
        id: { not: conversationId },
        isArchived: false,
        caseContext: { not: { equals: null } },
      },
      select: {
        id: true,
        title: true,
        caseContext: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50, // 最多扫描最近 50 个对话
    });

    // 计算相似度得分
    const related: {
      id: string;
      title: string;
      reason: string;
      updatedAt: Date;
      score: number;
    }[] = [];
    const currentType = crystal.case_type?.trim() ?? '';
    const currentDispute = crystal.core_dispute?.trim() ?? '';
    // 提取核心关键词（按中文词边界切割，取长度≥2的词）
    const disputeKeywords = currentDispute.match(/[\u4e00-\u9fa5]{2,6}/g) ?? [];

    for (const conv of others) {
      if (!conv.caseContext || typeof conv.caseContext !== 'object') continue;
      const other = conv.caseContext as unknown as CaseCrystal;
      const otherType = other.case_type?.trim() ?? '';
      const otherDispute = other.core_dispute?.trim() ?? '';

      let score = 0;
      let reason = '';

      // 案件类型完全匹配
      if (currentType && otherType && currentType === otherType) {
        score += 2;
        reason = `同为${currentType}案件`;
      }

      // 核心争议关键词重叠
      if (disputeKeywords.length > 0 && otherDispute) {
        const matches = disputeKeywords.filter(kw => otherDispute.includes(kw));
        if (matches.length >= 2) {
          score += matches.length;
          reason = reason
            ? `${reason}，争议焦点相似`
            : `争议焦点含"${matches.slice(0, 2).join('、')}"`;
        }
      }

      if (score >= 2) {
        related.push({
          id: conv.id,
          title: conv.title,
          reason,
          updatedAt: conv.updatedAt,
          score,
        });
      }
    }

    // 按相似度得分降序，取前 3
    const top3 = related
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ id, title, reason, updatedAt }) => ({
        id,
        title,
        reason,
        updatedAt,
      }));

    return NextResponse.json({ success: true, data: top3 });
  } catch (error) {
    logger.error('查询相关对话失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
