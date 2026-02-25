/**
 * 辩论流式生成API路由
 *
 * GET /api/v1/debates/[id]/stream
 *
 * 功能：
 * 1. 通过SSE (Server-Sent Events) 实时流式推送辩论生成进度
 * 2. 支持多轮次辩论的连续生成
 * 3. 集成关键词搜索和图谱增强搜索获取相关法条
 * 4. 实时推送AI生成的原始token和解析后的论点
 * 5. 自动计算和保存论点评分（逻辑分、法律分、综合分）
 *
 * SSE事件类型：
 * - connected: 连接建立确认
 * - round-start: 轮次开始
 * - ai_stream: AI原始token（实时）
 * - argument: 单个论点（已解析，含side/content/reasoning/legalBasis/scores）
 * - progress: 进度更新（0-100%）
 * - completed: 整体完成
 * - error: 错误信息
 *
 * 安全机制：
 * - 用户认证和授权检查
 * - 所有权验证（仅允许访问自己的辩论）
 * - 速率限制（60秒内最多5个轮次）
 *
 * 法条检索策略：
 * 1. 关键词搜索（6条）
 * 2. 图谱增强搜索（500ms超时）
 * 3. 将图谱分析结果注入AI上下文
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/app/api/lib/errors/api-error';
import { validatePathParam } from '@/app/api/lib/validation/validator';
import { uuidSchema } from '@/app/api/lib/validation/schemas';
import { prisma } from '@/lib/db/prisma';
import { getUnifiedAIService } from '@/lib/ai/unified-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { searchAllLawArticles } from '@/lib/debate/law-search';
import { computeArgumentScores } from '@/lib/debate/scoring';
import {
  graphEnhancedSearch,
  formatGraphAnalysisForPrompt,
} from '@/lib/debate/graph-enhanced-law-search';
import {
  DebateStatus,
  RoundStatus,
  ArgumentSide,
  ArgumentType,
  Prisma,
} from '@prisma/client';
import { logger } from '@/lib/logger';

// 确保在 Node.js 环境中可以使用 Web Streams API
const { ReadableStream } = globalThis;

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 从请求中提取关联 ID
 */
function extractCorrelationId(request: NextRequest): string | undefined {
  return (
    request.headers.get('X-Correlation-ID') ||
    request.headers.get('x-correlation-id') ||
    new URL(request.url).searchParams.get('correlationId') ||
    undefined
  );
}

/**
 * 构建标准 SSE 命名事件字符串（符合 W3C SSE 规范）
 */
function sseEvent(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * 构建 SSE 错误事件
 */
function sseError(
  error: string | Error | ApiError,
  correlationId?: string,
  statusCode = 500,
  details?: Record<string, unknown>
): string {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorCode = error instanceof ApiError ? error.code : 'STREAM_ERROR';
  return sseEvent('error', {
    code: errorCode,
    message: errorMessage,
    httpStatus: statusCode,
    details,
    correlationId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 构建前轮辩论上下文摘要（截断200字，与 /generate 路由保持一致）
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
      arguments: { orderBy: { createdAt: 'asc' }, take: 10 },
    },
    orderBy: { roundNumber: 'asc' },
  });

  if (previousRounds.length === 0) return null;

  const contextParts: string[] = [];
  for (const round of previousRounds) {
    const plaintiffSummary = round.arguments
      .filter(a => a.side === 'PLAINTIFF')
      .map(
        a =>
          `  - ${a.content.length > 200 ? a.content.substring(0, 200) + '…' : a.content}`
      )
      .join('\n');
    const defendantSummary = round.arguments
      .filter(a => a.side === 'DEFENDANT')
      .map(
        a =>
          `  - ${a.content.length > 200 ? a.content.substring(0, 200) + '…' : a.content}`
      )
      .join('\n');

    contextParts.push(
      `### 第${round.roundNumber}轮\n原告方：\n${plaintiffSummary || '  （无）'}\n被告方：\n${defendantSummary || '  （无）'}`
    );
  }
  return contextParts.join('\n\n');
}

