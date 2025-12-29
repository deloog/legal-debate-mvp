// 质量评估器：评估辩论整体质量

import { Argument, DebateResult, QualityAssessment } from "../types";
import { LogicValidator } from "../validators/logic-validator";
import { LawValidator } from "../validators/law-validator";

/**
 * 质量评估器类
 */
export class QualityAssessor {
  /**
   * 评估辩论质量
   */
  static assessDebate(
    plaintiffArguments: Argument[],
    defendantArguments: Argument[],
  ): QualityAssessment {
    const allArguments = [...plaintiffArguments, ...defendantArguments];

    // 1. 评估逻辑清晰度
    const logicClarityScore =
      LogicValidator.calculateAverageLogicClarityScore(allArguments);
    const logicDetails = this.assessLogicDetails(allArguments);

    // 2. 评估法律准确性
    const legalAccuracyScore =
      LawValidator.calculateAverageLegalAccuracyScore(allArguments);
    const legalDetails = this.assessLegalDetails(allArguments);

    // 3. 评估正反方平衡度
    const balanceScore = this.assessBalance(
      plaintiffArguments,
      defendantArguments,
    );
    const balanceDetails = this.assessBalanceDetails(
      plaintiffArguments,
      defendantArguments,
    );

    // 4. 计算整体质量
    const overallScore =
      (logicClarityScore + legalAccuracyScore + balanceScore) / 3;

    // 5. 判断是否通过
    const passed = overallScore >= 7.0;

    // 6. 生成改进建议
    const suggestions = this.generateSuggestions(
      logicClarityScore,
      legalAccuracyScore,
      balanceScore,
    );

    return {
      passed,
      overallScore,
      metrics: {
        logicClarity: {
          score: logicClarityScore,
          details: logicDetails,
        },
        legalAccuracy: {
          score: legalAccuracyScore,
          details: legalDetails,
        },
        balance: {
          score: balanceScore,
          details: balanceDetails,
        },
      },
      suggestions,
    };
  }

  /**
   * 评估逻辑细节
   */
  private static assessLogicDetails(arguments_: Argument[]): string[] {
    const details: string[] = [];

    const avgContentLength =
      arguments_.reduce((sum, arg) => sum + arg.content.length, 0) /
      arguments_.length;

    const avgReasoningLength =
      arguments_.reduce((sum, arg) => sum + arg.reasoning.length, 0) /
      arguments_.length;

    const avgLegalBasisCount =
      arguments_.reduce((sum, arg) => sum + arg.legalBasis.length, 0) /
      arguments_.length;

    if (avgContentLength >= 30 && avgContentLength <= 200) {
      details.push(`论点内容长度适中（平均${avgContentLength.toFixed(0)}字）`);
    } else if (avgContentLength < 30) {
      details.push("论点内容偏短，建议补充");
    } else {
      details.push("论点内容偏长，建议精简");
    }

    if (avgReasoningLength >= 100 && avgReasoningLength <= 500) {
      details.push(
        `推理过程长度适中（平均${avgReasoningLength.toFixed(0)}字）`,
      );
    } else if (avgReasoningLength < 100) {
      details.push("推理过程偏短，建议补充");
    } else {
      details.push("推理过程偏长，建议精简");
    }

    if (avgLegalBasisCount >= 1 && avgLegalBasisCount <= 3) {
      details.push(
        `法律依据数量适中（平均${avgLegalBasisCount.toFixed(1)}个）`,
      );
    } else if (avgLegalBasisCount < 1) {
      details.push("法律依据不足，建议增加");
    } else {
      details.push("法律依据过多，建议精简");
    }

    return details;
  }

  /**
   * 评估法律细节
   */
  private static assessLegalDetails(arguments_: Argument[]): string[] {
    const details: string[] = [];

    const argumentsWithLegalBasis = arguments_.filter(
      (arg) => arg.legalBasis.length > 0,
    );

    if (argumentsWithLegalBasis.length === arguments_.length) {
      details.push("所有论点都有法律依据");
    } else {
      const withoutLegalBasis =
        arguments_.length - argumentsWithLegalBasis.length;
      details.push(`${withoutLegalBasis}个论点缺少法律依据`);
    }

    const totalLegalBasis = arguments_.reduce(
      (sum, arg) => sum + arg.legalBasis.length,
      0,
    );

    const avgRelevance =
      arguments_.reduce(
        (sum, arg) =>
          sum + arg.legalBasis.reduce((s, b) => s + (b.relevance || 0), 0),
        0,
      ) / (totalLegalBasis || 1);

    if (avgRelevance >= 0.8) {
      details.push(`法条相关性高（平均${(avgRelevance * 100).toFixed(0)}%）`);
    } else if (avgRelevance >= 0.6) {
      details.push(`法条相关性中等（平均${(avgRelevance * 100).toFixed(0)}%）`);
    } else {
      details.push(`法条相关性偏低（平均${(avgRelevance * 100).toFixed(0)}%）`);
    }

    return details;
  }

