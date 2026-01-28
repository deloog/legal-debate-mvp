/**
 * 案件类型大类枚举
 */
export enum CaseTypeCategory {
  CIVIL = 'CIVIL', // 民事
  CRIMINAL = 'CRIMINAL', // 刑事
  ADMINISTRATIVE = 'ADMINISTRATIVE', // 行政
  NON_LITIGATION = 'NON_LITIGATION', // 非诉
}

/**
 * 案件类型大类标签映射
 */
export const CASE_TYPE_CATEGORY_LABELS: Record<CaseTypeCategory, string> = {
  [CaseTypeCategory.CIVIL]: '民事',
  [CaseTypeCategory.CRIMINAL]: '刑事',
  [CaseTypeCategory.ADMINISTRATIVE]: '行政',
  [CaseTypeCategory.NON_LITIGATION]: '非诉',
};

/**
 * 材料项接口
 */
export interface MaterialItem {
  name: string;
  description: string;
  copies: number;
  templateUrl?: string;
  notes?: string;
}

/**
 * 材料清单接口
 */
export interface MaterialList {
  materials: MaterialItem[];
  notes?: string[];
  requirements?: string[];
}

/**
 * 案件类型配置接口
 */
export interface CaseTypeConfig {
  id: string;
  code: string;
  name: string;
  category: CaseTypeCategory;
  baseFee: number;
  riskFeeRate: number | null;
  hourlyRate: number | null;
  requiredDocs: MaterialList;
  optionalDocs: MaterialList | null;
  avgDuration: number | null;
  complexityLevel: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建案件类型配置输入接口
 */
export interface CreateCaseTypeConfigInput {
  code: string;
  name: string;
  category: CaseTypeCategory;
  baseFee: number;
  riskFeeRate?: number;
  hourlyRate?: number;
  requiredDocs: MaterialList;
  optionalDocs?: MaterialList;
  avgDuration?: number;
  complexityLevel?: number;
  isActive?: boolean;
  sortOrder?: number;
}

/**
 * 更新案件类型配置输入接口
 */
export interface UpdateCaseTypeConfigInput {
  name?: string;
  category?: CaseTypeCategory;
  baseFee?: number;
  riskFeeRate?: number | null;
  hourlyRate?: number | null;
  requiredDocs?: MaterialList;
  optionalDocs?: MaterialList | null;
  avgDuration?: number | null;
  complexityLevel?: number;
  isActive?: boolean;
  sortOrder?: number;
}

/**
 * 案件类型配置查询参数接口
 */
export interface CaseTypeConfigQueryParams {
  category?: CaseTypeCategory;
  isActive?: boolean;
  code?: string;
  keyword?: string;
  sortBy?: 'code' | 'name' | 'sortOrder';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 案件类型配置列表响应接口
 */
export interface CaseTypeConfigListResponse {
  items: CaseTypeConfig[];
  total: number;
}

/**
 * 类型守卫：验证是否为有效的案件类型大类
 */
export function isValidCaseTypeCategory(
  value: string
): value is CaseTypeCategory {
  return Object.values(CaseTypeCategory).includes(value as CaseTypeCategory);
}

/**
 * 类型守卫：验证材料清单结构
 */
export function isValidMaterialList(value: unknown): value is MaterialList {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const materialList = value as Record<string, unknown>;

  if (!Array.isArray(materialList.materials)) {
    return false;
  }

  // 验证每个材料项
  return materialList.materials.every((item: unknown) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const materialItem = item as Record<string, unknown>;

    return (
      typeof materialItem.name === 'string' &&
      typeof materialItem.description === 'string' &&
      typeof materialItem.copies === 'number' &&
      materialItem.copies >= 0
    );
  });
}

/**
 * 获取案件类型大类标签
 */
export function getCaseTypeCategoryLabel(category: CaseTypeCategory): string {
  return CASE_TYPE_CATEGORY_LABELS[category] || category;
}

/**
 * 获取复杂度等级标签
 */
export function getComplexityLevelLabel(level: number): string {
  const labels: Record<number, string> = {
    1: '非常简单',
    2: '简单',
    3: '中等',
    4: '复杂',
    5: '非常复杂',
  };

  if (level < 1 || level > 5) {
    return '未知';
  }

  return labels[Math.floor(level)] || '中等';
}

/**
 * 计算费用（基础收费）
 */
export function calculateBaseFee(
  baseFee: number,
  complexityLevel: number
): number {
  // 复杂度越高，费用越高
  const complexityMultiplier = 1 + (complexityLevel - 2) * 0.2;
  return baseFee * complexityMultiplier;
}

/**
 * 计算风险代理费用
 */
export function calculateRiskFee(
  amount: number,
  riskFeeRate: number,
  baseFee: number
): number {
  if (!riskFeeRate || riskFeeRate <= 0) {
    return 0;
  }

  const riskFee = amount * riskFeeRate;
  // 风险代理费用不低于基础收费
  return Math.max(riskFee, baseFee * 0.5);
}

/**
 * 计算计时收费
 */
export function calculateHourlyFee(
  hourlyRate: number,
  estimatedHours: number
): number {
  return hourlyRate * estimatedHours;
}

/**
 * 估算办案周期（天）
 */
export function estimateCaseDuration(
  avgDuration: number | null | undefined,
  complexityLevel: number
): number {
  if (avgDuration && avgDuration > 0) {
    return avgDuration;
  }

  // 根据复杂度估算
  const baseDurations: Record<number, number> = {
    1: 30, // 简单案件 30天
    2: 60, // 中等案件 60天
    3: 90, // 复杂案件 90天
    4: 120, // 非常复杂 120天
    5: 180, // 极其复杂 180天
  };

  return baseDurations[complexityLevel] || 90;
}

/**
 * 验证案件类型代码格式
 * 格式要求：大写字母和下划线，如: LABOR_DISPUTE
 */
export function isValidCaseTypeCode(code: string): boolean {
  const codePattern = /^[A-Z][A-Z0-9_]*$/;
  return codePattern.test(code);
}

/**
 * 生成案件类型代码（从名称自动生成）
 * 示例: "劳动争议" -> "LABOR_DISPUTE"
 */
export function generateCaseTypeCode(name: string): string {
  // 简单的拼音转英文映射（示例）
  const pinyinMap: Record<string, string> = {
    劳动: 'LABOR',
    争议: 'DISPUTE',
    合同: 'CONTRACT',
    纠纷: 'DISPUTE',
    侵权: 'TORT',
    责任: 'LIABILITY',
    婚姻: 'MARRIAGE',
    家庭: 'FAMILY',
    继承: 'INHERITANCE',
    物权: 'PROPERTY',
    刑事: 'CRIMINAL',
    辩护: 'DEFENSE',
    行政: 'ADMINISTRATIVE',
    复议: 'RECONSIDERATION',
    诉讼: 'LITIGATION',
    企业: 'ENTERPRISE',
    公司: 'COMPANY',
    证券: 'SECURITIES',
    保险: 'INSURANCE',
    法律: 'LEGAL',
    顾问: 'COUNSEL',
    尽职: 'DUE_DILIGENCE',
    调查: 'DILIGENCE',
  };

  // 将名称转换为代码
  let code = name;
  for (const [chinese, english] of Object.entries(pinyinMap)) {
    code = code.replace(new RegExp(chinese, 'g'), `_${english}_`);
  }

  // 如果没有替换任何内容，返回原始名称
  if (code === name) {
    return name.length > 0 ? name : 'UNKNOWN';
  }

  // 移除连续的下划线
  code = code.replace(/_+/g, '_');

  // 移除首尾下划线
  code = code.replace(/^_+|_+$/g, '');

  return code || 'UNKNOWN';
}

/**
 * 根据复杂度获取建议的律师人数
 */
export function getRecommendedLawyerCount(complexityLevel: number): number {
  if (complexityLevel <= 2) {
    return 1; // 简单案件 1名律师
  } else if (complexityLevel <= 4) {
    return 2; // 复杂案件 2名律师
  } else {
    return 3; // 非常复杂案件 3名律师
  }
}
