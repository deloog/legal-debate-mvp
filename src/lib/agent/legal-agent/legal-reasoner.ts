/**
 * LegalReasoner - 法律推理器
 *
 * 功能：
 * 1. 构建推理链
 * 2. 支持演绎、归纳、类比推理
 * 3. 逻辑验证
 * 4. 生成结论
 */

import { createHash } from 'crypto';
import type {
  Fact,
  ReasoningStep,
  ReasoningChain,
  LogicValidationResult,
  LawArticle,
} from './types';

// =============================================================================
// 类型定义
// =============================================================================

interface ReasoningOptions {
  /** 最大推理步骤数 */
  maxSteps?: number;
  /** 推理类型（deductive/inductive/analogical） */
  reasoningType?: 'deductive' | 'inductive' | 'analogical';
  /** 最小置信度 */
  minConfidence?: number;
}

// =============================================================================
// LegalReasoner类
// =============================================================================

export class LegalReasoner {
  private readonly defaultOptions: ReasoningOptions = {
    maxSteps: 10,
    reasoningType: 'deductive',
    minConfidence: 0.5,
  };

  /**
   * 构建推理链
   */
  async buildReasoningChain(
    facts: Fact[],
    laws: LawArticle[],
    options: ReasoningOptions = {}
  ): Promise<ReasoningChain> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    // 1. 提取关键事实
    const keyFacts = this.extractKeyFacts(facts);

    // 2. 构建推理步骤
    const steps = this.buildSteps(keyFacts, laws, opts);

    // 3. 生成结论
    const conclusion = this.generateConclusion(steps, keyFacts, laws);

    // 4. 计算逻辑评分
    const logicScore = this.calculateLogicScore(steps, conclusion);

    // 5. 计算完整性
    const completeness = this.calculateCompleteness(steps, facts, laws);

