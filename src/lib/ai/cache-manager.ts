import type { AIRequestConfig, AIResponse } from '../../types/ai-service';
import cacheManager from '../cache/manager';
import * as crypto from 'crypto';

// =============================================================================
// AI缓存管理器
// =============================================================================

/**
 * AI服务缓存管理
 */
export class AICacheManager {
  private cacheManager: typeof cacheManager;

  constructor() {
    this.cacheManager = cacheManager;
  }

  /**
   * 检查缓存
   */
  public async checkCache(
    request: AIRequestConfig
  ): Promise<AIResponse | null> {
    if (!this.cacheManager) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(request);
      const cached = await this.cacheManager.get(cacheKey);

      if (cached) {
        return cached as AIResponse;
      }

      return null;
    } catch (error) {
      console.warn('Cache check failed:', error);
      return null;
    }
  }

  /**
   * 缓存响应
   */
  public async cacheResponse(
    request: AIRequestConfig,
    response: AIResponse,
    ttl?: number
  ): Promise<void> {
    if (!this.cacheManager) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(request);
      const defaultTtl = ttl || 3600; // 默认1小时

      await this.cacheManager.set(cacheKey, response, { ttl: defaultTtl });
    } catch (error) {
      console.warn('Cache storage failed:', error);
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: AIRequestConfig): string {
    const keyData = {
      model: request.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    };

    // 使用SHA256哈希替代Base64编码，避免长文本导致的键长度问题
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
    return `ai_chat_${hash}`;
  }

  /**
   * 为辩论生成生成智能缓存键（基于案件相似性）
   */
  public generateDebateCacheKey(caseInfo: {
    title: string;
    description: string;
    legalReferences?: string[];
  }): string {
    // 提取案件关键要素
    const caseType = this.extractCaseType(caseInfo.title, caseInfo.description);
    const keyElements = this.extractKeyElements(
      caseInfo.title,
      caseInfo.description
    );

    // 生成基于案件类型和关键要素的模糊匹配键
    const keyData = {
      caseType,
      keyElements: keyElements.sort(), // 排序确保一致性
      model: 'deepseek-chat',
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');

    return `debate_fuzzy_${hash}`;
  }

  /**
   * 检查辩论缓存（支持模糊匹配）
   */
  public async checkDebateCache(caseInfo: {
    title: string;
    description: string;
    legalReferences?: string[];
  }): Promise<AIResponse | null> {
    try {
      // 1. 首先检查精确匹配
      const exactKey = this.generateDebateCacheKey(caseInfo);
      const exactMatch = await this.cacheManager.get(exactKey);
      if (exactMatch) {
        console.log('Found exact debate cache match');
        return exactMatch as AIResponse;
      }

      // 2. 检查相似案件缓存
      const similarKey = this.generateSimilarCaseKey(caseInfo);
      const similarMatches = await this.findSimilarDebates(similarKey);

      if (similarMatches.length > 0) {
        console.log(
          `Found ${similarMatches.length} similar debate cache matches`
        );
        // 返回最相似的缓存结果
        return similarMatches[0] as AIResponse;
      }

      return null;
    } catch (error) {
      console.warn('Debate cache check failed:', error);
      return null;
    }
  }

  /**
   * 缓存辩论结果
   */
  public async cacheDebate(
    caseInfo: {
      title: string;
      description: string;
      legalReferences?: string[];
    },
    response: AIResponse,
    ttl?: number
  ): Promise<void> {
    try {
      const cacheKey = this.generateDebateCacheKey(caseInfo);
      const defaultTtl = ttl || 1800; // 辩论缓存30分钟

      await this.cacheManager.set(cacheKey, response, { ttl: defaultTtl });

      // 同时存储到相似案件索引
      const similarKey = this.generateSimilarCaseKey(caseInfo);
      await this.addToSimilarCaseIndex(similarKey, cacheKey);
    } catch (error) {
      console.warn('Debate cache storage failed:', error);
    }
  }

  /**
   * 提取案件类型
   */
  private extractCaseType(title: string, description: string): string {
    const text = (title + ' ' + description).toLowerCase();

    if (text.includes('合同') || text.includes('违约')) return '合同纠纷';
    if (text.includes('劳动') || text.includes('工资')) return '劳动纠纷';
    if (text.includes('交通') || text.includes('事故')) return '交通事故';
    if (text.includes('侵权') || text.includes('赔偿')) return '侵权纠纷';
    if (text.includes('婚姻') || text.includes('离婚')) return '婚姻家庭';
    if (text.includes('房产') || text.includes('房屋')) return '房产纠纷';

    return '其他纠纷';
  }

  /**
   * 提取案件关键要素
   */
  private extractKeyElements(title: string, description: string): string[] {
    const text = (title + ' ' + description).toLowerCase();
    const elements: string[] = [];

    // 常见法律关键词
    const legalKeywords = [
      '违约',
      '侵权',
      '赔偿',
      '解除',
      '无效',
      '撤销',
      '定金',
      '违约金',
      '损失',
      '医疗费',
      '误工费',
      '工资',
      '经济补偿',
      '解除合同',
      '过户',
      '交付',
    ];

    legalKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        elements.push(keyword);
      }
    });

    return elements;
  }

  /**
   * 生成相似案件键
   */
  private generateSimilarCaseKey(caseInfo: {
    title: string;
    description: string;
    legalReferences?: string[];
  }): string {
    const caseType = this.extractCaseType(caseInfo.title, caseInfo.description);
    const keyElements = this.extractKeyElements(
      caseInfo.title,
      caseInfo.description
    );

    return `similar_${caseType}_${keyElements.slice(0, 3).sort().join('_')}`;
  }

  /**
   * 查找相似辩论
   */
  private async findSimilarDebates(similarKey: string): Promise<any[]> {
    try {
      // 从相似案件索引获取缓存键列表
      const cacheKeys = (await this.cacheManager.get(similarKey)) || [];

      // 确保cacheKeys是数组
      const keysArray = Array.isArray(cacheKeys) ? cacheKeys : [];

      // 批量获取缓存内容
      const promises = keysArray.map((key: string) =>
        this.cacheManager.get(key).catch(() => null)
      );

      const results = await Promise.all(promises);
      return results.filter(result => result !== null);
    } catch (error) {
      console.warn('Find similar debates failed:', error);
      return [];
    }
  }

  /**
   * 添加到相似案件索引
   */
  private async addToSimilarCaseIndex(
    similarKey: string,
    cacheKey: string
  ): Promise<void> {
    try {
      const existingKeys = (await this.cacheManager.get(similarKey)) || [];
      // 确保existingKeys是数组
      const keysArray = Array.isArray(existingKeys) ? existingKeys : [];
      const updatedKeys = [...keysArray, cacheKey].slice(-5); // 最多保留5个相似缓存

      await this.cacheManager.set(similarKey, updatedKeys, { ttl: 3600 }); // 索引缓存1小时
    } catch (error) {
      console.warn('Add to similar case index failed:', error);
    }
  }

  /**
   * 清除缓存
   */
  public async clearCache(): Promise<void> {
    if (!this.cacheManager) {
      return;
    }

    try {
      // 清除所有AI相关缓存
      const aiKeys = await this.getCacheKeys();
      if (aiKeys.length > 0) {
        await this.cacheManager.mdelete(aiKeys);
      }
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }

  /**
   * 获取匹配模式的缓存键
   */
  private async getCacheKeys(): Promise<string[]> {
    // 这里可以实现模式匹配逻辑
    // 暂时返回空数组，实际项目中需要根据Redis实现
    return [];
  }

  /**
   * 获取缓存统计
   */
  public async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    const stats = this.cacheManager.getStats();
    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate,
    };
  }
}
