/**
 * LegalRepresentativeFilter - 法定代表人过滤器
 *
 * 核心功能：
 * - 过滤法定代表人记录
 * - 保留独立当事人（即使同名）
 * - 支持多种法定代表人表达方式
 *
 * 性能目标：<5ms
 */

import type { Party, ExtractedData } from '../core/types';
import { logger } from '../../../agent/security/logger';

// =============================================================================
// 接口定义
// =============================================================================

export interface LegalRepFilterResult {
  parties: Party[];
  filteredCount: number;
  processingTime: number;
}

export interface LegalRepFilterConfig {
  legalRepKeywords: string[];
  independentRoles: string[];
}

// =============================================================================
// 默认配置
// =============================================================================

const DEFAULT_CONFIG: LegalRepFilterConfig = {
  legalRepKeywords: [
    '法定代表人',
    '法定代表',
    '法人代表',
    '负责人',
    '执行事务合伙人',
  ],
  independentRoles: [
    '原告',
    '被告',
    '第三人',
    '申请人',
    '被申请人',
    '上诉人',
    '被上诉人',
  ],
};

// =============================================================================
// LegalRepresentativeFilter 类
// =============================================================================

export class LegalRepresentativeFilter {
  private config: LegalRepFilterConfig;

  constructor(config?: Partial<LegalRepFilterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 过滤法定代表人
   */
  public async filter(
    text: string,
    parties: Party[]
  ): Promise<LegalRepFilterResult> {
    const startTime = Date.now();

    const filteredParties = parties.filter((party: Party) => {
      // 规则0: 如果名称本身就包含法定代表人关键词，直接过滤
      if (
        this.config.legalRepKeywords.some(keyword =>
          party.name.includes(keyword)
        )
      ) {
        return false;
      }

      // 规则1: 如果角色包含独立角色关键词，直接保留
      if (
        party.role &&
        this.config.independentRoles.some(role => party.role!.includes(role))
      ) {
        return true;
      }

      // 规则2: 如果角色包含法定代表人关键词，过滤掉
      if (
        party.role &&
        this.config.legalRepKeywords.some(keyword =>
          party.role!.includes(keyword)
        )
      ) {
        return false;
      }

      // 规则3: 检查名称在上下文中是否紧跟法定代表人关键词
      const patterns = this.config.legalRepKeywords.map(
        keyword =>
          new RegExp(
            `${keyword}[:：]?\\s*${party.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
            'g'
          )
      );

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return false;
        }
      }

      // 规则4: 检查名称是否是典型的法定代表人的短名称
      if (party.name.length <= 3 && !party.address && !party.contact) {
        // 如果名称很短且没有详细地址和联系方式，可能是法定代表人
        // 检查这个名称是否有独立的角色
        const hasIndependentRole = parties.some(
          p =>
            p.name === party.name &&
            p.type !== 'other' &&
            p.role &&
            this.config.independentRoles.some(role => p.role!.includes(role))
        );

        if (!hasIndependentRole) {
          return false;
        }
      }

      return true;
    });

    const filteredCount = parties.length - filteredParties.length;
    const processingTime = Date.now() - startTime;

    if (filteredCount > 0) {
      const filteredNames = parties
        .filter(p => !filteredParties.some(fp => fp.name === p.name))
        .map(p => p.name);
      logger.info('法定代表人已过滤', {
        filteredCount,
        filteredNames,
        processingTime,
      });
    }

    return {
      parties: filteredParties,
      filteredCount,
      processingTime,
    };
  }

  /**
   * 应用到ExtractedData
   */
  public async applyToExtractedData(
    text: string,
    data: ExtractedData
  ): Promise<ExtractedData> {
    if (!data.parties || data.parties.length === 0) {
      return data;
    }

    const result = await this.filter(text, data.parties);

    return {
      ...data,
      parties: result.parties,
    };
  }

  /**
   * 获取配置
   */
  public getConfig(): LegalRepFilterConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<LegalRepFilterConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('LegalRepresentativeFilter配置已更新', { config: this.config });
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建默认LegalRepresentativeFilter实例
 */
export function createLegalRepFilter(
  config?: Partial<LegalRepFilterConfig>
): LegalRepresentativeFilter {
  return new LegalRepresentativeFilter(config);
}
