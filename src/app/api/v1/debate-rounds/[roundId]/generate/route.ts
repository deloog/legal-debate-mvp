import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { prisma } from '@/lib/db/prisma';
import {
  ArgumentSide,
  ArgumentType,
  RoundStatus,
  DebateStatus,
} from '@prisma/client';

/**
 * POST /api/v1/debate-rounds/[roundId]/generate
 * 生成辩论论点API
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ roundId: string }> }
  ) => {
    const { roundId } = await params;

    // 安全解析请求体，处理空请求体或解析错误
    let body: Record<string, unknown> = {};
    try {
      const parsedBody = await request.json();
      body =
        typeof parsedBody === 'object' && parsedBody !== null
          ? (parsedBody as Record<string, unknown>)
          : {};
    } catch {
      // JSON解析失败时使用空对象
      body = {};
    }

    // 获取辩论轮次信息
    const round = await prisma.debateRound.findUnique({
      where: { id: roundId },
      include: {
        debate: {
          include: {
            case: {
              include: {
                documents: {
                  where: {
                    analysisStatus: 'COMPLETED',
                  },
                },
              },
            },
          },
        },
        arguments: true,
      },
    });

    if (!round) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ROUND_NOT_FOUND',
            message: '辩论轮次不存在',
          },
        },
        { status: 404 }
      );
    }

    // 检查是否已经生成过论点
    const existingArguments = await prisma.argument.count({
      where: { roundId },
    });

    if (existingArguments > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ARGUMENTS_ALREADY_GENERATED',
            message: '论点已生成，无法重复生成',
          },
        },
        { status: 400 }
      );
    }

    // 获取适用法条，确保类型安全
    const articleIds =
      Array.isArray(body.applicableArticles) &&
      body.applicableArticles.every(
        (item): item is string => typeof item === 'string'
      )
        ? (body.applicableArticles as string[])
        : [];

    const articles = await prisma.lawArticle.findMany({
      where: {
        id: { in: articleIds },
      },
    });

    // 获取案件分析数据
    const caseData = round.debate.case;
    const claims = caseData.documents.flatMap(
      doc =>
        (
          doc.analysisResult as {
            extractedData?: {
              claims?: unknown[];
            };
          } | null
        )?.extractedData?.claims || []
    );
    const parties = caseData.documents.flatMap(
      doc =>
        (
          doc.analysisResult as {
            extractedData?: {
              parties?: unknown[];
            };
          } | null
        )?.extractedData?.parties || []
    );
    const keyFacts = caseData.documents.flatMap(
      doc =>
        (
          doc.analysisResult as {
            extractedData?: {
              keyFacts?: unknown[];
            };
          } | null
        )?.extractedData?.keyFacts || []
    );

    // 更新轮次状态为进行中
    await prisma.debateRound.update({
      where: { id: roundId },
      data: {
        status: RoundStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    // 生成论点
    const plaintiffArguments = generateSideArguments({
      side: 'PLAINTIFF',
      claims,
      parties,
      keyFacts,
      articles,
      roundNumber: round.roundNumber,
      roundId,
    });

    const defendantArguments = generateSideArguments({
      side: 'DEFENDANT',
      claims,
      parties,
      keyFacts,
      articles,
      roundNumber: round.roundNumber,
      roundId,
    });

    // 保存论点到数据库
    const allArguments = [...plaintiffArguments, ...defendantArguments];
    await prisma.argument.createMany({
      data: allArguments,
    });

    // 更新轮次状态为已完成
    await prisma.debateRound.update({
      where: { id: roundId },
      data: {
        status: RoundStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // 检查是否需要创建新轮次
    const debateConfig = round.debate.debateConfig as {
      maxRounds?: number;
    } | null;
    const maxRounds = debateConfig?.maxRounds || 3;

    if (round.roundNumber < maxRounds) {
      await prisma.debateRound.create({
        data: {
          debateId: round.debateId,
          roundNumber: round.roundNumber + 1,
          status: RoundStatus.PENDING,
        },
      });
    } else {
      // 更新辩论状态为已完成
      await prisma.debate.update({
        where: { id: round.debateId },
        data: {
          status: DebateStatus.COMPLETED,
        },
      });
    }

    return createSuccessResponse({
      plaintiff: {
        arguments: plaintiffArguments.map(arg => ({
          id: arg.id,
          type: arg.type,
          content: arg.content,
        })),
      },
      defendant: {
        arguments: defendantArguments.map(arg => ({
          id: arg.id,
          type: arg.type,
          content: arg.content,
        })),
      },
      roundId,
      roundNumber: round.roundNumber,
      generatedAt: new Date().toISOString(),
    });
  }
);

/**
 * OPTIONS /api/v1/debate-rounds/[roundId]/generate
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});

/**
 * 生成单方论点
 */
