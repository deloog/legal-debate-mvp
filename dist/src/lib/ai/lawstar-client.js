'use strict';
/**
 * 法律之星API客户端
 *
 * 提供法规查询和向量查询两个核心功能
 * 支持缓存、重试、错误处理等特性
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.LawStarClient = void 0;
exports.createLawStarClient = createLawStarClient;
const manager_1 = __importDefault(require('../cache/manager'));
const crypto = __importStar(require('crypto'));
// =============================================================================
// 法律之星客户端类
// =============================================================================
class LawStarClient {
  constructor(config) {
    this.authToken = null;
    this.tokenExpiry = 0;
    this.config = {
      ...config,
      cache: config.cache || { enabled: true, ttl: 3600 },
      retry: config.retry || { maxRetries: 3, retryDelay: 1000 },
    };
    this.stats = {
      regulation: {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
      },
      vector: {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
      },
      lastUpdate: Date.now(),
    };
  }
  // =============================================================================
  // 认证方法
  // =============================================================================
  /**
   * 获取认证Token
   */
  async getAuthToken() {
    // 检查Token是否仍然有效
    if (this.authToken && Date.now() < this.tokenExpiry) {
      return this.authToken;
    }
    try {
      const response = await this.authenticate();
      // 检查返回的数据结构
      if (!response || !response.Authorization) {
        throw new Error(
          'Authentication failed: No authorization token received'
        );
      }
      this.authToken = response.Authorization;
      // Token有效期通常为4小时，提前5分钟刷新
      this.tokenExpiry = Date.now() + 4 * 60 * 60 * 1000 - 5 * 60 * 1000;
      return this.authToken;
    } catch (error) {
      throw this.handleError(error, 'authentication');
    }
  }
  /**
   * 执行认证
   */
  async authenticate() {
    const authConfig = this.config.regulation; // 使用regulation配置进行认证
    const url = `${authConfig.baseURL}/api/auth/login`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appid: authConfig.appId,
          appsecret: authConfig.appSecret,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(
          `Authentication failed: HTTP ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();
      // 调试日志
      console.log(
        'LawStar authentication response:',
        JSON.stringify(data, null, 2)
      );
      // 检查响应状态码 - 支持数字和字符串格式
      if (data.code !== 200 && data.code !== '200') {
        const errorMsg =
          data.msg || data.message || 'Unknown authentication error';
        throw new Error(
          `Authentication failed: ${errorMsg} (code: ${data.code})`
        );
      }
      // 检查是否有数据字段
      if (!data.data) {
        throw new Error('Authentication failed: No data field in response');
      }
      // 检查是否有Authorization字段
      if (!data.data.Authorization) {
        throw new Error(
          'Authentication failed: No Authorization token in response data'
        );
      }
      return data.data;
    } catch (error) {
      clearTimeout(timeoutId);
      // 如果是网络错误或超时，重新抛出
      if (
        error instanceof Error &&
        (error.name === 'AbortError' ||
          error.message.includes('timeout') ||
          error.message.includes('network'))
      ) {
        throw error;
      }
      // 其他错误也重新抛出
      throw error;
    }
  }
  // =============================================================================
  // 法规查询接口
  // =============================================================================
  /**
   * 查询法规
   */
  async searchRegulations(request) {
    this.stats.regulation.totalRequests++;
    const startTime = Date.now();
    try {
      // 检查缓存
      if (this.config.cache?.enabled) {
        const cached = await this.getFromCache('regulation', request);
        if (cached) {
          this.updateStats('regulation', true, Date.now() - startTime, true);
          return cached;
        }
      }
      // 执行请求
      const response = await this.executeRegulationRequest(request);
      // 缓存结果
      if (this.config.cache?.enabled) {
        await this.saveToCache('regulation', request, response);
      }
      this.updateStats('regulation', true, Date.now() - startTime, false);
      return response;
    } catch (error) {
      this.updateStats('regulation', false, Date.now() - startTime, false);
      throw this.handleError(error, 'regulation');
    }
  }
  /**
   * 执行法规查询请求
   */
  async executeRegulationRequest(request) {
    const authToken = await this.getAuthToken();
    const config = this.config.regulation;
    // 使用专业版查询接口
    const url = `${config.baseURL}/api/lawData/professional/query`;
    const params = new URLSearchParams({
      field: request.field || 'lawlevel',
      page: String(request.page || 1),
      rows: String(request.pageSize || 10),
    });
    if (request.keyword) params.append('keyword', request.keyword);
    if (request.lawType) params.append('effective', request.lawType);
    if (request.effectLevel) params.append('lawlevel', request.effectLevel);
    if (request.validity) params.append('timelinessnew', request.validity);
    if (request.startDate) params.append('startDate', request.startDate);
    if (request.endDate) params.append('endDate', request.endDate);
    if (request.depName) params.append('depName', request.depName);
    if (request.fileNum) params.append('fileNum', request.fileNum);
    return this.makeRequest(
      `${url}?${params.toString()}`,
      authToken,
      config.timeout || 30000
    );
  }
  // =============================================================================
  // 向量查询接口
  // =============================================================================
  /**
   * 向量查询（语义检索）
   */
  async vectorSearch(request) {
    this.stats.vector.totalRequests++;
    const startTime = Date.now();
    try {
      // 检查缓存
      if (this.config.cache?.enabled) {
        const cached = await this.getFromCache('vector', request);
        if (cached) {
          this.updateStats('vector', true, Date.now() - startTime, true);
          return cached;
        }
      }
      // 执行请求
      const response = await this.executeVectorRequest(request);
      // 缓存结果
      if (this.config.cache?.enabled) {
        await this.saveToCache('vector', request, response);
      }
      this.updateStats('vector', true, Date.now() - startTime, false);
      return response;
    } catch (error) {
      this.updateStats('vector', false, Date.now() - startTime, false);
      throw this.handleError(error, 'vector');
    }
  }
  /**
   * 执行向量查询请求
   */
  async executeVectorRequest(request) {
    const authToken = await this.getAuthToken();
    const config = this.config.vector;
    const url = `${config.baseURL}/api/lawData/xlquery`;
    const params = new URLSearchParams({
      rows: String(request.topK || 10),
    });
    if (request.query) params.append('vector', request.query);
    if (request.keyword) params.append('keyword', request.keyword);
    if (request.lawType) params.append('xls', request.lawType);
    if (request.areaFacet) params.append('areaFacet', request.areaFacet);
    if (request.fbdwFacet) params.append('fbdwFacet', request.fbdwFacet);
    if (request.topicsFacet) params.append('topicsFacet', request.topicsFacet);
    if (request.rawnumber) params.append('rawnumber', request.rawnumber);
    if (request.filenum) params.append('filenum', request.filenum);
    if (request.timeliness !== undefined)
      params.append('lawstatexlsFacet', String(request.timeliness));
    if (request.includeContent !== undefined)
      params.append('includeContent', String(request.includeContent));
    return this.makeRequest(
      `${url}?${params.toString()}`,
      authToken,
      config.timeout || 30000
    );
  }
  // =============================================================================
  // HTTP请求方法
  // =============================================================================
  /**
   * 执行HTTP请求（带重试机制）
   */
  async makeRequest(url, authToken, timeout) {
    // 检查authToken是否有效
    if (!authToken) {
      throw new Error('Authentication token is required but not available');
    }
    const maxRetries = this.config.retry?.maxRetries || 3;
    const retryDelay = this.config.retry?.retryDelay || 1000;
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authToken,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        // 检查API响应状态 - 支持数字和字符串格式
        if (data.code !== '200' && data.code !== 200) {
          throw new Error(
            `API Error ${data.code}: ${data.msg || data.message || 'Unknown error'}`
          );
        }
        return data;
      } catch (error) {
        lastError = error;
        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          break;
        }
        // 判断是否应该重试
        if (!this.shouldRetry(error)) {
          break;
        }
        // 等待后重试
        await this.sleep(retryDelay * (attempt + 1));
      }
    }
    throw lastError || new Error('Request failed');
  }
  /**
   * 判断错误是否应该重试
   */
  shouldRetry(error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('429') // Rate limit
    );
  }
  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  // =============================================================================
  // 缓存方法
  // =============================================================================
  /**
   * 从缓存获取数据
   */
  async getFromCache(type, request) {
    try {
      const cacheKey = this.generateCacheKey(type, request);
      return await manager_1.default.get(cacheKey);
    } catch (error) {
      console.warn('Cache get failed:', error);
      return null;
    }
  }
  /**
   * 保存数据到缓存
   */
  async saveToCache(type, request, response) {
    try {
      const cacheKey = this.generateCacheKey(type, request);
      const ttl = this.config.cache?.ttl || 3600;
      await manager_1.default.set(cacheKey, response, { ttl });
    } catch (error) {
      console.warn('Cache set failed:', error);
    }
  }
  /**
   * 生成缓存键
   */
  generateCacheKey(type, request) {
    const keyData = { type, ...request };
    // 使用SHA256哈希替代Base64编码，避免长文本导致的键长度问题
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
    return `lawstar_${type}_${hash}`;
  }
  // =============================================================================
  // 错误处理
  // =============================================================================
  /**
   * 处理错误
   */
  handleError(error, context) {
    const message = error.message.toLowerCase();
    let errorType = 'unknown';
    let code = 500;
    let retryable = false;
    if (message.includes('authentication') || message.includes('401')) {
      errorType = 'authentication';
      code = 401;
      retryable = false;
    } else if (message.includes('rate limit') || message.includes('429')) {
      errorType = 'rate_limit';
      code = 429;
      retryable = true;
    } else if (message.includes('timeout') || message.includes('network')) {
      errorType = 'network';
      code = 503;
      retryable = true;
    } else if (message.includes('validation') || message.includes('400')) {
      errorType = 'validation';
      code = 400;
      retryable = false;
    } else if (message.includes('500') || message.includes('server')) {
      errorType = 'server';
      code = 500;
      retryable = true;
    }
    return {
      code,
      message: `[${context}] ${error.message}`,
      type: errorType,
      retryable,
      originalError: error,
    };
  }
  // =============================================================================
  // 统计和监控
  // =============================================================================
  /**
   * 更新统计信息
   */
  updateStats(type, success, duration, cached) {
    const stats = this.stats[type];
    if (success) {
      stats.successRequests++;
    } else {
      stats.failedRequests++;
    }
    // 更新平均响应时间
    const totalSuccessRequests = stats.successRequests;
    if (totalSuccessRequests > 0) {
      stats.averageResponseTime =
        (stats.averageResponseTime * (totalSuccessRequests - 1) + duration) /
        totalSuccessRequests;
    }
    // 更新缓存命中率
    if (cached) {
      const cacheHits = stats.totalRequests * stats.cacheHitRate + 1;
      stats.cacheHitRate = cacheHits / stats.totalRequests;
    } else {
      const cacheHits = stats.totalRequests * stats.cacheHitRate;
      stats.cacheHitRate = cacheHits / stats.totalRequests;
    }
    this.stats.lastUpdate = Date.now();
  }
  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }
  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      regulation: {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
      },
      vector: {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
      },
      lastUpdate: Date.now(),
    };
  }
  // =============================================================================
  // 健康检查
  // =============================================================================
  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      // 尝试获取认证Token
      await this.getAuthToken();
      return true;
    } catch {
      return false;
    }
  }
}
exports.LawStarClient = LawStarClient;
// =============================================================================
// 工厂函数
// =============================================================================
/**
 * 创建法律之星客户端
 */
function createLawStarClient(config) {
  return new LawStarClient(config);
}
// =============================================================================
// 默认导出
// =============================================================================
exports.default = LawStarClient;
