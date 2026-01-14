/**
 * 系统配置相关类型定义
 */

// =============================================================================
// 配置类型枚举
// =============================================================================

/**
 * 配置类型枚举
 */
export const CONFIG_TYPES = [
  'STRING',
  'NUMBER',
  'BOOLEAN',
  'ARRAY',
  'OBJECT',
] as const;
export type ConfigType = (typeof CONFIG_TYPES)[number];

/**
 * 配置分类枚举
 */
export const CONFIG_CATEGORIES = [
  'general', // 通用配置
  'ai', // AI服务配置
  'storage', // 存储配置
  'security', // 安全配置
  'feature', // 功能配置
  'ui', // UI配置
  'notification', // 通知配置
  'other', // 其他配置
] as const;
export type ConfigCategory = (typeof CONFIG_CATEGORIES)[number];

// =============================================================================
// 系统配置接口
// =============================================================================

/**
 * 系统配置项
 */
export interface SystemConfig {
  id: string;
  key: string;
  value: unknown;
  type: ConfigType;
  category: string;
  description: string | null;
  isPublic: boolean;
  isRequired: boolean;
  defaultValue: unknown | null;
  validationRules: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 配置查询参数
 */
export interface ConfigQueryParams {
  page?: string;
  limit?: string;
  category?: string;
  type?: string;
  isPublic?: string;
  search?: string;
}

/**
 * 配置列表响应数据
 */
export interface ConfigResponse {
  configs: SystemConfig[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 创建配置请求
 */
export interface CreateConfigRequest {
  key: string;
  value: unknown;
  type: ConfigType;
  category: ConfigCategory;
  description?: string;
  isPublic?: boolean;
  isRequired?: boolean;
  defaultValue?: unknown;
  validationRules?: unknown;
}

/**
 * 更新配置请求
 */
export interface UpdateConfigRequest {
  value?: unknown;
  description?: string;
  isPublic?: boolean;
  isRequired?: boolean;
  defaultValue?: unknown;
  validationRules?: unknown;
}

/**
 * 批量更新配置请求
 */
export interface BatchUpdateConfigRequest {
  configs: Array<{
    key: string;
    value: unknown;
  }>;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 验证配置类型
 */
export function isValidConfigType(type: string): type is ConfigType {
  return CONFIG_TYPES.includes(type as ConfigType);
}

/**
 * 验证配置分类
 */
export function isValidConfigCategory(
  category: string
): category is ConfigCategory {
  return CONFIG_CATEGORIES.includes(category as ConfigCategory);
}

/**
 * 根据类型获取配置值的显示格式
 */
export function formatConfigValue(value: unknown, type: ConfigType): string {
  switch (type) {
    case 'BOOLEAN':
      return value === true ? '是' : value === false ? '否' : String(value);
    case 'OBJECT':
    case 'ARRAY':
      return JSON.stringify(value, null, 2);
    default:
      return String(value);
  }
}

/**
 * 解析配置值为指定类型
 */
export function parseConfigValue(value: unknown, type: ConfigType): unknown {
  switch (type) {
    case 'STRING':
      return String(value ?? '');
    case 'NUMBER':
      return Number(value ?? 0);
    case 'BOOLEAN':
      return Boolean(value);
    case 'ARRAY':
      return Array.isArray(value) ? value : JSON.parse(String(value ?? '[]'));
    case 'OBJECT':
      return typeof value === 'object' && value !== null
        ? value
        : JSON.parse(String(value ?? '{}'));
    default:
      return value;
  }
}
