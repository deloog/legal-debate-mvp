/**
 * 时效计算规则配置
 *
 * 基于中华人民共和国民法典和相关司法解释
 */

import { StatuteType, CaseTypeForStatute, StatuteRule } from '@/types/statute';

/**
 * 默认时效规则配置
 */
export const DEFAULT_STATUTE_RULES: StatuteRule[] = [
  // 民事案件诉讼时效
  {
    id: 'civil-litigation-general',
    statuteType: StatuteType.LITIGATION,
    caseType: CaseTypeForStatute.CIVIL,
    statutePeriod: 1095, // 3年 = 365 * 3
    description: '一般民事案件诉讼时效',
    legalBasis: '《民法典》第一百八十八条',
    effectiveDate: new Date('2021-01-01'),
    isActive: true,
  },
  // 商事案件诉讼时效
  {
    id: 'commercial-litigation-general',
    statuteType: StatuteType.LITIGATION,
    caseType: CaseTypeForStatute.COMMERCIAL,
    statutePeriod: 1095, // 3年
    description: '商事案件诉讼时效',
    legalBasis: '《民法典》第一百八十八条',
    effectiveDate: new Date('2021-01-01'),
    isActive: true,
  },
  // 劳动案件诉讼时效
  {
    id: 'labor-litigation-arbitration',
    statuteType: StatuteType.LITIGATION,
    caseType: CaseTypeForStatute.LABOR,
    statutePeriod: 365, // 1年
    description: '劳动仲裁申请时效',
    legalBasis: '《劳动争议调解仲裁法》第二十七条',
    effectiveDate: new Date('2008-05-01'),
    isActive: true,
  },
  // 知识产权案件诉讼时效
  {
    id: 'intellectual-litigation-patent',
    statuteType: StatuteType.LITIGATION,
    caseType: CaseTypeForStatute.INTELLECTUAL,
    statutePeriod: 1095, // 3年
    description: '知识产权案件诉讼时效',
    legalBasis: '《民法典》第一百八十八条',
    effectiveDate: new Date('2021-01-01'),
    isActive: true,
  },
  // 行政案件诉讼时效
  {
    id: 'administrative-litigation-general',
    statuteType: StatuteType.LITIGATION,
    caseType: CaseTypeForStatute.ADMINISTRATIVE,
    statutePeriod: 180, // 6个月
    description: '行政案件诉讼时效',
    legalBasis: '《行政诉讼法》第四十六条',
    effectiveDate: new Date('2015-05-01'),
    isActive: true,
  },
  // 刑事案件追诉时效
  {
    id: 'criminal-prosecution-major',
    statuteType: StatuteType.LITIGATION,
    caseType: CaseTypeForStatute.CRIMINAL,
    statutePeriod: 3650, // 10年
    description: '重大刑事案件追诉时效',
    legalBasis: '《刑法》第八十七条',
    effectiveDate: new Date('2020-12-26'),
    isActive: true,
  },
  // 民事案件上诉时效
  {
    id: 'civil-appeal-general',
    statuteType: StatuteType.APPEAL,
    caseType: CaseTypeForStatute.CIVIL,
    statutePeriod: 15, // 15天
    description: '民事案件上诉期限',
    legalBasis: '《民事诉讼法》第一百七十一条',
    effectiveDate: new Date('2022-01-01'),
    isActive: true,
  },
  // 商事案件上诉时效
  {
    id: 'commercial-appeal-general',
    statuteType: StatuteType.APPEAL,
    caseType: CaseTypeForStatute.COMMERCIAL,
    statutePeriod: 15, // 15天
    description: '商事案件上诉期限',
    legalBasis: '《民事诉讼法》第一百七十一条',
    effectiveDate: new Date('2022-01-01'),
    isActive: true,
  },
  // 行政案件上诉时效
  {
    id: 'administrative-appeal-general',
    statuteType: StatuteType.APPEAL,
    caseType: CaseTypeForStatute.ADMINISTRATIVE,
    statutePeriod: 15, // 15天
    description: '行政案件上诉期限',
    legalBasis: '《行政诉讼法》第八十五条',
    effectiveDate: new Date('2015-05-01'),
    isActive: true,
  },
  // 刑事案件上诉时效
  {
    id: 'criminal-appeal-general',
    statuteType: StatuteType.APPEAL,
    caseType: CaseTypeForStatute.CRIMINAL,
    statutePeriod: 10, // 10天
    description: '刑事案件上诉期限',
    legalBasis: '《刑事诉讼法》第二百三十条',
    effectiveDate: new Date('2018-10-26'),
    isActive: true,
  },
  // 民事案件执行时效
  {
    id: 'civil-enforcement-general',
    statuteType: StatuteType.ENFORCEMENT,
    caseType: CaseTypeForStatute.CIVIL,
    statutePeriod: 730, // 2年
    description: '民事案件执行时效',
    legalBasis: '《民事诉讼法》第二百四十六条',
    effectiveDate: new Date('2022-01-01'),
    isActive: true,
  },
  // 商事案件执行时效
  {
    id: 'commercial-enforcement-general',
    statuteType: StatuteType.ENFORCEMENT,
    caseType: CaseTypeForStatute.COMMERCIAL,
    statutePeriod: 730, // 2年
    description: '商事案件执行时效',
    legalBasis: '《民事诉讼法》第二百四十六条',
    effectiveDate: new Date('2022-01-01'),
    isActive: true,
  },
  // 行政案件执行时效
  {
    id: 'administrative-enforcement-general',
    statuteType: StatuteType.ENFORCEMENT,
    caseType: CaseTypeForStatute.ADMINISTRATIVE,
    statutePeriod: 180, // 6个月
    description: '行政案件执行时效',
    legalBasis: '《行政诉讼法》第六十六条',
    effectiveDate: new Date('2015-05-01'),
    isActive: true,
  },
];

