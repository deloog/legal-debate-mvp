import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/app/api/lib/errors/api-error';
import { validatePathParam } from '@/app/api/lib/validation/validator';
import { uuidSchema } from '@/app/api/lib/validation/schemas';
import { prisma } from '@/lib/db/prisma';
import { getUnifiedAIService } from '@/lib/ai/unified-service';
import {
  DebateStatus,
  RoundStatus,
  ArgumentSide,
  ArgumentType,
} from '@prisma/client';

// 确保在Node.js环境中可以使用Web Streams API
const { ReadableStream } = globalThis;

/**
 * 从请求中提取关联ID
 */
function extractCorrelationId(request: NextRequest): string | undefined {
  // 从请求头获取
  const headerCorrelationId =
    request.headers.get('X-Correlation-ID') ||
    request.headers.get('x-correlation-id');
  if (headerCorrelationId) {
    return headerCorrelationId;
  }

  // 从查询参数获取
  const url = new URL(request.url);
  const queryCorrelationId = url.searchParams.get('correlationId');
  if (queryCorrelationId) {
    return queryCorrelationId;
  }

  return undefined;
}

/**
 * 创建标准化的流式错误事件
 */
function createStreamError(
  error: string | Error | ApiError,
  correlationId?: string,
  statusCode: number = 500,
  details?: Record<string, unknown>
): string {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorCode = error instanceof ApiError ? error.code : 'STREAM_ERROR';

  return `data: ${JSON.stringify({
    type: 'error',
    timestamp: new Date().toISOString(),
    correlationId,
    error: {
      code: errorCode,
      message: errorMessage,
      details,
      httpStatus: statusCode,
    },
  })}\n\n`;
}

/**
 * 解析AI生成的辩论论点
 * 这是一个简化的解析器，实际使用时需要根据AI服务的返回格式调整
 */
function parseDebateArguments(
  content: string
  // roundNumber: number,
): Array<{
  side: ArgumentSide;
  content: string;
  confidence: number;
}> {
  // 简化的论点解析逻辑
  // 实际实现中应该根据AI服务的具体返回格式进行解析
  const plaintiffRegex = /原告[：:]\s*([^。\n]+)[。\n]?/g;
  const defendantRegex = /被告[：:]\s*([^。\n]+)[。\n]?/g;

  const parsedArguments: Array<{
    side: ArgumentSide;
    content: string;
    confidence: number;
  }> = [];

  let match;

  // 解析原告论点
  while ((match = plaintiffRegex.exec(content)) !== null) {
    parsedArguments.push({
      side: ArgumentSide.PLAINTIFF,
      content: match[1].trim(),
      confidence: 0.85 + Math.random() * 0.1,
    });
  }

  // 解析被告论点
  while ((match = defendantRegex.exec(content)) !== null) {
    parsedArguments.push({
      side: ArgumentSide.DEFENDANT,
      content: match[1].trim(),
      confidence: 0.8 + Math.random() * 0.15,
    });
  }

  // 如果没有解析到论点，提供默认论点
  if (parsedArguments.length === 0) {
    parsedArguments.push(
      {
        side: ArgumentSide.PLAINTIFF,
        content: `基于案件事实和法律依据，原告的诉讼请求应当得到支持。`,
        confidence: 0.85,
      },
      {
        side: ArgumentSide.DEFENDANT,
        content: `原告的指控缺乏事实和法律依据，应当驳回其诉讼请求。`,
        confidence: 0.82,
      }
    );
  }

  return parsedArguments;
}

