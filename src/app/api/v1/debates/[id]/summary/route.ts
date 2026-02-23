import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getUnifiedAIService } from '@/lib/ai/unified-service';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/debates/[id]/summary
 * 获取辩论摘要数据（各轮次得分统计、双方论点数量、整体结论）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;

    const debate = await prisma.debate.findUnique({
      where: { id },
      include: {
        case: {
          select: { id: true, title: true, type: true, description: true },
        },
        rounds: {
          where: { status: 'COMPLETED' },
          include: {
            arguments: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    if (!debate) {
      return NextResponse.json(
        { success: false, error: '辩论不存在' },
        { status: 404 }
      );
    }

    const isAdmin = (session.user as { role?: string }).role === 'ADMIN';
    if (debate.userId !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '无权访问' },
        { status: 403 }
      );
    }

    // 计算每轮统计数据
    const roundStats = debate.rounds.map(round => {
      const plaintiffArgs = round.arguments.filter(a => a.side === 'PLAINTIFF');
      const defendantArgs = round.arguments.filter(a => a.side === 'DEFENDANT');

      const avgScore = (args: typeof round.arguments) => {
        const withScore = args.filter(a => a.overallScore !== null);
        if (withScore.length === 0) return null;
        return (
          withScore.reduce((sum, a) => sum + (a.overallScore ?? 0), 0) /
          withScore.length
        );
      };

      const avgConfidence = (args: typeof round.arguments) => {
        const withConf = args.filter(a => a.confidence !== null);
        if (withConf.length === 0) return null;
        return (
          withConf.reduce((sum, a) => sum + (a.confidence ?? 0), 0) /
          withConf.length
        );
      };

      const plaintiffScore = avgScore(plaintiffArgs);
      const defendantScore = avgScore(defendantArgs);
      const plaintiffConf = avgConfidence(plaintiffArgs);
      const defendantConf = avgConfidence(defendantArgs);

      // 提取本轮法条引用
      const allLegalBasis = round.arguments.flatMap(a => {
        if (!Array.isArray(a.legalBasis)) return [];
        return (
          a.legalBasis as Array<{ lawName?: string; articleNumber?: string }>
        )
          .filter(b => b.lawName)
          .map(b => `《${b.lawName}》${b.articleNumber}`);
      });
      const uniqueLaws = [...new Set(allLegalBasis)].slice(0, 6);

      // 本轮关键论点摘要（每方各取最高置信度的1个）
      const topPlaintiff = plaintiffArgs.sort(
        (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)
      )[0]?.content;
      const topDefendant = defendantArgs.sort(
        (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)
      )[0]?.content;

      return {
        roundNumber: round.roundNumber,
        roundId: round.id,
        startedAt: round.startedAt,
        completedAt: round.completedAt,
        plaintiff: {
          argumentCount: plaintiffArgs.length,
          avgOverallScore: plaintiffScore,
          avgConfidence: plaintiffConf,
          topArgument: topPlaintiff
            ? topPlaintiff.length > 100
              ? topPlaintiff.substring(0, 100) + '…'
              : topPlaintiff
            : null,
        },
        defendant: {
          argumentCount: defendantArgs.length,
          avgOverallScore: defendantScore,
          avgConfidence: defendantConf,
          topArgument: topDefendant
            ? topDefendant.length > 100
              ? topDefendant.substring(0, 100) + '…'
              : topDefendant
            : null,
        },
        citedLaws: uniqueLaws,
        roundWinner:
          plaintiffScore !== null && defendantScore !== null
            ? plaintiffScore > defendantScore
              ? 'plaintiff'
              : defendantScore > plaintiffScore
                ? 'defendant'
                : 'tie'
            : plaintiffConf !== null && defendantConf !== null
              ? plaintiffConf > defendantConf
                ? 'plaintiff'
                : 'defendant'
              : null,
      };
    });

    // 汇总统计
    const totalPlaintiff = roundStats.reduce(
      (s, r) => s + r.plaintiff.argumentCount,
      0
    );
    const totalDefendant = roundStats.reduce(
      (s, r) => s + r.defendant.argumentCount,
      0
    );

    const plaintiffWins = roundStats.filter(
      r => r.roundWinner === 'plaintiff'
    ).length;
    const defendantWins = roundStats.filter(
      r => r.roundWinner === 'defendant'
    ).length;

    const overallWinner =
      plaintiffWins > defendantWins
        ? 'plaintiff'
        : defendantWins > plaintiffWins
          ? 'defendant'
          : 'tie';

    const allLaws = roundStats.flatMap(r => r.citedLaws);
    const uniqueAllLaws = [...new Set(allLaws)];

    return NextResponse.json({
      success: true,
      data: {
        debateId: debate.id,
        debateTitle: debate.title,
        caseTitle: debate.case?.title,
        caseType: debate.case?.type,
        status: debate.status,
        roundCount: roundStats.length,
        roundStats,
        totals: {
          plaintiffArguments: totalPlaintiff,
          defendantArguments: totalDefendant,
          plaintiffRoundWins: plaintiffWins,
          defendantRoundWins: defendantWins,
          overallWinner,
          citedLawCount: uniqueAllLaws.length,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('获取辩论摘要失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST — 生成 AI 辩论总结并持久化
// =============================================================================

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;

    // 1. 加载辩论完整数据
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
              orderBy: { createdAt: 'asc' },
              select: {
                side: true,
                content: true,
                legalBasis: true,
                priority: true,
              },
            },
          },
        },
      },
    });

    if (!debate) {
      return NextResponse.json(
        { success: false, error: '辩论不存在' },
        { status: 404 }
      );
    }

    const isAdmin = (session.user as { role?: string }).role === 'ADMIN';
    if (debate.userId !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '无权访问' },
        { status: 403 }
      );
    }

    if (debate.rounds.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有已完成的轮次，无法生成总结' },
        { status: 422 }
      );
    }

    // 2. 构建 AI 分析所需的辩论文本
    const caseInfo = debate.case;
    const roundsSummary = debate.rounds
      .map(round => {
        const formatSide = (side: 'PLAINTIFF' | 'DEFENDANT') =>
          round.arguments
            .filter(a => a.side === side)
            .map((a, i) => {
              const lb = Array.isArray(a.legalBasis)
                ? (
                    a.legalBasis as Array<{
                      lawName?: string;
                      articleNumber?: string;
                    }>
                  )
                    .filter(b => b.lawName)
                    .map(b => `《${b.lawName}》${b.articleNumber}`)
                    .join('、')
                : '';
              return `  ${i + 1}. ${a.content.substring(0, 180)}${lb ? `（法律依据：${lb}）` : ''}`;
            })
            .join('\n') || '  （无）';

        return `### 第${round.roundNumber}轮\n原告：\n${formatSide('PLAINTIFF')}\n被告：\n${formatSide('DEFENDANT')}`;
      })
      .join('\n\n');

    const aiPrompt = `你是资深法律专家，请对以下模拟法庭辩论做客观专业的总结分析。

案件：${caseInfo.title}
原告：${caseInfo.plaintiffName ?? '原告方'}
被告：${caseInfo.defendantName ?? '被告方'}
案情：${(caseInfo.description ?? '').substring(0, 300)}

辩论记录（共${debate.rounds.length}轮已完成）：
${roundsSummary}

请以 JSON 格式输出（不加 markdown 代码块之外的任何文字）：
\`\`\`json
{
  "verdict": "综合评估：从法律论证角度分析哪方更有力，说明主要依据（150字以内）",
  "plaintiffStrengths": ["原告最有力论点1", "原告最有力论点2"],
  "defendantStrengths": ["被告最有力论点1", "被告最有力论点2"],
  "keyLegalIssues": ["本案核心法律争议1", "核心争议2", "核心争议3"],
  "weaknesses": {
    "plaintiff": "原告方论证的主要不足",
    "defendant": "被告方论证的主要不足"
  },
  "recommendation": "对律师备庭的改进建议（100字以内）"
}
\`\`\``;

    // 3. 调用 AI 服务
    const aiService = await getUnifiedAIService();
    let rawContent = '';
    try {
      const response = await aiService.generateDebate({
        title: caseInfo.title,
        description: aiPrompt,
        legalReferences: [],
        previousRoundsContext: aiPrompt,
      });
      rawContent = response.choices?.[0]?.message?.content ?? '';
    } catch (aiErr) {
      logger.error('AI 总结生成失败:', aiErr);
      return NextResponse.json(
        { success: false, error: 'AI 服务暂时不可用，请稍后重试' },
        { status: 503 }
      );
    }

    // 4. 解析 JSON
    let summaryData: Record<string, unknown>;
    try {
      const codeMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonText = codeMatch
        ? codeMatch[1]
        : (rawContent.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
      summaryData = JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      summaryData = {
        verdict: rawContent.substring(0, 600),
        raw: true,
      };
    }

    // 5. 写入数据库
    const payload = {
      ...summaryData,
      generatedAt: new Date().toISOString(),
      roundCount: debate.rounds.length,
    };

    await prisma.debate.update({
      where: { id },
      data: { summary: payload as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({ success: true, data: payload });
  } catch (err) {
    logger.error('生成辩论总结失败:', err);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
