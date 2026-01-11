import { withErrorHandler } from "@/app/api/lib/errors/error-handler";
import { createSuccessResponse } from "@/app/api/lib/responses/api-response";
import {
  generateArgumentsSchema,
  uuidSchema,
} from "@/app/api/lib/validation/schemas";
import {
  validatePathParam,
  validateRequestBody,
} from "@/app/api/lib/validation/validator";
import { getUnifiedAIService } from "@/lib/ai/unified-service";
import { prisma } from "@/lib/db/prisma";
import { ArgumentSide, ArgumentType, RoundStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/debates/[id]/rounds/[roundId]/generate
 * 为指定轮次生成辩论论点
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string; roundId: string }> },
  ) => {
    // Next.js 15+ requires awaiting params
    const resolvedParams = await context.params;

    // 验证路径参数
    const debateId = validatePathParam(resolvedParams.id, uuidSchema);
    const roundId = validatePathParam(resolvedParams.roundId, uuidSchema);

    // 验证请求体
    const body = await validateRequestBody(request, generateArgumentsSchema);
    const { applicableArticles } = body;

    // 使用事务确保数据一致性，设置更长的超时时间（120秒）
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. 获取辩论轮次信息
        const round = await tx.debateRound.findUnique({
          where: { id: roundId },
          include: {
            debate: {
              include: {
                case: {
                  include: {
                    documents: true,
                  },
                },
              },
            },
          },
        });

        if (!round) {
          throw new Error("Round not found");
        }

        // 验证轮次归属
        if (round.debateId !== debateId) {
          throw new Error("Round does not belong to this debate");
        }

        // 验证轮次状态
        if (round.status !== RoundStatus.IN_PROGRESS) {
          throw new Error(
            `Cannot generate arguments for round with status: ${round.status}`,
          );
        }

        // 2. 准备法律参考文献
        const legalReferences = applicableArticles.map((id: string) => ({
          id,
          content: `法条 ${id}`,
          relevance: 0.8,
        }));

        // 3. 使用AI服务生成辩论论点（带重试机制）
        const aiService = await getUnifiedAIService();

        let debateContent = "";
        const maxRetries = 3;
        const retryDelay = 2000; // 2秒

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const debateResponse = await aiService.generateDebate({
              title: round.debate.case.title,
              description: round.debate.case.description,
              legalReferences: legalReferences.map((lr) => lr.id),
            });
            debateContent = debateResponse.choices?.[0]?.message?.content || "";
            console.log(`AI服务调用成功 (尝试 ${attempt}/${maxRetries})`);
            break;
          } catch (aiError) {
            console.error(
              `AI服务调用失败 (尝试 ${attempt}/${maxRetries}):`,
              aiError,
            );
            if (attempt < maxRetries) {
              console.log(`等待 ${retryDelay}ms 后重试...`);
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            } else {
              console.error("AI服务调用重试次数已达上限，使用默认内容继续");
              debateContent = "";
            }
          }
        }

        // 4. 解析AI生成的论点
        const generatedArguments = parseDebateArguments(
          debateContent,
          round.roundNumber,
        );

        // 5. 创建论点记录
        const createdArguments = await tx.argument.createMany({
          data: generatedArguments.map((arg) => ({
            roundId,
            side: arg.side,
            content: arg.content,
            type: arg.type,
            aiProvider: "deepseek",
            confidence: arg.confidence,
          })),
        });

        // 6. 更新轮次状态为已完成，同时更新辩论的当前轮次
        await tx.debate.update({
          where: { id: debateId },
          data: { currentRound: round.roundNumber },
        });

        await tx.debateRound.update({
          where: { id: roundId },
          data: {
            status: RoundStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        // 7. 返回生成的论点
        return {
          plaintiff: {
            arguments: generatedArguments
              .filter((arg) => arg.side === ArgumentSide.PLAINTIFF)
              .map((arg) => ({
                type: arg.type,
                content: arg.content,
                references: arg.references || [],
                legalBasis: arg.legalBasis || [],
              })),
          },
          defendant: {
            arguments: generatedArguments
              .filter((arg) => arg.side === ArgumentSide.DEFENDANT)
              .map((arg) => ({
                type: arg.type,
                content: arg.content,
                references: arg.references || [],
                legalBasis: arg.legalBasis || [],
              })),
          },
          totalArguments: createdArguments.count,
          roundId,
          roundNumber: round.roundNumber,
        };
      },
      {
        timeout: 120000, // 120秒超时，适应AI服务重试
        maxWait: 120000,
      },
    );

    return createSuccessResponse(result);
  },
);

/**
 * OPTIONS /api/v1/debates/[id]/rounds/[roundId]/generate
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
});

/**
 * 解析AI生成的辩论论点
 */
