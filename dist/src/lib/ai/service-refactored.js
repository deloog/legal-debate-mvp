"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIServiceFactory = exports.AIService = void 0;
const load_balancer_1 = require("./load-balancer");
const monitor_1 = require("./monitor");
const fallback_1 = require("./fallback");
const client_factory_1 = require("./client-factory");
const cache_manager_1 = require("./cache-manager");
const request_executor_1 = require("./request-executor");
const error_serializer_1 = __importDefault(require("./error-serializer"));
// =============================================================================
// 重构后的AI服务主类
// =============================================================================
class AIService {
    constructor(config) {
        this.initialized = false;
        this.config = config;
        this.clients = new Map();
        this.cacheManager = new cache_manager_1.AICacheManager();
    }
    // =============================================================================
    // 初始化方法
    // =============================================================================
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // 初始化组件
            this.loadBalancer = load_balancer_1.LoadBalancerFactory.getInstance("main", this.config.loadBalancer);
            this.monitor = monitor_1.MonitorFactory.getInstance("main", this.config.monitor);
            this.fallbackManager = fallback_1.FallbackManagerFactory.getInstance("main", this.config.fallback);
            // 初始化AI客户端
            await this.initializeClients();
            // 初始化请求执行器
            this.requestExecutor = new request_executor_1.AIRequestExecutor(this.clients);
            this.initialized = true;
            console.log("AI Service initialized successfully");
        }
        catch (error) {
            console.error("Failed to initialize AI Service:", error);
            throw error;
        }
    }
    async initializeClients() {
        for (const clientConfig of this.config.clients) {
            try {
                const client = await client_factory_1.AIClientFactory.createClient(clientConfig);
                this.clients.set(clientConfig.provider, client);
                // 记录客户端初始化
                this.monitor.recordHealthCheck(clientConfig.provider, true, 0);
            }
            catch (error) {
                console.error(`Failed to initialize client for ${clientConfig.provider}:`, error);
                // 记录初始化失败
                this.monitor.recordHealthCheck(clientConfig.provider, false, 0);
            }
        }
    }
    // =============================================================================
    // 主要API方法
    // =============================================================================
    async chatCompletion(request) {
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
                    this.monitor.recordResponse(requestId, provider, request.model, true, 0, 0, true);
                    this.loadBalancer.decrementConnections(provider);
                    return cachedResponse;
                }
                // 执行请求
                const response = await this.requestExecutor.executeRequest(provider, request);
                const duration = Date.now() - startTime;
                response.duration = duration;
                // 缓存响应
                await this.cacheManager.cacheResponse(request, response, this.config.fallback?.cacheFallback?.ttl);
                // 记录成功指标
                this.monitor.recordResponse(requestId, provider, request.model, true, duration, response.usage?.totalTokens || 0, false);
                // 更新负载均衡器状态
                this.loadBalancer.updateProviderStats(provider, true, duration);
                this.loadBalancer.decrementConnections(provider);
                return response;
            }
            catch (error) {
                const duration = Date.now() - startTime;
                const aiError = this.createAIError(error, provider);
                // 记录失败指标
                this.monitor.recordResponse(requestId, provider, request.model, false, duration, 0, false, aiError.type);
                // 更新负载均衡器状态
                this.loadBalancer.updateProviderStats(provider, false, duration);
                this.loadBalancer.decrementConnections(provider);
                // 尝试降级处理
                const fallbackResponse = await this.fallbackManager.handleFailure(aiError, request, Array.from(this.clients.keys()));
                if (fallbackResponse) {
                    this.monitor.recordFallbackActivation(provider, "success");
                    return fallbackResponse;
                }
                throw aiError;
            }
        }
        catch (error) {
            this.monitor.recordResponse(requestId, provider, request.model, false, 0, 0, false, error?.type || "unknown_error");
            throw error;
        }
    }
    // =============================================================================
    // 错误处理方法
    // =============================================================================
    createAIError(error, provider) {
        // 使用错误序列化器标准化错误对象
        const serializedError = error_serializer_1.default.serialize(error, {
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
    getServiceStatus() {
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
            }, {}),
            lastUpdate: Date.now(),
        };
    }
    async healthCheck() {
        try {
            // 检查所有组件的健康状态
            const [loadBalancerHealthy, monitorHealthy, fallbackHealthy] = await Promise.allSettled([
                this.checkLoadBalancerHealth(),
                this.checkMonitorHealth(),
                this.fallbackManager.checkFallbackHealth(),
            ]);
            return (loadBalancerHealthy.status === "fulfilled" &&
                monitorHealthy.status === "fulfilled" &&
                fallbackHealthy.status === "fulfilled" &&
                loadBalancerHealthy.value &&
                monitorHealthy.value &&
                fallbackHealthy.value);
        }
        catch {
            return false;
        }
    }
    async checkLoadBalancerHealth() {
        try {
            const status = this.loadBalancer.getLoadBalancerStatus();
            return status.providerStats.some((stat) => stat.healthy);
        }
        catch {
            return false;
        }
    }
    async checkMonitorHealth() {
        try {
            const status = this.monitor.getServiceStatus();
            return status.initialized;
        }
        catch {
            return false;
        }
    }
    // =============================================================================
    // 配置更新方法
    // =============================================================================
    updateConfig(config) {
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
    async shutdown() {
        try {
            // 停止监控
            this.monitor.stop();
            // 清理客户端连接
            this.clients.clear();
            // 清理负载均衡器
            this.loadBalancer.reset();
            this.initialized = false;
            console.log("AI Service shut down successfully");
        }
        catch (error) {
            console.error("Error during AI Service shutdown:", error);
            throw error;
        }
    }
    // =============================================================================
    // 工具方法
    // =============================================================================
    getAvailableProviders() {
        return this.requestExecutor.getAvailableProviders();
    }
    isProviderAvailable(provider) {
        return this.requestExecutor.isProviderAvailable(provider) &&
            this.loadBalancer.isHealthy(provider);
    }
    getProviderStats() {
        return this.loadBalancer.getLoadBalancerStatus();
    }
    getMetrics(timeWindow) {
        return this.monitor.getMetrics(undefined, undefined, timeWindow);
    }
    getFallbackStats(timeWindow) {
        return this.fallbackManager.getFallbackStats(timeWindow);
    }
    // =============================================================================
    // 错误序列化工具方法
    // =============================================================================
    /**
     * 序列化错误为JSON字符串
     */
    serializeError(error, context) {
        return error_serializer_1.default.serializeToJson(error, context, {
            sanitizeSensitiveInfo: true,
            includeStackTrace: false,
            maxMessageLength: 500,
        });
    }
    /**
     * 创建用户友好的错误消息
     */
    createUserFriendlyError(error, locale = "zh-CN") {
        const serializedError = error_serializer_1.default.serialize(error, undefined, {
            sanitizeSensitiveInfo: true,
        });
        return error_serializer_1.default.createUserFriendlyMessage(serializedError, locale);
    }
    /**
     * 生成错误摘要
     */
    generateErrorSummary(errors) {
        const serializedErrors = errors.map((error) => error_serializer_1.default.serialize(error, undefined, {
            sanitizeSensitiveInfo: true,
        }));
        return error_serializer_1.default.generateSummary(serializedErrors);
    }
}
exports.AIService = AIService;
// =============================================================================
// AI服务工厂
// =============================================================================
class AIServiceFactory {
    static async getInstance(name = "default", config) {
        let instance = this.instances.get(name);
        if (!instance) {
            if (!config) {
                throw new Error("Configuration is required for first instance creation");
            }
            instance = new AIService(config);
            await instance.initialize();
            this.instances.set(name, instance);
        }
        return instance;
    }
    static async createCustomInstance(name, config) {
        const instance = new AIService(config);
        await instance.initialize();
        this.instances.set(name, instance);
        return instance;
    }
    static removeInstance(name) {
        const instance = this.instances.get(name);
        if (instance) {
            instance.shutdown();
            return this.instances.delete(name);
        }
        return false;
    }
    static getAllInstances() {
        return new Map(this.instances);
    }
    static async shutdownAll() {
        const shutdownPromises = Array.from(this.instances.values()).map((instance) => instance
            .shutdown()
            .catch((error) => console.error("Error shutting down instance:", error)));
        await Promise.allSettled(shutdownPromises);
        this.instances.clear();
    }
}
exports.AIServiceFactory = AIServiceFactory;
AIServiceFactory.instances = new Map();
// =============================================================================
// 默认导出
// =============================================================================
exports.default = AIServiceFactory;
