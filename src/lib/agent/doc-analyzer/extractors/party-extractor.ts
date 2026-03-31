/**
 * PartyExtractor - 当事人提取器（算法兜底层）
 *
 * 功能：
 * - 使用正则表达式和规则算法提取当事人信息
 * - 作为AI识别失败或遗漏时的兜底方案
 * - 补充和修正AI识别的当事人数据
 */

import type { Party } from '../core/types';
import { logger } from '../../../agent/security/logger';

export interface PartyExtractionResult {
  parties: Party[];
  confidence: number;
  method: 'regex' | 'rule' | 'hybrid';
}

/**
 * 当事人模式定义
 */
interface PartyPattern {
  regex: RegExp;
  type: 'plaintiff' | 'defendant' | 'other';
  role?: string;
}

export class PartyExtractor {
  // 原告模式
  private readonly plaintiffPatterns: PartyPattern[] = [
    {
      regex: /(?:原告|申请人|上诉人)[：:]\s*([^\n]+)/gu,
      type: 'plaintiff',
      role: '原告',
    },
    {
      regex: /(?:原告|申请人)[：:]\s*([^\n]+)，(?:性别|男|女)/gu,
      type: 'plaintiff',
      role: '原告',
    },
    {
      regex: /原告[：:]\s*([^\n]+?)(?:，|。|\n)/gu,
      type: 'plaintiff',
      role: '原告',
    },
    // 上诉人识别（原审原告）- 支持中英文括号
    {
      regex: /上诉人[（(](?:原审)?原告[）)][：:]\s*([^\n，。]+)/gu,
      type: 'plaintiff',
      role: '上诉人',
    },
    // 上诉人单独出现
    {
      regex: /上诉人[：:]\s*([^\n，。]+)/gu,
      type: 'plaintiff',
      role: '上诉人',
    },
  ];

  // 被告模式
  private readonly defendantPatterns: PartyPattern[] = [
    {
      regex: /(?:被告|被申请人|被上诉人)[：:]\s*([^\n]+)/gu,
      type: 'defendant',
      role: '被告',
    },
    {
      regex: /(?:被告|被申请人)[：:]\s*([^\n]+)，(?:性别|男|女)/gu,
      type: 'defendant',
      role: '被告',
    },
    {
      regex: /被告[：:]\s*([^\n]+?)(?:，|。|\n)/gu,
      type: 'defendant',
      role: '被告',
    },
    // 被上诉人识别（原审被告）- 支持中英文括号
    {
      regex: /被上诉人[（(](?:原审)?被告[）)][：:]\s*([^\n，。]+)/gu,
      type: 'defendant',
      role: '被上诉人',
    },
    // 被上诉人单独出现
    {
      regex: /被上诉人[：:]\s*([^\n，。]+)/gu,
      type: 'defendant',
      role: '被上诉人',
    },
  ];

  // 第三人模式
  private readonly thirdPartyPatterns: PartyPattern[] = [
    {
      regex: /第三人[：:]\s*([^\n]+)/gu,
      type: 'other',
      role: '第三人',
    },
  ];

  // 特殊组织架构模式
  private readonly specialOrganizationPatterns: PartyPattern[] = [
    // 清算组
    {
      regex: /(.+?)(清算组|清算委员会)/g,
      type: 'other',
      role: '清算组',
    },
    // 破产管理人
    {
      regex: /(.+?)(破产管理人|破产清算人)/g,
      type: 'other',
      role: '破产管理人',
    },
    // 联合体
    {
      regex: /(.+?)与(.+?)(联合体|共同体)/g,
      type: 'other',
      role: '联合体',
    },
    // 分支机构
    {
      regex: /(.+?)(分公司|分支机构|办事处|代表处)/g,
      type: 'other',
      role: '分支机构',
    },
    // 临时机构
    {
      regex: /(.+?)(筹备组|筹备委员会|临时管理人)/g,
      type: 'other',
      role: '临时机构',
    },
  ];

