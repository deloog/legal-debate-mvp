// 文档模板类型定义

/**
 * 文档模板类型枚举
 */
export enum DocumentTemplateType {
  INDICTMENT = 'INDICTMENT', // 起诉状
  DEFENSE = 'DEFENSE', // 答辩状
  APPEARANCE = 'APPEARANCE', // 代理词
  APPEAL = 'APPEAL', // 上诉状
  OTHER = 'OTHER', // 其他
}

/**
 * 文档模板分类枚举
 */
export enum DocumentTemplateCategory {
  CIVIL = 'CIVIL', // 民事
  CRIMINAL = 'CRIMINAL', // 刑事
  ADMINISTRATIVE = 'ADMINISTRATIVE', // 行政
  COMMERCIAL = 'COMMERCIAL', // 商事
  LABOR = 'LABOR', // 劳动
  INTELLECTUAL = 'INTELLECTUAL', // 知识产权
  OTHER = 'OTHER', // 其他
}

/**
 * 模板状态枚举
 */
export enum TemplateStatus {
  DRAFT = 'DRAFT', // 草稿
  PUBLISHED = 'PUBLISHED', // 已发布
  ARCHIVED = 'ARCHIVED', // 已归档
}

/**
 * 模板变量类型枚举
 */
export enum TemplateVariableType {
  STRING = 'string', // 字符串
  NUMBER = 'number', // 数字
  DATE = 'date', // 日期
  BOOLEAN = 'boolean', // 布尔值
  TEXT = 'text', // 长文本
}

/**
 * 模板变量接口
 */
export interface TemplateVariable {
  name: string;
  type: TemplateVariableType;
  description: string;
  required: boolean;
  defaultValue?: string | number | boolean | Date | null;
}

/**
 * 创建文档模板输入接口
 */
export interface CreateDocumentTemplateInput {
  name: string;
  type: DocumentTemplateType;
  category?: DocumentTemplateCategory;
  content: string;
  variables: TemplateVariable[];
  version?: string;
  isSystem?: boolean;
  isPublic?: boolean;
  createdBy: string;
  status?: TemplateStatus;
  metadata?: Record<string, unknown>;
}

/**
 * 更新文档模板输入接口
 */
export interface UpdateDocumentTemplateInput {
  name?: string;
  type?: DocumentTemplateType;
  category?: DocumentTemplateCategory;
  content?: string;
  variables?: TemplateVariable[];
  version?: string;
  isSystem?: boolean;
  isPublic?: boolean;
  status?: TemplateStatus;
  metadata?: Record<string, unknown>;
}

/**
 * 文档模板详情接口
 */
export interface DocumentTemplateDetail {
  id: string;
  name: string;
  type: DocumentTemplateType;
  category: DocumentTemplateCategory | null;
  content: string;
  variables: TemplateVariable[];
  version: string;
  isSystem: boolean;
  isPublic: boolean;
  createdBy: string;
  status: TemplateStatus;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  creatorName?: string;
}

/**
 * 文档模板查询参数接口
 */
export interface DocumentTemplateQueryParams {
  userId?: string;
  type?: DocumentTemplateType;
  category?: DocumentTemplateCategory;
  status?: TemplateStatus;
  isPublic?: boolean;
  isSystem?: boolean;
  search?: string; // 搜索关键词（名称）
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'version';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 文档模板列表响应接口
 */
export interface DocumentTemplateListResponse {
  templates: DocumentTemplateDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 生成文档输入接口
 */
export interface GenerateDocumentInput {
  templateId: string;
  variables: Record<string, string | number | boolean | Date>;
  caseId?: string;
}

/**
 * 生成的文档输出接口
 */
export interface GeneratedDocument {
  content: string;
  templateName: string;
  generatedAt: Date;
  variables: Record<string, string | number | boolean | Date>;
}

/**
 * 模板验证错误接口
 */
export interface TemplateValidationError {
  field: string;
  message: string;
}

/**
 * 模板验证结果接口
 */
export interface TemplateValidationResult {
  isValid: boolean;
  errors: TemplateValidationError[];
}

/**
 * 模板统计信息接口
 */
export interface TemplateStatistics {
  totalTemplates: number;
  templatesByType: Record<string, number>;
  templatesByCategory: Record<string, number>;
  templatesByStatus: Record<string, number>;
  publicTemplates: number;
  privateTemplates: number;
  systemTemplates: number;
  userTemplates: number;
  recentTemplates: DocumentTemplateDetail[];
}
