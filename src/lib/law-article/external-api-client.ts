/**
 * 外部法条 API 客户端
 *
 * 支持多种法条数据源：
 * - 法律之星 (LawStar)
 * - 北大法宝 (PKULaw)
 * - 本地降级 (Local Fallback)
 *
 * 功能：
 * - 统一接口
 * - 自动降级
 * - 结果缓存
 * - 错误处理
 */

import { LawArticle } from '../agent/legal-agent/types';
import { logger } from '@/lib/logger';

// =============================================================================
// 类型定义
// =============================================================================

export interface ExternalSearchOptions {
  limit?: number;
  caseType?: string;
  lawType?: string;
  category?: string;
  enableCache?: boolean;
}

export interface ExternalSearchResult {
  articles: LawArticle[];
  total: number;
  source: 'lawstar' | 'pkulaw' | 'local';
  cached: boolean;
  executionTime: number;
}

export interface ExternalAPIConfig {
  provider: 'lawstar' | 'pkulaw' | 'local';
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
}

// =============================================================================
// API 客户端接口
// =============================================================================

export interface IExternalLawArticleAPI {
  search(
    query: string,
    options?: ExternalSearchOptions
  ): Promise<ExternalSearchResult>;
  getById(id: string): Promise<LawArticle | null>;
  isAvailable(): Promise<boolean>;
}

// =============================================================================
// 法律之星客户端
// =============================================================================

class LawStarClient implements IExternalLawArticleAPI {
  private apiKey: string;
  private baseURL: string;
  private timeout: number;

  constructor(config?: Partial<ExternalAPIConfig>) {
    this.apiKey = config?.apiKey || process.env.LAWSTAR_API_KEY || '';
    this.baseURL =
      config?.baseURL ||
      process.env.LAWSTAR_BASE_URL ||
      'https://api.lawstar.cn';
    this.timeout = config?.timeout || 10000;
  }

  async search(
    query: string,
    options?: ExternalSearchOptions
  ): Promise<ExternalSearchResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      logger.warn('[LawStar] API 密钥未配置，跳过外部检索');
      return this.emptyResult('lawstar', startTime);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/v1/articles/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: options?.limit || 20,
          filters: {
            caseType: options?.caseType,
            lawType: options?.lawType,
            category: options?.category,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const data = await response.json();
      const articles = this.transformResponse(data);

      return {
        articles,
        total: data.total || articles.length,
        source: 'lawstar',
        cached: false,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('[LawStar] 检索失败:', error);
      return this.emptyResult('lawstar', startTime);
    }
  }

  async getById(id: string): Promise<LawArticle | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/v1/articles/${id}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return this.transformArticle(data);
    } catch (error) {
      logger.error('[LawStar] 获取法条失败:', error);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseURL}/v1/health`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private transformResponse(data: unknown): LawArticle[] {
    const typedData = data as {
      articles?: Array<{
        id: string;
        lawName: string;
        articleNumber: string;
        content: string;
        category?: string;
        effectiveDate?: string;
        deprecated?: boolean;
        keywords?: string[];
        level?: string;
        relevanceScore?: number;
      }>;
    };

    return (typedData.articles || []).map(item => this.transformArticle(item));
  }

  private transformArticle(item: {
    id: string;
    lawName: string;
    articleNumber: string;
    content: string;
    category?: string;
    effectiveDate?: string;
    deprecated?: boolean;
    keywords?: string[];
    level?: string;
    relevanceScore?: number;
  }): LawArticle {
    return {
      id: item.id,
      lawName: item.lawName,
      articleNumber: item.articleNumber,
      content: item.content,
      category: item.category || 'civil',
      effectiveDate: item.effectiveDate,
      deprecated: item.deprecated || false,
      keywords: item.keywords || [],
      level: this.mapLevel(item.level),
      relevanceScore: item.relevanceScore,
    };
  }

  private mapLevel(
    level?: string
  ): 'constitution' | 'law' | 'administrative' | 'regulation' | 'local' {
    const levelMap: Record<
      string,
      'constitution' | 'law' | 'administrative' | 'regulation' | 'local'
    > = {
      宪法: 'constitution',
      法律: 'law',
      行政法规: 'administrative',
      部门规章: 'regulation',
      地方性法规: 'local',
    };
    return levelMap[level || ''] || 'law';
  }

  private emptyResult(
    source: 'lawstar' | 'pkulaw' | 'local',
    startTime: number
  ): ExternalSearchResult {
    return {
      articles: [],
      total: 0,
      source,
      cached: false,
      executionTime: Date.now() - startTime,
    };
  }
}

// =============================================================================
// 北大法宝客户端
// =============================================================================

class PKULawClient implements IExternalLawArticleAPI {
  private apiKey: string;
  private baseURL: string;
  private timeout: number;

  constructor(config?: Partial<ExternalAPIConfig>) {
    this.apiKey = config?.apiKey || process.env.PKULAW_API_KEY || '';
    this.baseURL =
      config?.baseURL ||
      process.env.PKULAW_BASE_URL ||
      'https://api.pkulaw.com';
    this.timeout = config?.timeout || 10000;
  }

  async search(
    query: string,
    options?: ExternalSearchOptions
  ): Promise<ExternalSearchResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      logger.warn('[PKULaw] API 密钥未配置，跳过外部检索');
      return this.emptyResult(startTime);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/api/search`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: query,
          pageSize: options?.limit || 20,
          lawType: options?.lawType,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const data = await response.json();
      const articles = this.transformResponse(data);

      return {
        articles,
        total: data.totalCount || articles.length,
        source: 'pkulaw',
        cached: false,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('[PKULaw] 检索失败:', error);
      return this.emptyResult(startTime);
    }
  }

  async getById(id: string): Promise<LawArticle | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/article/${id}`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return this.transformArticle(data);
    } catch (error) {
      logger.error('[PKULaw] 获取法条失败:', error);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/health`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private transformResponse(data: unknown): LawArticle[] {
    const typedData = data as {
      data?: Array<{
        gid: string;
        title: string;
        tiaomu: string;
        content: string;
        flfl: string;
        sxrq?: string;
        gjc?: string;
      }>;
    };

    return (typedData.data || []).map(item => this.transformArticle(item));
  }

  private transformArticle(item: {
    gid: string;
    title: string;
    tiaomu: string;
    content: string;
    flfl: string;
    sxrq?: string;
    gjc?: string;
  }): LawArticle {
    return {
      id: item.gid,
      lawName: item.title,
      articleNumber: item.tiaomu,
      content: item.content,
      category: this.mapCategory(item.flfl),
      effectiveDate: item.sxrq,
      deprecated: false,
      keywords: item.gjc?.split(',') || [],
    };
  }

  private mapCategory(flfl: string): string {
    const categoryMap: Record<string, string> = {
      民事: 'CIVIL',
      刑事: 'CRIMINAL',
      行政: 'ADMINISTRATIVE',
      商事: 'COMMERCIAL',
    };
    return categoryMap[flfl] || 'civil';
  }

  private emptyResult(startTime: number): ExternalSearchResult {
    return {
      articles: [],
      total: 0,
      source: 'pkulaw',
      cached: false,
      executionTime: Date.now() - startTime,
    };
  }
}

