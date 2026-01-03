/**
 * ErrorLearner - 错误学习机制
 * 从error_logs表学习错误模式，更新知识库
 */

import { v4 as uuidv4 } from "uuid";
import { PrismaClient, ErrorType } from "@prisma/client";

import { AIService } from "@/lib/ai/service-refactored";
import { MemoryManager } from "./memory-manager";
import { ErrorPatternAnalyzer } from "./error-learner/analyzer";
import { AIHelpers } from "./error-learner/ai-helpers";
import { KnowledgeBaseUpdater } from "./error-learner/knowledge-base";
import type { LearningResult, ErrorAnalysis } from "./types";

/**
 * ErrorLearner - 错误学习类
 */
export class ErrorLearner {
  private analyzer: ErrorPatternAnalyzer;
  private aiHelpers: AIHelpers;
  private knowledgeBaseUpdater: KnowledgeBaseUpdater;

  constructor(
    private prisma: PrismaClient,
    private aiService: AIService,
    private memoryManager: MemoryManager,
  ) {
    this.analyzer = new ErrorPatternAnalyzer(prisma, aiService);
    this.aiHelpers = new AIHelpers(aiService);
    this.knowledgeBaseUpdater = new KnowledgeBaseUpdater(memoryManager);
  }

  /**
   * 从错误学习
   */
  async learnFromError(errorId: string): Promise<LearningResult> {
    const error = (await this.prisma.errorLog.findUnique({
      where: { id: errorId },
    })) as unknown as {
      errorType: ErrorType;
      errorCode: string;
      errorMessage: string;
      context: Record<string, unknown>;
      attemptedAction: Record<string, unknown>;
      userId: string | null;
    };

    if (!error) {
      throw new Error(`Error not found: ${errorId}`);
    }

    // 分析错误模式
    const pattern = await this.analyzer.analyzePattern(error);

    // AI生成学习笔记
    const learningNotes = await this.aiHelpers.generateLearningNotes(
      error,
      pattern,
    );

    // 提取预防措施
    const preventionMeasures =
      await this.aiHelpers.extractPreventionMeasures(learningNotes);

    // 更新知识库
    const knowledgeUpdated =
      await this.knowledgeBaseUpdater.updateKnowledgeBase(
        {
          errorType: error.errorType,
          userId: error.userId,
        },
        pattern,
        preventionMeasures,
      );

    // 标记错误已学习
    await this.prisma.errorLog.update({
      where: { id: errorId },
      data: {
        learned: true,
        learningNotes,
        updatedAt: new Date(),
      },
    });

    return {
      learningId: uuidv4(),
      errorId,
      pattern,
      learningNotes,
      preventionMeasures,
      knowledgeUpdated,
      learnedAt: new Date(),
    };
  }

  /**
   * 批量学习（学习所有未学习的错误）
   */
  async batchLearn(limit: number = 50): Promise<LearningResult[]> {
    const unlearnedErrors = await this.prisma.errorLog.findMany({
      where: {
        learned: false,
      },
      take: limit,
      orderBy: {
        createdAt: "asc",
      },
    });

    const results: LearningResult[] = [];

    for (const error of unlearnedErrors) {
      try {
        const result = await this.learnFromError(error.id);
        results.push(result);
      } catch (error) {
        console.error(`Failed to learn from error ${error.id}:`, error);
      }
    }

    return results;
  }

  /**
   * 分析错误（返回错误分析结果）
   */
  async analyzeError(errorId: string): Promise<ErrorAnalysis> {
    const error = (await this.prisma.errorLog.findUnique({
      where: { id: errorId },
    })) as unknown as {
      id: string;
      errorType: ErrorType;
      errorCode: string;
      errorMessage: string;
    };

    if (!error) {
      throw new Error(`Error not found: ${errorId}`);
    }

    const pattern = await this.analyzer.analyzePattern({
      errorType: error.errorType,
      errorCode: error.errorCode,
      errorMessage: error.errorMessage,
      context: {},
      attemptedAction: {},
    });

    // 生成建议操作
    const suggestedActions = await this.aiHelpers.generateSuggestedActions(
      {
        errorType: error.errorType,
        errorCode: error.errorCode,
        errorMessage: error.errorMessage,
      },
      pattern,
    );

    return {
      errorId,
      errorType: error.errorType,
      frequency: pattern.frequency,
      pattern: pattern.rootCause,
      suggestedActions,
    };
  }
}
