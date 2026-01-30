/**
 * 逻辑一致性验证器
 * 支持论点矛盾检测、论据一致性验证、因果关系统计
 */

/**
 * 矛盾信息接口
 */
interface Contradiction {
  type: 'argument' | 'evidence';
  severity: 'high' | 'medium' | 'low';
  description: string;
  statements: string[];
}

/**
 * 因果关系接口
 */
interface CausalRelation {
  cause: string;
  effect: string;
  isReasonable: boolean;
}

/**
 * 问题接口
 */
interface Issue {
  message: string;
  severity: 'high' | 'medium' | 'low';
  type: string;
}

/**
 * 验证结果接口
 */
interface LogicConsistencyVerificationResult {
  score: number;
  passed: boolean;
  contradictions: Contradiction[];
  evidenceConsistency: number;
  evidenceCompleteness: number;
  causalRelations: CausalRelation[];
  causalRelationScore: number;
  issues: Issue[];
}

/**
 * 待验证数据接口
 */
interface DataToVerify {
  arguments?: string[] | null;
  evidence?: string[] | null;
  [key: string]: unknown;
}

/**
 * 验证器配置接口
 */
interface LogicConsistencyVerifierConfig {
  contradictionThreshold?: number;
  evidenceConsistencyThreshold?: number;
  enableContradictionCheck?: boolean;
  enableCausalRelationCheck?: boolean;
}

/**
 * 逻辑一致性验证器类
 */
export class LogicConsistencyVerifier {
  private config: Required<LogicConsistencyVerifierConfig>;

  constructor(config?: LogicConsistencyVerifierConfig) {
    this.config = {
      contradictionThreshold: config?.contradictionThreshold ?? 0.9,
      evidenceConsistencyThreshold: config?.evidenceConsistencyThreshold ?? 0.8,
      enableContradictionCheck: config?.enableContradictionCheck ?? true,
      enableCausalRelationCheck: config?.enableCausalRelationCheck ?? true,
    };
  }

  /**
   * 执行逻辑一致性验证
   */
  async verify(
    data: DataToVerify
  ): Promise<LogicConsistencyVerificationResult> {
    const contradictions: Contradiction[] = [];
    const causalRelations: CausalRelation[] = [];
    const issues: Issue[] = [];

    // 清理输入数据
    const cleanArguments = this.cleanTextArray(data.arguments);
    const cleanEvidence = this.cleanTextArray(data.evidence);

    // 1. 论点矛盾检测
    if (this.config.enableContradictionCheck && cleanArguments.length > 0) {
      const argContradictions =
        this.detectArgumentContradictions(cleanArguments);
      contradictions.push(...argContradictions);
    }

    // 2. 论据矛盾检测
    if (this.config.enableContradictionCheck && cleanEvidence.length > 0) {
      const evidenceContradictions =
        this.detectEvidenceContradictions(cleanEvidence);
      contradictions.push(...evidenceContradictions);
    }

    // 3. 论据一致性验证
    const evidenceConsistency = this.calculateEvidenceConsistency(
      cleanArguments,
      cleanEvidence
    );

    // 4. 论据完整性验证
    const evidenceCompleteness = this.calculateEvidenceCompleteness(
      cleanArguments,
      cleanEvidence
    );

    // 5. 因果关系统计
    if (this.config.enableCausalRelationCheck && cleanArguments.length > 0) {
      const relations = this.extractCausalRelations(cleanArguments);
      causalRelations.push(...relations);
    }

    // 6. 因果关系评分
    const causalRelationScore =
      this.calculateCausalRelationScore(causalRelations);

    // 7. 生成问题列表
    this.generateIssues(
      contradictions,
      evidenceConsistency,
      evidenceCompleteness,
      causalRelations,
      cleanArguments,
      cleanEvidence,
      issues
    );

    // 8. 计算综合评分
    const score = this.calculateOverallScore(
      contradictions,
      evidenceConsistency,
      evidenceCompleteness,
      causalRelationScore
    );

    const passed = score >= this.config.contradictionThreshold;

    return {
      score,
      passed,
      contradictions,
      evidenceConsistency,
      evidenceCompleteness,
      causalRelations,
      causalRelationScore,
      issues,
    };
  }

