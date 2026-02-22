import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import {
  generateArgumentsSchema,
  uuidSchema,
} from '@/app/api/lib/validation/schemas';
import {
  validatePathParam,
  validateRequestBody,
} from '@/app/api/lib/validation/validator';
import { getUnifiedAIService } from '@/lib/ai/unified-service';
import { prisma } from '@/lib/db/prisma';
import { searchAllLawArticles } from '@/lib/debate/law-search';
import { computeArgumentScores } from '@/lib/debate/scoring';
import {
  graphEnhancedSearch,
  formatGraphAnalysisForPrompt,
} from '@/lib/debate/graph-enhanced-law-search';
import {
  ArgumentSide,
  ArgumentType,
  Prisma,
  RoundStatus,
} from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// =============================================================================
// 案件类型特化辩论指引（仅 generate 路由使用）
// =============================================================================
const CASE_TYPE_DEBATE_GUIDANCE: Record<string, string> = {
  CIVIL: `【民事案件辩论要点】
- 原告须证明：权利存在、被告侵权行为、损害结果、因果关系（四要件）
- 举证责任：谁主张谁举证（民诉法第67条）
- 重点法律：民法典、民事诉讼法、相关司法解释`,

  CRIMINAL: `【刑事案件辩论要点】
- 控方须证明：犯罪主体、主观故意/过失、客观行为、危害结果（四构成要件）
- 疑罪从无原则：证据不足不得定罪（刑诉法第200条）
- 辩护重点：无罪辩护或罪轻辩护，证据合法性
- 重点法律：刑法、刑事诉讼法、最高法相关司法解释`,

  ADMINISTRATIVE: `【行政案件辩论要点】
- 被告（行政机关）承担举证责任（行政诉讼法第34条）
- 审查重点：具体行政行为合法性、程序正当性、证据充分性
- 重点法律：行政诉讼法、行政处罚法、行政许可法`,

  LABOR: `【劳动争议辩论要点】
- 举证责任部分倒置：劳动关系存续期间的证据由用人单位提供
- 关键事项：劳动关系认定、解除/终止合法性、工资报酬计算
- 重点法律：劳动合同法、劳动法、工伤保险条例、最高法劳动争议司法解释`,

  COMMERCIAL: `【商事案件辩论要点】
- 合同效力、违约认定、损失计算是核心
- 商事惯例和交易习惯可作为补充依据
- 重点法律：民法典合同编、公司法、担保法、票据法`,

  INTELLECTUAL_PROPERTY: `【知识产权案件辩论要点】
- 权利归属、侵权认定、赔偿计算（实际损失/违法所得/法定赔偿）
- 举证：权利人证明权利存在及侵权事实
- 重点法律：著作权法、专利法、商标法、反不正当竞争法`,
};

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 构建前轮辩论上下文摘要（截断200字，加强针对性反驳指引）
 */
async function buildPreviousRoundsContext(
  debateId: string,
  currentRoundNumber: number
): Promise<string | null> {
  if (currentRoundNumber <= 1) return null;

  const previousRounds = await prisma.debateRound.findMany({
    where: {
      debateId,
      roundNumber: { lt: currentRoundNumber },
      status: 'COMPLETED',
    },
    include: {
      arguments: {
        orderBy: { createdAt: 'asc' },
        take: 10,
      },
    },
    orderBy: { roundNumber: 'asc' },
  });

  if (previousRounds.length === 0) return null;

  const contextParts: string[] = [];
  for (const round of previousRounds) {
    const plaintiffSummary = round.arguments
      .filter(a => a.side === 'PLAINTIFF')
      .map(
        (a, i) =>
          `  ${i + 1}. ${a.content.length > 200 ? a.content.substring(0, 200) + '…' : a.content}`
      )
      .join('\n');
    const defendantSummary = round.arguments
      .filter(a => a.side === 'DEFENDANT')
      .map(
        (a, i) =>
          `  ${i + 1}. ${a.content.length > 200 ? a.content.substring(0, 200) + '…' : a.content}`
      )
      .join('\n');

    contextParts.push(
      `### 第${round.roundNumber}轮\n原告方论点：\n${plaintiffSummary || '  （无）'}\n被告方论点：\n${defendantSummary || '  （无）'}`
    );
  }
  return contextParts.join('\n\n');
}

/**
 * 解析AI返回的JSON格式辩论论点（结构化解析）
 */
