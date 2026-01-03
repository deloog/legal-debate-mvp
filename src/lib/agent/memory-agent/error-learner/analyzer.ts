/**
 * ErrorPatternAnalyzer - 错误模式分析器
 * 分析错误模式、常见原因和根本原因
 */

import { v4 as uuidv4 } from "uuid";
import { PrismaClient, ErrorType } from "@prisma/client";

import { AIService } from "@/lib/ai/service-refactored";
import type { AIRequestConfig, AIResponse } from "@/types/ai-service";
import type { ErrorPattern } from "../types";

/**
 * ErrorPatternAnalyzer - 错误模式分析类
 */
export class ErrorPatternAnalyzer {
  constructor(
    private prisma: PrismaClient,
    private aiService: AIService,
  ) {}

  /**
   * 分析错误模式
   */
  async analyzePattern(error: {
    errorType: ErrorType;
    errorCode: string;
    errorMessage: string;
    context: Record<string, unknown>;
    attemptedAction: Record<string, unknown>;
  }): Promise<ErrorPattern> {
    // 统计相同类型的错误
    const sameTypeErrors = await this.prisma.errorLog.findMany({
      where: {
        errorType: error.errorType,
      },
    });

    const frequency = sameTypeErrors.length;

    // 分析常见原因
    const commonCauses = await this.analyzeCommonCauses(error.errorType);

    // 使用AI分析根本原因
    const rootCause = await this.analyzeRootCause(error);

    return {
      patternId: uuidv4(),
      errorType: error.errorType,
      frequency,
      commonCauses,
      rootCause,
    };
  }

  /**
   * 分析常见原因
   */
  async analyzeCommonCauses(errorType: ErrorType): Promise<string[]> {
    const errors = await this.prisma.errorLog.findMany({
      where: {
        errorType,
      },
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
    });

    // 提取上下文信息
    const contexts = errors.map((e) => e.context);

    // 使用AI聚类分析
    if (contexts.length === 0) {
      return [];
    }

    const prompt = `请分析以下${contexts.length}个错误上下文，提取3-5个最常见的原因：

${contexts.map((c, i) => `${i + 1}. ${JSON.stringify(c)}`).join("\n")}

返回格式：纯文本，每行一个原因`;

    const requestConfig: AIRequestConfig = {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的错误分析助手，擅长从多个错误实例中找出共同原因。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 500,
    };

    const response: AIResponse =
      await this.aiService.chatCompletion(requestConfig);

    const content = response.choices[0]?.message?.content || "";
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 5);
  }

  /**
   * AI分析根本原因
   */
  async analyzeRootCause(error: {
    errorType: string;
    errorCode: string;
    errorMessage: string;
    context: Record<string, unknown>;
    attemptedAction: Record<string, unknown>;
  }): Promise<string> {
    const prompt = `请分析以下错误记录，找出根本原因：

错误类型：${error.errorType}
错误代码：${error.errorCode}
错误消息：${error.errorMessage}
上下文：${JSON.stringify(error.context)}
尝试的动作：${JSON.stringify(error.attemptedAction)}

要求：
1. 返回根本原因（50-100字）
2. 解释为什么导致这个错误`;

    const requestConfig: AIRequestConfig = {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "你是一个专业的错误分析助手，擅长找出错误的根本原因。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      maxTokens: 300,
    };

    const response: AIResponse =
      await this.aiService.chatCompletion(requestConfig);

    return response.choices[0]?.message?.content?.trim() || "";
  }
}
