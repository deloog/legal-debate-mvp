/**
 * 法律法规采集模块类型定义
 */

import { LawCategory, LawType, LawStatus } from '@prisma/client';

/**
 * 法律法规数据源
 */
export type DataSource =
  | 'npc' // 全国人大
  | 'flk' // 法律法规数据库
  | 'court' // 最高人民法院
  | 'cail' // 中国法律服务网
  | 'pkulaw' // 北大法宝
  | 'wikass' // 威科先行
  | 'manual'; // 手动录入

/**
 * 采集任务状态
 */
export type CrawlTaskStatus =
  | 'pending' // 等待执行
  | 'running' // 执行中
  | 'completed' // 已完成
  | 'failed' // 失败
  | 'cancelled'; // 已取消

/**
 * 法律法规采集任务
 */
export interface CrawlTask {
  id: string;
  source: DataSource;
  status: CrawlTaskStatus;
  crawlType: 'full' | 'incremental';
  itemsTotal: number;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * 采集任务创建参数
 */
export interface CreateCrawlTaskParams {
  source: DataSource;
  crawlType: 'full' | 'incremental';
  options?: {
    categories?: LawCategory[];
    dateFrom?: Date;
    dateTo?: Date;
    lawTypes?: LawType[];
    force?: boolean; // 强制重新采集
  };
}

/**
 * 数据源配置
 */
export interface DataSourceConfig {
  name: string;
  source: DataSource;
  baseUrl: string;
  enabled: boolean;
  rateLimit: number; // 请求间隔(ms)
  priority: number; // 优先级
  lastCrawlAt?: Date;
  lastSuccessAt?: Date;
  totalCrawled: number;
  failureCount: number;
}

/**
 * 法条数据（采集用）
 */
export interface CrawledLawArticle {
  source: DataSource;
  sourceId: string;
  sourceUrl?: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  lawType: LawType;
  category: LawCategory;
  subCategory?: string;
  tags?: string[];
  keywords?: string[];
  version?: string;
  effectiveDate: Date;
  expiryDate?: Date;
  status: LawStatus;
  issuingAuthority: string;
  jurisdiction?: string;
  amendmentHistory?: AmendmentInfo[];
  relatedArticles?: string[];
  legalBasis?: string;
  crawledAt: Date;
}

export interface AmendmentInfo {
  amendmentNumber: string;
  amendmentDate: Date;
  description: string;
  previousText?: string;
}

/**
 * 采集统计
 */
export interface CrawlStatistics {
  source: DataSource;
  totalArticles: number;
  validArticles: number;
  invalidArticles: number;
  newArticles: number;
  updatedArticles: number;
  failedArticles: number;
  averageProcessingTime: number;
  dataQuality: {
    completeness: number; // 完整性
    accuracy: number; // 准确性
    consistency: number; // 一致性
    timeliness: number; // 时效性
  };
}

/**
 * 采集日志
 */
export interface CrawlLog {
  id: string;
  taskId: string;
  source: DataSource;
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * 同步配置
 */
export interface SyncConfig {
  enabled: boolean;
  interval: number; // 同步间隔（小时）
  fullSyncDayOfWeek?: number; // 0-6, 每周全量同步的星期
  incrementalSyncHour: number; // 0-23, 增量同步时间
  sources: DataSource[];
  categories?: LawCategory[];
  notifyOnFailure: boolean;
  maxRetries: number;
}
