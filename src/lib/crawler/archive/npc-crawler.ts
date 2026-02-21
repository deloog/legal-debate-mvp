/**
 * 全国人大法律法规采集爬虫
 *
 * ⚠️  此爬虫已废弃！
 *
 * 原因：FLK（flk.npc.gov.cn）国家法律法规数据库已整合全国人大、最高人民法院等部门的法规数据。
 *       FLK 数据中的 811 条司法解释已覆盖 Court 来源，无需单独采集。
 *
 * 状态：已废弃，保留代码供参考，不参与采集调度
 *
 * 采集调度器默认只启用 'flk' 数据源
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseCrawler, CrawlerResult, LawArticleData } from '../base-crawler';
import { LawCategory, LawType, LawStatus, SyncStatus } from '@prisma/client';
import { getLogger } from '../crawler-logger';

/** NPC 法规分类代码 */
export type NPCCategoryCode = number;

/** NPC 分类配置 */
export interface NPCCategoryConfig {
  code: NPCCategoryCode;
  label: string;
  lawType: LawType;
  category: LawCategory;
}

/** 列表 API 请求体（模板，需要根据实际 API 调整） */
interface NPCListRequest {
  pageNum: number;
  pageSize: number;
  searchContent?: string;
  categoryCode?: number;
  startDate?: string;
  endDate?: string;
}

/** 列表 API 响应（模板） */
interface NPCListResponse {
  total: number;
  rows: NPCListItem[];
  code: number;
  msg: string;
}

/** 列表项 */
interface NPCListItem {
  id: string;
  title: string;
  publishDate: string;
  effectiveDate: string;
  categoryCode: number;
  categoryName: string;
  issuingAuthority: string;
  lawNumber: string;
}

/** 详情 API 响应（模板） */
interface NPCDetailResponse {
  code: number;
  msg: string;
  data: NPCDetailData;
}

/** 详情数据 */
interface NPCDetailData {
  id: string;
  title: string;
  fullText: string;
  publishDate: string;
  effectiveDate: string;
  categoryCode: number;
  categoryName: string;
  issuingAuthority: string;
  lawNumber: string;
  attachments?: Array<{ name: string; url: string }>;
}

/** 断点文件结构 */
interface DownloadCheckpoint {
  version: string;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'in_progress' | 'completed' | 'failed';
  items: DownloadedItem[];
}

interface DownloadedItem {
  id: string;
  title: string;
  categoryCode: number;
  publishDate: string;
  effectiveDate: string;
  issuingAuthority: string;
  downloadedAt: string;
  error?: string;
}

