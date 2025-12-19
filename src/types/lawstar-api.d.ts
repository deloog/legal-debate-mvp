/**
 * 法律之星API类型定义
 * 
 * 提供两个核心服务：
 * 1. 法规查询接口（专业版）- 基于关键词的法条检索
 * 2. 向量库查询接口 - 基于语义的智能检索
 */

// =============================================================================
// 法规查询接口类型定义
// =============================================================================

/**
 * 法规查询请求参数（专业版）
 */
export interface LawStarRegulationRequest {
  /** 查询关键词 */
  keyword?: string;
  /** 法律类型（可选）：如 "民法"、"刑法"、"行政法" 等 */
  lawType?: string;
  /** 效力级别（可选）：如 "法律"、"行政法规"、"司法解释" 等 */
  effectLevel?: string;
  /** 时效性（可选）：如 "现行有效"、"已废止" 等 */
  validity?: string;
  /** 排序字段：rDate(发布日期) 或 lawlevel(相关性) */
  field?: string;
  /** 页码（默认1） */
  page?: number;
  /** 每页数量（默认10） */
  pageSize?: number;
  /** 文号 */
  fileNum?: string;
  /** 部门名称 */
  depName?: string;
  /** 发布日期起始年月日yyyyMMdd */
  startDate?: string;
  /** 发布日期结束年月日yyyyMMdd */
  endDate?: string;
  /** 实施日期起始年月日yyyyMMdd */
  startDate1?: string;
  /** 实施日期结束年月日yyyyMMdd */
  endDate1?: string;
  /** 发文机关代码 */
  depNumber?: string;
  /** 区域代码 */
  areaNumber?: string;
  /** 法规效力，对应效力级别代码 */
  effective?: string;
  /** 时效性：0尚未实施，1现行有效,2已失效,3已修改，4草案/征求意见稿 */
  timelinessnew?: string;
}

/**
 * 法规查询响应
 */
export interface LawStarRegulationResponse {
  /** 状态码 */
  code: string | number;
  /** 响应消息 */
  msg: string;
  /** 查询结果 */
  data: {
    /** 总结果数 */
    count: number;
    /** 每页数 */
    pageSize: number;
    /** 总页数 */
    totalPage: number;
    /** 法规列表 */
    lawdata: LawStarRegulation[];
  };
}

/**
 * 法规信息
 */
export interface LawStarRegulation {
  /** 法规ID */
  lawId: string;
  /** 法规标题 */
  lawName: string;
  /** 发文机关名称 */
  issuingOrgan: string;
  /** 文号 */
  issuingNo: string;
  /** 发布日期 */
  releaseYearMonthDate: string;
  /** 实施日期 */
  implementYearMonthDate: string;
  /** 状态 */
  timeliness: string;
}

// =============================================================================
// 向量查询接口类型定义
// =============================================================================

/**
 * 向量查询请求参数
 */
export interface LawStarVectorRequest {
  /** 查询文本（案情描述、法律问题等） */
  query?: string;
  /** 返回结果数量（默认10，最大100） */
  topK?: number;
  /** 相似度阈值（0-1，默认0.7） */
  threshold?: number;
  /** 法律类型过滤（可选） */
  lawType?: string;
  /** 是否包含法条内容（默认true） */
  includeContent?: boolean;
  /** 发文机关 */
  fbdwFacet?: string;
  /** 时效性：0尚未实施，1现行有效,2已失效,4已修改 */
  lawstatexlsFacet?: number;
  /** 适用范围，如：北京天津 */
  areaFacet?: string;
  /** 行业分类，示例公安系统 */
  topicsFacet?: string;
  /** 标题关键词，多个用空格分隔 */
  keyword?: string;
  /** 文号 */
  filenum?: string;
  /** 效力级别详细子类，多个用空格分隔 */
  xls?: string;
  /** 条号 */
  rawnumber?: string;
  /** 时效性 */
  timeliness?: number;
}

/**
 * 向量查询响应
 */
export interface LawStarVectorResponse {
  /** 状态码 */
  code: string | number;
  /** 响应消息 */
  msg: string;
  /** 查询结果 */
  data: {
    /** 匹配结果 */
    result: LawStarVectorMatch[];
  };
}

/**
 * 向量匹配结果
 */
export interface LawStarVectorMatch {
  /** 法规ID */
  lawId: string;
  /** 法规标题 */
  lawName: string;
  /** 向量查询匹配度 */
  score: number;
  /** 发布部门 */
  issuingOrgan: string;
  /** 有效性 */
  timeliness: string;
  /** 效力等级 */
  xls: string;
  /** 内容 */
  content: string;
  /** 发布日期 */
  releaseYearMonthDate: number;
  /** 实施日期 */
  implementYearMonthDate: number;
  /** 条号 */
  rawnumber?: string;
  /** 法规沿革 */
  hisgroup?: any[];
  /** 文号 */
  filenum?: string;
  /** 行业分类 */
  topName?: string;
}

// =============================================================================
// 客户端配置类型
// =============================================================================

/**
 * 法律之星客户端配置
 */
export interface LawStarClientConfig {
  /** 法规查询接口配置 */
  regulation: {
    /** API基础URL */
    baseURL: string;
    /** App ID */
    appId: string;
    /** App Secret */
    appSecret: string;
    /** 请求超时时间（毫秒） */
    timeout?: number;
  };
  /** 向量查询接口配置 */
  vector: {
    /** API基础URL */
    baseURL: string;
    /** App ID */
    appId: string;
    /** App Secret */
    appSecret: string;
    /** 请求超时时间（毫秒） */
    timeout?: number;
  };
  /** 缓存配置 */
  cache?: {
    /** 是否启用缓存 */
    enabled: boolean;
    /** 缓存TTL（秒） */
    ttl: number;
  };
  /** 重试配置 */
  retry?: {
    /** 最大重试次数 */
    maxRetries: number;
    /** 重试延迟（毫秒） */
    retryDelay: number;
  };
}

// =============================================================================
// 错误类型定义
// =============================================================================

/**
 * 法律之星API错误
 */
export interface LawStarError {
  /** 错误码 */
  code: number;
  /** 错误消息 */
  message: string;
  /** 错误类型 */
  type: 'authentication' | 'rate_limit' | 'network' | 'validation' | 'server' | 'unknown';
  /** 是否可重试 */
  retryable: boolean;
  /** 原始错误 */
  originalError?: Error;
}

// =============================================================================
// 统计和监控类型
// =============================================================================

/**
 * 法律之星服务统计
 */
export interface LawStarStats {
  /** 法规查询统计 */
  regulation: {
    /** 总请求数 */
    totalRequests: number;
    /** 成功请求数 */
    successRequests: number;
    /** 失败请求数 */
    failedRequests: number;
    /** 平均响应时间（毫秒） */
    averageResponseTime: number;
    /** 缓存命中率 */
    cacheHitRate: number;
  };
  /** 向量查询统计 */
  vector: {
    /** 总请求数 */
    totalRequests: number;
    /** 成功请求数 */
    successRequests: number;
    /** 失败请求数 */
    failedRequests: number;
    /** 平均响应时间（毫秒） */
    averageResponseTime: number;
    /** 缓存命中率 */
    cacheHitRate: number;
  };
  /** 最后更新时间 */
  lastUpdate: number;
}