    return {
      facts: keyFacts,
      laws,
      steps,
      conclusion,
      logicScore,
      completeness,
      buildTime: Date.now() - startTime,
    };
  }

  /**
   * 提取关键事实
   */
  private extractKeyFacts(facts: Fact[]): Fact[] {
    // 按相关性排序，提取前N个关键事实
    return facts
      .filter(f => f.relevance > 0.5)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
  }

  /**
   * 构建推理步骤
   */
  private buildSteps(
    facts: Fact[],
    laws: LawArticle[],
    options: ReasoningOptions
  ): ReasoningStep[] {
    const steps: ReasoningStep[] = [];
    const maxSteps = options.maxSteps || 10;
    const reasoningType = options.reasoningType || 'deductive';

    for (let i = 0; i < maxSteps && i < laws.length; i++) {
      const law = laws[i];
      const relatedFacts = this.findRelatedFacts(facts, law);

      if (relatedFacts.length === 0) {
        continue;
      }

      const step: ReasoningStep = {
        id: this.generateStepId(),
        order: i + 1,
        content: this.generateStepContent(law, relatedFacts, i + 1),
        law,
        facts: relatedFacts,
        logicType: reasoningType,
        confidence: this.calculateConfidence(law, relatedFacts),
      };

      // 检查置信度是否满足要求
      if (step.confidence >= (options.minConfidence || 0.5)) {
        steps.push(step);
      }
    }

    return steps;
  }

  /**
   * 查找相关事实
   */
  private findRelatedFacts(facts: Fact[], law: LawArticle): Fact[] {
    const keywords = law.keywords || [];
    const lawText = law.content.toLowerCase();

    return facts.filter(fact => {
      const factText = fact.content.toLowerCase();

      // 检查是否包含法条关键词
      for (const keyword of keywords) {
        if (factText.includes(keyword.toLowerCase())) {
          return true;
        }
      }

      // 检查是否包含法条文本中的词
      const lawWords = lawText.split(/\s+/).slice(0, 10);
      for (const word of lawWords) {
        if (factText.includes(word)) {
          return true;
        }
      }

      return false;
    });
  }

  /**
   * 生成步骤内容
   */
  private generateStepContent(
    law: LawArticle,
    facts: Fact[],
    order: number
  ): string {
    const templates = [
      `根据法条${law.articleNumber}，结合事实${facts.map(f => f.id).join('、')}，可以得出推论。`,
      `依据${law.lawName}第${law.articleNumber}条，以及相关事实${facts.map(f => f.id).join('、')}，适用该法条。`,
      `第${order}步：根据${law.articleNumber}条规定，${this.truncateContent(law.content, 30)}，结合事实${facts.map(f => f.id).join('、')}，适用。`,
    ];

    return templates[order % templates.length];
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(law: LawArticle, facts: Fact[]): number {
    let confidence = 0.5;

    // 基于法条级别
    if (law.level === 'constitution') {
      confidence += 0.3;
    } else if (law.level === 'law') {
      confidence += 0.2;
    }

    // 基于事实数量和质量
    const avgRelevance =
      facts.reduce((sum, f) => sum + f.relevance, 0) / facts.length;
    confidence += avgRelevance * 0.2;

    return Math.min(confidence, 1.0);
  }

  /**
   * 生成结论
   */
  private generateConclusion(
    steps: ReasoningStep[],
    facts: Fact[],
    _laws: LawArticle[]
  ): string {
    if (steps.length === 0) {
      return '由于缺乏足够的法律依据和事实支持，无法得出有效结论。';
    }

    const lastStep = steps[steps.length - 1];
    const applicableLaws = steps.length;

    return `综上所述，基于${applicableLaws}个法条和${facts.length}个关键事实，根据${lastStep.law.lawName}等法律规定，可以得出结论：根据案件事实和法律规定，${this.getConclusionTemplate(lastStep)}。`;
  }

  /**
   * 获取结论模板
   */
  private getConclusionTemplate(step: ReasoningStep): string {
    const templates = [
      '原告的诉请具有法律依据，应当予以支持',
      '被告应当承担相应的法律责任',
      '双方应当履行各自的法律义务',
      '应当依照法律规定进行裁判',
    ];

    return templates[step.order % templates.length];
  }

  /**
   * 计算逻辑评分
   */
  private calculateLogicScore(
    steps: ReasoningStep[],
    conclusion: string
  ): number {
    if (steps.length === 0) {
      return 0;
    }

    let score = 0;

    // 基于推理步骤数量
    score += Math.min(steps.length / 5, 1.0) * 0.3;

    // 基于平均置信度
    const avgConfidence =
      steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
    score += avgConfidence * 0.4;

    // 基于结论质量（简化的长度和关键词检查）
    if (conclusion.length > 20 && conclusion.includes('结论')) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 计算完整性
   */
  private calculateCompleteness(
    steps: ReasoningStep[],
    facts: Fact[],
    laws: LawArticle[]
  ): number {
    let completeness = 0;

    // 检查是否覆盖了主要法条
    const lawCoverage = steps.length / Math.min(laws.length, 5);
    completeness += lawCoverage * 0.4;

    // 检查是否覆盖了关键事实
    const usedFacts = new Set<string>();
    for (const step of steps) {
      for (const fact of step.facts) {
        usedFacts.add(fact.id);
      }
    }
    const factCoverage = usedFacts.size / facts.length;
    completeness += factCoverage * 0.4;

    // 检查推理链的连续性
    if (steps.length > 1) {
      completeness += 0.2;
    }

    return Math.min(completeness, 1.0);
  }

  /**
   * 验证逻辑
   */
  validateLogic(reasoningChain: ReasoningChain): LogicValidationResult {
    const issues: LogicValidationResult['issues'] = [];
    let passed = true;

    // 检查是否有矛盾
    const contradictions = this.checkContradictions(reasoningChain);
    issues.push(...contradictions);

    // 检查是否有缺失前提
    const missingPremises = this.checkMissingPremises(reasoningChain);
    issues.push(...missingPremises);

    // 检查是否有无效推理
    const invalidInferences = this.checkInvalidInferences(reasoningChain);
    issues.push(...invalidInferences);

    // 检查是否有弱论点
    const weakArguments = this.checkWeakArguments(reasoningChain);
    issues.push(...weakArguments);

    passed = issues.length === 0;

    return {
      passed,
      score: this.calculateLogicScore(
        reasoningChain.steps,
        reasoningChain.conclusion
      ),
      issues,
    };
  }

  /**
   * 检查矛盾
   */
  private checkContradictions(
    reasoningChain: ReasoningChain
  ): LogicValidationResult['issues'] {
    const issues: LogicValidationResult['issues'] = [];

    // 简化处理：检查结论是否与前提矛盾
    const conclusionKeywords = this.extractKeywords(reasoningChain.conclusion);
    const premiseKeywords = new Set<string>();

    for (const step of reasoningChain.steps) {
      const stepKeywords = this.extractKeywords(step.content);
      for (const keyword of stepKeywords) {
        premiseKeywords.add(keyword);
      }
    }

    // 检查结论中是否有否定词但前提中没有
    const negationWords = ['不', '无', '否', '非', '未'];
    for (const word of negationWords) {
      if (conclusionKeywords.includes(word)) {
        let found = false;
        for (const kw of premiseKeywords) {
          if (kw.includes(word)) {
            found = true;
            break;
          }
        }
        if (!found) {
          issues.push({
            type: 'contradiction',
            description: `结论中包含否定词"${word}"，但前提中未明确提及`,
            severity: 'medium',
          });
        }
      }
    }

    return issues;
  }

  /**
   * 检查缺失前提
   */
  private checkMissingPremises(
    reasoningChain: ReasoningChain
  ): LogicValidationResult['issues'] {
    const issues: LogicValidationResult['issues'] = [];

    // 检查推理链是否缺少必要步骤
    if (reasoningChain.steps.length < 2) {
      issues.push({
        type: 'missing_premise',
        description: '推理步骤过少，可能缺少必要的前提',
        severity: 'high',
      });
    }

    return issues;
  }

  /**
   * 检查无效推理
   */
  private checkInvalidInferences(
    reasoningChain: ReasoningChain
  ): LogicValidationResult['issues'] {
    const issues: LogicValidationResult['issues'] = [];

    // 检查每一步推理是否有效
    for (const step of reasoningChain.steps) {
      if (step.facts.length === 0) {
        issues.push({
          type: 'invalid_inference',
          description: `步骤${step.order}没有相关事实支持`,
          severity: 'high',
        });
      }

      if (step.confidence < 0.5) {
        issues.push({
          type: 'invalid_inference',
          description: `步骤${step.order}的置信度过低`,
          severity: 'medium',
        });
      }
    }

    return issues;
  }

  /**
   * 检查弱论点
   */
  private checkWeakArguments(
    reasoningChain: ReasoningChain
  ): LogicValidationResult['issues'] {
    const issues: LogicValidationResult['issues'] = [];

    // 检查结论是否过于简短
    if (reasoningChain.conclusion.length < 50) {
      issues.push({
        type: 'weak_argument',
        description: '结论过于简短，缺乏充分论证',
        severity: 'low',
      });
    }

    return issues;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简化处理：提取常见关键词
    const keywords = text
      .split(/[\s，。；：，]+/)
      .filter(word => word.length > 1);
    return keywords;
  }

  /**
   * 生成步骤ID
   */
  private generateStepId(): string {
    return createHash('sha256')
      .update(`step-${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * 截断内容
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  /**
   * 批量构建推理链
   */
  async batchBuildReasoningChains(
    cases: { facts: Fact[]; laws: LawArticle[] }[],
    options: ReasoningOptions = {}
  ): Promise<ReasoningChain[]> {
    const results: ReasoningChain[] = [];

    for (const caseInfo of cases) {
      const chain = await this.buildReasoningChain(
        caseInfo.facts,
        caseInfo.laws,
        options
      );
      results.push(chain);
    }

    return results;
  }
}
