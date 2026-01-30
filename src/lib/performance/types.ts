/**
 * 性能优化器类型定义
 */

/**
 * 慢查询信息
 */
export interface SlowQuery {
  /** 查询语句 */
  query: string;
  /** 平均执行时间（毫秒） */
  meanExecTime: number;
  /** 调用次数 */
  calls: number;
  /** 总执行时间（毫秒） */
  totalExecTime: number;
}

/**
 * 查询模式
 */
export interface QueryPattern {
  /** 表名 */
  table: string;
  /** 列名 */
  column: string;
  /** 查询类型 */
  type: 'WHERE' | 'JOIN' | 'ORDER_BY' | 'GROUP_BY';
}

/**
 * 索引信息
 */
export interface IndexInfo {
  /** 索引名称 */
  name: string;
  /** 表名 */
  table: string;
  /** 列名 */
  column: string;
  /** 是否存在 */
  exists: boolean;
}

/**
 * 数据库连接池配置
 */
export interface DatabasePoolConfig {
  /** 最小连接数 */
  minConnections: number;
  /** 最大连接数 */
  maxConnections: number;
  /** 空闲超时（毫秒） */
  idleTimeout: number;
  /** 连接超时（毫秒） */
  connectionTimeout: number;
}

/**
 * Redis缓存配置
 */
export interface RedisCacheConfig {
  /** 主机 */
  host: string;
  /** 端口 */
  port: number;
  /** 密码 */
  password?: string;
  /** 数据库索引 */
  db: number;
  /** 默认TTL（秒） */
  defaultTTL: number;
  /** 最大重试次数 */
  maxRetries: number;
}

/**
 * CDN配置
 */
export interface CDNConfig {
  /** 是否启用 */
  enabled: boolean;
  /** CDN域名 */
  domain: string;
  /** 静态资源路径 */
  staticPaths: string[];
  /** 缓存时间（秒） */
  cacheMaxAge: number;
}

/**
 * 响应压缩配置
 */
export interface CompressionConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 压缩级别（1-9） */
  level: number;
  /** 最小压缩大小（字节） */
  threshold: number;
  /** 压缩类型 */
  types: string[];
}

/**
 * API优化结果
 */
export interface APIOptimizationResult {
  /** 是否成功 */
  success: boolean;
  /** 数据库连接池状态 */
  databasePool: {
    enabled: boolean;
    config: DatabasePoolConfig;
  };
  /** Redis缓存状态 */
  redisCache: {
    enabled: boolean;
    config: RedisCacheConfig | null;
  };
  /** CDN状态 */
  cdn: {
    enabled: boolean;
    config: CDNConfig | null;
  };
  /** 响应压缩状态 */
  compression: {
    enabled: boolean;
    config: CompressionConfig;
  };
  /** 优化时间戳 */
  timestamp: Date;
}

/**
 * 数据库优化结果
 */
export interface DatabaseOptimizationResult {
  /** 是否成功 */
  success: boolean;
  /** 分析的慢查询数量 */
  slowQueriesAnalyzed: number;
  /** 创建的索引数量 */
  indexesCreated: number;
  /** 优化的N+1查询数量 */
  nPlusOneOptimized: number;
  /** 启用的批量查询数量 */
  batchQueriesEnabled: number;
  /** 详细信息 */
  details: {
    slowQueries: SlowQuery[];
    createdIndexes: IndexInfo[];
    optimizations: string[];
  };
  /** 优化时间戳 */
  timestamp: Date;
}

/**
 * 前端优化配置
 */
export interface FrontendOptimizationConfig {
  /** 代码分割 */
  codeSplitting: {
    enabled: boolean;
    chunks: string[];
  };
  /** 懒加载 */
  lazyLoading: {
    enabled: boolean;
    components: string[];
  };
  /** 图片优化 */
  imageOptimization: {
    enabled: boolean;
    formats: string[];
    quality: number;
  };
  /** Service Worker */
  serviceWorker: {
    enabled: boolean;
    cacheStrategies: string[];
  };
}

/**
 * 前端优化结果
 */
export interface FrontendOptimizationResult {
  /** 是否成功 */
  success: boolean;
  /** 代码分割状态 */
  codeSplitting: {
    enabled: boolean;
    chunksCount: number;
  };
  /** 懒加载状态 */
  lazyLoading: {
    enabled: boolean;
    componentsCount: number;
  };
  /** 图片优化状态 */
  imageOptimization: {
    enabled: boolean;
    optimizedCount: number;
  };
  /** Service Worker状态 */
  serviceWorker: {
    enabled: boolean;
    registered: boolean;
  };
  /** 优化时间戳 */
  timestamp: Date;
}

/**
 * 性能优化配置
 */
export interface PerformanceOptimizerConfig {
  /** 数据库连接池配置 */
  databasePool: DatabasePoolConfig;
  /** Redis缓存配置 */
  redisCache: RedisCacheConfig;
  /** CDN配置 */
  cdn: CDNConfig;
  /** 响应压缩配置 */
  compression: CompressionConfig;
  /** 前端优化配置 */
  frontend: FrontendOptimizationConfig;
  /** 慢查询阈值（毫秒） */
  slowQueryThreshold: number;
}

/**
 * 完整优化结果
 */
export interface FullOptimizationResult {
  /** API优化结果 */
  api: APIOptimizationResult;
  /** 数据库优化结果 */
  database: DatabaseOptimizationResult;
  /** 前端优化结果 */
  frontend: FrontendOptimizationResult;
  /** 总体状态 */
  overall: {
    success: boolean;
    totalOptimizations: number;
    errors: string[];
  };
  /** 优化时间戳 */
  timestamp: Date;
}