  /**
   * 评估平衡度
   */
  private static assessBalance(
    plaintiffArguments: Argument[],
    defendantArguments: Argument[],
  ): number {
    let score = 5.0; // 基础分

    // 1. 数量平衡
    const countDiff = Math.abs(
      plaintiffArguments.length - defendantArguments.length,
    );
    if (countDiff === 0) {
      score += 2.5;
    } else if (countDiff === 1) {
      score += 2.0;
    } else if (countDiff === 2) {
      score += 1.5;
    } else {
      score += 1.0;
    }

    // 2. 质量平衡
    const plaintiffAvgScore =
      plaintiffArguments.reduce((sum, arg) => sum + arg.overallScore, 0) /
      (plaintiffArguments.length || 1);
    const defendantAvgScore =
      defendantArguments.reduce((sum, arg) => sum + arg.overallScore, 0) /
      (defendantArguments.length || 1);

    const qualityDiff = Math.abs(plaintiffAvgScore - defendantAvgScore);
    if (qualityDiff < 0.5) {
      score += 2.5;
    } else if (qualityDiff < 1.0) {
      score += 2.0;
    } else if (qualityDiff < 1.5) {
      score += 1.5;
    } else {
      score += 1.0;
    }

    return Math.min(10, Math.max(0, score));
  }

  /**
   * 评估平衡度细节
   */
  private static assessBalanceDetails(
    plaintiffArguments: Argument[],
    defendantArguments: Argument[],
  ): string[] {
    const details: string[] = [];

    // 数量对比
    const plaintiffCount = plaintiffArguments.length;
    const defendantCount = defendantArguments.length;
    details.push(`原告论点数量：${plaintiffCount}`);
    details.push(`被告论点数量：${defendantCount}`);

    if (plaintiffCount === defendantCount) {
      details.push("论点数量平衡");
    } else {
      const diff = Math.abs(plaintiffCount - defendantCount);
      details.push(`论点数量差异：${diff}个`);
    }

    // 质量对比
    const plaintiffAvgScore =
      plaintiffArguments.reduce((sum, arg) => sum + arg.overallScore, 0) /
      (plaintiffCount || 1);
    const defendantAvgScore =
      defendantArguments.reduce((sum, arg) => sum + arg.overallScore, 0) /
      (defendantCount || 1);

    details.push(`原告平均质量：${plaintiffAvgScore.toFixed(1)}/10`);
    details.push(`被告平均质量：${defendantAvgScore.toFixed(1)}/10`);

    if (Math.abs(plaintiffAvgScore - defendantAvgScore) < 0.5) {
      details.push("论点质量平衡");
    } else {
      details.push("论点质量存在一定差异");
    }

    return details;
  }

  /**
   * 生成改进建议
   */
  private static generateSuggestions(
    logicClarity: number,
    legalAccuracy: number,
    balance: number,
  ): string[] {
    const suggestions: string[] = [];

    if (logicClarity < 7.0) {
      suggestions.push("建议增加推理过程的详细程度");
      suggestions.push("建议加强论点与事实的关联性");
    }

    if (legalAccuracy < 7.0) {
      suggestions.push("建议增加法律依据的数量");
      suggestions.push("建议提高法条与论点的相关性");
    }

    if (balance < 7.0) {
      suggestions.push("建议调整论点数量以达到平衡");
      suggestions.push("建议优化较弱方论点的质量");
    }

    if (logicClarity >= 8.0 && legalAccuracy >= 8.0 && balance >= 8.0) {
      suggestions.push("辩论质量优秀，可直接使用");
    }

    return suggestions;
  }

  /**
   * 创建DebateResult中的质量指标
   */
  static createQualityMetrics(
    plaintiffArguments: Argument[],
    defendantArguments: Argument[],
  ): DebateResult["qualityMetrics"] {
    const logicClarity = LogicValidator.calculateAverageLogicClarityScore([
      ...plaintiffArguments,
      ...defendantArguments,
    ]);

    const legalAccuracy = LawValidator.calculateAverageLegalAccuracyScore([
      ...plaintiffArguments,
      ...defendantArguments,
    ]);

    const balanceScore = this.assessBalance(
      plaintiffArguments,
      defendantArguments,
    );

    const plaintiffLogic =
      LogicValidator.calculateAverageLogicClarityScore(plaintiffArguments);
    const plaintiffLegal =
      LawValidator.calculateAverageLegalAccuracyScore(plaintiffArguments);
    const defendantLogic =
      LogicValidator.calculateAverageLogicClarityScore(defendantArguments);
    const defendantLegal =
      LawValidator.calculateAverageLegalAccuracyScore(defendantArguments);

    const overallQuality = (logicClarity + legalAccuracy + balanceScore) / 3;

    return {
      overallQuality,
      logicClarity,
      legalAccuracy,
      balanceScore,
      argumentCount: {
        plaintiff: plaintiffArguments.length,
        defendant: defendantArguments.length,
      },
      averageScores: {
        plaintiffLogic,
        plaintiffLegal,
        defendantLogic,
        defendantLegal,
      },
    };
  }
}
