/**
 * ArgumentGenerator - 论点生成器
 *
 * 功能：
 * 1. 根据法律依据生成论点
 * 2. 支持主论点、支持论据、法律引用、反驳论点
 * 3. 计算论点强度
 * 4. 批量生成论点
 * 5. 生成推理链（新增）
 * 6. 使用逻辑连接词（新增）
 * 7. 识别因果关系（新增）
 */

import { createHash } from 'crypto';
import type {
  LegalBasis,
  Argument,
  ArgumentGenerationResult,
  ArgumentSide,
  ArgumentType,
  LawArticle,
} from './types';
import {
  generateReasoningChain,
  identifyCausalType,
  type CausalType,
} from './reasoning-rules';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 推理链信息
 */
export interface ReasoningChainInfo {
  /** 推理步骤 */
  steps: string[];
  /** 推理类型 */
  type: 'deductive' | 'inductive' | 'analogical';
}

// =============================================================================
// 类型定义
// =============================================================================

interface GenerationOptions {
  /** 主论点数量 */
  mainCount?: number;
  /** 支持论据数量 */
  supportingCount?: number;
  /** 法律引用数量 */
  legalReferenceCount?: number;
  /** 论点方向（原告/被告） */
  side?: ArgumentSide;
}

interface ArgumentTemplate {
  type: ArgumentType;
  templates: string[];
}

// =============================================================================
// ArgumentGenerator类
// =============================================================================

export class ArgumentGenerator {
  private readonly defaultOptions: GenerationOptions = {
    mainCount: 3,
    supportingCount: 5,
    legalReferenceCount: 2,
    side: 'PLAINTIFF',
  };

  private readonly templates: Record<ArgumentType, ArgumentTemplate> = {
    main: {
      type: 'main',
      templates: [
        '根据法条{articleNumber}的规定，{content}，因此应当支持原告诉请。',
        '基于{lawName}第{articleNumber}条，{content}，被告应当承担相应责任。',
        '依据{articleNumber}条规定，{content}，原告的主张具有法律依据。',
        '由于{articleNumber}条规定{content}，故而应当支持原告诉请。',
        '鉴于{articleNumber}条明确规定{content}，所以原告的主张成立。',
      ],
    },
    supporting: {
      type: 'supporting',
      templates: [
        '事实{factIndex}证明了{content}。',
        '从{factIndex}可以看出，{content}。',
        '结合{articleNumber}条的规定，{content}。',
      ],
    },
    legal_reference: {
      type: 'legal_reference',
      templates: [
        '参见{lawName}第{articleNumber}条：{content}',
        '根据{articleNumber}条规定，{content}',
      ],
    },
    rebuttal: {
      type: 'rebuttal',
      templates: [
        '被告关于{content}的主张与法条{articleNumber}相悖。',
        '{articleNumber}条明确规定{content}，因此被告的抗辩不成立。',
        '根据{articleNumber}条规定，{content}，被告的理由不成立。',
      ],
    },
  };

  /**
   * 生成论点
   */
  async generate(
    legalBasis: LegalBasis,
    options: GenerationOptions = {}
  ): Promise<ArgumentGenerationResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    // 1. 生成主论点
    const mainArgs = this.generateMainArguments(legalBasis, opts);

    // 2. 生成支持论据
    const supportingArgs = this.generateSupportingArguments(legalBasis, opts);

    // 3. 生成法律引用
    const legalRefs = this.generateLegalReferences(legalBasis, opts);

    // 4. 合并所有论点
    const allArgs = [...mainArgs, ...supportingArgs, ...legalRefs];

    // 5. 计算统计信息
    const mainArgCount = mainArgs.length;
    const supportingArgCount = supportingArgs.length;
    const legalRefCount = legalRefs.length;
    const avgStrength = this.calculateAverageStrength(allArgs);

