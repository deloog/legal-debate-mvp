/**
 * SSE流式辩论生成API端点
 * 负责实时推送辩论生成过程
 */

import { AIClientFactory } from '@/lib/ai/clients';
import { prisma } from '@/lib/db/prisma';
import { DebateGenerator } from '@/lib/debate/debate-generator';
import { DebateStreamGenerator } from '@/lib/debate/stream/debate-stream-generator';
import type { ArgumentEventData } from '@/lib/debate/stream/types';
import { NextRequest } from 'next/server';

type StreamGeneratorConfig = {
  debateId: string;
  roundId: string;
  roundNumber: number;
  totalArguments: number;
  progressInterval: number;
};

/**
 * GET /api/debate/stream
 * SSE流式生成辩论（使用真实AI）
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
    async start(controller) {
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

      // 使用真实AI生成辩论
      await generateRealDebate(generator, controller, config);
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
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * 使用真实AI生成辩论
 */
async function generateRealDebate(
  generator: DebateStreamGenerator,
  controller: ReadableStreamDefaultController,
  config: StreamGeneratorConfig
) {
  try {
    // 发送连接确认
    generator.sendConnected();

    // 获取辩论和案件信息
    const debate = await prisma.debate.findUnique({
      where: { id: config.debateId },
      include: {
        case: true,
        rounds: {
          where: { id: config.roundId },
          include: { arguments: true },
        },
      },
    });

    if (!debate) {
      generator.sendError('DEBATE_NOT_FOUND', '辩论不存在');
      generator.cleanup();
      controller.close();
      return;
    }

    // 发送轮次开始
    generator.sendRoundStart();

    // 启动心跳
    generator.startHeartbeat(30000);

    // 初始化AI服务
    const aiClient = AIClientFactory.getClient('deepseek');

    // 创建辩论生成器
    const debateGenerator = new DebateGenerator(aiClient);

    // 构建辩论输入
    const caseInfo = debate.case;
    const lawArticles = await prisma.legalReference.findMany({
      where: { caseId: debate.caseId },
      take: 10,
    });

    const input = {
      caseInfo: {
        title: caseInfo.title,
        description: caseInfo.description,
        caseType: caseInfo.type,
        parties: {
          plaintiff: caseInfo.plaintiffName || '原告',
          defendant: caseInfo.defendantName || '被告',
        },
        claims: [],
        facts: [],
      },
      lawArticles: lawArticles.map(article => ({
        lawName: article.source || '法律',
        articleNumber: article.articleNumber || '',
        content: article.content,
        category: article.category || undefined,
      })),
    };

    // 发送进度更新
    generator.sendProgress('初始化AI服务', 5);

    // 生成辩论
    const result = await debateGenerator.generate(input);

    // 发送进度更新
    generator.sendProgress('生成论点中', 50);

    // 发送原告论点
    for (let i = 0; i < result.plaintiffArguments.length; i++) {
      const arg = result.plaintiffArguments[i];
      const argument: ArgumentEventData = {
        argumentId: arg.id,
        roundId: config.roundId,
        side: 'PLAINTIFF',
        content: arg.content,
        type: mapArgumentType(arg.type),
        timestamp: new Date().toISOString(),
        reasoning: arg.reasoning,
        legalBasis: arg.legalBasis,
        confidence: arg.overallScore,
      };

      generator.sendArgument(argument);
      await sleep(300);
      generator.sendProgress(
        `生成原告论点 ${i + 1}/${result.plaintiffArguments.length}`,
        50 + (i + 1) * 10
      );
    }

    // 发送被告论点
    for (let i = 0; i < result.defendantArguments.length; i++) {
      const arg = result.defendantArguments[i];
      const argument: ArgumentEventData = {
        argumentId: arg.id,
        roundId: config.roundId,
        side: 'DEFENDANT',
        content: arg.content,
        type: mapArgumentType(arg.type),
        timestamp: new Date().toISOString(),
        reasoning: arg.reasoning,
        legalBasis: arg.legalBasis,
        confidence: arg.overallScore,
      };

      generator.sendArgument(argument);
      await sleep(300);
      generator.sendProgress(
        `生成被告论点 ${i + 1}/${result.defendantArguments.length}`,
        80 + (i + 1) * 5
      );
    }

    // 发送完成事件
    generator.sendCompleted();

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
 * 映射论点类型
 */
function mapArgumentType(
  type: string
):
  | 'MAIN_POINT'
  | 'SUPPORTING'
  | 'REBUTTAL'
  | 'EVIDENCE'
  | 'LEGAL_BASIS'
  | 'CONCLUSION' {
  const typeMap: Record<
    string,
    | 'MAIN_POINT'
    | 'SUPPORTING'
    | 'REBUTTAL'
    | 'EVIDENCE'
    | 'LEGAL_BASIS'
    | 'CONCLUSION'
  > = {
    main_point: 'MAIN_POINT',
    supporting: 'SUPPORTING',
    rebuttal: 'REBUTTAL',
    evidence: 'EVIDENCE',
    conclusion: 'CONCLUSION',
  };

  return typeMap[type] || 'MAIN_POINT';
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
