import type { 
  AIProvider, 
  AIServiceConfig, 
  AIRequestConfig, 
  AIResponse, 
  AIError,
  AIErrorType,
  ServiceStatus,
  AIClientConfig 
} from '../../types/ai-service';

import { LoadBalancerFactory } from './load-balancer';
import { MonitorFactory } from './monitor';
import { FallbackManagerFactory } from './fallback';
import cacheManager from '../cache/manager';
import * as crypto from 'crypto';

// =============================================================================
// AI服务主类
// =============================================================================

export class AIService {
  private config: AIServiceConfig;
  private loadBalancer: ReturnType<typeof LoadBalancerFactory.getInstance>;
  private monitor: ReturnType<typeof MonitorFactory.getInstance>;
  private fallbackManager: ReturnType<typeof FallbackManagerFactory.getInstance>;
  private cacheManager: typeof cacheManager;
  private clients: Map<AIProvider, any>;
  private initialized: boolean = false;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.clients = new Map();

    // 初始化同步组件
    this.cacheManager = cacheManager;
  }

  // =============================================================================
  // 初始化方法
  // =============================================================================

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 初始化负载均衡器
      this.loadBalancer = LoadBalancerFactory.getInstance('main', this.config.loadBalancer);

      // 初始化监控器
      this.monitor = MonitorFactory.getInstance('main', this.config.monitor);

      // 初始化降级管理器
      this.fallbackManager = FallbackManagerFactory.getInstance('main', this.config.fallback);

      // 初始化AI客户端
      await this.initializeClients();

      this.initialized = true;
      console.log('AI Service initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize AI Service:', error);
      throw error;
    }
  }

  private async initializeClients(): Promise<void> {
    for (const clientConfig of this.config.clients) {
      try {
        const client = await this.createClient(clientConfig);
        this.clients.set(clientConfig.provider, client);
        
        // 记录客户端初始化
        this.monitor.recordHealthCheck(clientConfig.provider, true, 0);
        
      } catch (error) {
        console.error(`Failed to initialize client for ${clientConfig.provider}:`, error);
        
        // 记录初始化失败
        this.monitor.recordHealthCheck(clientConfig.provider, false, 0);
      }
    }
  }

  private async createClient(config: AIClientConfig): Promise<any> {
    // 根据提供商类型创建对应的客户端
    switch (config.provider) {
      case 'zhipu':
        return this.createZhipuClient(config);
      case 'deepseek':
        return this.createDeepSeekClient(config);
      case 'openai':
        return this.createOpenAIClient(config);
      case 'anthropic':
        return this.createAnthropicClient(config);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  private async createZhipuClient(config: AIClientConfig): Promise<any> {
    // 动态导入智谱AI客户端
    try {
      const { ZhipuAI } = await import('zhipuai');
      
      return new ZhipuAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: config.timeout || 30000,
      });
    } catch (error) {
      console.warn('ZhipuAI client not available, using mock client');
      return this.createMockClient('zhipu');
    }
  }

  private async createDeepSeekClient(config: AIClientConfig): Promise<any> {
      // 动态导入DeepSeek客户端
    try {
      const DeepSeek = await import('deepseek-api');
      
      return new DeepSeek.default({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: config.timeout || 30000,
      });
    } catch (error) {
      console.warn('DeepSeek client not available, using mock client');
      return this.createMockClient('deepseek');
    }
  }

  private async createOpenAIClient(config: AIClientConfig): Promise<any> {
    // 动态导入OpenAI客户端
    try {
      const { OpenAI } = await import('openai');
      
      return new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: config.timeout || 30000,
      });
    } catch (error) {
      console.warn('OpenAI client not available, using mock client');
      return this.createMockClient('openai');
    }
  }

  private async createAnthropicClient(config: AIClientConfig): Promise<any> {
    // 动态导入Anthropic客户端
    try {
      const Anthropic = await import('@anthropic-ai/sdk');
      
      return new Anthropic.default({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: config.timeout || 30000,
      });
    } catch (error) {
      console.warn('Anthropic client not available, using mock client');
      return this.createMockClient('anthropic');
    }
  }

  private createMockClient(provider: AIProvider): any {
    // 创建模拟客户端用于开发测试
    return {
      chat: {
        completions: {
          create: async (params: any) => ({
            id: `${provider}_mock_${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model: params.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: `Mock response from ${provider} for: ${params.messages[params.messages.length - 1]?.content || 'unknown'}`,
              },
              finish_reason: 'stop',
              logprobs: null,
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
          }),
        },
      },
      embeddings: {
        create: async (params: any) => ({
          object: 'list',
          data: [{
            object: 'embedding',
            embedding: new Array(1536).fill(0).map(() => Math.random()),
            index: 0,
          }],
          model: params.model,
          usage: {
            prompt_tokens: 10,
            total_tokens: 10,
          },
        }),
      },
    };
  }

  // =============================================================================
  // 主要API方法
  // =============================================================================

  public async chatCompletion(request: AIRequestConfig): Promise<AIResponse> {
    if (!this.initialized) {
      throw new Error('AI Service not initialized');
    }

    // 如果请求中指定了提供商，使用指定的提供商，否则使用负载均衡器选择
    const provider = request.provider || this.loadBalancer.selectProvider();

    const requestId = this.monitor.recordRequest(
      provider,
      request.model
    );

    try {
      // 增加连接计数
      this.loadBalancer.incrementConnections(provider);

      const startTime = Date.now();

      try {
        // 检查缓存
        const cachedResponse = await this.checkCache(request);
        if (cachedResponse) {
          this.monitor.recordResponse(requestId, provider, request.model, true, 0, 0, true);
          this.loadBalancer.decrementConnections(provider);
          return cachedResponse;
        }

        // 执行请求
        const response = await this.executeRequest(provider, request);
        const duration = Date.now() - startTime;

        // 缓存响应
        await this.cacheResponse(request, response);

        // 记录成功指标
        this.monitor.recordResponse(
          requestId, 
          provider, 
          request.model, 
          true, 
          duration, 
          response.usage?.totalTokens || 0,
          false
        );

        // 更新负载均衡器状态
        this.loadBalancer.updateProviderStats(provider, true, duration);
        this.loadBalancer.decrementConnections(provider);

        return response;

      } catch (error) {
        const duration = Date.now() - startTime;
        const aiError = this.createAIError(error as Error, provider);

        // 记录失败指标
        this.monitor.recordResponse(
          requestId, 
          provider, 
          request.model, 
          false, 
          duration, 
          0, 
          false, 
          aiError.type
        );

        // 更新负载均衡器状态
        this.loadBalancer.updateProviderStats(provider, false, duration);
        this.loadBalancer.decrementConnections(provider);

        // 尝试降级处理
        const fallbackResponse = await this.fallbackManager.handleFailure(
          aiError, 
          request, 
          Array.from(this.clients.keys())
        );

        if (fallbackResponse) {
          this.monitor.recordFallbackActivation(provider, 'success');
          return fallbackResponse;
        }

        throw aiError;
      }

    } catch (error) {
      this.monitor.recordResponse(
        requestId, 
        provider, 
        request.model, 
        false, 
        0, 
        0, 
        false, 
        (error as AIError)?.type || 'unknown_error'
      );
      
      throw error;
    }
  }

  // =============================================================================
  // 请求执行方法
  // =============================================================================

  private async executeRequest(provider: AIProvider, request: AIRequestConfig): Promise<AIResponse> {
    const client = this.clients.get(provider);

    if (!client) {
      throw new Error(`No client available for provider: ${provider}`);
    }

    let response;

    try {
      // 根据提供商调用对应的聊天完成接口
      switch (provider) {
        case 'zhipu':
          response = await client.chat.completions.create({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            top_p: request.topP,
            stream: request.stream,
            stop: request.stop,
          });
          break;

        case 'deepseek':
          response = await client.chat.completions.create({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            top_p: request.topP,
            stream: request.stream,
            stop: request.stop,
          });
          break;

        case 'openai':
          response = await client.chat.completions.create({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            top_p: request.topP,
            stream: request.stream,
            stop: request.stop,
          });
          break;

        case 'anthropic':
          response = await client.messages.create({
            model: request.model,
            messages: request.messages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            top_p: request.topP,
            stream: request.stream,
            stop_sequences: request.stop,
          });
          // 转换Anthropic响应格式为标准格式
          response = this.convertAnthropicResponse(response);
          break;

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // 转换为标准AI响应格式
      return this.convertResponse(response, provider);

    } catch (error) {
      throw this.createAIError(error as Error, provider);
    }
  }

  private convertResponse(response: any, provider: AIProvider): AIResponse {
    // 将不同提供商的响应转换为统一格式
    return {
      id: response.id || `${provider}_${Date.now()}`,
      object: response.object || 'chat.completion',
      created: response.created || Date.now(),
      model: response.model,
      choices: response.choices || [{
        index: 0,
        message: response.message || response.content || {
          role: 'assistant',
          content: response.content?.text || response.content,
        },
        finishReason: response.finish_reason || 'stop',
        logprobs: response.logprobs || null,
      }],
      usage: response.usage,
      provider,
      duration: 0, // 将在外部设置
      cached: false,
    };
  }

  private convertAnthropicResponse(response: any): any {
    // 转换Anthropic响应为OpenAI格式
    return {
      id: response.id,
      object: 'chat.completion',
      created: Date.now(),
      model: response.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.content[0]?.text || '',
        },
        finish_reason: response.stop_reason || 'stop',
        logprobs: null,
      }],
      usage: {
        prompt_tokens: response.usage?.input_tokens,
        completion_tokens: response.usage?.output_tokens,
        total_tokens: response.usage?.input_tokens + response.usage?.output_tokens,
      },
    };
  }

  // =============================================================================
  // 缓存方法
  // =============================================================================

  private async checkCache(request: AIRequestConfig): Promise<AIResponse | null> {
    if (!this.cacheManager) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(request);
      const cached = await this.cacheManager.get(cacheKey);

      if (cached) {
        this.monitor.recordCacheHit(this.config.defaultProvider || 'zhipu', cacheKey);
        return cached as AIResponse;
      } else {
        this.monitor.recordCacheMiss(this.config.defaultProvider || 'zhipu', cacheKey);
        return null;
      }
    } catch (error) {
      console.warn('Cache check failed:', error);
      return null;
    }
  }

  private async cacheResponse(request: AIRequestConfig, response: AIResponse): Promise<void> {
    if (!this.cacheManager) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(request);
      const ttl = this.config.fallback?.cacheFallback?.ttl || 3600;
      
      await this.cacheManager.set(cacheKey, response, { ttl: ttl });
    } catch (error) {
      console.warn('Cache storage failed:', error);
    }
  }

  private generateCacheKey(request: AIRequestConfig): string {
    const keyData = {
      model: request.model,
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    };

    // 使用SHA256哈希替代Base64编码，避免长文本导致的键长度问题
    const hash = crypto.createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
    return `ai_chat_${hash}`;
  }

  // =============================================================================
  // 错误处理方法
  // =============================================================================

  private createAIError(error: Error, provider: AIProvider): AIError {
    // 将各种错误转换为标准AI错误格式
    const errorMessage = error.message.toLowerCase();
    let errorType: AIErrorType = 'unknown_error';
    let statusCode: number | undefined;

    if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
      errorType = 'authentication_error';
      statusCode = 401;
    } else if (errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
      errorType = 'permission_error';
      statusCode = 403;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      errorType = 'rate_limit_error';
      statusCode = 429;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timeout')) {
      errorType = 'timeout_error';
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      errorType = 'network_error';
    } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      errorType = 'not_found_error';
      statusCode = 404;
    } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      errorType = 'insufficient_quota';
      statusCode = 402;
    } else if (errorMessage.includes('model') && errorMessage.includes('not available')) {
      errorType = 'model_not_available';
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      errorType = 'validation_error';
      statusCode = 400;
    }

    return {
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message,
      type: errorType,
      provider,
      statusCode,
      timestamp: Date.now(),
      retryable: ['timeout_error', 'network_error', 'rate_limit_error', 'api_error'].includes(errorType),
    };
  }

  // =============================================================================
  // 状态和管理方法
  // =============================================================================

  public getServiceStatus(): ServiceStatus {
    const monitorStatus = this.monitor.getServiceStatus();
    const loadBalancerStatus = this.loadBalancer.getLoadBalancerStatus();

    return {
      initialized: this.initialized,
      healthy: monitorStatus.healthy,
      totalRequests: monitorStatus.totalRequests,
      totalErrors: monitorStatus.totalErrors,
      averageResponseTime: monitorStatus.averageResponseTime,
      uptime: Date.now() - (this.initialized ? Date.now() : 0),
      providerStatus: loadBalancerStatus.providerStats.reduce((acc, stat) => {
        acc[stat.provider] = {
          provider: stat.provider,
          healthy: stat.healthy,
          lastCheck: Date.now(),
          responseTime: stat.averageResponseTime,
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          uptime: Date.now(),
        };
        return acc;
      }, {} as Record<AIProvider, any>),
      lastUpdate: Date.now(),
    };
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // 检查所有组件的健康状态
      const [loadBalancerHealthy, monitorHealthy, fallbackHealthy] = await Promise.allSettled([
        this.checkLoadBalancerHealth(),
        this.checkMonitorHealth(),
        this.fallbackManager.checkFallbackHealth(),
      ]);

      return loadBalancerHealthy.status === 'fulfilled' &&
             monitorHealthy.status === 'fulfilled' &&
             fallbackHealthy.status === 'fulfilled' &&
             loadBalancerHealthy.value &&
             monitorHealthy.value &&
             fallbackHealthy.value;
    } catch {
      return false;
    }
  }

  private async checkLoadBalancerHealth(): Promise<boolean> {
    try {
      const status = this.loadBalancer.getLoadBalancerStatus();
      return status.providerStats.some(stat => stat.healthy);
    } catch {
      return false;
    }
  }

  private async checkMonitorHealth(): Promise<boolean> {
    try {
      const status = this.monitor.getServiceStatus();
      return status.initialized;
    } catch {
      return false;
    }
  }

  // =============================================================================
  // 配置更新方法
  // =============================================================================

  public updateConfig(config: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新各个组件的配置
    if (config.loadBalancer) {
      this.loadBalancer.updateConfig(config.loadBalancer);
    }

    if (config.monitor) {
      this.monitor.updateConfig(config.monitor);
    }

    if (config.fallback) {
      this.fallbackManager.updateConfig(config.fallback);
    }
  }

  // =============================================================================
  // 清理和关闭方法
  // =============================================================================

  public async shutdown(): Promise<void> {
    try {
      // 停止监控
      this.monitor.stop();

      // 清理客户端连接
      this.clients.clear();

      // 清理负载均衡器
      this.loadBalancer.reset();

      this.initialized = false;
      console.log('AI Service shut down successfully');

    } catch (error) {
      console.error('Error during AI Service shutdown:', error);
      throw error;
    }
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  public getAvailableProviders(): AIProvider[] {
    return Array.from(this.clients.keys());
  }

  public isProviderAvailable(provider: AIProvider): boolean {
    return this.clients.has(provider) && this.loadBalancer.isHealthy(provider);
  }

  public getProviderStats(): any {
    return this.loadBalancer.getLoadBalancerStatus();
  }

  public getMetrics(timeWindow?: number): any {
    return this.monitor.getMetrics(undefined, undefined, timeWindow);
  }

  public getFallbackStats(timeWindow?: number): any {
    return this.fallbackManager.getFallbackStats(timeWindow);
  }
}

// =============================================================================
// AI服务工厂
// =============================================================================

export class AIServiceFactory {
  private static instances: Map<string, AIService> = new Map();

  public static async getInstance(name: string = 'default', config?: AIServiceConfig): Promise<AIService> {
    let instance = this.instances.get(name);
    
    if (!instance) {
      if (!config) {
        throw new Error('Configuration is required for first instance creation');
      }

      instance = new AIService(config);
      await instance.initialize(); // 显式调用初始化
      this.instances.set(name, instance);
    }

    return instance;
  }

  public static async createCustomInstance(name: string, config: AIServiceConfig): Promise<AIService> {
    const instance = new AIService(config);
    await instance.initialize(); // 显式调用初始化
    this.instances.set(name, instance);
    return instance;
  }

  public static removeInstance(name: string): boolean {
    const instance = this.instances.get(name);
    if (instance) {
      instance.shutdown();
      return this.instances.delete(name);
    }
    return false;
  }

  public static getAllInstances(): Map<string, AIService> {
    return new Map(this.instances);
  }

  public static async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.instances.values()).map(instance => 
      instance.shutdown().catch(error => console.error('Error shutting down instance:', error))
    );

    await Promise.allSettled(shutdownPromises);
    this.instances.clear();
  }
}

// =============================================================================
// 默认导出
// =============================================================================

export default AIServiceFactory;
