/**
 * AI案件评估服务
 *
 * 提供案件评估功能，包括：
 * - 胜诉率评估
 * - 案件难度分析
 * - 风险等级评估
 * - 费用建议计算
 * - 关键法律点识别
 * - 类似案例推荐
 */

import { prisma } from '@/lib/db/prisma';
import { AIAssessment } from '@/types/consultation';
import { logger } from '@/lib/logger';

/**
 * 案件评估输入参数
 */
export interface CaseAssessmentInput {
  caseType?: string;
  caseSummary: string;
  clientDemand?: string;
  consultationType?: string;
}

/**
 * 难度等级
 */
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * 风险等级
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * 案件评估服务类
 */
export class CaseAssessmentService {
  /**
   * 执行案件评估
   */
  public async assess(input: CaseAssessmentInput): Promise<AIAssessment> {
    try {
      // 1. 分析案情关键信息
      const keyPoints = this.extractKeyPoints(input.caseSummary);

      // 2. 评估案件难度
      const difficultyResult = this.assessDifficulty(input);

      // 3. 评估风险等级
      const riskResult = this.assessRisk(input);

      // 4. 评估胜诉率
      const winRateResult = await this.estimateWinRate(input);

      // 5. 计算费用建议
      const feeResult = await this.calculateSuggestedFee(
        input,
        difficultyResult.difficulty
      );

      // 6. 获取类似案例（如果可用）
      const similarCases = await this.findSimilarCases(input);

      // 7. 生成建议
      const suggestions = this.generateSuggestions(
        input,
        difficultyResult,
        riskResult,
        winRateResult
      );

      return {
        winRate: winRateResult.rate,
        winRateReasoning: winRateResult.reasoning,
        difficulty: difficultyResult.difficulty,
        difficultyFactors: difficultyResult.factors,
        riskLevel: riskResult.level,
        riskFactors: riskResult.factors,
        suggestedFeeMin: feeResult.min,
        suggestedFeeMax: feeResult.max,
        feeReasoning: feeResult.reasoning,
        keyLegalPoints: keyPoints,
        suggestions,
        similarCases,
      };
    } catch (error) {
      logger.error('案件评估失败:', error);
      throw new Error('案件评估失败，请重试');
    }
  }

  /**
   * 提取案情关键法律点
   */
  private extractKeyPoints(
    caseSummary: string
  ): Array<{ point: string; relevantLaw: string }> {
    const keyPoints: Array<{ point: string; relevantLaw: string }> = [];

    // 劳动争议相关关键词检测
    const laborKeywords = [
      { keyword: '解除劳动合同', law: '《劳动合同法》第39-41条' },
      { keyword: '经济补偿', law: '《劳动合同法》第46-47条' },
      { keyword: '加班', law: '《劳动法》第44条' },
      { keyword: '工资拖欠', law: '《劳动法》第50条' },
      { keyword: '社保', law: '《社会保险法》第58条' },
      { keyword: '工伤', law: '《工伤保险条例》第14-15条' },
      { keyword: '竞业限制', law: '《劳动合同法》第23-24条' },
    ];

    // 合同纠纷相关关键词检测
    const contractKeywords = [
      { keyword: '违约', law: '《民法典》第577-585条' },
      { keyword: '解除合同', law: '《民法典》第562-566条' },
      { keyword: '定金', law: '《民法典》第586-588条' },
      { keyword: '不可抗力', law: '《民法典》第180条' },
      { keyword: '欺诈', law: '《民法典》第148-149条' },
    ];

    // 婚姻家庭相关关键词检测
    const familyKeywords = [
      { keyword: '离婚', law: '《民法典》第1076-1092条' },
      { keyword: '财产分割', law: '《民法典》第1087条' },
      { keyword: '抚养权', law: '《民法典》第1084条' },
      { keyword: '抚养费', law: '《民法典》第1085条' },
      { keyword: '家暴', law: '《反家庭暴力法》第2条' },
    ];

    const allKeywords = [
      ...laborKeywords,
      ...contractKeywords,
      ...familyKeywords,
    ];

    for (const { keyword, law } of allKeywords) {
      if (caseSummary.includes(keyword)) {
        keyPoints.push({
          point: keyword,
          relevantLaw: law,
        });
      }
    }

    // 如果没有匹配到关键词，返回通用建议
    if (keyPoints.length === 0) {
      keyPoints.push({
        point: '需进一步分析案情',
        relevantLaw: '根据具体情况确定适用法律',
      });
    }

    return keyPoints;
  }

