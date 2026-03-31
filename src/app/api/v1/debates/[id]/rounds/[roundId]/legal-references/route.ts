/**
 * 辩论轮次法条引用 API
 * GET /api/v1/debates/[id]/rounds/[roundId]/legal-references
 *
 * 阶段4修复：从 Argument.legalBasis 提取 AI 实际引用的法条，
 * 而非从 LegalReference 表读取案件级预存记录。
 *
 * 流程：
 *   1. 查询本轮所有论点的 legalBasis 字段
 *   2. 去重合并（同一法条可能被原被告双方都引用）
 *   3. 批量补全真实法条全文（从 law_articles 表）
 *   4. 同步到 LegalReference 表（创建或更新），以便律师反馈
 *   5. 按相关性排序返回
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import { LawStatus, Prisma } from '@prisma/client';

// AI 生成的 legalBasis 单条结构
interface LegalBasisItem {
  lawName: string;
  articleNumber: string;
  relevance: number;
  explanation: string;
}

// 去重后的合并结构（追踪双方引用）
interface MergedBasis extends LegalBasisItem {
  sides: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  try {
    const { id: debateId, roundId } = await params;

    // ── 权限校验 ──
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { id: true, userId: true, caseId: true },
    });
    if (!debate) {
      return NextResponse.json(
        { success: false, error: '辩论不存在' },
        { status: 404 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
    if (debate.userId !== authUser.userId && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '无权访问' },
        { status: 403 }
      );
    }

    const round = await prisma.debateRound.findUnique({
      where: { id: roundId, debateId },
      select: { id: true, roundNumber: true },
    });
    if (!round) {
      return NextResponse.json(
        { success: false, error: '辩论轮次不存在' },
        { status: 404 }
      );
    }

    // ── 步骤1：提取本轮所有论点的 legalBasis ──
    const roundArguments = await prisma.argument.findMany({
      where: { roundId },
      select: { legalBasis: true, side: true },
    });

    if (roundArguments.length === 0) {
      return NextResponse.json({ success: true, articles: [] });
    }

    // ── 步骤2：去重合并（同一法条被双方引用时合并 sides，取最高 relevance）──
    const basisMap = new Map<string, MergedBasis>();
    for (const arg of roundArguments) {
      if (!arg.legalBasis || !Array.isArray(arg.legalBasis)) continue;
      for (const raw of arg.legalBasis as unknown[]) {
        const item = raw as Partial<LegalBasisItem>;
        if (!item.lawName || !item.articleNumber) continue;
        const key = `${item.lawName}|${item.articleNumber}`;
        const existing = basisMap.get(key);
        if (existing) {
          if (!existing.sides.includes(arg.side)) existing.sides.push(arg.side);
          existing.relevance = Math.max(
            existing.relevance,
            item.relevance ?? 0
          );
        } else {
          basisMap.set(key, {
            lawName: item.lawName,
            articleNumber: item.articleNumber,
            relevance: item.relevance ?? 0.5,
            explanation: item.explanation ?? '',
            sides: [arg.side],
          });
        }
      }
    }

    if (basisMap.size === 0) {
      return NextResponse.json({ success: true, articles: [] });
    }

    // ── 步骤3：批量从 law_articles 补全真实全文 ──
    const basisList = [...basisMap.values()];
    const fullTextMap = new Map<string, string>();
    const lawArticles = await prisma.lawArticle.findMany({
      where: {
        OR: basisList.map(item => ({
          AND: [
            { lawName: item.lawName },
            { articleNumber: item.articleNumber },
          ],
        })),
        status: { in: [LawStatus.VALID, LawStatus.AMENDED] },
      },
      select: { lawName: true, articleNumber: true, fullText: true },
    });
    for (const la of lawArticles) {
      fullTextMap.set(`${la.lawName}|${la.articleNumber}`, la.fullText);
    }

    // ── 步骤4：同步到 LegalReference 表（upsert via findFirst + create/update）──
    const articles = [];
    for (const item of basisList) {
      const key = `${item.lawName}|${item.articleNumber}`;
      const content = fullTextMap.get(key) ?? item.explanation;

      let ref = await prisma.legalReference.findFirst({
        where: {
          caseId: debate.caseId,
          source: item.lawName,
          articleNumber: item.articleNumber,
        },
      });

      if (!ref) {
        ref = await prisma.legalReference.create({
          data: {
            caseId: debate.caseId,
            source: item.lawName,
            articleNumber: item.articleNumber,
            content,
            applicabilityScore: item.relevance,
            applicabilityReason: item.explanation,
            metadata: {
              roundId,
              aiGenerated: true,
              sides: item.sides,
            } as Prisma.InputJsonValue,
          },
        });
      } else {
        // 更新内容和分数；...existingMeta 展开确保律师已有反馈（lawyerFeedback 等）不被丢弃
        const existingMeta = (ref.metadata as Record<string, unknown>) ?? {};
        ref = await prisma.legalReference.update({
          where: { id: ref.id },
          data: {
            content: fullTextMap.get(key) ?? ref.content, // 有真实全文则更新
            applicabilityScore: item.relevance,
            applicabilityReason: item.explanation,
            metadata: {
              ...existingMeta, // 保留律师反馈等已有字段
              roundId,
              aiGenerated: true,
              sides: item.sides,
            } as Prisma.InputJsonValue,
          },
        });
      }

      articles.push({
        id: ref.id,
        lawName: ref.source,
        articleNumber: ref.articleNumber ?? '',
        content: ref.content,
        applicabilityScore: ref.applicabilityScore,
        applicabilityReason: ref.applicabilityReason,
        status: ref.status,
        metadata: ref.metadata,
        // 附加信息：哪方引用了此法条
        sides: item.sides,
      });
    }

    // ── 步骤5：按相关性降序排列 ──
    articles.sort(
      (a, b) => (b.applicabilityScore ?? 0) - (a.applicabilityScore ?? 0)
    );

    logger.info(
      `[legal-references] 辩论 ${debateId} 第${round.roundNumber}轮：AI引用法条 ${articles.length} 条`
    );

    return NextResponse.json({ success: true, articles });
  } catch (error) {
    logger.error('获取AI引用法条失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
