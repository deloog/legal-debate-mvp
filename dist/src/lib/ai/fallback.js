'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.FallbackManagerFactory = exports.FallbackManager = void 0;
// =============================================================================
// AI降级策略实现
// =============================================================================
class FallbackManager {
  constructor(config, cacheManager) {
    this.config = config;
    this.activeStrategies = new Map();
    this.fallbackHistory = [];
    this.cacheManager = cacheManager;
    // 初始化降级策略
    this.initializeStrategies();
  }
  // =============================================================================
  // 初始化和配置
  // =============================================================================
  initializeStrategies() {
    if (!this.config.enabled) return;
    // 按优先级排序策略
    const sortedStrategies = [...this.config.strategies].sort(
      (a, b) => a.priority - b.priority
    );
    sortedStrategies.forEach(strategy => {
      const key = `${strategy.condition}_${strategy.action}`;
      this.activeStrategies.set(key, strategy);
    });
  }
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    this.initializeStrategies();
  }
  // =============================================================================
  // 降级决策和执行
  // =============================================================================
  async handleFailure(error, originalRequest, providers) {
    const event = {
      timestamp: Date.now(),
      originalError: error,
      originalRequest,
      attemptedStrategies: [],
      success: false,
      finalResult: null,
    };
    try {
      // 根据错误类型确定降级条件
      const condition = this.determineFallbackCondition(error);
      // 获取匹配的降级策略
      const strategies = this.getStrategiesForCondition(condition);
      // 按优先级执行降级策略
      for (const strategy of strategies) {
        event.attemptedStrategies.push(strategy);
        try {
          const result = await this.executeStrategy(
            strategy,
            originalRequest,
            providers
          );
          if (result) {
            event.success = true;
            event.finalResult = result;
            event.successfulStrategy = strategy;
            this.recordFallbackEvent(event);
            return result;
          }
        } catch (strategyError) {
          console.warn(
            `Fallback strategy ${strategy.action} failed:`,
            strategyError
          );
          continue;
        }
      }
      // 所有策略都失败了
      this.recordFallbackEvent(event);
      return null;
    } catch (fallbackError) {
      console.error('Fallback manager failed:', fallbackError);
      this.recordFallbackEvent(event);
      return null;
    }
  }
  determineFallbackCondition(error) {
    // 根据错误类型映射到降级条件
    switch (error.type) {
      case 'authentication_error':
      case 'permission_error':
      case 'insufficient_quota':
        return 'provider_error';
      case 'rate_limit_error':
        return 'rate_limit';
      case 'timeout_error':
      case 'network_error':
        return 'timeout';
      case 'api_error':
      case 'model_not_available':
        return 'provider_error';
      default:
        return 'provider_error';
    }
  }
  getStrategiesForCondition(condition) {
    const strategies = [];
    for (const strategy of this.config.strategies) {
      if (strategy.condition === condition) {
        strategies.push(strategy);
      }
    }
    // 按优先级排序
    return strategies.sort((a, b) => a.priority - b.priority);
  }
  async executeStrategy(strategy, originalRequest, availableProviders) {
    switch (strategy.action) {
      case 'switch_provider':
        return this.switchProvider(originalRequest, availableProviders);
      case 'use_cache':
        return this.useCache(originalRequest);
      case 'simplified_request':
        return this.simplifiedRequest(originalRequest);
      case 'local_processing':
        return this.localProcessing(originalRequest);
      case 'return_error':
        return this.returnError(originalRequest);
      default:
        throw new Error(`Unknown fallback action: ${strategy.action}`);
    }
  }
  // =============================================================================
  // 具体降级行动实现
  // =============================================================================
  async switchProvider(originalRequest, availableProviders) {
    // 这个方法需要与负载均衡器配合
    // 这里只是模拟实现
    console.log('Switching to alternative provider...');
    // 返回null表示需要外部系统处理提供商切换
    return null;
  }
  async useCache(originalRequest) {
    if (!this.config.cacheFallback.enabled || !this.cacheManager) {
      console.warn('Cache fallback not enabled or cache manager not available');
      return null;
    }
    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey(originalRequest);
      // 从缓存获取响应
      const cachedResponse = await this.cacheManager.get(cacheKey);
      if (cachedResponse) {
        console.log('Using cached response as fallback');
        // 转换为标准AI响应格式
        return {
          id: `cached_${Date.now()}`,
          object: 'chat.completion',
          created: Date.now(),
          model: originalRequest.model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: cachedResponse.content || cachedResponse,
              },
              finishReason: 'stop',
              logprobs: null,
            },
          ],
          provider: 'zhipu', // 使用有效的AIProvider类型
          duration: 0,
          cached: true,
        };
      }
      return null;
    } catch (cacheError) {
      console.error('Cache fallback failed:', cacheError);
      return null;
    }
  }
  async simplifiedRequest(originalRequest) {
    if (!this.config.simplifiedMode.enabled) {
      console.warn('Simplified mode fallback not enabled');
      return null;
    }
    try {
      console.log('Using simplified request as fallback');
      // 创建简化的请求配置
      const simplifiedConfig = {
        ...originalRequest,
        maxTokens: this.config.simplifiedMode.maxTokens,
        temperature: originalRequest.temperature
          ? Math.min(originalRequest.temperature, 0.5)
          : 0.3,
      };
      // 如果启用了简化提示
      if (this.config.simplifiedMode.simplifiedPrompts) {
        simplifiedConfig.messages = this.simplifyMessages(
          originalRequest.messages
        );
      }
      // 返回null表示需要外部系统处理简化请求
      // 这里可以集成具体的AI客户端调用
      return null;
    } catch (simplifyError) {
      console.error('Simplified request fallback failed:', simplifyError);
      return null;
    }
  }
  async localProcessing(originalRequest) {
    if (!this.config.localProcessing.enabled) {
      console.warn('Local processing fallback not enabled');
      return null;
    }
    try {
      console.log('Using local processing as fallback');
      // 根据请求类型进行本地处理
      const lastMessage =
        originalRequest.messages[originalRequest.messages.length - 1];
      const userContent = lastMessage?.content || '';
      let responseContent = '';
      if (
        this.config.localProcessing.capabilities.includes('text_generation')
      ) {
        responseContent = this.generateLocalResponse(userContent);
      } else if (
        this.config.localProcessing.capabilities.includes('template_response')
      ) {
        responseContent = this.getTemplateResponse(userContent);
      } else {
        responseContent =
          'I apologize, but I am currently experiencing technical difficulties. Please try again later.';
      }
      return {
        id: `local_${Date.now()}`,
        object: 'chat.completion',
        created: Date.now(),
        model: 'local-fallback',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: responseContent,
            },
            finishReason: 'stop',
            logprobs: null,
          },
        ],
        provider: 'zhipu', // 使用有效的AIProvider类型
        duration: 10,
        cached: false,
      };
    } catch (localError) {
      console.error('Local processing fallback failed:', localError);
      return null;
    }
  }
  async returnError(originalRequest) {
    console.log('Returning error response as fallback');
    const errorMessage =
      'I apologize, but I am currently unable to process your request due to service limitations. Please try again later.';
    throw new Error(errorMessage);
    // 或者返回一个错误响应
    return {
      id: `error_${Date.now()}`,
      object: 'chat.completion',
      created: Date.now(),
      model: originalRequest.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: errorMessage,
          },
          finishReason: 'stop',
          logprobs: null,
        },
      ],
      provider: 'zhipu', // 使用有效的AIProvider类型
      duration: 0,
      cached: false,
    };
  }
  // =============================================================================
  // 辅助方法
  // =============================================================================
  generateCacheKey(request) {
    const keyData = {
      model: request.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    };
    return `ai_fallback_${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }
  simplifyMessages(messages) {
    return messages.map(message => {
      if (message.role === 'system') {
        // 简化系统消息
        return {
          ...message,
          content: 'You are a helpful assistant.',
        };
      } else if (message.role === 'user' && message.content.length > 500) {
        // 截断过长的用户消息
        return {
          ...message,
          content: message.content.substring(0, 500) + '... (truncated)',
        };
      }
      return message;
    });
  }
  generateLocalResponse(userContent) {
    // 简单的本地响应生成逻辑
    const lowerContent = userContent.toLowerCase();
    if (lowerContent.includes('hello') || lowerContent.includes('hi')) {
      return 'Hello! How can I help you today?';
    } else if (lowerContent.includes('help')) {
      return "I'm here to help! What do you need assistance with?";
    } else if (lowerContent.includes('thank')) {
      return "You're welcome! Is there anything else I can help you with?";
    } else if (lowerContent.includes('bye')) {
      return 'Goodbye! Have a great day!';
    } else {
      return "I understand you're looking for assistance. While I'm experiencing some technical difficulties, I'm still here to help with basic questions.";
    }
  }
  getTemplateResponse(userContent) {
    // 基于模板的响应
    return `I received your message: "${userContent}". Due to current service limitations, I can only provide this basic response. For more detailed assistance, please try again later.`;
  }
  // =============================================================================
  // 事件记录和统计
  // =============================================================================
  recordFallbackEvent(event) {
    this.fallbackHistory.push(event);
    // 限制历史记录数量
    if (this.fallbackHistory.length > 1000) {
      this.fallbackHistory.splice(0, this.fallbackHistory.length - 1000);
    }
    // 记录日志
    console.log('Fallback event recorded:', {
      success: event.success,
      strategy: event.successfulStrategy?.action,
      error: event.originalError.type,
    });
  }
  getFallbackHistory() {
    return [...this.fallbackHistory];
  }
  getFallbackStats(timeWindow) {
    const cutoffTime = timeWindow ? Date.now() - timeWindow : 0;
    const relevantEvents = this.fallbackHistory.filter(
      e => e.timestamp > cutoffTime
    );
    const totalEvents = relevantEvents.length;
    const successfulEvents = relevantEvents.filter(e => e.success).length;
    const failedEvents = totalEvents - successfulEvents;
    const strategyStats = {};
    relevantEvents.forEach(event => {
      if (event.successfulStrategy) {
        const action = event.successfulStrategy.action;
        strategyStats[action] = (strategyStats[action] || 0) + 1;
      }
    });
    const errorTypeStats = {};
    relevantEvents.forEach(event => {
      const errorType = event.originalError.type;
      errorTypeStats[errorType] = (errorTypeStats[errorType] || 0) + 1;
    });
    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      successRate: totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0,
      strategyStats,
      errorTypeStats,
      averageResolutionTime: this.calculateAverageResolutionTime(
        relevantEvents.filter(e => e.success)
      ),
    };
  }
  calculateAverageResolutionTime(successfulEvents) {
    if (successfulEvents.length === 0) return 0;
    const totalTime = successfulEvents.reduce((sum, event) => {
      return sum + (event.resolutionTime || 0);
    }, 0);
    return totalTime / successfulEvents.length;
  }
  // =============================================================================
  // 健康检查和恢复
  // =============================================================================
  async checkFallbackHealth() {
    // 检查各个降级组件的健康状况
    const checks = await Promise.allSettled([
      this.checkCacheHealth(),
      this.checkLocalProcessingHealth(),
    ]);
    return checks.every(
      check => check.status === 'fulfilled' && check.value === true
    );
  }
  async checkCacheHealth() {
    if (!this.config.cacheFallback.enabled || !this.cacheManager) {
      return true; // 未启用时视为健康
    }
    try {
      // 尝试一个简单的缓存操作
      const testKey = 'health_check_' + Date.now();
      await this.cacheManager.set(testKey, 'test', 10);
      const result = await this.cacheManager.get(testKey);
      await this.cacheManager.delete(testKey);
      return result === 'test';
    } catch {
      return false;
    }
  }
  async checkLocalProcessingHealth() {
    if (!this.config.localProcessing.enabled) {
      return true; // 未启用时视为健康
    }
    try {
      // 测试本地处理能力
      const testResponse = this.generateLocalResponse('health check');
      return testResponse.length > 0;
    } catch {
      return false;
    }
  }
}
exports.FallbackManager = FallbackManager;
// =============================================================================
// 降级管理器工厂
// =============================================================================
class FallbackManagerFactory {
  static getInstance(name = 'default', config, cacheManager) {
    let instance = this.instances.get(name);
    if (!instance) {
      const defaultConfig = {
        enabled: true,
        strategies: [
          {
            priority: 1,
            condition: 'provider_error',
            action: 'switch_provider',
          },
          {
            priority: 2,
            condition: 'rate_limit',
            action: 'use_cache',
          },
          {
            priority: 3,
            condition: 'timeout',
            action: 'simplified_request',
          },
          {
            priority: 4,
            condition: 'all_providers_down',
            action: 'local_processing',
          },
          {
            priority: 5,
            condition: 'provider_error',
            action: 'return_error',
          },
        ],
        cacheFallback: {
          enabled: true,
          ttl: 300, // 5分钟
          maxAge: 3600, // 1小时
        },
        simplifiedMode: {
          enabled: true,
          maxTokens: 1000,
          simplifiedPrompts: true,
        },
        localProcessing: {
          enabled: true,
          capabilities: ['text_generation', 'template_response'],
        },
      };
      const finalConfig = { ...defaultConfig, ...config };
      instance = new FallbackManager(finalConfig, cacheManager);
      this.instances.set(name, instance);
    }
    return instance;
  }
  static createCustomInstance(name, config, cacheManager) {
    const instance = new FallbackManager(config, cacheManager);
    this.instances.set(name, instance);
    return instance;
  }
  static removeInstance(name) {
    return this.instances.delete(name);
  }
  static getAllInstances() {
    return new Map(this.instances);
  }
}
exports.FallbackManagerFactory = FallbackManagerFactory;
FallbackManagerFactory.instances = new Map();
// =============================================================================
// 默认导出
// =============================================================================
exports.default = FallbackManagerFactory;