  /**
   * 评估案件难度
   */
  private assessDifficulty(input: CaseAssessmentInput): {
    difficulty: DifficultyLevel;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    const summary = input.caseSummary.toLowerCase();

    // 复杂度因素评估
    if (summary.includes('多方') || summary.includes('第三人')) {
      factors.push('涉及多方当事人');
      score += 2;
    }

    if (summary.includes('证据') && summary.includes('缺失')) {
      factors.push('关键证据可能缺失');
      score += 2;
    }

    if (summary.includes('跨境') || summary.includes('涉外')) {
      factors.push('涉及跨境或涉外因素');
      score += 3;
    }

    if (summary.length > 500) {
      factors.push('案情较为复杂');
      score += 1;
    }

    if (summary.includes('刑事') || summary.includes('犯罪')) {
      factors.push('可能涉及刑事问题');
      score += 2;
    }

    if (summary.includes('上诉') || summary.includes('再审')) {
      factors.push('涉及复杂程序问题');
      score += 2;
    }

    // 计算难度等级
    let difficulty: DifficultyLevel;
    if (score >= 5) {
      difficulty = 'HARD';
      if (factors.length === 0) {
        factors.push('综合评估案件复杂度较高');
      }
    } else if (score >= 2) {
      difficulty = 'MEDIUM';
      if (factors.length === 0) {
        factors.push('案件存在一定复杂因素');
      }
    } else {
      difficulty = 'EASY';
      if (factors.length === 0) {
        factors.push('案情相对简单明确');
      }
    }

    return { difficulty, factors };
  }

  /**
   * 评估风险等级
   */
  private assessRisk(input: CaseAssessmentInput): {
    level: RiskLevel;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    const summary = input.caseSummary.toLowerCase();

    // 风险因素评估
    if (summary.includes('证据不足') || summary.includes('没有证据')) {
      factors.push('证据可能不足');
      score += 3;
    }

    if (summary.includes('时效') || summary.includes('过期')) {
      factors.push('可能存在诉讼时效问题');
      score += 3;
    }

    if (summary.includes('对方') && summary.includes('公司')) {
      factors.push('对方为公司主体，可能资源充足');
      score += 1;
    }

    if (summary.includes('已经判决') || summary.includes('败诉')) {
      factors.push('存在不利先例');
      score += 2;
    }

    if (summary.includes('无合同') || summary.includes('口头约定')) {
      factors.push('缺乏书面合同依据');
      score += 2;
    }

    if (summary.includes('争议') && summary.includes('大')) {
      factors.push('争议金额较大');
      score += 1;
    }

    // 计算风险等级
    let level: RiskLevel;
    if (score >= 5) {
      level = 'HIGH';
      if (factors.length === 0) {
        factors.push('综合评估风险较高');
      }
    } else if (score >= 2) {
      level = 'MEDIUM';
      if (factors.length === 0) {
        factors.push('存在一定风险因素');
      }
    } else {
      level = 'LOW';
      if (factors.length === 0) {
        factors.push('风险相对可控');
      }
    }

    return { level, factors };
  }

  /**
   * 估算胜诉率
   */
  private async estimateWinRate(
    input: CaseAssessmentInput
  ): Promise<{ rate: number; reasoning: string }> {
    let baseRate = 0.5; // 基础胜诉率
    const factors: string[] = [];

    const summary = input.caseSummary.toLowerCase();

    // 正面因素
    if (summary.includes('合同') && !summary.includes('无合同')) {
      baseRate += 0.1;
      factors.push('有书面合同支持');
    }

    if (summary.includes('证据') && !summary.includes('证据不足')) {
      baseRate += 0.1;
      factors.push('有相关证据');
    }

    if (summary.includes('录音') || summary.includes('录像')) {
      baseRate += 0.05;
      factors.push('有视听资料佐证');
    }

    if (summary.includes('证人')) {
      baseRate += 0.05;
      factors.push('有证人证言');
    }

    // 负面因素
    if (summary.includes('证据不足') || summary.includes('没有证据')) {
      baseRate -= 0.15;
      factors.push('证据不足');
    }

    if (summary.includes('时效') || summary.includes('过期')) {
      baseRate -= 0.2;
      factors.push('可能存在时效问题');
    }

    if (summary.includes('无合同') || summary.includes('口头')) {
      baseRate -= 0.1;
      factors.push('缺乏书面依据');
    }

    // 确保胜诉率在合理范围内
    baseRate = Math.max(0.1, Math.min(0.9, baseRate));

    // 生成评估理由
    let reasoning: string;
    if (baseRate >= 0.7) {
      reasoning = `综合评估胜诉可能性较高。${factors.length > 0 ? '主要因素：' + factors.join('、') : ''}`;
    } else if (baseRate >= 0.4) {
      reasoning = `胜诉可能性存在不确定性，需要进一步准备。${factors.length > 0 ? '关注因素：' + factors.join('、') : ''}`;
    } else {
      reasoning = `胜诉可能性较低，建议谨慎考虑。${factors.length > 0 ? '主要问题：' + factors.join('、') : ''}`;
    }

    return { rate: baseRate, reasoning };
  }

