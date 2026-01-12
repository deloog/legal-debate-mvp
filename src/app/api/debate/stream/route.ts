/**
 * SSE流式辩论生成API端点
 * 负责实时推送辩论生成过程
 */

import { NextRequest } from 'next/server';
import { DebateStreamGenerator } from '@/lib/debate/stream/debate-stream-generator';
import type { ArgumentEventData } from '@/lib/debate/stream/types';

type StreamGeneratorConfig = {
  debateId: string;
  roundId: string;
  roundNumber: number;
  totalArguments: number;
  progressInterval: number;
};

/**
 * GET /api/debate/stream
 * SSE流式生成辩论
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const debateId = searchParams.get('debateId');
  const roundId = searchParams.get('roundId');
  const roundNumber = parseInt(searchParams.get('roundNumber') || '1', 10);
  const totalArguments = parseInt(
    searchParams.get('totalArguments') || '4',
    10
  );

  // 验证必需参数
  if (!debateId || !roundId) {
    return new Response(
      JSON.stringify({ error: '缺少必需参数: debateId, roundId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 创建可读流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sessionId = `sse-${debateId}-${Date.now()}`;
      const config = {
        debateId,
        roundId,
        roundNumber,
        totalArguments,
        progressInterval: 1000,
      } as StreamGeneratorConfig;

      const generator = new DebateStreamGenerator(
        sessionId,
        config,
        (data: string) => {
          controller.enqueue(encoder.encode(data));
        }
      );

      // 模拟辩论生成过程
      simulateDebateGeneration(generator, controller, config);
    },
    cancel() {
      // 清理资源
    },
  });

  // 返回SSE响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用Nginx缓冲
    },
  });
}

/**
 * 模拟辩论生成过程
 */
async function simulateDebateGeneration(
  generator: DebateStreamGenerator,
  controller: ReadableStreamDefaultController,
  config: StreamGeneratorConfig
) {
  try {
    // 发送连接确认
    generator.sendConnected();
    await sleep(100);

    // 发送轮次开始
    generator.sendRoundStart();
    await sleep(100);

    // 启动心跳
    generator.startHeartbeat(30000);

    // 模拟生成论点
    const sides = ['PLAINTIFF', 'DEFENDANT'];
    const argumentTypes = ['MAIN_POINT', 'SUPPORTING', 'REBUTTAL'];

    for (let i = 0; i < 4; i++) {
      const side = sides[i % 2] as 'PLAINTIFF' | 'DEFENDANT';
      const argument: ArgumentEventData = {
        argumentId: `arg-${Date.now()}-${i}`,
        roundId: config.roundId,
        side,
        content: `这是${side === 'PLAINTIFF' ? '原告' : '被告'}的第${Math.floor(i / 2) + 1}个论点，详细阐述了相关法律条款和事实依据。`,
        type: argumentTypes[i % argumentTypes.length] as
          | 'MAIN_POINT'
          | 'SUPPORTING'
          | 'REBUTTAL',
        timestamp: new Date().toISOString(),
      };

      generator.sendArgument(argument);
      await sleep(500);
    }

    // 发送完成事件
    generator.sendCompleted();
    await sleep(100);

    // 清理资源
    generator.cleanup();
    controller.close();
  } catch (error) {
    generator.sendError(
      'GENERATION_ERROR',
      '生成过程中发生错误',
      error instanceof Error ? error.message : String(error)
    );
    generator.cleanup();
    controller.close();
  }
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