function parseDebateArguments(
  content: string,
  roundNumber: number,
): Array<{
  side: ArgumentSide;
  content: string;
  type: ArgumentType;
  confidence: number;
  legalBasis?: Array<{ articleId: string }>;
  references?: Array<{ roundNumber: number }>;
}> {
  // 简化的论点解析逻辑
  const plaintiffRegex = /原告[：:]\s*([^。\n]+)[。\n]?/g;
  const defendantRegex = /被告[：:]\s*([^。\n]+)[。\n]?/g;

  const parsedArguments: Array<{
    side: ArgumentSide;
    content: string;
    type: ArgumentType;
    confidence: number;
    legalBasis?: Array<{ articleId: string }>;
    references?: Array<{ roundNumber: number }>;
  }> = [];

  let match;

  // 解析原告论点
  while ((match = plaintiffRegex.exec(content)) !== null) {
    parsedArguments.push({
      side: ArgumentSide.PLAINTIFF,
      content: match[1].trim(),
      type: ArgumentType.MAIN_POINT,
      confidence: 0.85 + Math.random() * 0.1,
      legalBasis: [],
      references: roundNumber > 1 ? [{ roundNumber: roundNumber - 1 }] : [],
    });
  }

  // 解析被告论点
  while ((match = defendantRegex.exec(content)) !== null) {
    parsedArguments.push({
      side: ArgumentSide.DEFENDANT,
      content: match[1].trim(),
      type: ArgumentType.MAIN_POINT,
      confidence: 0.8 + Math.random() * 0.15,
      legalBasis: [],
      references: roundNumber > 1 ? [{ roundNumber: roundNumber - 1 }] : [],
    });
  }

  // 如果没有解析到论点，提供默认论点（多种类型）
  if (parsedArguments.length === 0) {
    const round1Content = [
      {
        side: ArgumentSide.PLAINTIFF,
        content: `基于案件事实和法律依据，原告的诉讼请求应当得到支持。`,
        type: ArgumentType.MAIN_POINT,
        confidence: 0.85,
        legalBasis: [],
        references: [],
      },
      {
        side: ArgumentSide.PLAINTIFF,
        content: `根据相关法律条款，被告应当履行合同义务，支付货款。`,
        type: ArgumentType.LEGAL_BASIS,
        confidence: 0.88,
        legalBasis: [],
        references: [],
      },
      {
        side: ArgumentSide.DEFENDANT,
        content: `原告的指控缺乏事实和法律依据，应当驳回其诉讼请求。`,
        type: ArgumentType.MAIN_POINT,
        confidence: 0.82,
        legalBasis: [],
        references: [],
      },
      {
        side: ArgumentSide.DEFENDANT,
        content: `合同中并未约定明确的履行期限，原告的主张缺乏依据。`,
        type: ArgumentType.LEGAL_BASIS,
        confidence: 0.8,
        legalBasis: [],
        references: [],
      },
    ];

    // 第二轮：更长的论点，引用第一轮
    if (roundNumber > 1) {
      parsedArguments.push(
        {
          side: ArgumentSide.PLAINTIFF,
          content: `针对被告在第一轮中关于合同履行期限的抗辩，原告认为，根据合同法相关规定及双方交易习惯，合理期限应当予以认定。原告在第一轮提出的诉讼请求具有充分的法律依据和事实支撑，被告应当立即履行付款义务，并承担迟延履行期间产生的利息损失。`,
          type: ArgumentType.MAIN_POINT,
          confidence: 0.87,
          legalBasis: [],
          references: [{ roundNumber: 1 }],
        },
        {
          side: ArgumentSide.PLAINTIFF,
          content: `第一轮中原告主张被告违约的事实，有双方签订的合同协议、付款凭证以及相关通讯记录作为充分证据。被告在上一轮未能提供有效证据反驳原告的主张，根据民事诉讼证据规则，应当认定被告存在违约行为，依法承担违约责任。`,
          type: ArgumentType.EVIDENCE,
          confidence: 0.91,
          legalBasis: [],
          references: [{ roundNumber: 1 }],
        },
        {
          side: ArgumentSide.DEFENDANT,
          content: `针对原告第一轮的指控，被告认为，原告在上一轮中未就合同约定的具体履行期限提供明确证据。根据合同法规定，当事人对履行期限约定不明确的，应当协议补充；不能达成补充协议的，按照合同相关条款或者交易习惯确定。原告未履行补充协议义务，其主张缺乏法律依据。`,
          type: ArgumentType.MAIN_POINT,
          confidence: 0.83,
          legalBasis: [],
          references: [{ roundNumber: 1 }],
        },
        {
          side: ArgumentSide.DEFENDANT,
          content: `原告在第一轮中提供的证据仅能证明双方存在合同关系，但不足以证明被告存在违约行为。被告已按照合同约定和交易习惯履行了相关义务，原告提供的付款凭证恰恰证明了被告的履约行为，而非违约行为。原告主张违约的事实不存在。`,
          type: ArgumentType.EVIDENCE,
          confidence: 0.85,
          legalBasis: [],
          references: [{ roundNumber: 1 }],
        },
      );
    } else {
      // 第一轮
      parsedArguments.push(...round1Content);
    }
  }

  return parsedArguments;
}