  /**
   * 从文本中提取当事人信息
   */
  public async extractFromText(
    text: string,
    existingParties: Party[] = []
  ): Promise<PartyExtractionResult> {
    const extractedParties: Party[] = [...existingParties];
    const existingNames = new Set(existingParties.map(p => p.name));

    // 提取地址信息并关联到当事人
    const addressMap = this.extractAddresses(text);

    // 提取原告
    const plaintiffs = this.extractByPatterns(text, this.plaintiffPatterns);
    for (const plaintiff of plaintiffs) {
      if (!existingNames.has(plaintiff.name)) {
        // 尝试关联地址
        if (addressMap.has(plaintiff.name)) {
          plaintiff.address = addressMap.get(plaintiff.name);
        }
        extractedParties.push(plaintiff);
        existingNames.add(plaintiff.name);
        logger.debug('算法兜底提取原告', { name: plaintiff.name });
      }
    }

    // 提取被告
    const defendants = this.extractByPatterns(text, this.defendantPatterns);
    for (const defendant of defendants) {
      if (!existingNames.has(defendant.name)) {
        // 尝试关联地址
        if (addressMap.has(defendant.name)) {
          defendant.address = addressMap.get(defendant.name);
        }
        extractedParties.push(defendant);
        existingNames.add(defendant.name);
        logger.debug('算法兜底提取被告', { name: defendant.name });
      }
    }

    // 提取第三人
    const thirdParties = this.extractByPatterns(text, this.thirdPartyPatterns);
    for (const thirdParty of thirdParties) {
      if (!existingNames.has(thirdParty.name)) {
        // 尝试关联地址
        if (addressMap.has(thirdParty.name)) {
          thirdParty.address = addressMap.get(thirdParty.name);
        }
        extractedParties.push(thirdParty);
        existingNames.add(thirdParty.name);
        logger.debug('算法兜底提取第三人', { name: thirdParty.name });
      }
    }

    // 提取特殊组织架构
    const specialOrgs = this.extractSpecialOrganizations(text);
    for (const org of specialOrgs) {
      if (!existingNames.has(org.name)) {
        extractedParties.push(org);
        existingNames.add(org.name);
        logger.debug('算法兜底提取特殊组织', {
          name: org.name,
          role: org.role,
        });
      }
    }

    // 从诉讼请求中推断被告
    const inferredDefendant = this.inferDefendantFromClaims(text);
    if (inferredDefendant && !existingNames.has(inferredDefendant.name)) {
      extractedParties.push(inferredDefendant);
      logger.info('从诉讼请求推断被告', {
        name: inferredDefendant.name,
      });
    }

    // 过滤法定代表人和诉讼代理人
    const filteredParties = this.filterNonParties(extractedParties);

    // 验证当事人身份
    const validatedParties = this.validateParties(filteredParties, text);

    // 计算置信度
    const confidence = this.calculateConfidence(
      extractedParties.length,
      validatedParties.length
    );

    return {
      parties: validatedParties,
      confidence,
      method: 'regex',
    };
  }

  /**
   * 提取当事人地址信息
   */
  private extractAddresses(text: string): Map<string, string> {
    const addressMap = new Map<string, string>();

    // 匹配模式：姓名，住址：地址 或 姓名，地址
    const addressPatterns = [
      /([^\n，]+)，(?:住址：|地址：|联系地址：|居住地：)\s*([^\n]+)/g,
      /([^\n，]+)，([^\n，]+)(?:省|市|区|县|路|街道|楼|室|号)/g,
    ];

    for (const pattern of addressPatterns) {
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: 必须在循环中赋值
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const address = match[2].trim();
        // 过滤掉非当事人名称
        if (
          name.length >= 2 &&
          !this.isCommonWords(name) &&
          !this.isLawyer(name)
        ) {
          addressMap.set(name, address);
          logger.debug('提取当事人地址', { name, address });
        }
      }
    }