    return {
      arguments: allArgs,
      mainArgumentCount: mainArgCount,
      supportingArgumentCount: supportingArgCount,
      legalReferenceCount: legalRefCount,
      averageStrength: avgStrength,
      generationTime: Date.now() - startTime,
    };
  }

  /**
   * 生成主论点（增强版 - 包含推理链）
   */
  private generateMainArguments(
    legalBasis: LegalBasis,
    options: GenerationOptions
  ): Argument[] {
    const args: Argument[] = [];
    const count = options.mainCount ?? 3;

    if (count === 0 || legalBasis.articles.length === 0) {
      return args;
    }

    for (let i = 0; i < count && i < legalBasis.articles.length; i++) {
      const article = legalBasis.articles[i];
      const template = this.getRandomTemplate('main');
      const content = template
        .replace('{articleNumber}', article.articleNumber)
        .replace('{lawName}', article.lawName)
        .replace('{content}', this.truncateContent(article.content, 30));

      // 生成推理链
      const reasoningChain = this.generateEnhancedReasoningChain(
        article,
        legalBasis.facts
      );

      // 识别因果关系
      const causalType = identifyCausalType(content);

      // 计算增强后的强度
      const strength = this.calculateEnhancedStrength(
        article,
        legalBasis.facts,
        reasoningChain,
        causalType
      );

      args.push({
        id: this.generateId(),
        type: 'main',
        content,
        legalBasis: [article],
        factBasis: legalBasis.facts,
        strength,
        side: options.side || 'PLAINTIFF',
        createdAt: Date.now(),
      });
    }

    return args;
  }

  /**
   * 生成增强的推理链
   */
  private generateEnhancedReasoningChain(
    article: LawArticle,
    facts: string[]
  ): ReasoningChainInfo {
    // 前提：法条规定
    const premise = `${article.lawName}第${article.articleNumber}条规定${article.content.substring(0, 20)}...`;

    // 推理：事实适用
    const reasoning =
      facts.length > 0
        ? `本案事实${facts[0].substring(0, 20)}...符合该条规定`
        : `案件事实符合法条规定`;

    // 结论：法律后果
    const conclusion =
      article.content.includes('应当') || article.content.includes('可以')
        ? `应当承担相应法律责任`
        : `该主张具有法律依据`;

    const steps = generateReasoningChain(premise, reasoning, conclusion);

    return {
      steps,
      type: 'deductive',
    };
  }

  /**
   * 计算增强的论点强度
   */
  private calculateEnhancedStrength(
    article: LawArticle,
    facts: string[],
    reasoningChain: ReasoningChainInfo,
    causalType?: CausalType
  ): number {
    // 基础强度
    let strength = this.calculateStrength(article, facts);

    // 推理链深度奖励（≥2步骤+0.05，≥3步骤+0.1）
    if (reasoningChain.steps.length >= 3) {
      strength += 0.1;
    } else if (reasoningChain.steps.length >= 2) {
      strength += 0.05;
    }

    // 因果关系奖励
    if (causalType) {
      strength += 0.1;
    }

    return Math.min(strength, 1.0);
  }

  /**
   * 生成支持论据
   */
  private generateSupportingArguments(
    legalBasis: LegalBasis,
    options: GenerationOptions
  ): Argument[] {
    const args: Argument[] = [];
    const count = options.supportingCount ?? 5;

    if (
      count === 0 ||
      legalBasis.articles.length === 0 ||
      legalBasis.facts.length === 0
    ) {
      return args;
    }

    for (let i = 0; i < count; i++) {
      const article = legalBasis.articles[i % legalBasis.articles.length];
      const fact = legalBasis.facts[i % legalBasis.facts.length];
      const template = this.getRandomTemplate('supporting');
      const content = template
        .replace('{articleNumber}', article.articleNumber)
        .replace('{factIndex}', fact)
        .replace('{content}', this.truncateContent(article.content, 20));

      args.push({
        id: this.generateId(),
        type: 'supporting',
        content,
        legalBasis: [article],
        factBasis: [fact],
        strength: this.calculateStrength(article, [fact]),
        side: options.side || 'PLAINTIFF',
        createdAt: Date.now(),
      });
    }

    return args;
  }

  /**
   * 生成法律引用
   */
  private generateLegalReferences(
    legalBasis: LegalBasis,
    options: GenerationOptions
  ): Argument[] {
    const args: Argument[] = [];
    const count = options.legalReferenceCount ?? 2;

    if (count === 0 || legalBasis.articles.length === 0) {
      return args;
    }

    for (let i = 0; i < count && i < legalBasis.articles.length; i++) {
      const article = legalBasis.articles[i];
      const template = this.getRandomTemplate('legal_reference');
      const content = template
        .replace('{articleNumber}', article.articleNumber)
        .replace('{lawName}', article.lawName)
        .replace('{content}', this.truncateContent(article.content, 50));

      args.push({
        id: this.generateId(),
        type: 'legal_reference',
        content,
        legalBasis: [article],
        factBasis: [],
        strength: 1.0,
        side: options.side || 'PLAINTIFF',
        createdAt: Date.now(),
      });
    }

    return args;
  }

  /**
   * 生成反驳论点
   */
  async generateRebuttal(
    legalBasis: LegalBasis,
    counterArgs: Argument[],
    options: GenerationOptions = {}
  ): Promise<ArgumentGenerationResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    const args: Argument[] = [];

    // 基于对方论点生成反驳
    for (let i = 0; i < counterArgs.length; i++) {
      const article = legalBasis.articles[i % legalBasis.articles.length];
      const template = this.getRandomTemplate('rebuttal');
      const content = template
        .replace('{articleNumber}', article.articleNumber)
        .replace('{content}', this.truncateContent(article.content, 20));

      args.push({
        id: this.generateId(),
        type: 'rebuttal',
        content,
        legalBasis: [article],
        factBasis: [],
        strength: this.calculateStrength(article, []),
        side: opts.side === 'PLAINTIFF' ? 'DEFENDANT' : 'PLAINTIFF',
        createdAt: Date.now(),
      });
    }

    return {
      arguments: args,
      mainArgumentCount: 0,
      supportingArgumentCount: 0,
      legalReferenceCount: 0,
      averageStrength: this.calculateAverageStrength(args),
      generationTime: Date.now() - startTime,
    };
  }

  /**
   * 获取随机模板
   */
  private getRandomTemplate(type: ArgumentType): string {
    const template = this.templates[type];
    const index = Math.floor(Math.random() * template.templates.length);
    return template.templates[index];
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
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
   * 计算论点强度
   */
  private calculateStrength(article: LawArticle, facts: string[]): number {
    // 基于法条级别和事实数量计算强度
    let strength = 0.5;

    // 法条级别加分
    if (article.level === 'constitution') {
      strength += 0.3;
    } else if (article.level === 'law') {
      strength += 0.2;
    }

    // 事实数量加分
    if (facts.length >= 3) {
      strength += 0.2;
    } else if (facts.length >= 1) {
      strength += 0.1;
    }

    return Math.min(strength, 1.0);
  }

  /**
   * 计算平均强度
   */
  private calculateAverageStrength(args: Argument[]): number {
    if (args.length === 0) {
      return 0;
    }

    const total = args.reduce((sum, arg) => sum + arg.strength, 0);
    return total / args.length;
  }

  /**
   * 批量生成论点
   */
  async batchGenerate(
    legalBasisList: LegalBasis[],
    options: GenerationOptions = {}
  ): Promise<ArgumentGenerationResult[]> {
    const results: ArgumentGenerationResult[] = [];

    for (const legalBasis of legalBasisList) {
      const result = await this.generate(legalBasis, options);
      results.push(result);
    }

    return results;
  }

  /**
   * 过滤论点
   */
  filterArguments(
    args: Argument[],
    filter: {
      type?: ArgumentType;
      side?: ArgumentSide;
      minStrength?: number;
    }
  ): Argument[] {
    return args.filter(arg => {
      if (filter.type && arg.type !== filter.type) {
        return false;
      }
      if (filter.side && arg.side !== filter.side) {
        return false;
      }
      if (filter.minStrength && arg.strength < filter.minStrength) {
        return false;
      }
      return true;
    });
  }

  /**
   * 排序论点
   */
  sortArguments(
    args: Argument[],
    sortBy: 'strength' | 'createdAt' = 'strength'
  ): Argument[] {
    return [...args].sort((a, b) => {
      if (sortBy === 'strength') {
        return b.strength - a.strength;
      }
      return b.createdAt - a.createdAt;
    });
  }
}
