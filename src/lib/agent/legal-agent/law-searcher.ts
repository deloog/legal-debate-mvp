/**
 * LawSearcher - 法律检索器
 *
 * 功能：
 * 1. 本地JSON检索（优先）
 * 2. 关键词全文搜索
 * 3. TF-IDF相关性排序
 * 4. 外部API检索（法律之星/北大法宝，已实现）
 * 5. 结果合并去重
 * 6. 自动降级（外部API失败时使用本地）
 *
 * 外部API配置（环境变量）：
 * - LAW_ARTICLE_PROVIDER: 'lawstar' | 'pkulaw' | 'local'
 * - LAWSTAR_API_KEY: 法律之星API密钥
 * - PKULAW_API_KEY: 北大法宝API密钥
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import type { LegalQuery, LawArticle, SearchResult } from './types';
import {
  getExternalAPIClient,
  type IExternalLawArticleAPI,
} from '../../law-article/external-api-client';

// =============================================================================
// 类型定义
// =============================================================================

interface RawLawArticle {
  lawName: string;
  articleNumber: string;
  fullText: string;
  lawType: string;
  category: string;
  subCategory?: string;
  tags?: string[];
  keywords?: string[];
  version?: string;
  effectiveDate?: string;
  status?: string;
  issuingAuthority?: string;
  jurisdiction?: string;
  searchableText?: string;
  viewCount?: number;
  referenceCount?: number;
}

interface LawArticleData {
  data: RawLawArticle[];
}

interface TFIDFDocument {
  id: string;
  terms: Map<string, number>;
  totalTerms: number;
}

interface SearchIndex {
  articles: Map<string, LawArticle>;
  tfidfIndex: Map<string, TFIDFDocument>;
  documentFrequency: Map<string, number>;
}

// =============================================================================
// LawSearcher类
// =============================================================================

export class LawSearcher {
  private searchIndex: SearchIndex | null = null;
  private dataDir: string;
  private initialized: boolean = false;
  private externalClient: IExternalLawArticleAPI;

  constructor(dataDir: string = path.join(process.cwd(), 'data')) {
    this.dataDir = dataDir;
    this.externalClient = getExternalAPIClient();
  }

  /**
   * 初始化搜索索引
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.buildSearchIndex();
      this.initialized = true;
    } catch (error) {
      console.error('LawSearcher initialization failed:', error);
      throw error;
    }
  }

  /**
   * 搜索法条
   */
  async search(query: LegalQuery): Promise<SearchResult> {
    const startTime = Date.now();

    await this.initialize();

    const limit = query.limit ?? 10;

    // 如果limit为0，直接返回空结果
    if (limit === 0) {
      return {
        articles: [],
        total: 0,
        source: 'local',
        executionTime: Date.now() - startTime,
      };
    }

    // 1. 本地检索
    const localResults = await this.localSearch(query);

    // 2. 外部检索（如果本地结果不足且启用外部检索）
    let externalResults: LawArticle[] = [];
    if (localResults.length < 5 && query.enableVectorSearch !== false) {
      try {
        const searchQuery = query.keywords.join(' ');
        const externalResult = await this.externalClient.search(searchQuery, {
          limit: 20,
          caseType: query.caseType,
          lawType: query.lawType,
        });

        if (externalResult.articles.length > 0) {
          externalResults = externalResult.articles;
          console.log(
            `[LawSearcher] 外部检索成功: ${externalResult.articles.length} 条结果 ` +
              `(来源: ${externalResult.source}, 缓存: ${externalResult.cached})`
          );
        }
      } catch (error) {
        console.warn('[LawSearcher] 外部检索失败，使用本地结果:', error);
      }
    }

    // 3. 合并去重
    const merged = this.mergeResults(localResults, externalResults);

    // 4. 相关性排序
    const ranked = this.rankByRelevance(merged);

    // 5. 限制结果数量
    const finalResults = ranked.slice(0, limit);

    return {
      articles: finalResults,
      total: merged.length,
      source: externalResults.length > 0 ? 'mixed' : 'local',
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * 本地检索
   */
  private async localSearch(query: LegalQuery): Promise<LawArticle[]> {
    if (!this.searchIndex) {
      return [];
    }

    const { articles } = this.searchIndex;

    // 1. 关键词匹配
    const keywordResults = this.searchByKeywords(
      Array.from(articles.values()),
      query.keywords
    );

    // 2. 案件类型过滤
    const filtered = this.filterByCaseType(keywordResults, query.caseType);

    // 3. 法律类型过滤
    const finalResults = this.filterByLawType(filtered, query.lawType);

    return finalResults;
  }

  /**
   * 构建搜索索引
   */
  private async buildSearchIndex(): Promise<void> {
    const articles = new Map<string, LawArticle>();
    const tfidfDocuments = new Map<string, TFIDFDocument>();
    const documentFrequency = new Map<string, number>();

    // 加载所有法条文件
    const lawFiles = await this.getLawFiles();

    for (const file of lawFiles) {
      const rawArticles = await this.loadLawFile(file);

      for (const raw of rawArticles) {
        const article = this.convertToLawArticle(raw);
        articles.set(article.id, article);

        // 构建TF-IDF文档
        const terms = this.extractTerms(article);
        const doc: TFIDFDocument = {
          id: article.id,
          terms,
          totalTerms: Array.from(terms.values()).reduce((a, b) => a + b, 0),
        };
        tfidfDocuments.set(article.id, doc);

        // 更新文档频率
        for (const term of terms.keys()) {
          documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
        }
      }
    }

    this.searchIndex = {
      articles,
      tfidfIndex: tfidfDocuments,
      documentFrequency,
    };
  }

  /**
   * 关键词搜索
   */
  private searchByKeywords(
    articles: LawArticle[],
    keywords: string[]
  ): LawArticle[] {
    if (keywords.length === 0) {
      return articles;
    }

    const results: LawArticle[] = [];

    for (const article of articles) {
      let matchScore = 0;
      const matchedKeywords: string[] = [];

      // 搜索content、searchableText、keywords
      const searchableContent = [
        article.content,
        article.articleNumber,
        ...(article.keywords || []),
      ]
        .join(' ')
        .toLowerCase();

      for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase();

        // 精确匹配
        if (searchableContent.includes(lowerKeyword)) {
          matchScore += 2;
          matchedKeywords.push(keyword);
        }

        // 模糊匹配（包含关键词的词）
        const words = searchableContent.split(/\s+/);
        for (const word of words) {
          if (word.includes(lowerKeyword)) {
            matchScore += 1;
            matchedKeywords.push(keyword);
            break;
          }
        }
      }

      if (matchScore > 0) {
        results.push({
          ...article,
          relevanceScore: Math.min(matchScore / keywords.length, 1),
        });
      }
    }

    return results;
  }

  /**
   * 案件类型过滤
   */
  private filterByCaseType(
    articles: LawArticle[],
    caseType?: string
  ): LawArticle[] {
    if (!caseType) {
      return articles;
    }

    const typeMapping: Record<string, string> = {
      民事: 'CIVIL',
      刑事: 'CRIMINAL',
      行政: 'ADMINISTRATIVE',
      商事: 'COMMERCIAL',
      知识产权: 'INTELLECTUAL',
      劳动: 'LABOR',
    };

    const targetCategory = typeMapping[caseType];
    if (!targetCategory) {
      return articles;
    }

    return articles.filter(a => a.category === targetCategory);
  }

  /**
   * 法律类型过滤
   */
  private filterByLawType(
    articles: LawArticle[],
    lawType?: string
  ): LawArticle[] {
    if (!lawType) {
      return articles;
    }

    const typeMapping: Record<string, string> = {
      民事: 'CIVIL',
      刑事: 'CRIMINAL',
      行政: 'ADMINISTRATIVE',
      商事: 'COMMERCIAL',
      知识产权: 'INTELLECTUAL',
      劳动: 'LABOR',
    };

    const targetCategory = typeMapping[lawType];
    if (!targetCategory) {
      return articles;
    }

    return articles.filter(a => a.category === targetCategory);
  }

  /**
   * 合并结果
   */
  private mergeResults(
    localResults: LawArticle[],
    externalResults: LawArticle[]
  ): LawArticle[] {
    const merged = new Map<string, LawArticle>();

    // 添加本地结果
    for (const article of localResults) {
      merged.set(article.id, article);
    }

    // 添加外部结果（如果不存在）
    for (const article of externalResults) {
      if (!merged.has(article.id)) {
        merged.set(article.id, article);
      }
    }

    return Array.from(merged.values());
  }

  /**
   * 相关性排序
   */
  private rankByRelevance(articles: LawArticle[]): LawArticle[] {
    return articles.sort((a, b) => {
      const scoreA = a.relevanceScore || 0;
      const scoreB = b.relevanceScore || 0;
      return scoreB - scoreA; // 降序
    });
  }

  /**
   * 获取法条文件列表
   */
  private async getLawFiles(): Promise<string[]> {
    const files = await fs.readdir(this.dataDir);
    return files
      .filter(
        file => file.startsWith('law-articles-') && file.endsWith('.json')
      )
      .map(file => path.join(this.dataDir, file));
  }

  /**
   * 加载法条文件
   */
  private async loadLawFile(filePath: string): Promise<RawLawArticle[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as LawArticleData;
      return data.data || [];
    } catch (error) {
      console.error(`Failed to load law file: ${filePath}`, error);
      return [];
    }
  }

  /**
   * 转换为LawArticle类型
   */
  private convertToLawArticle(raw: RawLawArticle): LawArticle {
    const id = createHash('sha256')
      .update(`${raw.lawName}-${raw.articleNumber}`)
      .digest('hex');

    return {
      id,
      lawName: raw.lawName,
      articleNumber: raw.articleNumber,
      content: raw.fullText,
      category: raw.category,
      effectiveDate: raw.effectiveDate,
      deprecated: raw.status !== 'VALID',
      keywords: raw.keywords,
      level: this.mapLawLevel(raw.lawType),
    };
  }

  /**
   * 映射法律层级
   */
  private mapLawLevel(
    lawType?: string
  ): 'constitution' | 'law' | 'administrative' | 'regulation' | 'local' {
    if (!lawType) {
      return 'law';
    }

    const typeMap: Record<
      string,
      'constitution' | 'law' | 'administrative' | 'regulation' | 'local'
    > = {
      CONSTITUTION: 'constitution',
      LAW: 'law',
      ADMINISTRATIVE: 'administrative',
      REGULATION: 'regulation',
      LOCAL: 'local',
    };

    return typeMap[lawType] || 'law';
  }

  /**
   * 提取词项
   */
  private extractTerms(article: LawArticle): Map<string, number> {
    const terms = new Map<string, number>();
    const text = [article.content, article.lawName, article.articleNumber].join(
      ' '
    );

    // 简单分词（按空格和标点符号）
    const words = text
      .toLowerCase()
      .split(/[，。；：\s]+/)
      .filter(word => word.length > 1);

    for (const word of words) {
      terms.set(word, (terms.get(word) || 0) + 1);
    }

    return terms;
  }

  /**
   * 计算TF-IDF
   */
  private _calculateTFIDF(
    doc: TFIDFDocument,
    term: string,
    documentFrequency: Map<string, number>,
    totalDocuments: number
  ): number {
    const tf = (doc.terms.get(term) || 0) / doc.totalTerms;
    const df = documentFrequency.get(term) || 1;
    const idf = Math.log(totalDocuments / df);
    return tf * idf;
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    if (!this.searchIndex) {
      return { initialized: false };
    }

    return {
      initialized: true,
      totalArticles: this.searchIndex.articles.size,
      totalTerms: this.searchIndex.documentFrequency.size,
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.searchIndex = null;
    this.initialized = false;
  }

  /**
   * 清除指定前缀的缓存文件
   *
   * @param prefix 文件前缀（如 'law-articles-'）
   * @returns 删除的文件数量
   */
  async clearCacheByPrefix(prefix: string): Promise<number> {
    try {
      const files = await fs.readdir(this.dataDir);
      const filesToDelete = files.filter(file => file.startsWith(prefix));

      let deletedCount = 0;
      for (const file of filesToDelete) {
        const filePath = path.join(this.dataDir, file);
        try {
          await fs.unlink(filePath);
          deletedCount++;
          console.log(`[LawSearcher] 删除缓存文件: ${file}`);
        } catch (error) {
          console.warn(`[LawSearcher] 删除缓存文件失败: ${file}`, error);
        }
      }

      // 清除内存中的搜索索引
      if (deletedCount > 0) {
        this.cleanup();
        console.log(`[LawSearcher] 缓存已清除，删除 ${deletedCount} 个文件`);
      }

      return deletedCount;
    } catch (error) {
      console.error('[LawSearcher] 清除缓存失败:', error);
      return 0;
    }
  }

  /**
   * 清除所有法条缓存文件
   *
   * @returns 删除的文件数量
   */
  async clearAllCache(): Promise<number> {
    return this.clearCacheByPrefix('law-articles-');
  }

  /**
   * 获取缓存文件列表
   *
   * @param prefix 文件前缀（可选）
   * @returns 缓存文件列表
   */
  async getCacheFiles(prefix?: string): Promise<string[]> {
    try {
      const files = await fs.readdir(this.dataDir);
      const cacheFiles = prefix
        ? files.filter(file => file.startsWith(prefix))
        : files.filter(file => file.startsWith('law-articles-'));

      return cacheFiles;
    } catch (error) {
      console.error('[LawSearcher] 获取缓存文件列表失败:', error);
      return [];
    }
  }
}