function parseStructuredDebateArguments(content: string): Array<{
  side: ArgumentSide;
  content: string;
  type: ArgumentType;
  confidence: number;
  reasoning?: string;
  legalBasis: Array<{
    lawName: string;
    articleNumber: string;
    relevance: number;
    explanation: string;
  }>;
}> | null {
  try {
    let jsonText = content;
    const codeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) jsonText = codeBlockMatch[1];
    else {
      const braceMatch = content.match(
        /\{[\s\S]*"plaintiff"[\s\S]*"defendant"[\s\S]*\}/
      );
      if (braceMatch) jsonText = braceMatch[0];
    }

    const parsed = JSON.parse(jsonText) as {
      plaintiff?: Array<{
        content: string;
        reasoning?: string;
        legalBasis?: unknown[];
      }>;
      defendant?: Array<{
        content: string;
        reasoning?: string;
        legalBasis?: unknown[];
      }>;
    };

    const results: ReturnType<typeof parseStructuredDebateArguments> = [];

    const mapArgs = (
      args: Array<{
        content: string;
        reasoning?: string;
        legalBasis?: unknown[];
      }>,
      side: ArgumentSide,
      baseConfidence: number
    ) => {
      for (const arg of args) {
        if (typeof arg.content === 'string' && arg.content.trim()) {
          results.push({
            side,
            content: arg.content.trim(),
            type: ArgumentType.MAIN_POINT,
            confidence: baseConfidence,
            reasoning:
              typeof arg.reasoning === 'string' ? arg.reasoning : undefined,
            legalBasis: Array.isArray(arg.legalBasis)
              ? (
                  arg.legalBasis as Array<{
                    lawName?: string;
                    articleNumber?: string;
                    relevance?: number;
                    explanation?: string;
                  }>
                )
                  .filter(b => b.lawName && b.articleNumber)
                  .map(b => ({
                    lawName: String(b.lawName),
                    articleNumber: String(b.articleNumber),
                    relevance: Number(b.relevance ?? 0.8),
                    explanation: String(b.explanation || ''),
                  }))
              : [],
          });
        }
      }
    };

    if (Array.isArray(parsed.plaintiff))
      mapArgs(parsed.plaintiff, ArgumentSide.PLAINTIFF, 0.88);
    if (Array.isArray(parsed.defendant))
      mapArgs(parsed.defendant, ArgumentSide.DEFENDANT, 0.85);

    return results.length >= 2 ? results : null;
  } catch {
    return null;
  }
}

// =============================================================================
// POST handler
// =============================================================================

