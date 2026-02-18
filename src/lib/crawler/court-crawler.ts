/**
 * 最高人民法院司法解释采集爬虫
 *
 * ⚠️  此爬虫已废弃！
 *
 * 原因：FLK（flk.npc.gov.cn）国家法律法规数据库已整合最高人民法院的司法解释数据。
 *       FLK 数据中的 811 条司法解释已覆盖 Court 来源，无需单独采集。
 *
 * 状态：已废弃，保留代码供参考，不参与采集调度
 *
 * 采集调度器默认只启用 'flk' 数据源
 */

import { BaseCrawler, CrawlerResult, LawArticleData } from './base-crawler';
import { LawCategory, LawType, LawStatus } from '@prisma/client';
import { getLogger } from './crawler-logger';

/** Court 分类代码 */
export type CourtCategoryCode = number;

/** 列表 API 请求体（模板） */
interface CourtListRequest {
  pageNum: number;
  pageSize: number;
  searchContent?: string;
  categoryCode?: number;
  startDate?: string;
  endDate?: string;
}

/** 列表 API 响应（模板） */
interface CourtListResponse {
  total: number;
  rows: CourtListItem[];
  code: number;
  msg: string;
}

/** 列表项 */
interface CourtListItem {
  id: string;
  title: string;
  documentNumber: string;
  publishDate: string;
  effectiveDate: string;
  categoryCode: number;
  categoryName: string;
  issuingAuthority: string;
}

/** 详情 API 响应（模板） */
interface CourtDetailResponse {
  code: number;
  msg: string;
  data: CourtDetailData;
}

/** 详情数据 */
interface CourtDetailData {
  id: string;
  title: string;
  fullText: string;
  documentNumber: string;
  publishDate: string;
  effectiveDate: string;
  categoryCode: number;
  categoryName: string;
  issuingAuthority: string;
  applicableScope: string;
}

/** Court 分类配置 */
const COURT_CATEGORY_CONFIGS: Array<{
  code: CourtCategoryCode;
  label: string;
  category: LawCategory;
}> = [
  // 司法解释
  { code: 1, label: '司法解释', category: LawCategory.PROCEDURE },
  // 司法指导性文件
  { code: 2, label: '司法指导性文件', category: LawCategory.PROCEDURE },
  // 司法规范性文件
  { code: 3, label: '司法规范性文件', category: LawCategory.PROCEDURE },
  // 典型案例
  { code: 4, label: '典型案例', category: LawCategory.PROCEDURE },
  // 裁判文书
  { code: 5, label: '裁判文书', category: LawCategory.CIVIL },
];

export interface CourtCrawlOptions {
  categoryCode?: CourtCategoryCode;
  maxPages?: number;
  pageSize?: number;
  sinceDate?: string;
}

export class CourtCrawler extends BaseCrawler {
  private readonly API_BASE = 'https://www.court.gov.cn';
  private readonly API_LIST: string;
  private readonly API_DETAIL: string;

  private consecutiveErrors = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 3;

  private logger = getLogger('CourtCrawler');

  constructor() {
    super({
      name: 'CourtCrawler',
      baseUrl: 'https://www.court.gov.cn',
      requestTimeout: 30000,
      maxRetries: 3,
      rateLimitDelay: 2000,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    });

    // API 端点需要根据实际调研结果调整
    this.API_LIST = `${this.API_BASE}/fabu-xxgk/api/xxx`; // TODO: 替换为实际 API
    this.API_DETAIL = `${this.API_BASE}/fabu-xxgk/api/xxx`; // TODO: 替换为实际 API
  }

  getDataSourceName(): string {
    return 'court';
  }

