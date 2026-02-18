/**
 * 基础爬虫类
 * 提供通用的爬虫功能和方法
 */

import { prisma } from '@/lib/db/prisma';
import {
  LawCategory,
  LawType,
  LawStatus,
  SyncStatus,
  Prisma,
} from '@prisma/client';

export interface CrawlerConfig {
  name: string;
  baseUrl: string;
  requestTimeout: number;
  maxRetries: number;
  rateLimitDelay: number;
  userAgent: string;
}

export interface CrawlerResult {
  success: boolean;
  itemsCrawled: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: string[];
  duration: number;
}

export interface LawArticleData {
  lawName: string;
  /**
   * 条款/文本标识符。
   * 对于 FLK 来源：存储 bbbs（业务主键），格式为 32 位十六进制字符串，
   * 代表整部法律文本，非条款级别编号。
   * 对于未来按条拆分的数据源：可存储「第X条」格式的条款号。
   * UI 展示时，FLK 数据应显示为「全文」而非原始哈希值。
   */
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
  status?: LawStatus;
  issuingAuthority: string;
  jurisdiction?: string;
  searchableText?: string;
  sourceId?: string;
  sourceUrl?: string;
}

export interface CrawlProgress {
  crawlerName: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  currentItem?: string;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
  lastError?: string;
}

export abstract class BaseCrawler {
  protected config: CrawlerConfig;
  protected progress: CrawlProgress;

  constructor(config: Partial<CrawlerConfig>) {
    this.config = {
      name: config.name || 'BaseCrawler',
      baseUrl: config.baseUrl || '',
      requestTimeout: config.requestTimeout || 30000,
      maxRetries: config.maxRetries || 3,
      rateLimitDelay: config.rateLimitDelay || 1000,
      userAgent: config.userAgent || 'LegalDebateBot/1.0',
    };

    this.progress = {
      crawlerName: this.config.name,
      status: 'idle',
      totalItems: 0,
      processedItems: 0,
      errors: [],
    };
  }

  /**
   * 获取爬虫配置
   */
  getConfig(): CrawlerConfig {
    return this.config;
  }

  /**
   * 获取爬虫进度
   */
  getProgress(): CrawlProgress {
    return this.progress;
  }

  /**
   * 更新进度
   */
  protected updateProgress(updates: Partial<CrawlProgress>): void {
    this.progress = { ...this.progress, ...updates };
  }

  /**
   * 记录错误
   */
  protected recordError(error: string): void {
    this.progress.errors.push(`[${new Date().toISOString()}] ${error}`);
    this.progress.lastError = error;
    console.error(`[${this.config.name}] Error:`, error);
  }

  /**
   * 延迟函数
   */
  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 抽象方法：获取数据源名称
   */
  abstract getDataSourceName(): string;

  /**
   * 抽象方法：执行抓取
   */
  abstract crawl(): Promise<CrawlerResult>;

  /**
   * 抽象方法：解析单个法条数据
   */
  abstract parseArticle(rawData: any): LawArticleData | null;

  /**
   * 保存法条数据到数据库。
   * 返回 { saved, isNew } 供调用方统计新增/更新数量，避免外部重复查询。
   */
  protected async saveArticle(
    data: LawArticleData
  ): Promise<{ saved: boolean; isNew: boolean }> {
    try {
      const existing = await prisma.lawArticle.findFirst({
        where: {
          lawName: data.lawName,
          articleNumber: data.articleNumber,
        },
        select: { id: true },
      });

      const articleData = {
        fullText: data.fullText,
        lawType: data.lawType,
        category: data.category,
        subCategory: data.subCategory,
        tags: data.tags || [],
        keywords: data.keywords || [],
        version: data.version || '1.0',
        effectiveDate: data.effectiveDate,
        expiryDate: data.expiryDate,
        status: data.status || LawStatus.VALID,
        issuingAuthority: data.issuingAuthority,
        jurisdiction: data.jurisdiction || '全国',
        searchableText:
          data.searchableText ||
          `${data.lawName} ${data.articleNumber} ${data.fullText}`,
        dataSource: this.getDataSourceName(),
        sourceId: data.sourceId,
        lastSyncedAt: new Date(),
        syncStatus: SyncStatus.SYNCED,
      } as Prisma.LawArticleUpdateInput;

      if (existing) {
        await prisma.lawArticle.update({
          where: { id: existing.id },
          data: articleData,
        });
        return { saved: true, isNew: false };
      } else {
        await prisma.lawArticle.create({
          data: {
            lawName: data.lawName,
            articleNumber: data.articleNumber,
            ...articleData,
          } as Prisma.LawArticleCreateInput,
        });
        return { saved: true, isNew: true };
      }
    } catch (error) {
      this.recordError(
        `Failed to save article: ${data.lawName} ${data.articleNumber} - ${error}`
      );
      return { saved: false, isNew: false };
    }
  }

  /**
   * 验证法条数据
   */
  protected validateArticleData(data: LawArticleData): boolean {
    const requiredFields = [
      'lawName',
      'articleNumber',
      'fullText',
      'lawType',
      'category',
      'issuingAuthority',
    ];

    for (const field of requiredFields) {
      if (!data[field as keyof LawArticleData]) {
        this.recordError(`Missing required field: ${field}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 批量保存法条。
   * 每条记录只执行一次 findFirst + update/create（共 2 次查询），
   * 不在 DB 写入之间施加速率限制延迟（限速仅适用于 HTTP 请求）。
   */
  protected async saveArticles(
    articles: LawArticleData[]
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const article of articles) {
      if (!this.validateArticleData(article)) {
        continue;
      }

      const result = await this.saveArticle(article);
      if (result.saved) {
        if (result.isNew) {
          created++;
        } else {
          updated++;
        }
      }

      this.updateProgress({
        processedItems: this.progress.processedItems + 1,
        currentItem: `${article.lawName} ${article.articleNumber}`,
      });
    }

    return { created, updated };
  }

  /**
   * 记录采集日志
   */
  protected async logCrawlOperation(
    operation: string,
    result: CrawlerResult
  ): Promise<void> {
    try {
      await prisma.aIInteraction.create({
        data: {
          type: 'CRAWLER',
          provider: this.config.name,
          request: {
            operation,
            // 仅记录操作名称，不记录 config（可能含敏感凭据）
          } as any,
          response: {
            itemsCrawled: result.itemsCrawled,
            itemsCreated: result.itemsCreated,
            itemsUpdated: result.itemsUpdated,
            duration: result.duration,
          } as any,
          success: result.success,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log crawl operation:', error);
    }
  }
}
