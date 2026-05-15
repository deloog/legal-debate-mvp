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
import { getAuthUser } from '@/lib/middleware/auth';
import { moderateRateLimiter } from '@/lib/middleware/rate-limit';
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
import { canAccessDebateByCasePermission } from '@/lib/debate/access';
import { CasePermission } from '@/types/case-collaboration';
import { syncDebateLegalReferences } from '@/lib/debate/legal-reference-sync-service';

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
  // 速率限制（防止 AI 流式接口被滥用）
  const rateLimitResponse = await moderateRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const authUser = await getAuthUser(request);
  if (!authUser) {
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
      case: {
        select: { title: true, description: true, type: true, metadata: true },
      },
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

  const access = await canAccessDebateByCasePermission(
    authUser.userId,
    debateId,
    CasePermission.EDIT_DEBATES
  );
  if (!access.allowed) {
    return NextResponse.json(
      { error: '无权访问', code: 'FORBIDDEN', correlationId },
      { status: 403, headers: { 'x-correlation-id': correlationId ?? '' } }
    );
  }

  // ── 速率限制：60秒内完成轮次不超过5个 ──
  const recentRounds = await prisma.debateRound.count({
    where: {
      debate: { userId: authUser.userId },
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

  // ── AI 配额检查（与 /generate 路由保持一致）──
  const { checkAIQuota } = await import('@/lib/ai/quota');
  const quotaCheck = await checkAIQuota(authUser.userId, authUser.role);
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      {
        error: quotaCheck.reason,
        code: 'QUOTA_EXCEEDED',
        correlationId,
      },
      { status: 429, headers: { 'x-correlation-id': correlationId ?? '' } }
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

        // 用户本轮补充的理由/证据（第二轮及以后由用户填写，注入AI上下文）
        const userContext =
          new URL(request.url).searchParams.get('userContext') || '';

        const aiService = await getUnifiedAIService();
        const maxRounds =
          (debate.debateConfig as { maxRounds?: number })?.maxRounds || 3;
        // 本次仅处理下一个待生成的轮次（由用户手动触发后续轮次）
        const roundIndex = debate.currentRound + 1;

        if (roundIndex > maxRounds) {
          enqueue(
            sseEvent('completed', {
              debateId,
              maxRoundsReached: true,
              hasMoreRounds: false,
              timestamp: new Date().toISOString(),
            })
          );
          close();
          return;
        }

        // ── 获取案件已采纳证据（注入AI上下文，增强辩论依据）──
        const caseEvidence = await prisma.evidence.findMany({
          where: {
            caseId: debate.caseId,
            status: 'ACCEPTED',
            deletedAt: null,
          },
          select: { type: true, name: true, description: true },
          take: 6,
          orderBy: { createdAt: 'desc' },
        });
        const evidenceContext =
          caseEvidence.length > 0
            ? caseEvidence
                .map(
                  e =>
                    `- [${e.type}] ${e.name}${e.description ? '：' + e.description : ''}`
                )
                .join('\n')
            : '';

        // ── 预先检索法条 ──
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

        // 5. 发送法条检索完成事件（前端立即展示检索到的法条）
        enqueue(
          sseEvent('law-search-complete', {
            articles: lawArticles.map(a => ({
              lawName: a.lawName,
              articleNumber: a.articleNumber,
            })),
            count: lawArticles.length,
            timestamp: new Date().toISOString(),
          })
        );

        // ── 处理本轮次（单轮，由用户手动触发后续轮次）──
        {
          // ── 查找或创建轮次（幂等）──
          let roundRecord = await prisma.debateRound.findFirst({
            where: { debateId, roundNumber: roundIndex },
          });

          // 记录该轮次在本次 SSE 连接前是否已是 IN_PROGRESS（用于并发锁检查）
          const wasAlreadyInProgress =
            roundRecord?.status === RoundStatus.IN_PROGRESS;

          if (!roundRecord) {
            // 新建轮次，直接设 IN_PROGRESS + startedAt（隐含声明了锁）
            roundRecord = await prisma.debateRound.create({
              data: {
                debateId,
                roundNumber: roundIndex,
                status: RoundStatus.IN_PROGRESS,
                startedAt: new Date(),
              },
            });
          } else if (roundRecord.status === RoundStatus.COMPLETED) {
            // 已完成轮次：通知前端该轮已完成，无需重新生成
            enqueue(
              sseEvent('completed', {
                debateId,
                roundNumber: roundIndex,
                hasMoreRounds: roundIndex < maxRounds,
                isLastRound: roundIndex >= maxRounds,
                alreadyCompleted: true,
                timestamp: new Date().toISOString(),
              })
            );
            close();
            return;
          } else if (roundRecord.status === RoundStatus.FAILED) {
            // FAILED 轮次不自动重试，等待用户通过 PATCH 手动重置后重试
            // 若此处自动重试，会导致：error → server close → client reconnect → 重试 → error → 死循环
            logger.warn(
              `[stream] 第${roundIndex}轮状态为 FAILED，跳过（需用户手动重试）`
            );
            enqueue(
              sseError(
                new ApiError(
                  409,
                  'ROUND_FAILED',
                  '本轮生成已失败，请点击"重新生成"按钮手动重试。',
                  { roundNumber: roundIndex }
                ),
                correlationId,
                409
              )
            );
            close();
            return;
          } else if (roundRecord.status === RoundStatus.PENDING) {
            // PENDING → IN_PROGRESS，同时声明软锁
            roundRecord = await prisma.debateRound.update({
              where: { id: roundRecord.id },
              data: { status: RoundStatus.IN_PROGRESS, startedAt: new Date() },
            });
          }
          // IN_PROGRESS：已存在，走并发锁检查（见下方）

          // ── 并发锁：对已存在的 IN_PROGRESS 轮次声明生成权 ──
          // 新建和 PENDING 激活的轮次在上方已原子性写入 startedAt，无需重复检查
          if (wasAlreadyInProgress) {
            const lockClaimed = await prisma.debateRound.updateMany({
              where: {
                id: roundRecord.id,
                status: RoundStatus.IN_PROGRESS,
                OR: [
                  { startedAt: null },
                  { startedAt: { lt: new Date(Date.now() - 180_000) } }, // 3分钟超时
                ],
              },
              data: { startedAt: new Date() },
            });
            if (lockClaimed.count === 0) {
              logger.warn(
                `[stream] 第${roundIndex}轮并发锁被占用，跳过（可能存在并发 SSE 连接）`
              );
              enqueue(
                sseError(
                  new ApiError(
                    409,
                    'ROUND_LOCKED',
                    '本轮正在生成中，请稍后刷新页面查看结果。',
                    { roundNumber: roundIndex }
                  ),
                  correlationId,
                  409
                )
              );
              close();
              return;
            }
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

          // ── 读取单边流式内容的辅助函数 ──
          // 读取 generateSideStreamLegacy 输出的 SSE 流，
          // 实时转发 ai_stream 事件给客户端，返回完整 AI 文本供解析。
          const readSideContent = async (
            sideStream: ReadableStream,
            sideLabel: string,
            chunkIdRef: { value: number },
            sideKey: 'plaintiff' | 'defendant'
          ): Promise<string> => {
            const reader = sideStream.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = '';
            let completeContent = '';

            while (isStreamActive) {
              const { done, value } = await reader.read();
              if (done) break;

              sseBuffer += decoder.decode(value, { stream: true });
              const events = sseBuffer.split('\n\n');
              sseBuffer = events.pop() ?? '';

              for (const eventStr of events) {
                const dataLine = eventStr
                  .split('\n')
                  .find(l => l.startsWith('data: '));
                if (!dataLine) continue;

                let eventData: {
                  type?: string;
                  content?: string;
                  side?: string;
                } | null = null;
                try {
                  eventData = JSON.parse(dataLine.slice(6)) as {
                    type?: string;
                    content?: string;
                    side?: string;
                  };
                } catch {
                  continue;
                }

                if (eventData.type === 'complete' && eventData.content) {
                  completeContent = eventData.content;
                } else if (eventData.type === 'content' && eventData.content) {
                  chunkIdRef.value++;
                  enqueue(
                    sseEvent('ai_stream', {
                      chunkId: chunkIdRef.value,
                      content: eventData.content,
                      side: sideKey,
                      sideLabel,
                      roundNumber: roundIndex,
                      timestamp: new Date().toISOString(),
                    })
                  );
                }
              }
            }
            return completeContent;
          };

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

          // 保存论点并推送 argument 事件的辅助函数
          const saveAndPushArgs = async (
            tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
            args: ParsedArg[],
            totalArgCount: number,
            argOffset: number
          ) => {
            for (let i = 0; i < args.length; i++) {
              const arg = args[i];
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

              const argProgress = ((argOffset + i + 1) / totalArgCount) * 90;
              enqueue(
                sseEvent('progress', {
                  debateId,
                  roundId,
                  progress: Math.round(argProgress),
                  currentStep: `生成${arg.side === 'PLAINTIFF' ? '原告' : '被告'}论点`,
                  totalSteps: totalArgCount,
                  timestamp: new Date().toISOString(),
                })
              );
            }
          };

          try {
            // 清除旧论点（重试场景）
            await prisma.argument.deleteMany({ where: { roundId } });

            // 从 Case.metadata.extractionSnapshot 提取辩论上下文
            const caseMeta =
              debate.case.metadata && typeof debate.case.metadata === 'object'
                ? (debate.case.metadata as Record<string, unknown>)
                : {};
            const snap = caseMeta['extractionSnapshot'] as
              | {
                  disputeFocuses?: string[];
                  establishedFacts?: string[];
                  uncertainFacts?: string[];
                }
              | undefined;

            const commonParams = {
              title: debate.case.title,
              description: enhancedDescription,
              legalReferences: legalReferencesForAI,
              previousRoundsContext: previousRoundsContext || undefined,
              evidenceContext: evidenceContext || undefined,
              userRoundContext: userContext || undefined,
              disputeFocuses: snap?.disputeFocuses?.length
                ? snap.disputeFocuses
                : undefined,
              establishedFacts: snap?.establishedFacts?.length
                ? snap.establishedFacts
                : undefined,
              uncertainFacts: snap?.uncertainFacts?.length
                ? snap.uncertainFacts
                : undefined,
            };
            const chunkIdRef = { value: 0 };

            // ── 阶段1：生成原告论点 ──
            enqueue(
              sseEvent('progress', {
                debateId,
                roundId,
                progress: 5,
                currentStep: '原告方陈述论点...',
                timestamp: new Date().toISOString(),
              })
            );
            const plaintiffStream = await aiService.generateSideStreamLegacy(
              commonParams,
              'plaintiff'
            );
            const plaintiffContent = await readSideContent(
              plaintiffStream,
              '原告',
              chunkIdRef,
              'plaintiff'
            );

            const plaintiffArgs = plaintiffContent
              ? parseStructuredDebateArguments(plaintiffContent)
              : null;

            if (!plaintiffArgs || plaintiffArgs.length < 1) {
              logger.error(
                `[stream] 第${roundIndex}轮原告论点解析失败，原始内容前200字:`,
                plaintiffContent.substring(0, 200)
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
                    'AI返回原告论点格式异常，无法解析。轮次已标记为失败，请重新生成。',
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

            // 保存原告论点，立即推送到前端（用户先看到原告）
            await prisma.$transaction(async tx => {
              await saveAndPushArgs(
                tx,
                plaintiffArgs,
                plaintiffArgs.length * 2,
                0
              );
            });

            // ── 阶段2：生成被告论点（传入原告论点作为上下文）──
            const plaintiffContext = plaintiffArgs
              .map((a, i) => `${i + 1}. ${a.content}`)
              .join('\n');

            enqueue(
              sseEvent('progress', {
                debateId,
                roundId,
                progress: 50,
                currentStep: '被告方针对原告主张进行回应...',
                timestamp: new Date().toISOString(),
              })
            );
            const defendantStream = await aiService.generateSideStreamLegacy(
              commonParams,
              'defendant',
              plaintiffContext
            );
            const defendantContent = await readSideContent(
              defendantStream,
              '被告',
              chunkIdRef,
              'defendant'
            );

            const defendantArgs = defendantContent
              ? parseStructuredDebateArguments(defendantContent)
              : null;

            if (!defendantArgs || defendantArgs.length < 1) {
              logger.error(
                `[stream] 第${roundIndex}轮被告论点解析失败，原始内容前200字:`,
                defendantContent.substring(0, 200)
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
                    'AI返回被告论点格式异常，无法解析。轮次已标记为失败，请重新生成。',
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

            // 保存被告论点并完成轮次
            await prisma.$transaction(async tx => {
              await saveAndPushArgs(
                tx,
                defendantArgs,
                plaintiffArgs.length + defendantArgs.length,
                plaintiffArgs.length
              );

              await tx.debateRound.update({
                where: { id: roundId },
                data: {
                  status: RoundStatus.COMPLETED,
                  completedAt: new Date(),
                },
              });

              await tx.debate.update({
                where: { id: debateId },
                data: {
                  currentRound: roundIndex,
                  status: DebateStatus.IN_PROGRESS,
                  updatedAt: new Date(),
                },
              });
            });

            syncDebateLegalReferences(debate.caseId, roundId, [
              ...plaintiffArgs.map(arg => ({
                side: arg.side,
                legalBasis: arg.legalBasis,
              })),
              ...defendantArgs.map(arg => ({
                side: arg.side,
                legalBasis: arg.legalBasis,
              })),
            ]).catch((err: unknown) => {
              logger.warn(
                `[stream] 辩论法条引用沉淀失败 [${debateId}/${roundId}]:`,
                err
              );
            });

            // fire-and-forget：每轮完成后自动生成辩论摘要
            import('@/lib/debate/debate-summary-service')
              .then(({ autoGenerateDebateSummary }) =>
                autoGenerateDebateSummary(debateId)
              )
              .catch((err: unknown) => {
                logger.warn(
                  `[stream] 自动辩论摘要 fire-and-forget 失败 [${debateId}]:`,
                  err
                );
              });
          } catch (aiError) {
            const errDetail =
              aiError instanceof Error ? aiError.message : String(aiError);
            logger.error(`[stream] 第${roundIndex}轮 AI 生成失败:`, aiError);
            enqueue(
              sseError(
                new ApiError(
                  503,
                  'AI_SERVICE_ERROR',
                  `AI 生成失败：${errDetail}`,
                  { roundNumber: roundIndex }
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

        // 本轮生成完毕，通知前端；是否继续由用户决定
        if (isStreamActive) {
          const isLastRound = roundIndex >= maxRounds;
          if (isLastRound) {
            // 已达最大轮次，将辩论标记为 COMPLETED
            await prisma.debate.update({
              where: { id: debateId },
              data: { status: DebateStatus.COMPLETED, updatedAt: new Date() },
            });
          }
          enqueue(
            sseEvent('completed', {
              debateId,
              roundNumber: roundIndex,
              hasMoreRounds: !isLastRound,
              isLastRound,
              timestamp: new Date().toISOString(),
            })
          );
        }
        close();
      } catch (error) {
        logger.error('[stream] 全局错误:', error);
        enqueue(
          sseError(
            new ApiError(500, 'STREAM_ERROR', 'Unknown stream error', {
              debateId,
            }),
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
