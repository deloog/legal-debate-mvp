/**
 * 全国人大法律法规采集爬虫
 * 从全国人大官网采集法律法规
 */

import { BaseCrawler, CrawlerResult, LawArticleData } from './base-crawler';
import { LawCategory, LawType, LawStatus } from '@prisma/client';

interface NPCLawListItem {
  id: string;
  title: string;
  lawNumber: string;
  publishDate: string;
  effectiveDate: string;
  category: string;
  lawType: string;
}

interface NPCLawDetail {
  id: string;
  title: string;
  lawNumber: string;
  fullText: string;
  publishDate: string;
  effectiveDate: string;
  category: string;
  lawType: string;
  issuingAuthority: string;
  amendments?: AmendmentInfo[];
}

interface AmendmentInfo {
  amendmentNumber: string;
  amendmentDate: string;
  description: string;
}

export class NPCCrawler extends BaseCrawler {
  private readonly API_BASE = 'http://www.npc.gov.cn';

  constructor() {
    super({
      name: 'NPCCrawler',
      baseUrl: 'http://www.npc.gov.cn',
      requestTimeout: 30000,
      maxRetries: 3,
      rateLimitDelay: 2000,
      userAgent: 'LegalDebateBot/1.0 (+https://legal-debate.example.com)',
    });
  }

  getDataSourceName(): string {
    return 'npc';
  }

