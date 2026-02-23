// 缓存项接口
export interface CacheItem<T = any> {
  key: string;
  value: T;
  ttl?: number; // 生存时间（秒）
  namespace?: string; // 命名空间
  tags?: string[]; // 标签，用于批量删除
}

// 缓存选项接口
export interface CacheOptions {
  ttl?: number; // 生存时间（秒）
  namespace?: string; // 命名空间
  tags?: string[]; // 标签
  serialize?: boolean; // 是否序列化（默认true）
  compress?: boolean; // 是否压缩（默认false）
}

// 缓存统计信息接口
export interface CacheStats {
  hits: number; // 命中次数
  misses: number; // 未命中次数
  hitRate: number; // 命中率（百分比）
  totalRequests: number; // 总请求数
  sets: number; // 设置次数
  deletes: number; // 删除次数
  evictions: number; // 驱逐次数
  memoryUsage: number; // 内存使用量（字节）
  keyCount: number; // 键数量
}

// 缓存健康状态接口
export interface CacheHealth {
  connected: boolean; // 是否连接
  responseTime: number; // 响应时间（毫秒）
  memoryUsage: number; // 内存使用量
  keyCount: number; // 键数量
  lastCheck: Date; // 最后检查时间
}

// 缓存配置接口
export interface CacheConfig {
  keyPrefix: string; // 键前缀
  defaultTtl: number; // 默认TTL（秒）
  sessionTtl: number; // 会话TTL（秒）
  configTtl: number; // 配置TTL（秒）
  enableMetrics: boolean; // 是否启用指标收集
  enableCompression: boolean; // 是否启用压缩
  maxKeyLength: number; // 最大键长度
  maxValueSize: number; // 最大值大小（字节）
}

// 缓存命名空间枚举
export enum CacheNamespace {
  USER_SESSION = 'user_session',
  USER_DATA = 'user_data',
  AI_RESPONSE = 'ai_response',
  CONFIGURATION = 'configuration',
  DATABASE_QUERY = 'database_query',
  API_RESPONSE = 'api_response',
  KNOWLEDGE_GRAPH = 'knowledge_graph',
  TEMPORARY = 'temporary',
  SYSTEM = 'system',
}

// 缓存策略枚举
export enum CacheStrategy {
  LAZY_LOADING = 'lazy_loading', // 懒加载
  WRITE_THROUGH = 'write_through', // 写穿透
  WRITE_BEHIND = 'write_behind', // 写回
  REFRESH_AHEAD = 'refresh_ahead', // 预刷新
}

// 缓存操作结果接口
export interface CacheOperationResult {
  success: boolean;
  key?: string;
  value?: any;
  error?: Error;
  operation: 'get' | 'set' | 'delete' | 'clear' | 'exists';
  timestamp: Date;
}

// 批量操作结果接口
export interface CacheBatchResult<T = any> {
  results: Array<{
    key: string;
    success: boolean;
    value?: T;
    error?: Error;
  }>;
  successCount: number;
  failureCount: number;
  totalCount: number;
}

// 缓存事件接口
export interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'expire' | 'evict';
  key: string;
  namespace?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// 缓存监听器类型
export type CacheEventListener = (event: CacheEvent) => void;

// 序列化器接口
export interface CacheSerializer {
  serialize<T>(value: T): string;
  deserialize<T>(value: string): T;
}

// 压缩器接口
export interface CacheCompressor {
  compress(data: string): Buffer;
  decompress(data: Buffer): string;
}

// 缓存键生成器接口
export interface CacheKeyGenerator {
  generateKey(parts: string[]): string;
  validateKey(key: string): boolean;
  normalizeKey(key: string): string;
}

// 缓存标签管理器接口
export interface CacheTagManager {
  addTags(key: string, tags: string[]): Promise<void>;
  removeTags(key: string, tags: string[]): Promise<void>;
  getKeysByTag(tag: string): Promise<string[]>;
  deleteByTag(tag: string): Promise<number>;
}

// 缓存命名空间管理器接口
export interface CacheNamespaceManager {
  addToNamespace(key: string, namespace: string): Promise<void>;
  removeFromNamespace(key: string, namespace: string): Promise<void>;
  getKeysByNamespace(namespace: string): Promise<string[]>;
  clearNamespace(namespace: string): Promise<number>;
}

// 默认缓存配置
export const defaultCacheConfig: CacheConfig = {
  keyPrefix: process.env.CACHE_KEY_PREFIX || 'legal_debate:',
  defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '3600', 10), // 1小时
  sessionTtl: parseInt(process.env.CACHE_SESSION_TTL || '1800', 10), // 30分钟
  configTtl: parseInt(process.env.CACHE_CONFIG_TTL || '86400', 10), // 24小时
  enableMetrics: process.env.NODE_ENV !== 'production',
  enableCompression: false,
  maxKeyLength: 2000, // 增加到2000，支持更长的缓存键
  maxValueSize: 1024 * 1024, // 1MB
};