    return addressMap;
  }

  /**
   * 根据模式提取当事人 - Unicode安全版 + 调试日志
   */
  private extractByPatterns(text: string, patterns: PartyPattern[]): Party[] {
    const parties: Party[] = [];

    for (const pattern of patterns) {
      // ✅ 使用原始正则（已包含gu标志）
      const regex = pattern.regex;
      let match: RegExpExecArray | null;

      // ✅ 添加调试日志
      logger.debug('[DEBUG] 执行正则匹配', {
        pattern: pattern.regex.source,
        flags: pattern.regex.flags,
        textSample: text.substring(0, 200),
      });

      // ✅ 重置lastIndex确保从头开始
      regex.lastIndex = 0;

      while ((match = regex.exec(text)) !== null) {
        const rawName = match[1];
        const cleanedName = this.cleanName(rawName);

        // ✅ 添加调试日志
        logger.debug('[DEBUG] 正则匹配结果', {
          matched: rawName,
          cleaned: cleanedName,
          isCommon: this.isCommonWords(cleanedName),
          isPlaceholder: this.isPlaceholder(cleanedName),
        });

        // ✅ 保留占位符，即使它可能被认为是"常见词"
        if (cleanedName && cleanedName.length >= 2) {
          if (
            !this.isCommonWords(cleanedName) ||
            this.isPlaceholder(cleanedName)
          ) {
            parties.push({
              type: pattern.type,
              name: cleanedName,
              role: pattern.role,
              _inferred: true,
            });
          }
        }
      }
    }

    logger.debug('[DEBUG] 最终提取的当事人', {
      count: parties.length,
      names: parties.map(p => p.name),
    });

    return parties;
  }

  /**
   * 清理当事人名称
   */
  private cleanName(name: string): string {
    return name
      .trim()
      .replace(/，[^\n]*$/, '') // 移除第一个逗号后的内容（保留地址等信息）
      .replace(/[（\(].*?[）\)]$/, '') // 移除括号内容（保留公司类型信息）
      .replace(/等/g, '') // 移除"等"
      .replace(/法定代表人/g, '') // 移除职务描述
      .replace(/委托代理人/g, '') // 移除职务描述
      .replace(/诉讼代理人/g, '') // 移除职务描述
      .replace(/，.*$/g, '') // 移除逗号后的所有内容（性别、出生年份等）
      .trim();
  }

  /**
   * 从诉讼请求中推断被告
   */
  private inferDefendantFromClaims(text: string): Party | null {
    // 匹配"判令XX偿还/支付/承担"等模式
    const patterns = [
      /判令\s*([^\s，]{2,10})\s*(?:偿还|支付|承担|履行)/,
      /判令\s*([^\s，]{2,10})\s*[承担|履行]/,
      /请求判令\s*([^\s，]{2,10})\s*(?:偿还|支付)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const name = this.cleanName(match[1]);
        // 验证名称有效性
        if (name && !this.isCommonWords(name)) {
          return {
            type: 'defendant',
            name,
            role: '推断被告',
            _inferred: true,
          };
        }
      }
    }

    return null;
  }

  /**
   * 判断是否为常见词汇（非当事人名称）
   */
  private isCommonWords(text: string): boolean {
    const commonWords = [
      '对方',
      '被告方',
      '原告方',
      '当事人',
      '第三人',
      '诉讼请求',
      '诉讼费',
      '律师费',
      '利息',
      '本金',
      '涉案',
      '本案',
      '被申请人',
      '申请人',
    ];
    return commonWords.includes(text);
  }

  /**
   * 过滤非当事人（法定代表人、诉讼代理人等）
   */
  private filterNonParties(parties: Party[]): Party[] {
    const filtered: Party[] = [];

    for (const party of parties) {
      // 检查是否为公司名称（公司名称通常是有效的当事人）
      if (this.isCompanyName(party.name)) {
        filtered.push(party);
        continue;
      }

      // 保留"某某"占位符（可能是真实测试案例）
      if (this.isPlaceholder(party.name)) {
        filtered.push(party);
        continue;
      }

      // 检查名称长度（过短可能是误识别）
      if (party.name.length < 2) {
        logger.debug('过滤过短名称', { name: party.name });
        continue;
      }

      // 检查是否包含律师关键字
      if (this.isLawyer(party.name)) {
        logger.debug('过滤诉讼代理人', { name: party.name });
        continue;
      }

      filtered.push(party);
    }

    return filtered;
  }

  /**
   * 判断是否为占位符
   */
  private isPlaceholder(name: string): boolean {
    return name.includes('某某') || /^某某.*某某$/.test(name);
  }

  /**
   * 判断是否为公司名称
   */
  private isCompanyName(name: string): boolean {
    const companyKeywords = [
      '公司',
      '企业',
      '集团',
      '有限',
      '股份',
      '责任',
      '合伙',
      '个体',
      '厂',
      '店',
      '中心',
      '工作室',
    ];
    return companyKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * 判断是否为律师
   */
  private isLawyer(name: string): boolean {
    const lawyerKeywords = ['律师', '律师所', '律所'];
    return lawyerKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    originalCount: number,
    filteredCount: number
  ): number {
    if (originalCount === 0) {
      return 0.0;
    }
    return filteredCount / originalCount;
  }

  /**
   * 合并当事人信息（AI提取 + 算法兜底）
   */
  public mergeParties(aiParties: Party[], algorithmParties: Party[]): Party[] {
    const merged: Party[] = [];
    const mergedNames = new Set<string>();

    // 优先保留AI识别的结果
    for (const aiParty of aiParties) {
      if (!mergedNames.has(aiParty.name)) {
        merged.push(aiParty);
        mergedNames.add(aiParty.name);
      }
    }

    // 补充算法识别的结果
    for (const algParty of algorithmParties) {
      if (!mergedNames.has(algParty.name)) {
        // 检查是否与现有当事人相似（可能是同一人的不同表述）
        const similar = merged.find(p =>
          this.isSimilarName(p.name, algParty.name)
        );
        if (similar) {
          // 如果相似，保留置信度更高的
          if (!similar._inferred && algParty._inferred) {
            // AI识别的优先
            continue;
          }
        } else {
          merged.push(algParty);
          mergedNames.add(algParty.name);
        }
      }
    }

    return merged;
  }

  /**
   * 判断两个名称是否相似
   */
  private isSimilarName(name1: string, name2: string): boolean {
    // 移除空格和标点
    const n1 = name1.replace(/\s+/g, '');
    const n2 = name2.replace(/\s+/g, '');

    if (n1 === n2) {
      return true;
    }

    // 检查一个是否是另一个的子串
    if (n1.includes(n2) || n2.includes(n1)) {
      return true;
    }

    return false;
  }

  /**
   * 提取特殊组织架构
   */
  private extractSpecialOrganizations(text: string): Party[] {
    const parties: Party[] = [];
    const seenNames = new Set<string>();

    for (const pattern of this.specialOrganizationPatterns) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        // 提取完整匹配的文本
        const fullMatch = match[0];
        const cleanedName = fullMatch.trim();

        if (
          cleanedName &&
          cleanedName.length >= 2 &&
          !seenNames.has(cleanedName)
        ) {
          // 判断当事人类型（从上下文推断）
          let type: 'plaintiff' | 'defendant' | 'other' = 'other';
          const contextBefore = text.substring(
            Math.max(0, match.index - 50),
            match.index
          );

          if (
            contextBefore.includes('原告') ||
            contextBefore.includes('申请人')
          ) {
            type = 'plaintiff';
          } else if (
            contextBefore.includes('被告') ||
            contextBefore.includes('被申请人')
          ) {
            type = 'defendant';
          }

          parties.push({
            type,
            name: cleanedName,
            role: pattern.role || '其他',
            _inferred: true,
          });
          seenNames.add(cleanedName);

          logger.debug('提取特殊组织架构', {
            name: cleanedName,
            role: pattern.role,
            type,
          });
        }
      }
    }

    return parties;
  }

  /**
   * 验证当事人身份
   */
  private validateParties(parties: Party[], text: string): Party[] {
    const validated: Party[] = [];

    for (const party of parties) {
      const validation = this.validatePartyIdentity(party, text);

      if (validation.isValid) {
        validated.push(party);
      } else {
        logger.debug('当事人验证失败', {
          name: party.name,
          confidence: validation.confidence,
          issues: validation.issues,
        });
      }
    }

    return validated;
  }

  /**
   * 验证单个当事人身份
   */
  private validatePartyIdentity(
    party: Party,
    text: string
  ): {
    isValid: boolean;
    confidence: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let confidence = 1.0;

    // 检查必填字段
    if (!party.name || party.name.trim().length === 0) {
      issues.push('当事人姓名为空');
      confidence = 0;
      return { isValid: false, confidence, issues };
    }

    // 检查姓名长度合理性
    if (party.name.length > 50) {
      issues.push('当事人姓名过长，可能包含多余信息');
      confidence -= 0.3;
    }

    // 检查是否包含法定代表人等描述性文字
    if (
      party.name.includes('法定代表人') ||
      party.name.includes('委托代理人') ||
      party.name.includes('诉讼代理人')
    ) {
      issues.push('当事人姓名包含职务描述');
      confidence -= 0.5;
    }

    // 检查姓名是否在原文中出现
    if (!text.includes(party.name)) {
      issues.push('当事人姓名未在原文中出现');
      confidence -= 0.2;
    }

    return {
      isValid: confidence > 0.5,
      confidence: Math.max(0, confidence),
      issues,
    };
  }
}