  /**
   * 执行抓取（示例实现）
   * 注意：实际使用时需要根据目标网站的API结构调整
   */
  async crawl(): Promise<CrawlerResult> {
    const startTime = Date.now();
    this.updateProgress({
      status: 'running',
      startedAt: new Date(),
      errors: [],
    });

    try {
      // 示例：从NPC官网获取法律法规列表
      // 实际实现需要根据网站结构调整
      const laws = await this.fetchLawList();

      this.updateProgress({
        totalItems: laws.length,
        processedItems: 0,
      });

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const law of laws) {
        try {
          const detail = await this.fetchLawDetail(law.id);

          if (detail) {
            const articleData = this.parseArticle(detail);

            if (articleData) {
              const result = await this.saveArticles([articleData]);
              created += result.created;
              updated += result.updated;
            }
          }
        } catch (error) {
          errors.push(`Failed to process law ${law.id}: ${error}`);
          this.recordError(`Failed to process law ${law.id}: ${error}`);
        }
      }

      const duration = Date.now() - startTime;
      this.updateProgress({
        status: 'completed',
        completedAt: new Date(),
      });

      // 记录采集日志
      await this.logCrawlOperation('full_crawl', {
        success: true,
        itemsCrawled: laws.length,
        itemsCreated: created,
        itemsUpdated: updated,
        errors,
        duration,
      });

      return {
        success: true,
        itemsCrawled: laws.length,
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

      // 记录错误日志
      await this.logCrawlOperation('full_crawl', {
        success: false,
        itemsCrawled: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        errors: [errorMessage],
        duration,
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
   * 获取法律法规列表
   */
  private async fetchLawList(): Promise<NPCLawListItem[]> {
    // 示例实现：实际需要根据NPC官网API调整
    // 这是一个模拟实现
    return [
      {
        id: 'law-001',
        title: '中华人民共和国民法典',
        lawNumber: '中华人民共和国主席令第四十五号',
        publishDate: '2020-05-28',
        effectiveDate: '2021-01-01',
        category: 'CIVIL',
        lawType: 'LAW',
      },
      {
        id: 'law-002',
        title: '中华人民共和国刑法',
        lawNumber: '中华人民共和国主席令第五十一号',
        publishDate: '2020-12-26',
        effectiveDate: '2021-03-01',
        category: 'CRIMINAL',
        lawType: 'LAW',
      },
    ];
  }

  /**
   * 获取法律法规详情
   */
  private async fetchLawDetail(lawId: string): Promise<NPCLawDetail | null> {
    // 示例实现：实际需要根据NPC官网API调整
    // 这里返回模拟数据
    const list = await this.fetchLawList();
    const law = list.find(l => l.id === lawId);

    if (!law) {
      return null;
    }

    return {
      id: law.id,
      title: law.title,
      lawNumber: law.lawNumber,
      fullText: `这是${law.title}的完整法律条文内容。`,
      publishDate: law.publishDate,
      effectiveDate: law.effectiveDate,
      category: law.category,
      lawType: law.lawType,
      issuingAuthority: '全国人民代表大会',
    };
  }

  /**
   * 解析法条数据
   */
  parseArticle(rawData: NPCLawDetail): LawArticleData | null {
    try {
      const category = this.mapCategory(rawData.category);
      const lawType = this.mapLawType(rawData.lawType);
      const status = this.determineStatus(rawData.effectiveDate);

      return {
        sourceId: rawData.id,
        sourceUrl: `${this.config.baseUrl}/flcaw/${rawData.id}`,
        lawName: rawData.title,
        articleNumber: '全部', // 整部法律
        fullText: rawData.fullText,
        lawType,
        category,
        issuingAuthority: rawData.issuingAuthority,
        effectiveDate: new Date(rawData.effectiveDate),
        searchableText: `${rawData.title} ${rawData.lawNumber} ${rawData.fullText}`,
        tags: [rawData.category, rawData.lawType],
        status,
        version: '1.0',
      };
    } catch (error) {
      this.recordError(`Failed to parse article: ${rawData.id} - ${error}`);
      return null;
    }
  }

  /**
   * 映射法律类别
   */
  private mapCategory(category: string): LawCategory {
    const categoryMap: Record<string, LawCategory> = {
      CIVIL: LawCategory.CIVIL,
      CRIMINAL: LawCategory.CRIMINAL,
      ADMINISTRATIVE: LawCategory.ADMINISTRATIVE,
      COMMERCIAL: LawCategory.COMMERCIAL,
      LABOR: LawCategory.LABOR,
      ECONOMIC: LawCategory.ECONOMIC,
      INTELLECTUAL_PROPERTY: LawCategory.INTELLECTUAL_PROPERTY,
      PROCEDURE: LawCategory.PROCEDURE,
      OTHER: LawCategory.OTHER,
    };

    return categoryMap[category] || LawCategory.OTHER;
  }

  /**
   * 映射法律类型
   */
  private mapLawType(lawType: string): LawType {
    const typeMap: Record<string, LawType> = {
      CONSTITUTION: LawType.CONSTITUTION,
      LAW: LawType.LAW,
      ADMINISTRATIVE_REGULATION: LawType.ADMINISTRATIVE_REGULATION,
      LOCAL_REGULATION: LawType.LOCAL_REGULATION,
      JUDICIAL_INTERPRETATION: LawType.JUDICIAL_INTERPRETATION,
      DEPARTMENTAL_RULE: LawType.DEPARTMENTAL_RULE,
      OTHER: LawType.OTHER,
    };

    return typeMap[lawType] || LawType.LAW;
  }

  /**
   * 判断法律状态
   */
  private determineStatus(effectiveDate: string): LawStatus {
    const effective = new Date(effectiveDate);
    const now = new Date();

    if (effective > now) {
      return LawStatus.DRAFT;
    }

    return LawStatus.VALID;
  }

  /**
   * 增量更新模式
   */
  async incrementalCrawl(since: Date): Promise<CrawlerResult> {
    const startTime = Date.now();
    this.updateProgress({
      status: 'running',
      startedAt: new Date(),
    });

    try {
      // 获取自指定日期以来更新的法律法规
      const updatedLaws = await this.fetchUpdatedLaws(since);

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const law of updatedLaws) {
        try {
          const detail = await this.fetchLawDetail(law.id);

          if (detail) {
            const articleData = this.parseArticle(detail);

            if (articleData) {
              const result = await this.saveArticles([articleData]);
              created += result.created;
              updated += result.updated;
            }
          }
        } catch (error) {
          errors.push(`Failed to process law ${law.id}: ${error}`);
        }
      }

      const duration = Date.now() - startTime;
      this.updateProgress({
        status: 'completed',
        completedAt: new Date(),
      });

      return {
        success: true,
        itemsCrawled: updatedLaws.length,
        itemsCreated: created,
        itemsUpdated: updated,
        errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.updateProgress({
        status: 'failed',
        completedAt: new Date(),
      });

      return {
        success: false,
        itemsCrawled: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        duration,
      };
    }
  }

  /**
   * 获取更新的法律法规
   */
  private async fetchUpdatedLaws(since: Date): Promise<NPCLawListItem[]> {
    // 示例实现
    const allLaws = await this.fetchLawList();
    return allLaws.filter(law => new Date(law.publishDate) > since);
  }
}

export const npcCrawler = new NPCCrawler();
