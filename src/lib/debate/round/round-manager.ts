// 轮次管理器：管理轮次生命周期和状态

import { RoundConfig, RoundSummary, RoundContext } from './types';
import { RoundValidator } from './round-validator';
import { ContextInheritanceProcessor } from './context-inheritance';
import { prisma } from '@/lib/db/prisma';
import { DebateRound, Argument, Prisma } from '@prisma/client';

/**
 * 法律依据接口
 */
export interface LegalBasisItem {
  lawName: string;
  articleNumber: string;
  relevance: number;
  explanation: string;
}

/**
 * 添加论点的额外选项
 */
export interface AddArgumentOptions {
  aiProvider?: string;
  confidence?: number;
  reasoning?: string;
  legalBasis?: LegalBasisItem[];
  logicScore?: number;
  legalScore?: number;
  overallScore?: number;
}

/**
 * 轮次管理器类
 * 负责管理辩论轮次的创建、状态转换和上下文继承
 */
export class RoundManager {
  private validator: RoundValidator;
  private contextProcessor: ContextInheritanceProcessor;

  constructor() {
    this.validator = new RoundValidator();
    this.contextProcessor = new ContextInheritanceProcessor();
  }

  /**
   * 开始新轮次
   *
   * @param debateId - 辩论ID
   * @param config - 轮次配置（可选）
   * @returns 轮次记录
   */
  async startRound(
    debateId: string,
    config?: RoundConfig
  ): Promise<DebateRound> {
    // 验证是否可以开始新轮次
    const validationResult = await this.validator.validateCanStart(debateId);
    if (!validationResult.valid) {
      throw new Error(this.validator.getErrorSummary(validationResult));
    }

    // 验证轮次配置
    const configValidation = this.validator.validateRoundConfig(config);
    if (!configValidation.valid) {
      throw new Error(this.validator.getErrorSummary(configValidation));
    }

    // 获取当前轮次编号
    const currentRound = await this.getCurrentRoundNumber(debateId);
    const newRoundNumber = currentRound + 1;

    // 创建新轮次
    const round = await prisma.debateRound.create({
      data: {
        debateId,
        roundNumber: newRoundNumber,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // 更新辩论的当前轮次
    await prisma.debate.update({
      where: { id: debateId },
      data: { currentRound: newRoundNumber },
    });

    console.log(
      `[RoundManager] 轮次 ${newRoundNumber} 已开始，ID: ${round.id}`
    );
    return round;
  }

  /**
   * 完成轮次
   *
   * @param roundId - 轮次ID
   * @returns 轮次摘要
   */
  async completeRound(roundId: string): Promise<RoundSummary> {
    // 获取轮次信息
    const round = await prisma.debateRound.findUnique({
      where: { id: roundId },
      include: {
        arguments: {
          orderBy: { createdAt: 'asc' },
        },
        debate: true,
      },
    });

    if (!round) {
      throw new Error('轮次不存在');
    }

    // 验证状态转换
    if (!this.validator.validateStatusTransition(round.status, 'COMPLETED')) {
      throw new Error(`无法从${round.status}状态转换为COMPLETED状态`);
    }

    // 验证轮次完整性
    const completenessValidation =
      await this.validator.validateRoundCompleteness(roundId);
    if (!completenessValidation.valid) {
      console.warn(
        `[RoundManager] 轮次完整性验证警告：${this.validator.getWarningSummary(
          completenessValidation
        )}`
      );
    }

    // 更新轮次状态
    const updatedRound = await prisma.debateRound.update({
      where: { id: roundId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        arguments: true,
      },
    });

    // 生成轮次摘要
    const summary = this.generateRoundSummary(updatedRound);
    console.log(
      `[RoundManager] 轮次 ${summary.roundNumber} 已完成，原告论点：${summary.plaintiffSummary.argumentCount}，被告论点：${summary.defendantSummary.argumentCount}`
    );

    return summary;
  }

  /**
   * 失败轮次
   *
   * @param roundId - 轮次ID
   * @param reason - 失败原因
   */
  async failRound(roundId: string, reason?: string): Promise<void> {
    const round = await prisma.debateRound.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      throw new Error('轮次不存在');
    }

    // 验证状态转换
    if (!this.validator.validateStatusTransition(round.status, 'FAILED')) {
      throw new Error(`无法从${round.status}状态转换为FAILED状态`);
    }

    await prisma.debateRound.update({
      where: { id: roundId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    });

    console.warn(
      `[RoundManager] 轮次 ${round.roundNumber} 失败，原因：${reason || '未知'}`
    );
  }

  /**
   * 重试失败的轮次
   *
   * @param roundId - 轮次ID
   * @returns 轮次记录
   */
  async retryRound(roundId: string): Promise<DebateRound> {
    const round = await prisma.debateRound.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      throw new Error('轮次不存在');
    }

    if (round.status !== 'FAILED') {
      throw new Error('只能重试失败的轮次');
    }

    // 验证是否可以开始新轮次（重新验证辩论状态）
    const validationResult = await this.validator.validateCanStart(
      round.debateId
    );
    if (!validationResult.valid) {
      throw new Error(this.validator.getErrorSummary(validationResult));
    }

    // 更新轮次状态为进行中
    const updatedRound = await prisma.debateRound.update({
      where: { id: roundId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        completedAt: null,
      },
    });

    console.log(`[RoundManager] 轮次 ${round.roundNumber} 已重试`);
    return updatedRound;
  }

  /**
   * 获取轮次上下文
   *
   * @param roundId - 轮次ID
   * @returns 轮次上下文
   */
  async getRoundContext(roundId: string): Promise<RoundContext> {
    const round = await prisma.debateRound.findUnique({
      where: { id: roundId },
      include: { debate: true },
    });

    if (!round) {
      throw new Error('轮次不存在');
    }

    return this.contextProcessor.buildRoundContext(
      round.debateId,
      round.roundNumber
    );
  }

  /**
   * 获取轮次摘要
   *
   * @param roundId - 轮次ID
   * @returns 轮次摘要
   */
  async getRoundSummary(roundId: string): Promise<RoundSummary> {
    const round = await prisma.debateRound.findUnique({
      where: { id: roundId },
      include: { arguments: true },
    });

    if (!round) {
      throw new Error('轮次不存在');
    }

    return this.generateRoundSummary(round);
  }

  /**
   * 添加轮次论点
   *
   * @param roundId - 轮次ID
   * @param side - 正反方
   * @param content - 论点内容
   * @param type - 论点类型
   * @param options - 额外选项（AI信息、法律依据等）
   * @returns 论点记录
   */
  async addArgument(
    roundId: string,
    side: 'PLAINTIFF' | 'DEFENDANT',
    content: string,
    type:
      | 'MAIN_POINT'
      | 'SUPPORTING'
      | 'REBUTTAL'
      | 'EVIDENCE'
      | 'LEGAL_BASIS'
      | 'CONCLUSION',
    options?: AddArgumentOptions
  ): Promise<{ roundId: string; argumentId: string }> {
    // 验证轮次状态
    const round = await prisma.debateRound.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      throw new Error('轮次不存在');
    }

    if (round.status !== 'IN_PROGRESS') {
      throw new Error(
        `只能在IN_PROGRESS状态的轮次中添加论点，当前状态：${round.status}`
      );
    }

    // 计算论点新颖性（基于历史论点）
    const historicalRounds = await prisma.debateRound.findMany({
      where: {
        debateId: round.debateId,
        roundNumber: { lt: round.roundNumber },
        status: 'COMPLETED',
      },
      include: { arguments: true },
    });

    const historicalArguments = historicalRounds.flatMap(r => r.arguments);
    const noveltyScore = await this.contextProcessor.calculateNoveltyScore(
      content,
      historicalArguments
    );

    // 创建论点，包含法律依据信息
    const argument = await prisma.argument.create({
      data: {
        roundId,
        side,
        content,
        type,
        aiProvider: options?.aiProvider,
        confidence: options?.confidence,
        reasoning: options?.reasoning,
        legalBasis: options?.legalBasis
          ? (options.legalBasis as unknown as Prisma.InputJsonValue)
          : undefined,
        logicScore: options?.logicScore,
        legalScore: options?.legalScore,
        overallScore: options?.overallScore,
      },
    });

    console.log(
      `[RoundManager] 已添加${side === 'PLAINTIFF' ? '原告' : '被告'}论点，新颖度：${noveltyScore.rating} (${noveltyScore.score.toFixed(2)})`
    );

    return { roundId, argumentId: argument.id };
  }

  /**
   * 获取当前轮次编号
   */
  private async getCurrentRoundNumber(debateId: string): Promise<number> {
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
    });

