/**
 * 最高人民法院司法解释采集爬虫
 * 从最高人民法院官网采集司法解释数据
 */

import { BaseCrawler, CrawlerResult, LawArticleData } from './base-crawler';
import { LawCategory, LawType, LawStatus } from '@prisma/client';

interface CourtInterpretationItem {
  id: string;
  title: string;
  documentNumber: string;
  publishDate: string;
  effectiveDate: string;
  category: string;
}

export class CourtCrawler extends BaseCrawler {
  private readonly API_BASE = 'http://www.court.gov.cn';

  constructor() {
    super({
      name: 'CourtCrawler',
      baseUrl: 'http://www.court.gov.cn',
      requestTimeout: 30000,
      maxRetries: 3,
      rateLimitDelay: 2000,
      userAgent: 'LegalDebateBot/1.0 (+https://legal-debate.example.com)',
    });
  }

  getDataSourceName(): string {
    return 'court';
  }

  /**
   * 执行抓取
   */
  async crawl(): Promise<CrawlerResult> {
    const startTime = Date.now();
    this.updateProgress({
      status: 'running',
      startedAt: new Date(),
      errors: [],
    });

    try {
      const interpretations = await this.fetchInterpretationList();

      this.updateProgress({
        totalItems: interpretations.length,
        processedItems: 0,
      });

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const item of interpretations) {
        try {
          const detail = await this.fetchInterpretationDetail(item.id);

          if (detail) {
            const articleData = this.parseArticle(detail);

            if (articleData) {
              const result = await this.saveArticles([articleData]);
              created += result.created;
              updated += result.updated;
            }
          }
        } catch {
          errors.push(`Failed to process ${item.id}`);
          this.recordError(`Failed to process ${item.id}`);
        }
      }

      const duration = Date.now() - startTime;
      this.updateProgress({
        status: 'completed',
        completedAt: new Date(),
      });

      await this.logCrawlOperation('full_crawl', {
        success: true,
        itemsCrawled: interpretations.length,
        itemsCreated: created,
        itemsUpdated: updated,
        errors,
        duration,
      });

      return {
        success: true,
        itemsCrawled: interpretations.length,
        itemsCreated: created,
        itemsUpdated: updated,
        errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.updateProgress({
        status: 'failed',
        completedAt: new Date(),
        lastError: errorMessage,
      });

      return {
        success: false,
        itemsCrawled: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        errors: [errorMessage],
        duration,
      };
    }
  }

  /**
   * 获取司法解释列表
   */
  private async fetchInterpretationList(): Promise<CourtInterpretationItem[]> {
    // 示例实现
    return [
      {
        id: 'interp-001',
        title:
          '最高人民法院关于适用《中华人民共和国民法典》合同编通则若干问题的解释',
        documentNumber: '法释〔2020〕17号',
        publishDate: '2020-12-29',
        effectiveDate: '2021-01-01',
        category: 'CIVIL',
      },
      {
        id: 'interp-002',
        title: '最高人民法院关于适用《中华人民共和国民法典》时间效力的若干规定',
        documentNumber: '法释〔2020〕15号',
        publishDate: '2020-12-29',
        effectiveDate: '2021-01-01',
        category: 'CIVIL',
      },
    ];
  }

  /**
   * 获取司法解释详情
   */
  private async fetchInterpretationDetail(id: string): Promise<any | null> {
    const list = await this.fetchInterpretationList();
    const item = list.find(i => i.id === id);

    if (!item) {
      return null;
    }

    return {
      id: item.id,
      title: item.title,
      documentNumber: item.documentNumber,
      fullText: `这是${item.title}的完整内容。`,
      publishDate: item.publishDate,
      effectiveDate: item.effectiveDate,
      category: item.category,
      issuingAuthority: '最高人民法院',
    };
  }

  /**
   * 解析法条数据
   */
  parseArticle(rawData: any): LawArticleData | null {
    try {
      return {
        sourceId: rawData.id,
        sourceUrl: `${this.config.baseUrl}/裁判文书/${rawData.id}`,
        lawName: rawData.title,
        articleNumber: rawData.documentNumber,
        fullText: rawData.fullText,
        lawType: LawType.JUDICIAL_INTERPRETATION,
        category: this.mapCategory(rawData.category),
        issuingAuthority: rawData.issuingAuthority,
        effectiveDate: new Date(rawData.effectiveDate),
        searchableText: `${rawData.title} ${rawData.documentNumber} ${rawData.fullText}`,
        tags: ['司法解释', rawData.category],
        status: LawStatus.VALID,
        version: '1.0',
      };
    } catch {
      this.recordError(`Failed to parse article: ${rawData.id}`);
      return null;
    }
  }

  private mapCategory(category: string): LawCategory {
    const categoryMap: Record<string, LawCategory> = {
      CIVIL: LawCategory.CIVIL,
      CRIMINAL: LawCategory.CRIMINAL,
      ADMINISTRATIVE: LawCategory.ADMINISTRATIVE,
      COMMERCIAL: LawCategory.COMMERCIAL,
      PROCEDURE: LawCategory.PROCEDURE,
    };
    return categoryMap[category] || LawCategory.OTHER;
  }
}

export const courtCrawler = new CourtCrawler();