/** NPC 分类配置 */
const NPC_CATEGORY_CONFIGS: NPCCategoryConfig[] = [
  // 法律
  {
    code: 1,
    label: '法律',
    lawType: LawType.LAW,
    category: LawCategory.OTHER, // 需要通过名称推断
  },
  // 有关法律问题的决定
  {
    code: 2,
    label: '决定',
    lawType: LawType.LAW,
    category: LawCategory.OTHER,
  },
  // 决议
  {
    code: 3,
    label: '决议',
    lawType: LawType.LAW,
    category: LawCategory.OTHER,
  },
  // 地方性法规
  {
    code: 4,
    label: '地方性法规',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
  // 自治条例和单行条例
  {
    code: 5,
    label: '自治条例',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
];

/** 采集选项 */
export interface NPCCrawlOptions {
  categoryCode?: NPCCategoryCode;
  maxPages?: number;
  pageSize?: number;
  sinceDate?: string;
  outputDir?: string;
}

export class NPCCrawler extends BaseCrawler {
  private readonly API_BASE = 'https://www.npc.gov.cn';
  private readonly API_LIST: string;
  private readonly API_DETAIL: string;
  private readonly DEFAULT_OUTPUT_DIR = path.resolve('data/crawled/npc');

  private consecutiveErrors = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 3;

  private logger = getLogger('NPCCrawler');

  constructor() {
    super({
      name: 'NPCCrawler',
      baseUrl: 'https://www.npc.gov.cn',
      requestTimeout: 30000,
      maxRetries: 3,
      rateLimitDelay: 2000,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // API 端点需要根据实际调研结果调整
    this.API_LIST = `${this.API_BASE}/api/xxx`; // TODO: 替换为实际 API
    this.API_DETAIL = `${this.API_BASE}/api/xxx`; // TODO: 替换为实际 API
  }

  getDataSourceName(): string {
    return 'npc';
  }

  /**
   * 全量采集
   */
  async crawl(options?: NPCCrawlOptions): Promise<CrawlerResult> {
    const {
      categoryCode,
      maxPages = 0,
      pageSize = 20,
      sinceDate,
      outputDir,
    } = options || {};

    const outDir = outputDir || this.DEFAULT_OUTPUT_DIR;
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
      // 获取分类列表
      const categories = categoryCode
        ? NPC_CATEGORY_CONFIGS.filter(c => c.code === categoryCode)
        : NPC_CATEGORY_CONFIGS;

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
              currentItem: `NPC ${category.label} 第 ${page} 页`,
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
   * 解析法条数据
   */
  parseArticle(rawData: NPCDetailData): LawArticleData | null {
    if (!rawData || !rawData.title) return null;

    const categoryConfig = NPC_CATEGORY_CONFIGS.find(
      c => c.code === rawData.categoryCode
    );

    return {
      sourceId: rawData.id,
      sourceUrl: `${this.API_BASE}/detail/${rawData.id}`,
      lawName: rawData.title,
      articleNumber: rawData.lawNumber || '全部',
      fullText: rawData.fullText || '',
      lawType: categoryConfig?.lawType || LawType.LAW,
      category: this.inferCategoryFromName(
        rawData.title,
        categoryConfig?.category ?? LawCategory.OTHER
      ),
      issuingAuthority: rawData.issuingAuthority || '未知',
      effectiveDate: rawData.effectiveDate
        ? new Date(rawData.effectiveDate)
        : new Date(rawData.publishDate),
      searchableText: `${rawData.title} ${rawData.lawNumber} ${rawData.issuingAuthority}`,
      status: this.determineStatus(rawData.effectiveDate),
      version: '1.0',
      tags: [categoryConfig?.label].filter(Boolean) as string[],
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
  ): Promise<NPCListResponse> {
    const requestBody: NPCListRequest = {
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
        Referer: this.API_BASE,
        Origin: this.API_BASE,
      },
      body: JSON.stringify(requestBody),
    });

    return response.json();
  }

  /**
   * 详情 API 请求
   */
  private async fetchDetail(id: string): Promise<NPCDetailResponse> {
    const url = `${this.API_DETAIL}/${id}`;
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'User-Agent': this.randomUA(),
        Accept: 'application/json',
        Referer: this.API_BASE,
      },
    });

    return response.json();
  }

  /**
   * 通过法律名称关键词推断学科分类
   */
  private inferCategoryFromName(
    lawName: string,
    flfgTypeCategory: LawCategory
  ): LawCategory {
    const name = lawName;

    if (/刑法|刑事诉讼|治安管理/.test(name)) {
      return LawCategory.CRIMINAL;
    }
    if (/劳动法|劳动合同|工会|工伤/.test(name)) {
      return LawCategory.LABOR;
    }
    if (/专利|商标|著作权|知识产权/.test(name)) {
      return LawCategory.INTELLECTUAL_PROPERTY;
    }
    if (/公司法|证券|保险|银行|破产/.test(name)) {
      return LawCategory.COMMERCIAL;
    }
    if (/民法典|合同法|物权|婚姻|继承|民事/.test(name)) {
      return LawCategory.CIVIL;
    }
    if (/行政|许可|处罚|复议|诉讼/.test(name)) {
      return LawCategory.ADMINISTRATIVE;
    }
    if (/环境|食品|药品|安全|消费/.test(name)) {
      return LawCategory.ECONOMIC;
    }
    if (/诉讼|仲裁|调解|鉴定/.test(name)) {
      return LawCategory.PROCEDURE;
    }

    return flfgTypeCategory;
  }

  /**
   * 确定法律状态
   */
  private determineStatus(effectiveDate: string): LawStatus {
    if (!effectiveDate) return LawStatus.VALID;
    const date = new Date(effectiveDate);
    if (date > new Date()) return LawStatus.DRAFT;
    return LawStatus.VALID;
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

export const npcCrawler = new NPCCrawler();