/**
 * 解析 AI 返回的结构化 JSON 论点（与 /generate 路由保持一致）
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

    const mapLegalBasis = (
      raw: unknown[]
    ): Array<{
      lawName: string;
      articleNumber: string;
      relevance: number;
      explanation: string;
    }> =>
      (
        raw as Array<{
          lawName?: string;
          articleNumber?: string;
          relevance?: number;
          explanation?: string;
        }>
      )
        .filter(b => b.lawName)
        .map(b => ({
          lawName: String(b.lawName || ''),
          articleNumber: String(b.articleNumber || ''),
          relevance: Number(b.relevance ?? 0.8),
          explanation: String(b.explanation || ''),
        }));

    if (Array.isArray(parsed.plaintiff)) {
      for (const arg of parsed.plaintiff) {
        if (typeof arg.content === 'string' && arg.content.trim()) {
          results.push({
            side: ArgumentSide.PLAINTIFF,
            content: arg.content.trim(),
            type: ArgumentType.MAIN_POINT,
            confidence: 0.88,
            reasoning:
              typeof arg.reasoning === 'string' ? arg.reasoning : undefined,
            legalBasis: Array.isArray(arg.legalBasis)
              ? mapLegalBasis(arg.legalBasis)
              : [],
          });
        }
      }
    }
    if (Array.isArray(parsed.defendant)) {
      for (const arg of parsed.defendant) {
        if (typeof arg.content === 'string' && arg.content.trim()) {
          results.push({
            side: ArgumentSide.DEFENDANT,
            content: arg.content.trim(),
            type: ArgumentType.MAIN_POINT,
            confidence: 0.85,
            reasoning:
              typeof arg.reasoning === 'string' ? arg.reasoning : undefined,
            legalBasis: Array.isArray(arg.legalBasis)
              ? mapLegalBasis(arg.legalBasis)
              : [],
          });
        }
      }
    }

    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}

// =============================================================================
// GET handler
// =============================================================================

/**
 * GET /api/v1/debates/[id]/stream
 *
 * SSE 流式推送辩论生成进度。
 *
 * 事件序列（均为命名事件，客户端通过 addEventListener('<name>', ...) 接收）：
 *   connected       → 连接建立确认
 *   round-start     → 轮次开始
 *   ai_stream       → AI 原始 token（实时）
 *   argument        → 单个论点（已解析，含 side/content/reasoning/legalBasis）
 *   progress        → 进度更新
 *   completed       → 整体完成
 *   error           → 错误
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: '未认证', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const params = await context.params;
  const debateId = validatePathParam(params.id, uuidSchema);
  const correlationId = extractCorrelationId(request);

  // 预检：辩论是否存在，同时取 userId + case.type 用于检索和所有权验证
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      case: { select: { title: true, description: true, type: true } },
    },
  });

  if (!debate) {
    return NextResponse.json(
      {
        error: 'Debate not found',
        correlationId,
        timestamp: new Date().toISOString(),
      },
      { status: 404, headers: { 'x-correlation-id': correlationId ?? '' } }
    );
  }

  const isAdmin = (session.user as { role?: string }).role === 'ADMIN';
  if (debate.userId !== session.user.id && !isAdmin) {
    return NextResponse.json(
      { error: '无权访问', code: 'FORBIDDEN', correlationId },
      { status: 403, headers: { 'x-correlation-id': correlationId ?? '' } }
    );
  }

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
        error: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMITED',
        correlationId,
      },
      { status: 429 }
    );
  }

  const allowedOrigin =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲，保证实时推送
  });

  let isStreamActive = true;
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => {
        if (isStreamActive) {
          try {
            controller.enqueue(chunk);
          } catch {
            // 客户端已断开
          }
        }
      };

      const close = () => {
        isStreamActive = false;
        try {
          controller.close();
        } catch {
          /* 已关闭 */
        }
      };

      try {
        // 连接确认
        enqueue(
          sseEvent('connected', {
            debateId,
            timestamp: new Date().toISOString(),
          })
        );

        const aiService = await getUnifiedAIService();
        const maxRounds =
          (debate.debateConfig as { maxRounds?: number })?.maxRounds || 3;
        const startFromRound = debate.currentRound + 1;

        // ── 预先检索法条（所有轮次共用同一套法条上下文）──
        // 1. 先执行关键词搜索
        const { articles: lawArticles } = await searchAllLawArticles(
          debate.case.type ?? null,
          debate.case.title,
          debate.case.description,
          6,
          4
        );
        const legalReferencesForAI = lawArticles.map(
          a => `《${a.lawName}》${a.articleNumber}`
        );
        if (lawArticles.length > 0) {
          logger.info(
            `[stream] 检索到 ${lawArticles.length} 条相关法条，注入AI上下文`
          );
        }

        // 2. 并行执行图谱增强搜索（带500ms超时）
        const graphSearchResult = await graphEnhancedSearch(
          debate.case.type ?? null,
          debate.case.title,
          { timeoutMs: 500, includeAttackPaths: true }
        );

        // 3. 如果图谱分析完成，注入额外信息
        let graphAnalysisPrompt = '';
        if (graphSearchResult.graphAnalysisCompleted) {
          graphAnalysisPrompt = formatGraphAnalysisForPrompt(graphSearchResult);
          logger.info(
            `[stream] 图谱分析完成，支持法条: ${graphSearchResult.supportingArticles.length}, 对方法条: ${graphSearchResult.opposingArticles.length}`
          );
        } else {
          logger.warn(`[stream] 图谱分析超时，仅使用关键词检索`);
        }

        // 4. 将图谱分析结果添加到description中（用于AI理解法条关系）
        let enhancedDescription = debate.case.description || '';
        if (graphAnalysisPrompt) {
          enhancedDescription = `${enhancedDescription}\n\n${graphAnalysisPrompt}`;
        }

        // 5. 标记信息来源（用于前端显示）
        const ___sourceAttribution = graphSearchResult.sourceAttribution;

        for (
          let roundIndex = startFromRound;
          roundIndex <= maxRounds && isStreamActive;
          roundIndex++
        ) {
          // ── 查找或创建轮次（幂等，避免与 /generate 路由冲突）──
          let roundRecord = await prisma.debateRound.findFirst({
            where: { debateId, roundNumber: roundIndex },
          });

          if (!roundRecord) {
            roundRecord = await prisma.debateRound.create({
              data: {
                debateId,
                roundNumber: roundIndex,
                status: RoundStatus.IN_PROGRESS,
                startedAt: new Date(),
              },
            });
          } else if (roundRecord.status === RoundStatus.COMPLETED) {
            // 已完成的轮次跳过（避免重复生成）
            continue;
          }

          const roundId = roundRecord.id;

          // 发送 round-start 事件
          enqueue(
            sseEvent('round-start', {
              debateId,
              roundId,
              roundNumber: roundIndex,
              timestamp: new Date().toISOString(),
            })
          );

          // ── 构建前轮上下文 ──
          const previousRoundsContext = await buildPreviousRoundsContext(
            debateId,
            roundIndex
          );
          if (previousRoundsContext) {
            logger.info(
              `[stream] 已构建第${roundIndex}轮前置上下文（前${roundIndex - 1}轮）`
            );
          }

          try {
            // ── 调用 AI 流式生成（注入法条引用 + 图谱分析）──
            const debateStream = await aiService.generateDebateStreamLegacy({
              title: debate.case.title,
              description: enhancedDescription,
              legalReferences: legalReferencesForAI,
              previousRoundsContext: previousRoundsContext || undefined,
            });

            const reader = debateStream.getReader();
            const decoder = new TextDecoder();
            let debateContent = '';
            let chunkId = 0;
            const totalEstimate = 3000; // 预估 token 数（用于进度计算）

            // 实时转发 AI token
            while (isStreamActive) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = decoder.decode(value, { stream: true });
              debateContent += text;
              chunkId++;

              enqueue(
                sseEvent('ai_stream', {
                  chunkId,
                  content: text,
                  accumulatedLength: debateContent.length,
                  progress: Math.min(
                    (debateContent.length / totalEstimate) * 80,
                    80
                  ),
                  roundNumber: roundIndex,
                  timestamp: new Date().toISOString(),
                })
              );
            }

            // ── 解析论点 ──
            const structuredArgs = debateContent
              ? parseStructuredDebateArguments(debateContent)
              : null;

            type ParsedArg = {
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
            };

            // 解析失败 → 标记轮次 FAILED，不插入任何假内容
            if (!structuredArgs || structuredArgs.length < 2) {
              logger.error(
                `[stream] 第${roundIndex}轮论点解析失败，原始内容前200字:`,
                debateContent.substring(0, 200)
              );
              await prisma.debateRound.update({
                where: { id: roundId },
                data: { status: RoundStatus.FAILED },
              });
              enqueue(
                sseError(
                  new ApiError(
                    422,
                    'PARSE_FAILED',
                    'AI返回内容格式异常，无法解析论点。轮次已标记为失败，请重新生成。',
                    { roundNumber: roundIndex }
                  ),
                  correlationId,
                  422
                )
              );
              isStreamActive = false;
              close();
              return;
            }

            const generatedArguments: ParsedArg[] = structuredArgs;

            // ── 保存到数据库（事务）+ 推送 argument 事件 ──
            await prisma.$transaction(async tx => {
              // 清除该轮次的旧论点（重试场景）
              await tx.argument.deleteMany({ where: { roundId } });

              for (const arg of generatedArguments) {
                const scores = computeArgumentScores({
                  reasoning: arg.reasoning,
                  legalBasis: arg.legalBasis,
                  confidence: arg.confidence,
                });

                const created = await tx.argument.create({
                  data: {
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
                  },
                });

                // 每个论点生成后立即推送 argument 事件
                enqueue(
                  sseEvent('argument', {
                    argumentId: created.id,
                    roundId,
                    side: arg.side,
                    content: arg.content,
                    type: arg.type,
                    reasoning: arg.reasoning,
                    legalBasis: arg.legalBasis,
                    confidence: arg.confidence,
                    logicScore: scores.logicScore,
                    legalScore: scores.legalScore,
                    overallScore: scores.overallScore,
                    timestamp: new Date().toISOString(),
                  })
                );

                // 每个论点间隔推送进度
                const argProgress =
                  80 +
                  ((generatedArguments.indexOf(arg) + 1) /
                    generatedArguments.length) *
                    20;
                enqueue(
                  sseEvent('progress', {
                    debateId,
                    roundId,
                    progress: Math.round(argProgress),
                    currentStep: `生成${arg.side === 'PLAINTIFF' ? '原告' : '被告'}论点`,
                    totalSteps: generatedArguments.length,
                    timestamp: new Date().toISOString(),
                  })
                );
              }

              // 更新轮次状态
              await tx.debateRound.update({
                where: { id: roundId },
                data: {
                  status: RoundStatus.COMPLETED,
                  completedAt: new Date(),
                },
              });

              // 更新辩论当前轮次
              await tx.debate.update({
                where: { id: debateId },
                data: {
                  currentRound: roundIndex,
                  status: DebateStatus.IN_PROGRESS,
                  updatedAt: new Date(),
                },
              });
            });
          } catch (aiError) {
            logger.error(`[stream] 第${roundIndex}轮 AI 生成失败:`, aiError);
            enqueue(
              sseError(
                new ApiError(
                  503,
                  'AI_SERVICE_ERROR',
                  'Failed to generate arguments',
                  {
                    roundNumber: roundIndex,
                    originalError:
                      aiError instanceof Error ? aiError.message : 'Unknown',
                  }
                ),
                correlationId,
                503
              )
            );
            isStreamActive = false;
            close();
            return;
          }
        }

        // 全部轮次完成 → 标记辩论为 COMPLETED
        if (isStreamActive) {
          await prisma.debate.update({
            where: { id: debateId },
            data: { status: DebateStatus.COMPLETED, updatedAt: new Date() },
          });
          enqueue(
            sseEvent('completed', {
              debateId,
              totalRounds: maxRounds,
              timestamp: new Date().toISOString(),
            })
          );
        }
        close();
      } catch (error) {
        logger.error('[stream] 全局错误:', error);
        enqueue(
          sseError(
            new ApiError(
              500,
              'STREAM_ERROR',
              error instanceof Error ? error.message : 'Unknown stream error',
              { debateId }
            ),
            correlationId,
            500
          )
        );
        close();
      }

      // 客户端断开时清理
      request.signal.addEventListener('abort', () => {
        isStreamActive = false;
      });
    },
  });

  return new NextResponse(stream, { headers });
}

/**
 * OPTIONS /api/v1/debates/[id]/stream
 */
export async function OPTIONS() {
  const allowedOrigin =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
