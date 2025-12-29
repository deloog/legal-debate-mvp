// 上下文继承处理器：处理轮次间的上下文继承

import {
  HistoricalContext,
  RoundContext,
  DisputeFocus,
  PositionSummary,
  ProgressionGuidance,
  UncoveredAngle,
  ArgumentAnalysis,
  NoveltyScore,
} from "./types";
import { prisma } from "@/lib/db/prisma";
import { Argument, DebateRound } from "@prisma/client";

/**
 * 扩展的轮次类型，包含关联的论点
 */
interface ExtendedDebateRound extends DebateRound {
  arguments: Argument[];
}

/**
 * 上下文继承处理器类
 * 负责处理轮次间的上下文继承和构建
 */
export class ContextInheritanceProcessor {
  /**
   * 构建轮次上下文
   *
   * @param debateId - 辩论ID
   * @param roundNumber - 当前轮次编号
   * @returns 轮次上下文
   */
  async buildRoundContext(
    debateId: string,
    roundNumber: number,
  ): Promise<RoundContext> {
    // 获取历史轮次
    const previousRounds = await this.getPreviousRounds(debateId, roundNumber);

    // 构建历史上下文
    const historicalContext = await this.buildHistoricalContext(previousRounds);

    // 识别争议焦点
    const disputeFocus = await this.identifyDisputeFocus(previousRounds);

    // 构建立场摘要
    const positionSummary = await this.buildPositionSummary(previousRounds);

    // 生成递进指导
    const progressionGuidance = await this.generateProgressionGuidance(
      historicalContext,
      disputeFocus,
      positionSummary,
    );

    return {
      debateId,
      currentRoundNumber: roundNumber,
      historicalContext,
      disputeFocus,
      positionSummary,
      progressionGuidance,
      builtAt: new Date(),
    };
  }