interface GenerateSideArgumentsInput {
  side: 'PLAINTIFF' | 'DEFENDANT';
  claims: unknown[];
  parties: unknown[];
  keyFacts: unknown[];
  articles: Array<{
    id: string;
    fullText: string;
    lawName: string;
    articleNumber: string;
  }>;
  roundNumber: number;
  roundId: string;
}

function generateSideArguments(input: GenerateSideArgumentsInput) {
  const { side, claims, parties, keyFacts, articles, roundId } = input;

  // 获取原告或被告名称
  const sideName = side === 'PLAINTIFF' ? '原告' : '被告';
  const partyName =
    (parties as { type: string; name: string }[]).find(
      p => p.type.toLowerCase() === side.toLowerCase()
    )?.name || sideName;

  const arguments_: Array<{
    id: string;
    roundId: string;
    side: ArgumentSide;
    content: string;
    type: ArgumentType;
    aiProvider: string;
    confidence: number;
  }> = [];

  // 为每个法条生成法律依据论点
  articles.slice(0, Math.min(articles.length, 3)).forEach(article => {
    const content = `${sideName}（${partyName}）主张：根据《${article.lawName}》${article.articleNumber}条规定，${article.fullText.substring(0, 50)}...，${side === 'PLAINTIFF' ? '请求法院支持原告诉请' : '请求法院驳回原告诉请'}。`;

    arguments_.push({
      id: `arg-${side}-${Date.now()}-${arguments_.length}`,
      roundId,
      side: side as ArgumentSide,
      content,
      type: ArgumentType.LEGAL_BASIS,
      aiProvider: 'DEEPSEEK',
      confidence: 0.8,
    });
  });

  // 生成主要论点（确保至少有一条论点）
  const claimContent = (claims as Array<{ content: string }>)[0]?.content;
  const mainContent = `${sideName}（${partyName}）的核心主张：${claimContent || '根据案件事实，${sideName}的请求具有充分的事实和法律依据'}。${side === 'PLAINTIFF' ? '请求法院依法支持原告的全部诉讼请求。' : '请求法院依法驳回原告的全部诉讼请求。'}`;

  arguments_.push({
    id: `arg-${side}-${Date.now()}-${arguments_.length}`,
    roundId,
    side: side as ArgumentSide,
    content: mainContent,
    type: ArgumentType.MAIN_POINT,
    aiProvider: 'DEEPSEEK',
    confidence: 0.85,
  });

  // 生成支持论点（确保至少有两条论点）
  const factContent = (keyFacts as { description?: string }[])[0]?.description;
  const supportContent = `${sideName}（${partyName}）的事实依据：${factContent || '根据本案查明的事实，能够充分支持${sideName}的主张'}。该事实与本案的争议焦点密切相关，具有重要的证明作用。`;

  arguments_.push({
    id: `arg-${side}-${Date.now()}-${arguments_.length}`,
    roundId,
    side: side as ArgumentSide,
    content: supportContent,
    type: ArgumentType.SUPPORTING,
    aiProvider: 'DEEPSEEK',
    confidence: 0.75,
  });

  return arguments_;
}