  /**
   * 计算费用建议
   */
  private async calculateSuggestedFee(
    input: CaseAssessmentInput,
    difficulty: DifficultyLevel
  ): Promise<{ min: number; max: number; reasoning: string }> {
    // 获取案件类型配置
    let baseFee = 5000;
    let maxMultiplier = 3;

    if (input.caseType) {
      const caseTypeConfig = await prisma.caseTypeConfig.findFirst({
        where: {
          OR: [
            { code: input.caseType },
            { name: { contains: input.caseType } },
          ],
          isActive: true,
        },
      });

      if (caseTypeConfig) {
        baseFee = Number(caseTypeConfig.baseFee);
        if (caseTypeConfig.complexityLevel) {
          maxMultiplier = caseTypeConfig.complexityLevel;
        }
      }
    }

    // 根据难度调整费用
    let difficultyMultiplier = 1;
    let reasoning = '';

    switch (difficulty) {
      case 'EASY':
        difficultyMultiplier = 1;
        reasoning = '案件复杂度较低，费用按基础标准计算';
        break;
      case 'MEDIUM':
        difficultyMultiplier = 1.5;
        reasoning = '案件存在一定复杂因素，费用适当上浮';
        break;
      case 'HARD':
        difficultyMultiplier = 2;
        reasoning = '案件较为复杂，需要投入更多精力和资源';
        break;
    }

    const minFee = Math.round(baseFee * difficultyMultiplier);
    const maxFee = Math.round(baseFee * difficultyMultiplier * maxMultiplier);

    return {
      min: minFee,
      max: maxFee,
      reasoning,
    };
  }

  /**
   * 查找类似案例
   */
  private async findSimilarCases(
    input: CaseAssessmentInput
  ): Promise<Array<{ caseName: string; result: string; similarity: number }>> {
    // 简单的关键词匹配查找类似案例
    try {
      const keywords = input.caseSummary
        .split(/[，。、；\s]+/)
        .filter(word => word.length >= 2)
        .slice(0, 5);

      if (keywords.length === 0) {
        return [];
      }

      const caseExamples = await prisma.caseExample.findMany({
        where: {
          OR: keywords.map(keyword => ({
            OR: [
              { title: { contains: keyword } },
              { facts: { contains: keyword } },
              { cause: { contains: keyword } },
            ],
          })),
        },
        take: 5,
        select: {
          title: true,
          result: true,
          cause: true,
        },
      });

      return caseExamples.map(example => ({
        caseName: example.title,
        result:
          example.result === 'WIN'
            ? '胜诉'
            : example.result === 'LOSE'
              ? '败诉'
              : example.result === 'PARTIAL'
                ? '部分支持'
                : '撤诉',
        similarity: 0.7, // 简化处理，实际应计算相似度
      }));
    } catch (error) {
      logger.error('查找类似案例失败:', error);
      return [];
    }
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    input: CaseAssessmentInput,
    difficultyResult: { difficulty: DifficultyLevel; factors: string[] },
    riskResult: { level: RiskLevel; factors: string[] },
    winRateResult: { rate: number; reasoning: string }
  ): string[] {
    const suggestions: string[] = [];

    // 基于胜诉率的建议
    if (winRateResult.rate >= 0.7) {
      suggestions.push('建议尽快收集固定相关证据，把握诉讼时机');
    } else if (winRateResult.rate >= 0.4) {
      suggestions.push('建议先与对方沟通协商，同时做好诉讼准备');
      suggestions.push('可考虑先发律师函进行交涉');
    } else {
      suggestions.push('建议优先考虑调解或和解方式解决');
      suggestions.push('如决定诉讼，需要充分准备应对不利结果');
    }

    // 基于风险的建议
    if (riskResult.level === 'HIGH') {
      suggestions.push('建议充分评估诉讼成本与预期收益');
      riskResult.factors.forEach(factor => {
        if (factor.includes('证据')) {
          suggestions.push('建议重点收集补充相关证据');
        }
        if (factor.includes('时效')) {
          suggestions.push('建议尽快采取法律行动，避免超过诉讼时效');
        }
      });
    }

    // 基于难度的建议
    if (difficultyResult.difficulty === 'HARD') {
      suggestions.push('建议委托专业律师全程代理');
    }

    // 通用建议
    if (input.caseSummary.includes('合同')) {
      suggestions.push('建议仔细审查合同条款，特别是争议解决条款');
    }

    // 去重并限制数量
    const uniqueSuggestions = [...new Set(suggestions)];
    return uniqueSuggestions.slice(0, 5);
  }
}

/**
 * 创建案件评估服务实例
 */
export function createCaseAssessmentService(): CaseAssessmentService {
  return new CaseAssessmentService();
}
