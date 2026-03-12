/**
 * 业务规则检查器
 * 检查数据是否符合预定义的业务规则
 */
import { BusinessRulesCheck } from '../types';

/**
 * 业务规则配置
 */
interface BusinessRuleConfig {
  name: string;
  validator: (data: Record<string, unknown>) => boolean | Promise<boolean>;
  errorMessage: string;
}

/**
 * 待验证数据接口
 */
interface DataToVerify {
  [key: string]: unknown;
}

/**
 * 默认业务规则配置
 */
const DEFAULT_BUSINESS_RULES: BusinessRuleConfig[] = [
  {
    name: 'has_mandatory_party_info',
    validator: data => {
      const parties = data.parties as Record<string, unknown> | undefined;
      return !!(
        parties?.plaintiff &&
        parties?.defendant &&
        parties.plaintiff !== parties.defendant
      );
    },
    errorMessage: '必须包含不同的原告和被告信息',
  },
  {
    name: 'amount_positive',
    validator: data =>
      !data.amount ||
      (parseFloat(String(data.amount as string | number)) >= 0 &&
        !isNaN(parseFloat(String(data.amount as string | number)))),
    errorMessage: '金额必须为非负数',
  },
];

/**
 * 业务规则检查器类
 */
export class BusinessRulesChecker {
  private businessRules: BusinessRuleConfig[];

  constructor(businessRules?: BusinessRuleConfig[]) {
    this.businessRules = businessRules || DEFAULT_BUSINESS_RULES;
  }

  /**
   * 检查业务规则符合性
   */
  async check(data: DataToVerify): Promise<BusinessRulesCheck> {
    const violatedRules: string[] = [];
    const warnings: string[] = [];

    for (const rule of this.businessRules) {
      try {
        const result = await rule.validator(data);
        if (!result) {
          violatedRules.push(rule.errorMessage);
        }
      } catch (error) {
        warnings.push(
          `规则${rule.name}验证失败: ${error instanceof Error ? error.message : '未知错误'}`
        );
      }
    }

    const passed = violatedRules.length === 0;

    return {
      passed,
      violatedRules,
      warnings,
    };
  }

  /**
   * 创建空的业务规则结果
   */
  async getEmptyResult(): Promise<BusinessRulesCheck> {
    return {
      passed: true,
      violatedRules: [],
      warnings: [],
    };
  }
}