  /**
   * 获取之前的轮次
   */
  private async getPreviousRounds(
    debateId: string,
    currentRoundNumber: number,
  ): Promise<ExtendedDebateRound[]> {
    return prisma.debateRound.findMany({
      where: {
        debateId,
        roundNumber: { lt: currentRoundNumber },
        status: "COMPLETED",
      },
      include: {
        arguments: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { roundNumber: "asc" },
    }) as Promise<ExtendedDebateRound[]>;
  }

  /**
   * 构建历史上下文
   */
  private async buildHistoricalContext(
    rounds: ExtendedDebateRound[],
  ): Promise<HistoricalContext> {
    const keyPointsPerRound = await Promise.all(
      rounds.map(async (round) => {
        const plaintiffArgs = round.arguments
          .filter((a) => a.side === "PLAINTIFF")
          .map((a) => this.extractKeyPoint(a.content));
        const defendantArgs = round.arguments
          .filter((a) => a.side === "DEFENDANT")
          .map((a) => this.extractKeyPoint(a.content));

        return {
          roundNumber: round.roundNumber,
          plaintiffPoints: plaintiffArgs,
          defendantPoints: defendantArgs,
        };
      }),
    );

    const allArguments = rounds.flatMap((r) => r.arguments);
    const analysis = this.analyzeArguments(allArguments);

    return {
      roundCount: rounds.length,
      keyPointsPerRound,
      disputeFocusEvolution: this.extractDisputeFocusEvolution(rounds),
      coveredLegalAngles: Array.from(analysis.coveredLegalAngles),
      coveredFactAngles: Array.from(analysis.coveredFactAngles),
    };
  }

  /**
   * 提取关键点
   */
  private extractKeyPoint(content: string): string {
    // 简化版：取前100字符作为关键点
    return content.length > 100 ? content.substring(0, 100) + "..." : content;
  }

  /**
   * 提取争议焦点演进
   */
  private extractDisputeFocusEvolution(
    rounds: ExtendedDebateRound[],
  ): string[] {
    // 简化版：基于论点内容生成争议焦点
    const evolution: string[] = [];
    for (const round of rounds) {
      const plaintiffArgs = round.arguments
        .filter((a) => a.side === "PLAINTIFF")
        .map((a) => a.content);
      const defendantArgs = round.arguments
        .filter((a) => a.side === "DEFENDANT")
        .map((a) => a.content);

      if (plaintiffArgs.length > 0 && defendantArgs.length > 0) {
        evolution.push(
          `第${round.roundNumber}轮：双方围绕${plaintiffArgs[0].substring(0, 30)}...展开辩论`,
        );
      }
    }
    return evolution;
  }

  /**
   * 分析论点
   */
  private analyzeArguments(argList: Argument[]): ArgumentAnalysis {
    const plaintiffArguments = argList.filter(
      (a) => a.side === "PLAINTIFF",
    ).length;
    const defendantArguments = argList.filter(
      (a) => a.side === "DEFENDANT",
    ).length;

    const coveredLegalAngles = new Set<string>();
    const coveredFactAngles = new Set<string>();
    const usedLawArticles = new Set<string>();
    const argumentTypeDistribution = new Map<string, number>();

    for (const arg of argList) {
      // 简化的角度提取逻辑
      const content = arg.content.toLowerCase();

      // 法律角度
      if (
        content.includes("法律") ||
        content.includes("法条") ||
        content.includes("规定")
      ) {
        coveredLegalAngles.add("法律依据");
      }
      if (
        content.includes("宪法") ||
        content.includes("民法") ||
        content.includes("刑法")
      ) {
        coveredLegalAngles.add("实体法");
      }
      if (content.includes("程序") || content.includes("证据")) {
        coveredLegalAngles.add("程序法");
      }

      // 事实角度
      if (content.includes("事实") || content.includes("情况")) {
        coveredFactAngles.add("事实认定");
      }
      if (content.includes("证据") || content.includes("证明")) {
        coveredFactAngles.add("证据分析");
      }

      // 法条提取（简化版）
      const lawMatches = content.match(/第[一二三四五六七八九十百]+条/g);
      lawMatches?.forEach((match) => usedLawArticles.add(match));

      // 论点类型统计
      const typeCount = argumentTypeDistribution.get(arg.type) || 0;
      argumentTypeDistribution.set(arg.type, typeCount + 1);
    }

    return {
      totalArguments: argList.length,
      plaintiffArguments,
      defendantArguments,
      coveredLegalAngles,
      coveredFactAngles,
      usedLawArticles,
      argumentTypeDistribution,
    };
  }

  /**
   * 识别争议焦点
   */
  private async identifyDisputeFocus(
    rounds: ExtendedDebateRound[],
  ): Promise<DisputeFocus[]> {
    const focus: DisputeFocus[] = [];
    const plaintiffArgs = rounds.flatMap((r) =>
      r.arguments.filter((a) => a.side === "PLAINTIFF"),
    );
    const defendantArgs = rounds.flatMap((r) =>
      r.arguments.filter((a) => a.side === "DEFENDANT"),
    );

    // 对比论点找出分歧点
    for (let i = 0; i < plaintiffArgs.length && i < defendantArgs.length; i++) {
      const pContent = plaintiffArgs[i].content;
      const dContent = defendantArgs[i].content;

      if (this.hasDisagreement(pContent, dContent)) {
        focus.push({
          id: `focus-${i + 1}`,
          description: `关于${this.extractFocusTopic(pContent, dContent)}的争议`,
          relatedRounds: [
            plaintiffArgs[i].roundId
              ? parseInt(plaintiffArgs[i].roundId.slice(-1))
              : 1,
          ],
          plaintiffView: this.extractViewpoint(pContent),
          defendantView: this.extractViewpoint(dContent),
        });
      }
    }

    return focus.slice(0, 5); // 最多返回5个争议焦点
  }

  /**
   * 判断是否有分歧
   */
  private hasDisagreement(content1: string, content2: string): boolean {
    // 简化的分歧判断：检查是否包含相反的关键词
    const contradictions = [
      ["同意", "反对"],
      ["应当", "不应当"],
      ["符合", "不符合"],
      ["有效", "无效"],
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
   * 提取焦点主题
   */
  private extractFocusTopic(content1: string, content2: string): string {
    // 简化版：提取两个内容中最长公共子串
    const common = this.findLongestCommonSubstring(content1, content2);
    return common.length > 5 ? common.substring(0, 30) : "相关法律问题";
  }

  /**
   * 查找最长公共子串
   */
  private findLongestCommonSubstring(str1: string, str2: string): string {
    let maxSub = "";
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
   * 提取观点
   */
  private extractViewpoint(content: string): string {
    // 简化版：返回论点的前200字符
    return content.length > 200 ? content.substring(0, 200) + "..." : content;
  }

  /**
   * 构建立场摘要
   */
  private async buildPositionSummary(
    rounds: ExtendedDebateRound[],
  ): Promise<PositionSummary> {
    const plaintiffArgs = rounds.flatMap((r) =>
      r.arguments.filter((a) => a.side === "PLAINTIFF"),
    );
    const defendantArgs = rounds.flatMap((r) =>
      r.arguments.filter((a) => a.side === "DEFENDANT"),
    );

    const plaintiffMainPoints = plaintiffArgs
      .map((a) => this.extractMainPoint(a.content))
      .slice(0, 5);
    const defendantMainPoints = defendantArgs
      .map((a) => this.extractMainPoint(a.content))
      .slice(0, 5);

    const commonGround = this.findCommonGround(plaintiffArgs, defendantArgs);
    const coreDisagreements = this.findCoreDisagreements(
      plaintiffArgs,
      defendantArgs,
    );

    return {
      plaintiffMainPoints,
      defendantMainPoints,
      commonGround,
      coreDisagreements,
    };
  }

  /**
   * 提取主要论点
   */
  private extractMainPoint(content: string): string {
    // 简化版：提取第一句话
    const firstSentence = content.split(/[。！？]/)[0];
    return firstSentence.length > 50
      ? firstSentence.substring(0, 50) + "..."
      : firstSentence;
  }

  /**
   * 查找共同认知
   */
  private findCommonGround(
    plaintiffArgs: Argument[],
    defendantArgs: Argument[],
  ): string[] {
    const common: string[] = [];

    // 查找双方都提到的事实
    const plaintiffFacts = plaintiffArgs
      .map((a) => this.extractFacts(a.content))
      .flat();
    const defendantFacts = defendantArgs
      .map((a) => this.extractFacts(a.content))
      .flat();

    for (const fact of plaintiffFacts) {
      if (defendantFacts.includes(fact) && !common.includes(fact)) {
        common.push(fact);
      }
    }

    return common.slice(0, 3);
  }

  /**
   * 提取事实
   */
  private extractFacts(content: string): string[] {
    // 简化版：提取包含"事实"、"情况"的句子
    const sentences = content.split(/[。！？]/);
    return sentences.filter((s) => s.includes("事实") || s.includes("情况"));
  }

  /**
   * 查找核心分歧
   */
  private findCoreDisagreements(
    plaintiffArgs: Argument[],
    defendantArgs: Argument[],
  ): string[] {
    const disagreements: string[] = [];

    // 对比论点找出分歧
    for (const pArg of plaintiffArgs) {
      for (const dArg of defendantArgs) {
        if (this.hasDisagreement(pArg.content, dArg.content)) {
          const topic = this.extractFocusTopic(pArg.content, dArg.content);
          if (!disagreements.includes(topic)) {
            disagreements.push(topic);
          }
        }
      }
    }

    return disagreements.slice(0, 5);
  }

  /**
   * 生成递进指导
   */
  private async generateProgressionGuidance(
    historicalContext: HistoricalContext,
    disputeFocus: DisputeFocus[],
    positionSummary: PositionSummary,
  ): Promise<ProgressionGuidance> {
    // 识别未覆盖的角度
    const priorityAngles = this.identifyUncoveredAngles(historicalContext);

    // 生成深度递进建议
    const depthSuggestions = this.generateDepthSuggestions(
      historicalContext,
      disputeFocus,
    );

    // 生成广度拓展建议
    const breadthSuggestions =
      this.generateBreadthSuggestions(historicalContext);

    // 生成反驳策略建议
    const refutationSuggestions =
      this.generateRefutationSuggestions(positionSummary);

    // 识别应避免的重复内容
    const avoidRepetition = historicalContext.keyPointsPerRound.flatMap((r) => [
      ...r.plaintiffPoints,
      ...r.defendantPoints,
    ]);

    return {
      priorityAngles,
      depthSuggestions,
      breadthSuggestions,
      refutationSuggestions,
      avoidRepetition,
    };
  }

  /**
   * 识别未覆盖的角度
   */
  private identifyUncoveredAngles(
    historicalContext: HistoricalContext,
  ): UncoveredAngle[] {
    const angles: UncoveredAngle[] = [];
    const coveredLegal = historicalContext.coveredLegalAngles;
    const coveredFact = historicalContext.coveredFactAngles;

    // 法律角度
    if (!coveredLegal.includes("宪法原则")) {
      angles.push({
        type: "legal",
        description: "宪法层面的法律原则分析",
        priority: "high",
        suggestedDirection: "从宪法原则出发分析案件",
      });
    }

    // 事实角度
    if (!coveredFact.includes("事实认定标准")) {
      angles.push({
        type: "factual",
        description: "事实认定的标准和程序",
        priority: "medium",
        suggestedDirection: "分析事实认定的法律标准",
      });
    }

    return angles;
  }

  /**
   * 生成深度递进建议
   */
  private generateDepthSuggestions(
    historicalContext: HistoricalContext,
    disputeFocus: DisputeFocus[],
  ): string[] {
    const suggestions: string[] = [];

    if (disputeFocus.length > 0) {
      suggestions.push(
        `针对"${disputeFocus[0].description}"进行更深入的法律分析`,
      );
    }

    if (historicalContext.coveredLegalAngles.length > 0) {
      suggestions.push(
        `在${historicalContext.coveredLegalAngles[0]}基础上进行更具体的适用分析`,
      );
    }

    return suggestions;
  }

  /**
   * 生成广度拓展建议
   */
  private generateBreadthSuggestions(
    historicalContext: HistoricalContext,
  ): string[] {
    const suggestions: string[] = [];
    const { coveredLegalAngles, coveredFactAngles } = historicalContext;

    if (!coveredLegalAngles.includes("程序法")) {
      suggestions.push("增加程序法相关分析");
    }

    if (!coveredLegalAngles.includes("国际法")) {
      suggestions.push("考虑国际法相关条文");
    }

    if (!coveredFactAngles.includes("证据链")) {
      suggestions.push("构建完整的证据链分析");
    }

    return suggestions;
  }

  /**
   * 生成反驳策略建议
   */
  private generateRefutationSuggestions(
    positionSummary: PositionSummary,
  ): string[] {
    const suggestions: string[] = [];

    for (const disagreement of positionSummary.coreDisagreements) {
      suggestions.push(`针对"${disagreement}"提供更有力的反驳论据`);
    }

    suggestions.push("指出对方论点中的逻辑漏洞");
    suggestions.push("通过类比分析强化己方观点");

    return suggestions;
  }

  /**
   * 计算论点新颖性评分
   *
   * @param newArgument - 新论点
   * @param historicalArguments - 历史论点
   * @returns 新颖性评分
   */
  async calculateNoveltyScore(
    newArgument: string,
    historicalArguments: Argument[],
  ): Promise<NoveltyScore> {
    // 计算内容相似度
    const contentNovelty = this.calculateContentNovelty(
      newArgument,
      historicalArguments,
    );

    // 计算角度新颖度（简化版）
    const angleNovelty = this.calculateAngleNovelty(
      newArgument,
      historicalArguments,
    );

    // 计算法条新颖度（简化版）
    const legalNovelty = this.calculateLegalNovelty(
      newArgument,
      historicalArguments,
    );

    // 综合评分
    const score = (contentNovelty + angleNovelty + legalNovelty) / 3;

    // 评级
    let rating: "high" | "medium" | "low";
    if (score > 0.7) {
      rating = "high";
    } else if (score > 0.4) {
      rating = "medium";
    } else {
      rating = "low";
    }

    // 找出相似论点
    const similarArguments = historicalArguments
      .map((arg) => ({
        roundNumber: arg.roundId ? parseInt(arg.roundId.slice(-1)) : 1,
        side: arg.side,
        similarity: this.calculateSimilarity(newArgument, arg.content),
      }))
      .filter((item) => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    return {
      score,
      rating,
      details: {
        contentNovelty,
        angleNovelty,
        legalNovelty,
        similarArguments,
      },
    };
  }

  /**
   * 计算内容新颖度
   */
  private calculateContentNovelty(
    newArgument: string,
    historical: Argument[],
  ): number {
    let maxSimilarity = 0;
    for (const arg of historical) {
      const similarity = this.calculateSimilarity(newArgument, arg.content);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    }
    return 1 - maxSimilarity;
  }

  /**
   * 计算角度新颖度
   */
  private calculateAngleNovelty(
    newArgument: string,
    historical: Argument[],
  ): number {
    // 简化版：基于关键词计算
    const newKeywords = this.extractKeywords(newArgument);
    let overlapping = 0;
    for (const arg of historical) {
      const histKeywords = this.extractKeywords(arg.content);
      const overlap = newKeywords.filter((k) =>
        histKeywords.includes(k),
      ).length;
      overlapping = Math.max(overlapping, overlap);
    }
    return 1 - overlapping / Math.max(newKeywords.length, 1);
  }

  /**
   * 计算法条新颖度
   */
  private calculateLegalNovelty(
    newArgument: string,
    historical: Argument[],
  ): number {
    const newLawMatches =
      newArgument.match(/第[一二三四五六七八九十百]+条/g) || [];
    if (newLawMatches.length === 0) {
      return 0.5; // 没有引用法条，中等新颖度
    }

    let usedCount = 0;
    for (const arg of historical) {
      const histMatches =
        arg.content.match(/第[一二三四五六七八九十百]+条/g) || [];
      if (histMatches.some((m) => newLawMatches.includes(m))) {
        usedCount++;
      }
    }

    return 1 - usedCount / Math.max(newLawMatches.length, 1);
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string[] {
    // 简化版：提取2字以上的关键词
    const keywords: string[] = [];
    for (let i = 0; i < content.length - 1; i++) {
      const word = content.substring(i, i + 2);
      if (
        !keywords.includes(word) &&
        !/^[，。！？、；：""''（）《》\s]+$/.test(word)
      ) {
        keywords.push(word);
      }
    }
    return keywords;
  }

  /**
   * 计算文本相似度（简化版Jaccard相似度）
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const set1 = new Set<string>(this.extractKeywords(text1));
    const set2 = new Set<string>(this.extractKeywords(text2));

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) {
      return 0;
    }

    return intersection.size / union.size;
  }
}
