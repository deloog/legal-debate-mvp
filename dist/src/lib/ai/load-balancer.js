"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadBalancerFactory = exports.LoadBalancer = void 0;
// =============================================================================
// 负载均衡器实现
// =============================================================================
class LoadBalancer {
    constructor(config) {
        this.lastHealthCheck = 0;
        this.config = config;
        this.providerStats = new Map();
        this.currentProviderIndex = 0;
        this.healthStatus = new Map();
        // 初始化提供商统计
        this.initializeProviderStats();
    }
    // =============================================================================
    // 初始化方法
    // =============================================================================
    initializeProviderStats() {
        const providers = [
            "zhipu",
            "deepseek",
            "openai",
            "anthropic",
        ];
        providers.forEach((provider) => {
            const weight = this.config.weights?.[provider] || 1;
            // 只初始化权重大于0的提供商
            if (weight > 0) {
                this.providerStats.set(provider, {
                    provider,
                    weight,
                    activeConnections: 0,
                    totalRequests: 0,
                    successfulRequests: 0,
                    failedRequests: 0,
                    averageResponseTime: 0,
                    lastUsed: 0,
                    healthy: true,
                });
                this.healthStatus.set(provider, {
                    provider,
                    healthy: true,
                    lastCheck: Date.now(),
                    responseTime: 0,
                    consecutiveFailures: 0,
                    consecutiveSuccesses: 0,
                    uptime: Date.now(),
                });
            }
        });
    }
    // =============================================================================
    // 负载均衡策略实现
    // =============================================================================
    selectProvider() {
        const healthyProviders = this.getHealthyProviders();
        if (healthyProviders.length === 0) {
            console.warn("No healthy providers available, falling back to all providers");
            return this.getFallbackProvider();
        }
        switch (this.config.strategy) {
            case "round_robin":
                return this.selectRoundRobin(healthyProviders);
            case "weighted_round_robin":
                return this.selectWeightedRoundRobin(healthyProviders);
            case "least_connections":
                return this.selectLeastConnections(healthyProviders);
            case "least_response_time":
                return this.selectLeastResponseTime(healthyProviders);
            case "random":
                return this.selectRandom(healthyProviders);
            case "provider_priority":
                return this.selectByPriority(healthyProviders);
            default:
                return this.selectRoundRobin(healthyProviders);
        }
    }
    getHealthyProviders() {
        const healthyProviders = [];
        this.healthStatus.forEach((health, provider) => {
            if (health.healthy) {
                healthyProviders.push(provider);
            }
        });
        return healthyProviders;
    }
    getFallbackProvider() {
        // 降级策略：返回第一个可用的提供商（权重大于0的）
        const availableProviders = [];
        this.providerStats.forEach((stats, provider) => {
            if (stats.weight > 0) {
                availableProviders.push(provider);
            }
        });
        return availableProviders.length > 0 ? availableProviders[0] : "zhipu";
    }
    selectRoundRobin(providers) {
        if (providers.length === 0)
            return this.getFallbackProvider();
        const provider = providers[this.currentProviderIndex % providers.length];
        this.currentProviderIndex++;
        return provider;
    }
    selectWeightedRoundRobin(providers) {
        if (providers.length === 0)
            return this.getFallbackProvider();
        // 计算总权重
        const totalWeight = providers.reduce((sum, provider) => {
            const stats = this.providerStats.get(provider);
            return sum + (stats?.weight || 1);
        }, 0);
        // 根据权重选择
        let random = Math.random() * totalWeight;
        for (const provider of providers) {
            const stats = this.providerStats.get(provider);
            const weight = stats?.weight || 1;
            if (random <= weight) {
                return provider;
            }
            random -= weight;
        }
        return providers[0];
    }
    selectLeastConnections(providers) {
        if (providers.length === 0)
            return this.getFallbackProvider();
        let leastConnectionsProvider = providers[0];
        let minConnections = Infinity;
        for (const provider of providers) {
            const stats = this.providerStats.get(provider);
            if (stats && stats.activeConnections < minConnections) {
                minConnections = stats.activeConnections;
                leastConnectionsProvider = provider;
            }
        }
        return leastConnectionsProvider;
    }
    selectLeastResponseTime(providers) {
        if (providers.length === 0)
            return this.getFallbackProvider();
        let fastestProvider = providers[0];
        let minResponseTime = Infinity;
        for (const provider of providers) {
            const stats = this.providerStats.get(provider);
            if (stats && stats.averageResponseTime < minResponseTime) {
                minResponseTime = stats.averageResponseTime;
                fastestProvider = provider;
            }
        }
        return fastestProvider;
    }
    selectRandom(providers) {
        if (providers.length === 0)
            return this.getFallbackProvider();
        const randomIndex = Math.floor(Math.random() * providers.length);
        return providers[randomIndex];
    }
    selectByPriority(providers) {
        if (providers.length === 0)
            return this.getFallbackProvider();
        // 预定义的优先级顺序
        const priorityOrder = [
            "zhipu",
            "deepseek",
            "openai",
            "anthropic",
        ];
        for (const provider of priorityOrder) {
            if (providers.includes(provider)) {
                return provider;
            }
        }
        return providers[0];
    }
    // =============================================================================
    // 健康检查和状态管理
    // =============================================================================
    updateProviderHealth(provider, healthy, responseTime) {
        const health = this.healthStatus.get(provider);
        if (!health)
            return;
        const now = Date.now();
        if (healthy !== health.healthy) {
            console.log(`Provider ${provider} health changed from ${health.healthy} to ${healthy}`);
        }
        health.healthy = healthy;
        health.lastCheck = now;
        if (responseTime !== undefined) {
            health.responseTime = responseTime;
        }
        if (healthy) {
            health.consecutiveSuccesses++;
            health.consecutiveFailures = 0;
        }
        else {
            health.consecutiveFailures++;
            health.consecutiveSuccesses = 0;
        }
        // 检查是否需要标记为不健康
        if (health.consecutiveFailures >= this.config.failureThreshold) {
            health.healthy = false;
            console.warn(`Provider ${provider} marked as unhealthy after ${health.consecutiveFailures} failures`);
        }
        // 检查是否需要恢复为健康
        if (!health.healthy &&
            health.consecutiveSuccesses >= this.config.recoveryThreshold) {
            health.healthy = true;
            console.log(`Provider ${provider} recovered and marked as healthy`);
        }
    }
    updateProviderStats(provider, success, responseTime) {
        const stats = this.providerStats.get(provider);
        if (!stats)
            return;
        stats.totalRequests++;
        stats.lastUsed = Date.now();
        if (success) {
            stats.successfulRequests++;
        }
        else {
            stats.failedRequests++;
        }
        // 更新平均响应时间（使用指数移动平均）
        const alpha = 0.1; // 平滑因子
        stats.averageResponseTime =
            alpha * responseTime + (1 - alpha) * stats.averageResponseTime;
    }
    incrementConnections(provider) {
        const stats = this.providerStats.get(provider);
        if (stats) {
            stats.activeConnections++;
        }
    }
    decrementConnections(provider) {
        const stats = this.providerStats.get(provider);
        if (stats && stats.activeConnections > 0) {
            stats.activeConnections--;
        }
    }
    // =============================================================================
    // 状态查询方法
    // =============================================================================
    getLoadBalancerStatus() {
        const providerStats = Array.from(this.providerStats.values());
        const totalRequests = providerStats.reduce((sum, stats) => sum + stats.totalRequests, 0);
        const totalErrors = providerStats.reduce((sum, stats) => sum + stats.failedRequests, 0);
        const averageResponseTime = providerStats.reduce((sum, stats) => sum + stats.averageResponseTime, 0) /
            providerStats.length;
        return {
            strategy: this.config.strategy,
            currentProvider: this.selectProvider(),
            providerStats,
            totalRequests,
            totalErrors,
            averageResponseTime,
        };
    }
    getProviderStats(provider) {
        return this.providerStats.get(provider);
    }
    getHealthStatus(provider) {
        return this.healthStatus.get(provider);
    }
    getAllHealthStatus() {
        return new Map(this.healthStatus);
    }
    isHealthy(provider) {
        const health = this.healthStatus.get(provider);
        return health?.healthy ?? false;
    }
    // =============================================================================
    // 配置更新
    // =============================================================================
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        // 如果权重更新，重新设置提供商统计中的权重
        if (config.weights) {
            for (const [provider, weight] of Object.entries(config.weights)) {
                const stats = this.providerStats.get(provider);
                if (stats) {
                    stats.weight = weight;
                }
            }
        }
    }
    getConfig() {
        return { ...this.config };
    }
    // =============================================================================
    // 重置和清理
    // =============================================================================
    reset() {
        this.initializeProviderStats();
        this.currentProviderIndex = 0;
        this.lastHealthCheck = 0;
    }
    resetProviderStats(provider) {
        const stats = this.providerStats.get(provider);
        if (stats) {
            stats.totalRequests = 0;
            stats.successfulRequests = 0;
            stats.failedRequests = 0;
            stats.averageResponseTime = 0;
            stats.activeConnections = 0;
        }
    }
}
exports.LoadBalancer = LoadBalancer;
// =============================================================================
// 负载均衡器工厂
// =============================================================================
class LoadBalancerFactory {
    static getInstance(name = "default", config) {
        let instance = this.instances.get(name);
        if (!instance) {
            const defaultConfig = {
                strategy: "weighted_round_robin",
                healthCheckInterval: 30000, // 30秒
                healthCheckTimeout: 5000, // 5秒
                failureThreshold: 3, // 连续失败3次标记为不健康
                recoveryThreshold: 2, // 连续成功2次恢复健康
                weights: {
                    zhipu: 2,
                    deepseek: 1,
                    openai: 0, // 设置为0，表示不可用
                    anthropic: 0, // 设置为0，表示不可用
                },
            };
            const finalConfig = { ...defaultConfig, ...config };
            instance = new LoadBalancer(finalConfig);
            this.instances.set(name, instance);
        }
        return instance;
    }
    static createCustomInstance(name, config) {
        const instance = new LoadBalancer(config);
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
exports.LoadBalancerFactory = LoadBalancerFactory;
LoadBalancerFactory.instances = new Map();
// =============================================================================
// 默认导出
// =============================================================================
exports.default = LoadBalancerFactory;
