/**
 * GET /api/v1/debates/[id]/export?format=markdown|json
 * 导出辩论记录（Markdown 或 JSON 格式），浏览器直接下载
 */

import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

const CASE_TYPE_LABELS: Record<string, string> = {
  CIVIL: '民事',
  CRIMINAL: '刑事',
  ADMINISTRATIVE: '行政',
  COMMERCIAL: '商事',
  LABOR: '劳动',
  INTELLECTUAL_PROPERTY: '知识产权',
  OTHER: '其他',
};

const SIDE_LABELS: Record<string, string> = {
  PLAINTIFF: '原告方',
  DEFENDANT: '被告方',
  NEUTRAL: '中立方',
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未认证' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const format = request.nextUrl.searchParams.get('format') ?? 'markdown';

    const debate = await prisma.debate.findUnique({
      where: { id },
      include: {
        case: {
          select: {
            title: true,
            description: true,
            type: true,
            plaintiffName: true,
            defendantName: true,
          },
        },
        rounds: {
          where: { status: 'COMPLETED' },
          orderBy: { roundNumber: 'asc' },
          include: {
            arguments: {
              orderBy: { side: 'asc' },
              select: {
                side: true,
                content: true,
                reasoning: true,
                legalBasis: true,
                type: true,
                priority: true,
                confidence: true,
              },
            },
          },
        },
      },
    });

    if (!debate) {
      return NextResponse.json({ error: '辩论不存在' }, { status: 404 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
    if (debate.userId !== authUser.userId && !isAdmin) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 });
    }

    const caseInfo = debate.case;
    const exportedAt = new Date().toLocaleString('zh-CN');
    const rawTitle = (caseInfo.title || '未知案件').substring(0, 20);
    const datePart = new Date().toISOString().slice(0, 10);
    const safeAsciiTitle = rawTitle.replace(/[^\x00-\x7F]/g, '_');
    const filename = `debate_record_${safeAsciiTitle}_${datePart}`;
    const filenameUtf8 = encodeURIComponent(`辩论记录_${rawTitle}_${datePart}`);

    // ── JSON 格式 ──────────────────────────────────────────────────────────────
    if (format === 'json') {
      const payload = {
        exportedAt,
        debate: {
          id: debate.id,
          title: debate.title,
          status: debate.status,
          roundCount: debate.rounds.length,
        },
        case: caseInfo,
        rounds: debate.rounds.map(round => ({
          roundNumber: round.roundNumber,
          completedAt: round.completedAt,
          arguments: round.arguments.map(arg => ({
            side: SIDE_LABELS[arg.side] ?? arg.side,
            content: arg.content,
            reasoning: arg.reasoning,
            legalBasis: arg.legalBasis,
            priority: arg.priority,
            confidence: arg.confidence,
          })),
        })),
        aiSummary: debate.summary ?? null,
      };

      return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.json"; filename*=UTF-8''${filenameUtf8}.json`,
        },
      });
    }

    // ── Markdown 格式 ──────────────────────────────────────────────────────────
    const lines: string[] = [];

    lines.push(`# ${caseInfo.title || debate.title}`);
    lines.push('');
    lines.push('## 案件基本信息');
    lines.push('');
    lines.push('| 字段 | 内容 |');
    lines.push('|------|------|');
    lines.push(`| 案由 | ${caseInfo.title || ''} |`);
    lines.push(
      `| 案件类型 | ${CASE_TYPE_LABELS[caseInfo.type ?? ''] ?? caseInfo.type ?? '未知'} |`
    );
    if (caseInfo.plaintiffName)
      lines.push(`| 原告 | ${caseInfo.plaintiffName} |`);
    if (caseInfo.defendantName)
      lines.push(`| 被告 | ${caseInfo.defendantName} |`);
    if (caseInfo.description) {
      lines.push(`| 案情简述 | ${caseInfo.description.substring(0, 200)} |`);
    }
    lines.push(`| 辩论轮次 | ${debate.rounds.length} 轮已完成 |`);
    lines.push(`| 导出时间 | ${exportedAt} |`);
    lines.push('');

    // AI 总结（若有）
    if (debate.summary && typeof debate.summary === 'object') {
      const s = debate.summary as Record<string, unknown>;
      lines.push('## AI 专家分析');
      lines.push('');
      if (s.verdict) {
        lines.push('### 综合评估');
        lines.push('');
        lines.push(String(s.verdict));
        lines.push('');
      }
      if (
        Array.isArray(s.plaintiffStrengths) &&
        s.plaintiffStrengths.length > 0
      ) {
        lines.push('### 原告方优势');
        lines.push('');
        (s.plaintiffStrengths as string[]).forEach(p => lines.push(`- ${p}`));
        lines.push('');
      }
      if (
        Array.isArray(s.defendantStrengths) &&
        s.defendantStrengths.length > 0
      ) {
        lines.push('### 被告方优势');
        lines.push('');
        (s.defendantStrengths as string[]).forEach(p => lines.push(`- ${p}`));
        lines.push('');
      }
      if (Array.isArray(s.keyLegalIssues) && s.keyLegalIssues.length > 0) {
        lines.push('### 核心法律争议');
        lines.push('');
        (s.keyLegalIssues as string[]).forEach(p => lines.push(`- ${p}`));
        lines.push('');
      }
      if (s.recommendation) {
        lines.push('### 改进建议');
        lines.push('');
        lines.push(String(s.recommendation));
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }

    // 逐轮论点
    lines.push('## 辩论记录');
    lines.push('');

    for (const round of debate.rounds) {
      lines.push(`### 第 ${round.roundNumber} 轮`);
      lines.push('');

      for (const side of ['PLAINTIFF', 'DEFENDANT', 'NEUTRAL'] as const) {
        const sideArgs = round.arguments.filter(a => a.side === side);
        if (sideArgs.length === 0) continue;

        lines.push(`#### ${SIDE_LABELS[side]}`);
        lines.push('');

        sideArgs.forEach((arg, idx) => {
          const priorityTag =
            arg.priority === 'primary'
              ? ' [主攻]'
              : arg.priority === 'secondary'
                ? ' [备用]'
                : '';
          lines.push(`**论点 ${idx + 1}**${priorityTag}`);
          lines.push('');
          lines.push(arg.content);
          lines.push('');

          if (arg.reasoning) {
            lines.push('> **推理过程：**');
            arg.reasoning.split('\n').forEach(line => lines.push(`> ${line}`));
            lines.push('');
          }

          if (Array.isArray(arg.legalBasis) && arg.legalBasis.length > 0) {
            const laws = (
              arg.legalBasis as Array<{
                lawName?: string;
                articleNumber?: string;
                explanation?: string;
              }>
            )
              .filter(b => b.lawName)
              .map(
                b =>
                  `- ${b.lawName}${b.articleNumber}${b.explanation ? `：${b.explanation}` : ''}`
              );
            if (laws.length > 0) {
              lines.push('**法律依据：**');
              lines.push('');
              laws.forEach(l => lines.push(l));
              lines.push('');
            }
          }
        });
      }
    }

    lines.push('---');
    lines.push('');
    lines.push(`*本文档由法辩助手自动生成，仅供参考。导出时间：${exportedAt}*`);

    const markdown = lines.join('\n');

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.md"`,
      },
    });
  } catch (err) {
    logger.error('导出辩论记录失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
