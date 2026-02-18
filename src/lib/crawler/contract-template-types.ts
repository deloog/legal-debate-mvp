/**
 * 合同模板数据源类型定义
 */

import { Prisma } from '@prisma/client';

/**
 * 合同模板数据源
 */
export type ContractTemplateSource =
  | 'samr' // 国家市场监督管理总局
  | 'mohrss' // 人社部
  | 'mohurd' // 住建部
  | 'mot' // 交通部
  | 'moj' // 司法部
  | 'other'; // 其他

/**
 * 合同模板分类
 */
export type ContractCategory =
  | 'LABOR' // 劳动合同
  | 'CIVIL' // 民事合同
  | 'COMMERCIAL' // 商业合同
  | 'REAL_ESTATE' // 房地产合同
  | 'CONSTRUCTION' // 建设工程合同
  | 'TRANSPORTATION' // 运输合同
  | 'INTELLECTUAL_PROPERTY' // 知识产权合同
  | 'FINANCIAL' // 金融合同
  | 'LEASE' // 租赁合同
  | 'SERVICE' // 服务合同
  | 'OTHER'; // 其他

/**
 * 合同模板优先级
 */
export type TemplatePriority = 'P0' | 'P1' | 'P2';

/**
 * 合同模板采集状态
 */
export type TemplateCrawlStatus =
  | 'pending'
  | 'crawling'
  | 'completed'
  | 'failed';

/**
 * 合同条款类型
 */
export type ClauseType =
  | 'PARTIES' // 当事人条款
  | 'SUBJECT_MATTER' // 标的条款
  | 'PRICE_PAYMENT' // 价格与支付条款
  | 'PERFORMANCE' // 履行条款
  | 'WARRANTY' // 担保条款
  | 'LIABILITY' // 违约责任条款
  | 'DISPUTE' // 争议解决条款
  | 'TERMINATION' // 解除条款
  | 'CONFIDENTIALITY' // 保密条款
  | 'INTELLECTUAL_PROPERTY' // 知识产权条款
  | 'FORCE_MAJEURE' // 不可抗力条款
  | 'GOVERNING_LAW' // 适用法律条款
  | 'NOTICE' // 通知条款
  | 'MISCELLANEOUS'; // 其他条款';

/**
 * 风险等级
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * 合同模板基础数据（采集用）
 */
export interface ContractTemplateData {
  // 基本信息
  name: string;
  code: string;
  category: ContractCategory;
  subCategory?: string;
  description?: string;

  // 来源信息
  source: ContractTemplateSource;
  sourceUrl?: string;
  sourceId?: string;
  publishedDate?: Date;
  effectiveDate?: Date;

  // 模板内容
  fullText: string;
  content?: string; // 简化的主要内容

  // 变量占位符
  variables: TemplateVariable[];

  // 条款结构
  clauses: TemplateClause[];

  // 风险提示
  riskWarnings: RiskWarning[];

  // 使用指南
  usageGuide?: string;

  // 版本信息
  version: string;
  isLatest: boolean;

  // 优先级
  priority: TemplatePriority;

  // 标签
  tags?: string[];
  keywords?: string[];
}

/**
 * 模板变量定义
 */
export interface TemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  defaultValue?: string;
  placeholder?: string;
  description?: string;
  options?: string[]; // for select type
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

/**
 * 模板条款
 */
export interface TemplateClause {
  type: ClauseType;
  title: string;
  content: string;
  order: number;
  isRequired: boolean;
  description?: string;
  fillGuidance?: string;
  sampleText?: string;
}

/**
 * 风险提示
 */
export interface RiskWarning {
  id?: string;
  level: RiskLevel;
  title: string;
  description: string;
  legalBasis?: string; // 法律依据
  suggestion?: string; // 建议
  relatedClauses?: string[]; // 相关条款
  occurrenceProbability?: 'LOW' | 'MEDIUM' | 'HIGH';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * 采集统计
 */
export interface ContractTemplateCrawlStats {
  source: ContractTemplateSource;
  totalTemplates: number;
  crawledTemplates: number;
  successCount: number;
  failedCount: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  errors: string[];
}

/**
 * 合同模板采集器配置
 */
export interface ContractTemplateCrawlerConfig {
  name: string;
  baseUrl: string;
  source: ContractTemplateSource;
  requestTimeout: number;
  maxRetries: number;
  rateLimitDelay: number;
  priority: TemplatePriority[];
}

/**
 * 搜索/筛选参数
 */
export interface ContractTemplateSearchParams {
  category?: ContractCategory;
  source?: ContractTemplateSource;
  keywords?: string;
  tags?: string[];
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'priority';
  order?: 'asc' | 'desc';
}

/**
 * Prisma扩展类型（预留，未来配合schema使用）
 */
export type ContractTemplateWithRelations = {
  id: string;
  name: string;
  code: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  content: string;
  fullText: string | null;
  variables: Prisma.JsonValue;
  clauses: Prisma.JsonValue;
  riskWarnings: Prisma.JsonValue;
  usageGuide: string | null;
  source: string;
  sourceUrl: string | null;
  sourceId: string | null;
  publishedDate: Date | null;
  effectiveDate: Date | null;
  version: string;
  isLatest: boolean;
  priority: string;
  tags: string[];
  keywords: string[];
  isActive: boolean;
  isDefault: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 合同模板采集结果
 */
export interface ContractTemplateCrawlResult {
  success: boolean;
  templatesCreated: number;
  templatesUpdated: number;
  errors: string[];
  duration: number;
}