    if (!debate) {
      throw new Error('辩论不存在');
    }

    return debate.currentRound;
  }

  /**
   * 生成轮次摘要
   */
  private generateRoundSummary(
    round: DebateRound & { arguments: Array<Argument> }
  ): RoundSummary {
    const plaintiffArgs = round.arguments.filter(a => a.side === 'PLAINTIFF');
    const defendantArgs = round.arguments.filter(a => a.side === 'DEFENDANT');

    const plaintiffScores = plaintiffArgs
      .map(a => a.confidence || 0)
      .filter(s => s > 0);
    const defendantScores = defendantArgs
      .map(a => a.confidence || 0)
      .filter(s => s > 0);

    const plaintiffAverageScore =
      plaintiffScores.length > 0
        ? plaintiffScores.reduce((sum, s) => sum + s, 0) /
          plaintiffScores.length
        : 0;
    const defendantAverageScore =
      defendantScores.length > 0
        ? defendantScores.reduce((sum, s) => sum + s, 0) /
          defendantScores.length
        : 0;

    // 提取关键点
    const plaintiffKeyPoints = plaintiffArgs
      .map(a => this.extractKeyPoint(a.content))
      .slice(0, 3);
    const defendantKeyPoints = defendantArgs
      .map(a => this.extractKeyPoint(a.content))
      .slice(0, 3);

    // 识别争议焦点
    const disputeFocus = this.identifyDisputeFocus(
      plaintiffArgs,
      defendantArgs
    );

    return {
      roundId: round.id,
      roundNumber: round.roundNumber,
      plaintiffSummary: {
        argumentCount: plaintiffArgs.length,
        keyPoints: plaintiffKeyPoints,
        averageScore: plaintiffAverageScore,
      },
      defendantSummary: {
        argumentCount: defendantArgs.length,
        keyPoints: defendantKeyPoints,
        averageScore: defendantAverageScore,
      },
      disputeFocus,
      completedAt: round.completedAt || new Date(),
    };
  }

  /**
   * 提取关键点
   */
  private extractKeyPoint(content: string): string {
    return content.length > 80 ? content.substring(0, 80) + '...' : content;
  }

  /**
   * 识别争议焦点
   */
  private identifyDisputeFocus(
    plaintiffArgs: Argument[],
    defendantArgs: Argument[]
  ): string[] {
    const focus: string[] = [];

    for (let i = 0; i < plaintiffArgs.length && i < defendantArgs.length; i++) {
      const pContent = plaintiffArgs[i].content;
      const dContent = defendantArgs[i].content;

      if (this.hasDisagreement(pContent, dContent)) {
        const common = this.findCommonSubstring(pContent, dContent);
        if (common.length > 5) {
          focus.push(common.substring(0, 30));
        }
      }
    }

    return focus.slice(0, 3);
  }

  /**
   * 判断是否有分歧
   */
  private hasDisagreement(content1: string, content2: string): boolean {
    const contradictions = [
      ['同意', '反对'],
      ['应当', '不应当'],
      ['符合', '不符合'],
      ['有效', '无效'],
    ];

    for (const [word1, word2] of contradictions) {
      if (
        (content1.includes(word1) && content2.includes(word2)) ||
        (content1.includes(word2) && content2.includes(word1))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * 查找公共子串
   */
  private findCommonSubstring(str1: string, str2: string): string {
    let maxSub = '';
    for (let i = 0; i < str1.length; i++) {
      for (let j = i + 1; j <= str1.length; j++) {
        const sub = str1.substring(i, j);
        if (str2.includes(sub) && sub.length > maxSub.length) {
          maxSub = sub;
        }
      }
    }
    return maxSub;
  }

  /**
   * 获取所有轮次
   *
   * @param debateId - 辩论ID
   * @returns 轮次列表
   */
  async getAllRounds(debateId: string): Promise<DebateRound[]> {
    return prisma.debateRound.findMany({
      where: { debateId },
      include: {
        arguments: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { roundNumber: 'asc' },
    });
  }

  /**
   * 获取进行中的轮次
   *
   * @param debateId - 辩论ID
   * @returns 进行中的轮次
   */
  async getInProgressRound(debateId: string): Promise<DebateRound | null> {
    return prisma.debateRound.findFirst({
      where: {
        debateId,
        status: 'IN_PROGRESS',
      },
      include: {
        arguments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }
}