/**
 * 根据时效类型和案件类型获取规则
 */
export function getStatuteRule(
  statuteType: StatuteType,
  caseType: CaseTypeForStatute
): StatuteRule | null {
  const rule = DEFAULT_STATUTE_RULES.find(
    r => r.statuteType === statuteType && r.caseType === caseType
  );
  return rule || null;
}

/**
 * 获取所有适用的规则
 */
export function getApplicableRules(
  statuteType: StatuteType,
  caseType: CaseTypeForStatute,
  customRules?: StatuteRule[]
): StatuteRule[] {
  const rules: StatuteRule[] = [];
  const defaultRule = getStatuteRule(statuteType, caseType);
  if (defaultRule) {
    rules.push(defaultRule);
  }
  if (customRules) {
    rules.push(...customRules);
  }
  return rules;
}

/**
 * 检查规则是否有效
 */
export function isRuleValid(rule: StatuteRule): boolean {
  return rule.isActive && rule.effectiveDate <= new Date();
}

/**
 * 获取默认规则（按时效类型分组）
 */
export function getDefaultRulesByType(statuteType: StatuteType): StatuteRule[] {
  return DEFAULT_STATUTE_RULES.filter(
    r => r.statuteType === statuteType && isRuleValid(r)
  );
}

/**
 * 根据案件类型获取所有规则
 */
export function getRulesByCaseType(
  caseType: CaseTypeForStatute
): StatuteRule[] {
  return DEFAULT_STATUTE_RULES.filter(
    r => r.caseType === caseType && isRuleValid(r)
  );
}

/**
 * 获取所有有效的规则
 */
export function getAllValidRules(): StatuteRule[] {
  return DEFAULT_STATUTE_RULES.filter(isRuleValid);
}

/**
 * 添加自定义规则
 */
export function createCustomRule(
  statuteType: StatuteType,
  caseType: CaseTypeForStatute,
  statutePeriod: number,
  description: string,
  legalBasis: string
): StatuteRule {
  return {
    id: `custom-${Date.now()}`,
    statuteType,
    caseType,
    statutePeriod,
    description,
    legalBasis,
    effectiveDate: new Date(),
    isActive: true,
  };
}