// =============================================================================
// 本地降级客户端
// =============================================================================

class LocalFallbackClient implements IExternalLawArticleAPI {
  async search(
    _query: string,
    _options?: ExternalSearchOptions
  ): Promise<ExternalSearchResult> {
    // 本地降级客户端不执行实际搜索
    // 由 LawSearcher 的本地搜索处理
    return {
      articles: [],
      total: 0,
      source: 'local',
      cached: false,
      executionTime: 0,
    };
  }

  async getById(_id: string): Promise<LawArticle | null> {
    return null;
  }

  async isAvailable(): Promise<boolean> {
    return true; // 本地总是可用
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

export function createExternalAPIClient(
  config?: Partial<ExternalAPIConfig>
): IExternalLawArticleAPI {
  const provider =
    config?.provider ||
    (process.env.LAW_ARTICLE_PROVIDER as 'lawstar' | 'pkulaw' | 'local') ||
    'local';

  switch (provider) {
    case 'lawstar':
      return new LawStarClient(config);
    case 'pkulaw':
      return new PKULawClient(config);
    default:
      return new LocalFallbackClient();
  }
}

// =============================================================================
// 带缓存的客户端包装
// =============================================================================

export class CachedExternalAPIClient implements IExternalLawArticleAPI {
  private client: IExternalLawArticleAPI;
  private cache: Map<string, { data: ExternalSearchResult; expiry: number }>;
  private ttl: number;

  constructor(client: IExternalLawArticleAPI, ttl: number = 3600000) {
    this.client = client;
    this.cache = new Map();
    this.ttl = ttl; // 默认 1 小时
  }

  async search(
    query: string,
    options?: ExternalSearchOptions
  ): Promise<ExternalSearchResult> {
    const cacheKey = this.generateCacheKey(query, options);

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return { ...cached.data, cached: true };
    }

    // 执行实际搜索
    const result = await this.client.search(query, options);

    // 只缓存成功的结果
    if (result.articles.length > 0) {
      this.cache.set(cacheKey, {
        data: result,
        expiry: Date.now() + this.ttl,
      });
    }

    return result;
  }

  async getById(id: string): Promise<LawArticle | null> {
    return this.client.getById(id);
  }

  async isAvailable(): Promise<boolean> {
    return this.client.isAvailable();
  }

  private generateCacheKey(
    query: string,
    options?: ExternalSearchOptions
  ): string {
    return `${query}|${options?.limit || 20}|${options?.caseType || ''}|${options?.lawType || ''}`;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// =============================================================================
// 导出单例
// =============================================================================

let defaultClient: IExternalLawArticleAPI | null = null;

export function getExternalAPIClient(): IExternalLawArticleAPI {
  if (!defaultClient) {
    const baseClient = createExternalAPIClient();
    defaultClient = new CachedExternalAPIClient(baseClient);
  }
  return defaultClient;
}

export function resetExternalAPIClient(): void {
  defaultClient = null;
}
