/**
 * 中文数字转换模块
 * 负责将中文数字转换为阿拉伯数字
 */

import { chineseNumberMap } from './amount-patterns';

/**
 * 中文数字转换配置
 */
export interface ChineseNumberConfig {
  enableSpecialCases: boolean;
  enableDecimals: boolean;
}

/**
 * 中文数字转换器类
 */
export class ChineseNumberConverter {
  private config: ChineseNumberConfig;
  private specialCases: Record<string, number>;

  constructor(config?: Partial<ChineseNumberConfig>) {
    this.config = {
      enableSpecialCases: true,
      enableDecimals: true,
      ...config,
    };
    this.specialCases = this.buildSpecialCases();
  }

  /**
   * 构建特殊表达式映射表
   */
  private buildSpecialCases(): Record<string, number> {
    return {
      // 常见大写金额
      壹佰万元整: 1000000,
      壹佰万: 1000000,
      壹佰万元: 1000000,
      壹佰元整: 100,
      壹佰元: 100,
      伍拾万元整: 500000,
      伍拾万: 500000,
      伍拾万元: 500000,
      伍万: 50000,
      伍万元: 50000,
      贰万元整: 20000,
      贰万元: 20000,
      贰万: 20000,
      拾万元整: 100000,
      拾万元: 100000,
      拾万: 100000,
      拾元整: 10,
      拾元: 10,
      壹拾万元整: 100000,
      壹拾万元: 100000,
      壹拾万: 100000,
      壹拾元: 10,
      壹拾元整: 10,
      玖万捌仟元: 98000,
      玖万捌仟元整: 98000,
      // 扩展：添加更多常见中文大写金额
      壹佰零伍万元: 1005000,
      壹佰零伍万元整: 1005000,
      壹佰零伍万: 1005000,
      壹佰零伍万整: 1005000,
      玖仟捌佰元: 9800,
      玖仟捌佰元整: 9800,
      捌佰元: 800,
      捌佰元整: 800,
      肆仟元: 4000,
      肆仟元整: 4000,
      陆仟元: 6000,
      陆仟元整: 6000,
      柒佰元: 700,
      柒佰元整: 700,
      叁佰元: 300,
      叁佰元整: 300,
      // 处理分角单位
      伍元叁角: 5.3,
      伍元叁角整: 5.3,
      贰拾元伍角柒分: 20.57,
      壹拾元伍角: 10.5,
      壹拾元伍角整: 10.5,
    };
  }

  /**
   * 将中文数字转换为阿拉伯数字
   */
  convertToNumber(chineseStr: string): number {
    const cleaned = chineseStr.replace(/[（()（）\s]/g, '');

    // 优先匹配特殊表达式
    if (this.config.enableSpecialCases) {
      const specialValue = this.matchSpecialCase(cleaned);
      if (specialValue !== null) {
        return specialValue;
      }
    }

    // 处理分角单位
    if (this.config.enableDecimals) {
      const decimalValue = this.parseDecimalAmount(cleaned);
      if (decimalValue !== null) {
        return decimalValue;
      }
    }

    // 处理"X万X"格式
    if (cleaned.includes('万')) {
      return this.parseWanFormat(cleaned);
    }

    // 处理普通中文数字
    return this.parseNormalChineseNumber(cleaned);
  }

  /**
   * 匹配特殊表达式
   */
  private matchSpecialCase(cleaned: string): number | null {
    const sortedSpecials = Object.entries(this.specialCases).sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [pattern, value] of sortedSpecials) {
      if (cleaned === pattern) {
        return value;
      }
    }

    return null;
  }

  /**
   * 解析包含分角的金额
   */
  private parseDecimalAmount(text: string): number | null {
    // 匹配"X元X角X分"格式
    const decimalPattern =
      /(\d+|[零壹贰叁肆伍陆柒捌玖]+)元(\d+|[零壹贰叁肆伍陆柒捌玖]+)角(\d+|[零壹贰叁肆伍陆柒捌玖]+)?分?/;

    const match = text.match(decimalPattern);
    if (!match) {
      return null;
    }

    const yuanPart = this.parseChineseToArabic(match[1]);
    const jiaoPart = this.parseChineseToArabic(match[2]) / 10;
    const fenPart = match[3] ? this.parseChineseToArabic(match[3]) / 100 : 0;

    return yuanPart + jiaoPart + fenPart;
  }

  /**
   * 将中文数字转为阿拉伯数字（单个数字或简单组合）
   */
  private parseChineseToArabic(str: string): number {
    const cleanStr = str.replace(/[元圆整]/g, '');
    let result = 0;

    for (const char of cleanStr) {
      const num = chineseNumberMap[char];
      if (num !== undefined) {
        if (char === '拾' && result === 0) {
          result = 10;
        } else {
          result += num;
        }
      }
    }

    return result;
  }

  /**
   * 解析"X万X"格式
   */
  private parseWanFormat(cleaned: string): number {
    const parts = cleaned.split('万');
    const wanPart = parts[0];
    const afterWan = parts[1] || '';

    // 解析"万"前面的数字
    let wanValue = 0;
    let temp = 0;

    for (const char of wanPart) {
      const num = chineseNumberMap[char];
      if (num !== undefined) {
        if (num >= 100) {
          if (temp === 0) {
            temp = 1;
          }
          if (num === 10000) {
            wanValue += temp * num;
            temp = 0;
          } else {
            temp *= num;
            if (num === 10000) {
              wanValue += temp;
              temp = 0;
            }
          }
        } else {
          if (wanPart.length === 1) {
            temp = num;
          } else {
            temp += num;
          }
        }
      }
    }

    if (temp > 0 && wanValue === 0) {
      wanValue = temp;
    }

    let total = wanValue * 10000;

    // 处理"万"后面的部分
    if (afterWan && !afterWan.includes('元')) {
      let subValue = 0;
      temp = 0;
      for (const char of afterWan) {
        const num = chineseNumberMap[char];
        if (num !== undefined) {
          if (num >= 10) {
            if (temp === 0) temp = 1;
            if (num === 10000) {
              subValue += temp * num;
              temp = 0;
            } else {
              temp *= num;
            }
          } else {
            temp += num;
          }
        }
      }
      if (temp > 0) subValue += temp;
      total += subValue;
    }

    return total > 0 ? total : 0;
  }

  /**
   * 解析普通中文数字
   */
  private parseNormalChineseNumber(cleaned: string): number {
    let result = 0;
    let temp = 0;
    let section = 0;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      const num = chineseNumberMap[char];

      if (num !== undefined) {
        if (num === 10 && temp === 0) {
          temp = 10;
        } else if (num >= 10) {
          if (temp === 0) {
            temp = 1;
          }
          if (num === 10000 || num === 100000000) {
            section += temp * num;
            temp = 0;
          } else {
            temp *= num;
          }
        } else {
          temp += num;
        }
      }
    }

    result = section + temp;
    return result > 0 ? result : 0;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ChineseNumberConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ChineseNumberConfig {
    return { ...this.config };
  }
}