/**
 * GET /api/v1/debates/[id]/stream
 * 流式获取辩论内容
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 验证路径参数
  const params = await context.params;
  const debateId = validatePathParam(params.id, uuidSchema);

  // 预检：辩论是否存在 - 在流创建前检查
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      case: {
        select: {
          title: true,
          description: true,
        },
      },
      rounds: {
        include: {
          arguments: true,
        },
        orderBy: { roundNumber: 'desc' },
        take: 1,
      },
    },
  });

  if (!debate) {
    const correlationId = extractCorrelationId(request);
    return NextResponse.json(
      {
        error: 'Debate not found',
        correlationId,
        timestamp: new Date().toISOString(),
      },
      {
        status: 404,
        headers: { 'x-correlation-id': correlationId },
      }
    );
  }

  // 设置SSE响应头
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });

  // 创建SSE流
  let isStreamActive = true;
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 发送连接确认
        controller.enqueue(
          `data: ${JSON.stringify({
            type: 'connected',
            timestamp: new Date().toISOString(),
            debateId,
          })}\n\n`
        );

        // 获取AI服务实例
        const aiService = await getUnifiedAIService();

        // 确定当前轮次
        const currentRound = debate.currentRound;
        const maxRounds =
          (debate.debateConfig as { maxRounds?: number })?.maxRounds || 3;

        // 生成论点并流式传输
        for (
          let roundIndex = currentRound + 1;
          roundIndex <= maxRounds && isStreamActive;
          roundIndex++
        ) {
          // 发送轮次开始事件
          if (isStreamActive) {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'round_started',
                timestamp: new Date().toISOString(),
                debateId,
                roundNumber: roundIndex,
              })}\n\n`
            );
          }

          try {
            // 使用AI服务生成辩论论点
            const debateResponse = await aiService.generateDebate({
              title: debate.case.title,
              description: debate.case.description,
              legalReferences: [], // 可以从案件相关法条中获取
            });

            const debateContent =
              debateResponse.choices?.[0]?.message?.content || '';

            // 解析AI生成的论点（这里需要根据实际AI返回格式调整）
            const generatedArguments = parseDebateArguments(debateContent);

            // 保存轮次到数据库
            const newRound = await prisma.$transaction(async tx => {
              const round = await tx.debateRound.create({
                data: {
                  debateId,
                  roundNumber: roundIndex,
                  status: RoundStatus.IN_PROGRESS,
                  startedAt: new Date(),
                },
              });

              // 创建论点
              for (const arg of generatedArguments) {
                await tx.argument.create({
                  data: {
                    roundId: round.id,
                    side: arg.side,
                    content: arg.content,
                    type: ArgumentType.MAIN_POINT,
                    aiProvider: 'deepseek',
                    confidence: arg.confidence,
                  },
                });
              }

              // 更新辩论状态
              await tx.debate.update({
                where: { id: debateId },
                data: {
                  currentRound: roundIndex,
                  status: DebateStatus.IN_PROGRESS,
                  updatedAt: new Date(),
                },
              });

              return round;
            });

            // 流式发送论点
            for (const arg of generatedArguments) {
              if (isStreamActive) {
                controller.enqueue(
                  `data: ${JSON.stringify({
                    type: 'argument_generated',
                    timestamp: new Date().toISOString(),
                    debateId,
                    roundNumber: roundIndex,
                    argument: {
                      ...arg,
                      roundId: newRound.id,
                    },
                  })}\n\n`
                );
              }

              // 添加延迟以模拟真实的处理时间
              await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // 完成轮次
            await prisma.debateRound.update({
              where: { id: newRound.id },
              data: {
                status: RoundStatus.COMPLETED,
                completedAt: new Date(),
              },
            });

            if (isStreamActive) {
              controller.enqueue(
                `data: ${JSON.stringify({
                  type: 'round_completed',
                  timestamp: new Date().toISOString(),
                  debateId,
                  roundNumber: roundIndex,
                  summary: `第${roundIndex}轮辩论完成`,
                })}\n\n`
              );
            }
          } catch (aiError) {
            console.error('AI service error:', aiError);
            const correlationId = extractCorrelationId(request);
            const errorEvent = createStreamError(
              new ApiError(
                503,
                'AI_SERVICE_ERROR',
                'Failed to generate arguments',
                {
                  roundNumber: roundIndex,
                  originalError:
                    aiError instanceof Error
                      ? aiError.message
                      : 'Unknown error',
                }
              ),
              correlationId,
              503
            );

            // 直接发送错误事件
            if (isStreamActive) {
              try {
                controller.enqueue(errorEvent);
              } catch (enqueueError) {
                console.warn('Failed to enqueue AI error event:', enqueueError);
              }
            }

            isStreamActive = false;
            try {
              controller.close();
            } catch (closeError) {
              console.warn(
                'Failed to close stream after AI error:',
                closeError
              );
            }
            return;
          }
        }

        // 发送完成事件
        if (isStreamActive) {
          controller.enqueue(
            `data: ${JSON.stringify({
              type: 'completed',
              timestamp: new Date().toISOString(),
              debateId,
              totalRounds: maxRounds,
            })}\n\n`
          );
        }

        controller.close();
      } catch (error) {
        console.error('Stream error:', error);
        const correlationId = extractCorrelationId(request);
        const errorEvent = createStreamError(
          new ApiError(
            500,
            'STREAM_ERROR',
            error instanceof Error ? error.message : 'Unknown stream error',
            {
              debateId,
              originalError:
                error instanceof Error ? error.stack : 'Unknown error',
            }
          ),
          correlationId,
          500
        );

        if (isStreamActive) {
          try {
            controller.enqueue(errorEvent);
          } catch (enqueueError) {
            console.warn('Failed to enqueue stream error event:', enqueueError);
          }
        }

        isStreamActive = false;
        try {
          controller.close();
        } catch (closeError) {
          console.warn('Failed to close stream:', closeError);
        }
      }

      // 处理客户端断开连接
      request.signal.addEventListener('abort', () => {
        isStreamActive = false;
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers,
  });
}

/**
 * OPTIONS /api/v1/debates/[id]/stream
 * CORS预检请求
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
