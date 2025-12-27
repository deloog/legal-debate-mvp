import type {
  AIProvider,
  AIServiceConfig,
  AIRequestConfig,
  AIResponse,
  AIError,
  ServiceStatus,
  AIClientConfig,
} from "../../types/ai-service";

import { LoadBalancerFactory } from "./load-balancer";
import { MonitorFactory } from "./monitor";
import { FallbackManagerFactory } from "./fallback";
import { AIClientFactory } from "./client-factory";
import { AICacheManager } from "./cache-manager";
import { AIRequestExecutor } from "./request-executor";
import AIErrorSerializer from "./error-serializer";

// =============================================================================
// 重构后的AI服务主类
// =============================================================================

export class AIService {
  private config: AIServiceConfig;
  private loadBalancer: ReturnType<typeof LoadBalancerFactory.getInstance>;
  private monitor: ReturnType<typeof MonitorFactory.getInstance>;
  private fallbackManager: ReturnType<
    typeof FallbackManagerFactory.getInstance
  >;
  private cacheManager: AICacheManager;
  private requestExecutor: AIRequestExecutor;
  private clients: Map<AIProvider, any>;
  private initialized: boolean = false;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.clients = new Map();
    this.cacheManager = new AICacheManager();
  }

  // =============================================================================
  // 初始化方法
  // =============================================================================

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 初始化组件
      this.loadBalancer = LoadBalancerFactory.getInstance(
        "main",
        this.config.loadBalancer,
      );
      this.monitor = MonitorFactory.getInstance("main", this.config.monitor);
      this.fallbackManager = FallbackManagerFactory.getInstance(
        "main",
        this.config.fallback,
      );

      // 初始化AI客户端
      await this.initializeClients();

      // 初始化请求执行器
      this.requestExecutor = new AIRequestExecutor(this.clients);

      this.initialized = true;
      console.log("AI Service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize AI Service:", error);
      throw error;
    }
  }

  private async initializeClients(): Promise<void> {
    for (const clientConfig of this.config.clients) {
      try {
        const client = await AIClientFactory.createClient(clientConfig);
        this.clients.set(clientConfig.provider, client);

        // 记录客户端初始化
        this.monitor.recordHealthCheck(clientConfig.provider, true, 0);
      } catch (error) {
        console.error(
          `Failed to initialize client for ${clientConfig.provider}:`,
          error,
        );

        // 记录初始化失败
        this.monitor.recordHealthCheck(clientConfig.provider, false, 0);
      }
    }
  }

  // =============================================================================
  // 主要API方法
  // =============================================================================

  public async chatCompletion(request: AIRequestConfig): Promise<AIResponse> {
    if (!this.initialized) {
      throw new Error("AI Service not initialized");
    }

    // 如果请求中指定了提供商，使用指定的提供商，否则使用负载均衡器选择
    const provider = request.provider || this.loadBalancer.selectProvider();

    const requestId = this.monitor.recordRequest(provider, request.model);

    try {
      // 增加连接计数
      this.loadBalancer.incrementConnections(provider);

      const startTime = Date.now();

      try {
        // 检查缓存
        const cachedResponse = await this.cacheManager.checkCache(request);
        if (cachedResponse) {
          this.monitor.recordResponse(
            requestId,
            provider,
            request.model,
            true,
            0,
            0,
            true,
          );
          this.loadBalancer.decrementConnections(provider);
          return cachedResponse;
        }

        // 执行请求
        const response = await this.requestExecutor.executeRequest(
          provider,
          request,
        );
        const duration = Date.now() - startTime;
        response.duration = duration;

        // 缓存响应
        await this.cacheManager.cacheResponse(
          request,
          response,
          this.config.fallback?.cacheFallback?.ttl,
        );

        // 记录成功指标
        this.monitor.recordResponse(
          requestId,
          provider,
          request.model,
          true,
          duration,
          response.usage?.totalTokens || 0,
          false,
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
          aiError.type,
        );

        // 更新负载均衡器状态
        this.loadBalancer.updateProviderStats(provider, false, duration);
        this.loadBalancer.decrementConnections(provider);

        // 尝试降级处理
        const fallbackResponse = await this.fallbackManager.handleFailure(
          aiError,
          request,
          Array.from(this.clients.keys()),
        );

        if (fallbackResponse) {
          this.monitor.recordFallbackActivation(provider, "success");
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
        (error as AIError)?.type || "unknown_error",
      );

      throw error;
    }
  }

  // =============================================================================
  // 错误处理方法
  // =============================================================================

  private createAIError(error: Error, provider: AIProvider): AIError {
    // 使用错误序列化器标准化错误对象
    const serializedError = AIErrorSerializer.serialize(error, {
      provider,
      timestamp: Date.now(),
    });

    return {
      code: serializedError.code,
      message: serializedError.message,
      type: serializedError.type,
      provider,
      statusCode: serializedError.statusCode,
      timestamp: serializedError.timestamp,
      retryable: serializedError.retryable,
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
      providerStatus: loadBalancerStatus.providerStats.reduce(
        (acc, stat) => {
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
        },
        {} as Record<AIProvider, any>,
      ),
      lastUpdate: Date.now(),
    };
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // 检查所有组件的健康状态
      const [loadBalancerHealthy, monitorHealthy, fallbackHealthy] =
        await Promise.allSettled([
          this.checkLoadBalancerHealth(),
          this.checkMonitorHealth(),
          this.fallbackManager.checkFallbackHealth(),
        ]);

      return (
        loadBalancerHealthy.status === "fulfilled" &&
        monitorHealthy.status === "fulfilled" &&
        fallbackHealthy.status === "fulfilled" &&
        loadBalancerHealthy.value &&
        monitorHealthy.value &&
        fallbackHealthy.value
      );
    } catch {
      return false;
    }
  }

  private async checkLoadBalancerHealth(): Promise<boolean> {
    try {
      const status = this.loadBalancer.getLoadBalancerStatus();
      return status.providerStats.some((stat) => stat.healthy);
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
      console.log("AI Service shut down successfully");
    } catch (error) {
      console.error("Error during AI Service shutdown:", error);
      throw error;
    }
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  public getAvailableProviders(): AIProvider[] {
    return this.requestExecutor.getAvailableProviders();
  }

  public isProviderAvailable(provider: AIProvider): boolean {
    return this.requestExecutor.isProviderAvailable(provider) &&
           this.loadBalancer.isHealthy(provider);
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

  // =============================================================================
  // 错误序列化工具方法
  // =============================================================================

  /**
   * 序列化错误为JSON字符串
   */
  public serializeError(
    error: AIError | Error | unknown,
    context?: any,
  ): string {
    return AIErrorSerializer.serializeToJson(error, context, {
      sanitizeSensitiveInfo: true,
      includeStackTrace: false,
      maxMessageLength: 500,
    });
  }

  /**
   * 创建用户友好的错误消息
   */
  public createUserFriendlyError(
    error: AIError | Error | unknown,
    locale: string = "zh-CN",
  ): string {
    const serializedError = AIErrorSerializer.serialize(error, undefined, {
      sanitizeSensitiveInfo: true,
    });
    return AIErrorSerializer.createUserFriendlyMessage(serializedError, locale);
  }

  /**
   * 生成错误摘要
   */
  public generateErrorSummary(errors: (AIError | Error | unknown)[]): any {
    const serializedErrors = errors.map((error) =>
      AIErrorSerializer.serialize(error, undefined, {
        sanitizeSensitiveInfo: true,
      }),
    );
    return AIErrorSerializer.generateSummary(serializedErrors);
  }
}

// =============================================================================
// AI服务工厂
// =============================================================================

export class AIServiceFactory {
  private static instances: Map<string, AIService> = new Map();

  public static async getInstance(
    name: string = "default",
    config?: AIServiceConfig,
  ): Promise<AIService> {
    let instance = this.instances.get(name);

    if (!instance) {
      if (!config) {
        throw new Error(
          "Configuration is required for first instance creation",
        );
      }

      instance = new AIService(config);
      await instance.initialize();
      this.instances.set(name, instance);
    }

    return instance;
  }

  public static async createCustomInstance(
    name: string,
    config: AIServiceConfig,
  ): Promise<AIService> {
    const instance = new AIService(config);
    await instance.initialize();
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
    const shutdownPromises = Array.from(this.instances.values()).map(
      (instance) =>
        instance
          .shutdown()
          .catch((error) =>
            console.error("Error shutting down instance:", error),
          ),
    );

    await Promise.allSettled(shutdownPromises);
    this.instances.clear();
  }
}

// =============================================================================
// 默认导出
// =============================================================================

export default AIServiceFactory;