  /**
   * 清理文本数组
   */
  private cleanTextArray(arr: string[] | null | undefined): string[] {
    if (!arr || !Array.isArray(arr)) {
      return [];
    }
    return arr.filter(
      text => text && typeof text === 'string' && text.trim().length > 0
    );
  }

  /**
   * 检测论点矛盾
   */
  private detectArgumentContradictions(arguments_: string[]): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (let i = 0; i < arguments_.length; i++) {
      for (let j = i + 1; j < arguments_.length; j++) {
        const arg1 = arguments_[i];
        const arg2 = arguments_[j];

        if (this.hasContradiction(arg1, arg2)) {
          contradictions.push({
            type: 'argument',
            severity: 'high',
            description: `论点${i + 1}与论点${j + 1}存在矛盾`,
            statements: [arg1, arg2],
          });
        }
      }
    }

    return contradictions;
  }

  /**
   * 检测论据矛盾
   */
  private detectEvidenceContradictions(evidence: string[]): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (let i = 0; i < evidence.length; i++) {
      for (let j = i + 1; j < evidence.length; j++) {
        const ev1 = evidence[i];
        const ev2 = evidence[j];

        if (this.hasContradiction(ev1, ev2)) {
          contradictions.push({
            type: 'evidence',
            severity: 'high',
            description: `论据${i + 1}与论据${j + 1}存在矛盾`,
            statements: [ev1, ev2],
          });
        }
      }
    }

    return contradictions;
  }

  /**
   * 检测两个文本是否矛盾
   */
  private hasContradiction(text1: string, text2: string): boolean {
    // 提取关键词
    const keywords1 = this.extractKeywords(text1);
    const keywords2 = this.extractKeywords(text2);

    // 检查是否有共同关键词
    const commonKeywords = keywords1.filter(k => keywords2.includes(k));
    if (commonKeywords.length === 0) {
      return false;
    }

    // 检查直接否定矛盾（如"应当"vs"不应当"）
    const directNegationPairs = [
      ['应当', '不应当'],
      ['应该', '不应该'],
      ['必须', '不必'],
      ['需要', '不需要'],
      ['可以', '不可以'],
      ['能', '不能'],
      ['会', '不会'],
      ['是', '不是'],
      ['有', '没有'],
      ['存在', '不存在'],
      ['有效', '无效'],
      ['合法', '非法'],
      ['履行', '未履行'],
      ['违约', '未违约'],
      ['声称', '同时'],
    ];

    for (const [positive, negative] of directNegationPairs) {
      if (
        (text1.includes(positive) && text2.includes(negative)) ||
        (text1.includes(negative) && text2.includes(positive))
      ) {
        // 确保有共同主题
        if (commonKeywords.length >= 1) {
          return true;
        }
      }
    }

    // 检查否定词矛盾
    const negationWords = ['不', '没有', '未', '非', '无'];
    const hasNegation1 = negationWords.some(word => text1.includes(word));
    const hasNegation2 = negationWords.some(word => text2.includes(word));

    if (hasNegation1 !== hasNegation2 && commonKeywords.length >= 2) {
      return true;
    }

    // 检查量词矛盾
    const quantifierPairs = [
      ['所有', '部分'],
      ['全部', '部分'],
      ['完全', '部分'],
      ['一定', '可能'],
      ['必然', '可能'],
    ];

    for (const [q1, q2] of quantifierPairs) {
      if (
        (text1.includes(q1) && text2.includes(q2)) ||
        (text1.includes(q2) && text2.includes(q1))
      ) {
        if (commonKeywords.length >= 1) {
          return true;
        }
      }
    }

    // 检测逻辑矛盾：例如"被告违约" vs "被告已经履行了合同义务"
    if (this.hasLogicalContradiction(text1, text2, commonKeywords)) {
      return true;
    }

    return false;
  }

  /**
   * 检测逻辑矛盾
   */
  private hasLogicalContradiction(
    text1: string,
    text2: string,
    commonKeywords: string[]
  ): boolean {
    // 定义逻辑矛盾对
    const logicContradictionPairs = [
      ['违约', '履行'],
      ['未履行', '履行'],
      ['未违约', '违约'],
      ['签订', '未签订'],
      ['是', '不是'],
      ['有', '没有'],
      ['存在', '不存在'],
    ];

    for (const [word1, word2] of logicContradictionPairs) {
      const text1HasWord1 = text1.includes(word1);
      const text1HasWord2 = text1.includes(word2);
      const text2HasWord1 = text2.includes(word1);
      const text2HasWord2 = text2.includes(word2);

      // 检查是否包含矛盾的词汇对
      if (
        (text1HasWord1 && text2HasWord2) ||
        (text1HasWord2 && text2HasWord1)
      ) {
        // 确保有共同主题
        if (commonKeywords.length >= 1) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 计算论据一致性
   */
  private calculateEvidenceConsistency(
    arguments_: string[],
    evidence: string[]
  ): number {
    if (arguments_.length === 0 && evidence.length === 0) {
      return 1.0;
    }

    if (arguments_.length === 0 || evidence.length === 0) {
      return 0.0;
    }

    let totalConsistency = 0;

    for (const arg of arguments_) {
      const argKeywords = this.extractKeywords(arg);
      let maxMatch = 0;
      let totalMatches = 0;

      for (const ev of evidence) {
        const evKeywords = this.extractKeywords(ev);
        const matchCount = argKeywords.filter(k =>
          evKeywords.includes(k)
        ).length;
        totalMatches += matchCount;

        // 使用更宽松的匹配比例
        const matchRatio = matchCount / Math.max(argKeywords.length, 1);
        maxMatch = Math.max(maxMatch, matchRatio);
      }

      // 考虑所有论据的总匹配情况
      const averageMatch =
        totalMatches / (evidence.length * Math.max(argKeywords.length, 1));
      // 取最大匹配和平均匹配的加权平均值
      const finalMatch = maxMatch * 0.7 + averageMatch * 0.3;
      totalConsistency += finalMatch;
    }

    return totalConsistency / arguments_.length;
  }

  /**
   * 计算论据完整性
   */
  private calculateEvidenceCompleteness(
    arguments_: string[],
    evidence: string[]
  ): number {
    if (arguments_.length === 0) {
      return 1.0;
    }

    if (evidence.length === 0) {
      return 0.0;
    }

    // 简单规则：每个论点至少需要一个论据支持
    const minRequired = arguments_.length;
    const actual = evidence.length;

    return Math.min(actual / minRequired, 1.0);
  }

  /**
   * 提取因果关系
   */
  private extractCausalRelations(arguments_: string[]): CausalRelation[] {
    const relations: CausalRelation[] = [];
    const causalPatterns = [
      { cause: '因为', effect: '所以' },
      { cause: '由于', effect: '导致' },
      { cause: '基于', effect: '因此' },
      { cause: '鉴于', effect: '故' },
    ];

    for (const arg of arguments_) {
      for (const pattern of causalPatterns) {
        if (arg.includes(pattern.cause) && arg.includes(pattern.effect)) {
          const parts = arg.split(
            new RegExp(`(${pattern.cause}|${pattern.effect})`)
          );
          if (parts.length >= 3) {
            const cause = parts[0] || parts[1] || '';
            const effect = parts[parts.length - 1] || '';

            relations.push({
              cause: cause.trim(),
              effect: effect.trim(),
              isReasonable: this.isCausalRelationReasonable(cause, effect),
            });
          }
        } else if (arg.includes(pattern.cause)) {
          const parts = arg.split(pattern.cause);
          if (parts.length >= 2) {
            relations.push({
              cause: parts[0].trim(),
              effect: parts[1].trim(),
              isReasonable: this.isCausalRelationReasonable(parts[0], parts[1]),
            });
          }
        }
      }
    }

    return relations;
  }

  /**
   * 判断因果关系是否合理
   */
  private isCausalRelationReasonable(cause: string, effect: string): boolean {
    // 检查是否包含明显不合理的因果关系（如天气导致违约）
    const unreasonableKeywords = [
      '天气',
      '晴朗',
      '下雨',
      '星期',
      '今天',
      '昨天',
      '明天',
    ];
    const causeHasUnreasonable = unreasonableKeywords.some(k =>
      cause.includes(k)
    );

    // 如果原因包含不合理关键词，认为不合理
    if (causeHasUnreasonable) {
      return false;
    }

    // 检查是否包含法律相关词汇
    const legalKeywords = [
      '违约',
      '责任',
      '赔偿',
      '合同',
      '法律',
      '权利',
      '义务',
      '侵权',
      '损害',
      '履行',
      '约定',
      '规定',
      '条款',
      '被告',
      '原告',
    ];

    const causeHasLegal = legalKeywords.some(k => cause.includes(k));
    const effectHasLegal = legalKeywords.some(k => effect.includes(k));

    // 如果因果关系中至少有一个包含法律词汇，认为是合理的
    return causeHasLegal || effectHasLegal;
  }

  /**
   * 计算因果关系评分
   */
  private calculateCausalRelationScore(relations: CausalRelation[]): number {
    if (relations.length === 0) {
      return 1.0;
    }

    const reasonableCount = relations.filter(r => r.isReasonable).length;
    return reasonableCount / relations.length;
  }

  /**
   * 生成问题列表
   */
  private generateIssues(
    contradictions: Contradiction[],
    evidenceConsistency: number,
    evidenceCompleteness: number,
    causalRelations: CausalRelation[],
    arguments_: string[],
    evidence: string[],
    issues: Issue[]
  ): void {
    // 矛盾问题
    for (const contradiction of contradictions) {
      issues.push({
        message: contradiction.description,
        severity: contradiction.severity,
        type: 'contradiction',
      });
    }

    // 论据一致性问题
    if (evidenceConsistency < this.config.evidenceConsistencyThreshold) {
      issues.push({
        message: `论据与论点一致性不足（${(evidenceConsistency * 100).toFixed(1)}%），建议补充相关论据`,
        severity: 'medium',
        type: 'evidence_consistency',
      });
    }

    // 论据完整性问题
    if (evidenceCompleteness === 0 && arguments_.length > 0) {
      issues.push({
        message: '缺少论据支持论点',
        severity: 'high',
        type: 'evidence_completeness',
      });
    } else if (
      evidenceCompleteness < 0.5 &&
      arguments_.length > 0 &&
      evidenceCompleteness > 0
    ) {
      issues.push({
        message: `论据不足（完整性${(evidenceCompleteness * 100).toFixed(1)}%），建议补充更多论据`,
        severity: 'medium',
        type: 'evidence_completeness',
      });
    }

    // 因果关系问题
    const unreasonableRelations = causalRelations.filter(r => !r.isReasonable);
    for (const relation of unreasonableRelations) {
      issues.push({
        message: `因果关系可能不合理："${relation.cause}" → "${relation.effect}"`,
        severity: 'medium',
        type: 'causal_relation',
      });
    }

    // 循环因果关系检测
    this.detectCircularCausality(causalRelations, issues);
  }

  /**
   * 检测循环因果关系
   */
  private detectCircularCausality(
    relations: CausalRelation[],
    issues: Issue[]
  ): void {
    for (let i = 0; i < relations.length; i++) {
      for (let j = i + 1; j < relations.length; j++) {
        const r1 = relations[i];
        const r2 = relations[j];

        // 检查是否形成循环：A→B 且 B→A
        const keywords1Cause = this.extractKeywords(r1.cause);
        const keywords1Effect = this.extractKeywords(r1.effect);
        const keywords2Cause = this.extractKeywords(r2.cause);
        const keywords2Effect = this.extractKeywords(r2.effect);

        // 检查r1的结果是否与r2的原因匹配（至少2个关键词）
        const effectToCauseMatch = keywords1Effect.filter(k =>
          keywords2Cause.includes(k)
        ).length;
        // 检查r2的结果是否与r1的原因匹配（至少2个关键词）
        const causeToEffectMatch = keywords2Effect.filter(k =>
          keywords1Cause.includes(k)
        ).length;

        // 如果双向都有较多匹配，认为是循环
        if (effectToCauseMatch >= 2 && causeToEffectMatch >= 2) {
          issues.push({
            message: `检测到循环因果关系："${r1.cause}→${r1.effect}" 与 "${r2.cause}→${r2.effect}"`,
            severity: 'high',
            type: 'circular_causality',
          });
        }
      }
    }
  }

  /**
   * 计算综合评分
   */
  private calculateOverallScore(
    contradictions: Contradiction[],
    evidenceConsistency: number,
    evidenceCompleteness: number,
    causalRelationScore: number
  ): number {
    let score = 1.0;

    // 矛盾扣分（每个矛盾扣0.2分）
    score -= contradictions.length * 0.2;

    // 如果没有矛盾且论据完整，保持高分
    if (contradictions.length === 0 && evidenceCompleteness >= 0.5) {
      // 论据一致性权重10%
      score = score * 0.9 + evidenceConsistency * 0.1;
      return Math.max(0.9, score);
    }

    // 如果没有矛盾，基础分保持较高
    if (contradictions.length === 0) {
      // 论据一致性权重15%
      score = score * 0.85 + evidenceConsistency * 0.15;

      // 论据完整性影响较小（完整性低于0.5时扣分）
      if (evidenceCompleteness < 0.5 && evidenceCompleteness > 0) {
        score -= (0.5 - evidenceCompleteness) * 0.1;
      }
    } else {
      // 有矛盾时，论据一致性权重增加
      score = score * 0.6 + evidenceConsistency * 0.4;

      // 论据完整性影响增加
      if (evidenceCompleteness < 0.5) {
        score -= (0.5 - evidenceCompleteness) * 0.2;
      }
    }

    // 因果关系评分影响（不合理的因果关系扣分）
    if (causalRelationScore < 1.0) {
      score -= (1.0 - causalRelationScore) * 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 提取关键词（改进的中文分词）
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      '的',
      '了',
      '是',
      '在',
      '和',
      '有',
      '我',
      '你',
      '他',
      '她',
      '它',
      '我们',
      '你们',
      '他们',
      '这',
      '那',
      '这个',
      '那个',
      '一个',
      '应当',
      '应该',
      '不应当',
      '不应该',
      '可以',
      '不可以',
      '能',
      '不能',
    ]);

    // 移除标点符号
    const cleanText = text.replace(
      /[，。！？；：""''（）@#$%^&*\-_+=\[\]{}|\\/<>~`]/g,
      ''
    );

    // 提取2-4字的词组（中文分词的简化方法）
    const words: string[] = [];

    // 提取2字词
    for (let i = 0; i < cleanText.length - 1; i++) {
      const word = cleanText.substring(i, i + 2);
      if (!stopWords.has(word) && /[\u4e00-\u9fa5]{2}/.test(word)) {
        words.push(word);
      }
    }

    // 提取3字词
    for (let i = 0; i < cleanText.length - 2; i++) {
      const word = cleanText.substring(i, i + 3);
      if (!stopWords.has(word) && /[\u4e00-\u9fa5]{3}/.test(word)) {
        words.push(word);
      }
    }

    // 提取4字词
    for (let i = 0; i < cleanText.length - 3; i++) {
      const word = cleanText.substring(i, i + 4);
      if (!stopWords.has(word) && /[\u4e00-\u9fa5]{4}/.test(word)) {
        words.push(word);
      }
    }

    return [...new Set(words)];
  }
}