/**
 * POST /api/v1/debates/[id]/rounds/[roundId]/generate
 * 为指定轮次生成辩论论点
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string; roundId: string }> }
  ) => {
    // ── 认证 ──
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未认证', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const resolvedParams = await context.params;
    const debateId = validatePathParam(resolvedParams.id, uuidSchema);
    const roundId = validatePathParam(resolvedParams.roundId, uuidSchema);
    const body = await validateRequestBody(request, generateArgumentsSchema);
    const { applicableArticles } = body;

    // ── 速率限制：60秒内完成轮次不超过5个 ──
    const recentRounds = await prisma.debateRound.count({
      where: {
        debate: { userId: session.user.id },
        completedAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recentRounds >= 5) {
      return NextResponse.json(
        {
          success: false,
          error: '请求过于频繁，请稍后再试',
          code: 'RATE_LIMITED',
        },
        { status: 429 }
      );
    }

    // 1. 获取轮次 + 案件信息
    const round = await prisma.debateRound.findUnique({
      where: { id: roundId },
      include: {
        debate: {
          include: {
            case: {
              select: {
                title: true,
                description: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!round) throw new Error('Round not found');
    if (round.debateId !== debateId)
      throw new Error('Round does not belong to this debate');

    // ── 所有权验证 ──
    const isAdmin = (session.user as { role?: string }).role === 'ADMIN';
    if (round.debate.userId !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '无权访问', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    if (round.status !== RoundStatus.IN_PROGRESS) {
      throw new Error(
        `Cannot generate arguments for round with status: ${round.status}`
      );
    }

    // ── 生成软锁：防止同一轮次被并发双重生成 ──
    // 条件：startedAt 为 null（由 PATCH 重置）或超过3分钟（旧锁过期清理）
    // stream 路由创建轮次时会设置 startedAt=now，3分钟内阻止 /generate 重复触发
    const lockClaimed = await prisma.debateRound.updateMany({
      where: {
        id: roundId,
        status: RoundStatus.IN_PROGRESS,
        OR: [
          { startedAt: null },
          { startedAt: { lt: new Date(Date.now() - 180_000) } },
        ],
      },
      data: { startedAt: new Date() },
    });

    if (lockClaimed.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '该轮次正在生成中，请稍后再试',
          code: 'GENERATION_IN_PROGRESS',
        },
        { status: 409 }
      );
    }

    const caseInfo = round.debate.case;
    const caseType = caseInfo.type ?? null;

    // 2. 构建前轮上下文
    const previousRoundsContext = await buildPreviousRoundsContext(
      debateId,
      round.roundNumber
    );
    if (previousRoundsContext) {
      logger.info(`已构建前${round.roundNumber - 1}轮辩论上下文`);
    }

    // 3. 检索相关法条（本地优先，LawStar备用）
    const {
      articles: allArticles,
      localCount: _localCount,
      lawstarCount,
    } = await searchAllLawArticles(
      caseType,
      caseInfo.title,
      caseInfo.description,
      6,
      4
    );
    if (allArticles.length === 0) {
      logger.info('本地DB及LawStar均未检索到匹配法条，AI将依赖自身知识库');
    } else if (lawstarCount > 0) {
      logger.info(
        `LawStar 补充了 ${lawstarCount} 条法条，合计 ${allArticles.length} 条`
      );
    }

    const localLawContext =
      allArticles.length > 0
        ? allArticles
            .map(
              a =>
                `《${a.lawName}》${a.articleNumber}：${a.fullText.substring(0, 300)}`
            )
            .join('\n\n')
        : '';

    // 4. 并行执行图谱增强搜索（带500ms超时）
    const graphSearchResult = await graphEnhancedSearch(
      caseType,
      caseInfo.title,
      { timeoutMs: 500, includeAttackPaths: true }
    );

    // 5. 如果图谱分析完成，注入额外信息
    let graphAnalysisPrompt = '';
    if (graphSearchResult.graphAnalysisCompleted) {
      graphAnalysisPrompt = formatGraphAnalysisForPrompt(graphSearchResult);
      logger.info(
        `图谱分析完成，支持法条: ${graphSearchResult.supportingArticles.length}, 对方法条: ${graphSearchResult.opposingArticles.length}`
      );
    } else {
      logger.warn(`图谱分析超时，仅使用关键词检索`);
    }

    // 6. 构建案件类型特化指引
    const caseTypeGuidance = caseType
      ? (CASE_TYPE_DEBATE_GUIDANCE[caseType] ?? '')
      : '';

    // 5. 构建多轮对抗提示词
    const isMultiRound = round.roundNumber > 1 && !!previousRoundsContext;
    const contextSection = isMultiRound
      ? `\n## 前轮辩论记录\n${previousRoundsContext}\n\n` +
        `## 本轮要求（第${round.roundNumber}轮 — 针对性反驳）\n` +
        `- 原告方：必须逐条回应被告方第${round.roundNumber - 1}轮的具体论点，明确指出其逻辑漏洞或法律适用错误\n` +
        `- 被告方：必须逐条回应原告方第${round.roundNumber - 1}轮的具体论点，提出反证或不同的法律解释\n` +
        `- 禁止重复前轮已有论点，本轮论点必须在前轮基础上深化或推进\n`
      : '';

    // 6. 构建完整用户提示词
    const graphSection = graphAnalysisPrompt
      ? `\n${graphAnalysisPrompt}\n`
      : '';
    const userPrompt = `案件信息：
**标题**：${caseInfo.title}
**描述**：${caseInfo.description ?? '（无）'}
**案件类型**：${caseType ?? '未知'}
${caseTypeGuidance}
${graphSection}
${
  allArticles.length > 0
    ? `## 法条库检索结果（仅可引用以下法条，不得引用此列表以外的法条）\n${localLawContext}\n\n` +
      `**重要：legalBasis 中的法条必须来自上方列表，不得自行补充其他法条**`
    : `## 法条引用要求\n请从您熟悉的中国现行有效法律中引用，必须精确到具体条款号（如第1165条第1款），禁止捏造`
}
${contextSection}
请分别为原告和被告各生成3-4个核心论点，直接以JSON格式输出：

{
  "plaintiff": [
    {
      "content": "论点主张（针对本案事实，清晰陈述核心观点）",
      "reasoning": "法律推理过程（从案件事实出发，引用法律规定，推导出结论，100-300字）",
      "legalBasis": [
        {
          "lawName": "中华人民共和国民法典",
          "articleNumber": "第1165条第1款",
          "relevance": 0.9,
          "explanation": "该条款确立过错责任原则，本案被告存在明显过错"
        }
      ]
    }
  ],
  "defendant": [...]
}`;

    // 7. 调用AI服务（带重试）
    const aiService = await getUnifiedAIService();
    let debateContent = '';
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const debateResponse = await aiService.generateDebate({
          title: caseInfo.title,
          description: caseInfo.description,
          legalReferences: applicableArticles,
          previousRoundsContext: userPrompt,
        });
        debateContent = debateResponse.choices?.[0]?.message?.content || '';
        logger.info(`AI调用成功（第${attempt}次）`);
        break;
      } catch (aiError) {
        logger.error(`AI调用失败（第${attempt}/${maxRetries}次）:`, aiError);
        if (attempt === maxRetries) {
          await prisma.debateRound.update({
            where: { id: roundId },
            data: { status: RoundStatus.FAILED },
          });
          return NextResponse.json(
            {
              success: false,
              error: 'AI_SERVICE_UNAVAILABLE',
              message:
                'AI服务暂时不可用，请稍后重试。轮次已标记为失败，您可以重新生成。',
            },
            { status: 503 }
          );
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 8. 解析失败直接标记失败
    const structuredArgs = debateContent
      ? parseStructuredDebateArguments(debateContent)
      : null;

    if (!structuredArgs || structuredArgs.length < 2) {
      logger.error('论点解析失败，原始内容:', debateContent.substring(0, 500));
      await prisma.debateRound.update({
        where: { id: roundId },
        data: { status: RoundStatus.FAILED },
      });
      return NextResponse.json(
        {
          success: false,
          error: 'PARSE_FAILED',
          message:
            'AI返回内容格式异常，无法解析论点。轮次已标记为失败，请重新生成。',
          rawContent: debateContent.substring(0, 200),
        },
        { status: 422 }
      );
    }

    logger.info(`解析成功，共 ${structuredArgs.length} 个论点`);

    // 9. 保存论点并完成轮次（事务）
    const result = await prisma.$transaction(
      async tx => {
        // 先删除本轮已有论点（重试时防止累积）
        await tx.argument.deleteMany({ where: { roundId } });

        const createdArguments = await tx.argument.createMany({
          data: structuredArgs.map(arg => {
            const scores = computeArgumentScores({
              reasoning: arg.reasoning,
              legalBasis: arg.legalBasis,
              confidence: arg.confidence,
            });
            return {
              roundId,
              side: arg.side,
              content: arg.content,
              type: arg.type,
              reasoning: arg.reasoning ?? null,
              legalBasis:
                arg.legalBasis.length > 0
                  ? (arg.legalBasis as unknown as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
              aiProvider: 'deepseek',
              confidence: arg.confidence,
              logicScore: scores.logicScore,
              legalScore: scores.legalScore,
              overallScore: scores.overallScore,
            };
          }),
        });

        const maxRounds =
          (round.debate.debateConfig as { maxRounds?: number } | null)
            ?.maxRounds ?? 3;
        const isLastRound = round.roundNumber >= maxRounds;

        await tx.debate.update({
          where: { id: debateId },
          data: {
            currentRound: round.roundNumber,
            ...(isLastRound ? { status: 'COMPLETED' } : {}),
          },
        });

        await tx.debateRound.update({
          where: { id: roundId },
          data: {
            status: RoundStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        return {
          plaintiff: {
            arguments: structuredArgs
              .filter(a => a.side === ArgumentSide.PLAINTIFF)
              .map(a => ({
                type: a.type,
                content: a.content,
                reasoning: a.reasoning,
                legalBasis: a.legalBasis,
              })),
          },
          defendant: {
            arguments: structuredArgs
              .filter(a => a.side === ArgumentSide.DEFENDANT)
              .map(a => ({
                type: a.type,
                content: a.content,
                reasoning: a.reasoning,
                legalBasis: a.legalBasis,
              })),
          },
          totalArguments: createdArguments.count,
          roundId,
          roundNumber: round.roundNumber,
          aiGenerationFailed: false,
          usedPreviousContext: !!previousRoundsContext,
          localLawArticlesUsed: allArticles.length,
          lawstarFallbackUsed: lawstarCount > 0,
          debateCompleted: isLastRound,
        };
      },
      { timeout: 30000, maxWait: 30000 }
    );

    return createSuccessResponse(result);
  }
);

/**
 * OPTIONS /api/v1/debates/[id]/rounds/[roundId]/generate
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