  /**
   * 全量采集
   */
  async crawl(options?: CourtCrawlOptions): Promise<CrawlerResult> {
    const {
      categoryCode,
      maxPages = 0,
      pageSize = 20,
      sinceDate,
    } = options || {};

    const startTime = Date.now();
    let totalProcessed = 0;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    this.updateProgress({
      status: 'running',
      startedAt: new Date(),
      errors: [],
    });

    try {
      const categories = categoryCode
        ? COURT_CATEGORY_CONFIGS.filter(c => c.code === categoryCode)
        : COURT_CATEGORY_CONFIGS;

      for (const category of categories) {
        this.logger.info(
          `采集分类: ${category.label} (code: ${category.code})`
        );

        let page = 1;
        let hasMore = true;
        let pageErrors = 0;

        while (hasMore && (maxPages === 0 || page <= maxPages)) {
          try {
            const listResponse = await this.fetchList(
              page,
              pageSize,
              category.code,
              sinceDate
            );

            if (listResponse.code !== 200 || !listResponse.rows) {
              errors.push(`分类 ${category.code} 第 ${page} 页请求失败`);
              pageErrors++;
              if (pageErrors >= 3) break;
              page++;
              continue;
            }

            const { rows, total } = listResponse;
            if (rows.length === 0) {
              hasMore = false;
              continue;
            }

            for (const item of rows) {
              try {
                const detail = await this.fetchDetail(item.id);
                if (detail?.code === 200 && detail.data) {
                  const articleData = this.parseArticle(detail.data);
                  if (articleData) {
                    const result = await this.saveArticles([articleData]);
                    created += result.created;
                    updated += result.updated;
                  }
                }
              } catch (err) {
                errors.push(`获取详情失败: ${item.title} - ${err}`);
              }
              await this.randomDelay();
            }

            totalProcessed += rows.length;
            hasMore = rows.length >= pageSize;
            page++;
            pageErrors = 0;

            this.updateProgress({
              totalItems: total,
              currentItem: `Court ${category.label} 第 ${page} 页`,
            });
          } catch (err) {
            errors.push(`分类 ${category.code} 第 ${page} 页异常: ${err}`);
            pageErrors++;
            if (pageErrors >= 3) break;
            page++;
          }
        }
      }

      const duration = Date.now() - startTime;
      this.updateProgress({ status: 'completed', completedAt: new Date() });

      return {
        success: true,
        itemsCrawled: totalProcessed,
        itemsCreated: created,
        itemsUpdated: updated,
        errors,
        duration,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.updateProgress({
        status: 'failed',
        completedAt: new Date(),
        lastError: errorMessage,
      });

      return {
        success: false,
        itemsCrawled: totalProcessed,
        itemsCreated: created,
        itemsUpdated: updated,
        errors: [...errors, errorMessage],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 增量采集
   */
  async incrementalCrawl(since: Date): Promise<CrawlerResult> {
    const sinceDate = since.toISOString().split('T')[0];
    return this.crawl({ sinceDate });
  }

  /**
   * 解析司法解释数据
   */
  parseArticle(rawData: CourtDetailData): LawArticleData | null {
    if (!rawData || !rawData.title) return null;

    const categoryConfig = COURT_CATEGORY_CONFIGS.find(
      c => c.code === rawData.categoryCode
    );

    return {
      sourceId: rawData.id,
      sourceUrl: `${this.API_BASE}/fabu-xxgk/${rawData.id}`,
      lawName: rawData.title,
      articleNumber: rawData.documentNumber || '',
      fullText: rawData.fullText || '',
      lawType: LawType.JUDICIAL_INTERPRETATION,
      category: categoryConfig?.category ?? LawCategory.PROCEDURE,
      issuingAuthority: rawData.issuingAuthority || '最高人民法院',
      effectiveDate: rawData.effectiveDate
        ? new Date(rawData.effectiveDate)
        : new Date(rawData.publishDate),
      searchableText: `${rawData.title} ${rawData.documentNumber} ${rawData.fullText}`,
      status: LawStatus.VALID,
      version: '1.0',
      tags: [categoryConfig?.label, '司法解释'].filter(Boolean) as string[],
    };
  }

  /**
   * 列表 API 请求
   */
  private async fetchList(
    page: number,
    pageSize: number,
    categoryCode?: number,
    sinceDate?: string
  ): Promise<CourtListResponse> {
    const requestBody: CourtListRequest = {
      pageNum: page,
      pageSize,
      searchContent: '',
      categoryCode,
      startDate: sinceDate,
      endDate: new Date().toISOString().split('T')[0],
    };

    const response = await this.fetchWithRetry(this.API_LIST, {
      method: 'POST',
      headers: {
        'User-Agent': this.randomUA(),
        'Content-Type': 'application/json;charset=utf-8',
        Referer: `${this.API_BASE}/fabu-xxgk/`,
        Origin: this.API_BASE,
      },
      body: JSON.stringify(requestBody),
    });

    return response.json();
  }

  /**
   * 详情 API 请求
   */
  private async fetchDetail(id: string): Promise<CourtDetailResponse> {
    const url = `${this.API_DETAIL}/${id}`;
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'User-Agent': this.randomUA(),
        Accept: 'application/json',
        Referer: `${this.API_BASE}/fabu-xxgk/`,
      },
    });

    return response.json();
  }

  /**
   * 随机延迟
   */
  private async randomDelay(): Promise<void> {
    const base = 2000 + Math.random() * 2000;
    const penalty = this.consecutiveErrors * 1000;
    const total = Math.min(base + penalty, 10000);
    await this.delay(total);
  }

  /**
   * 随机 User-Agent
   */
  private randomUA(): string {
    const ua = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Firefox/122.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    ];
    return ua[Math.floor(Math.random() * ua.length)];
  }

  /**
   * 带重试的请求
   */
  private async fetchWithRetry(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    const maxRetries = this.config.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.requestTimeout
        );

        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          if (response.status >= 500 && attempt < maxRetries) {
            this.consecutiveErrors++;
            await this.delay(this.config.rateLimitDelay * Math.pow(2, attempt));
            continue;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        this.consecutiveErrors = 0;
        return response;
      } catch (error) {
        this.consecutiveErrors++;
        if (attempt >= maxRetries) throw error;
        await this.delay(this.config.rateLimitDelay * Math.pow(2, attempt));
      }
    }

    throw new Error('请求失败');
  }
}

export const courtCrawler = new CourtCrawler();
