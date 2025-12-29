// Agent依赖注入容器

import type { Agent } from "../../types/agent";
import { AgentType } from "../../types/agent";

// =============================================================================
// 依赖注入容器接口
// =============================================================================

// 依赖提供者类型
export type DependencyProvider<T = any> = T | (() => T);

// 依赖工厂函数
export type DependencyFactory<T = any> = (...args: any[]) => T;

// 依赖注册信息
interface DependencyRegistration {
  provider: DependencyProvider;
  singleton: boolean;
  instance?: any;
  factory?: DependencyFactory;
}

// Agent创建配置
export interface AgentCreationConfig {
  // 依赖注入
  dependencies?: Record<string, any>;

  // 构造函数参数
  constructorArgs?: any[];

  // 配置选项
  options?: Record<string, any>;

  // 生命周期管理
  initialize?: boolean;
  cleanup?: boolean;

  // 注册者信息
  updatedBy?: string;
}

// =============================================================================
// 依赖注入容器类
// =============================================================================

export class AgentDIContainer {
  private dependencies = new Map<string, DependencyRegistration>();
  private agentConfigs = new Map<string, AgentCreationConfig>();

  // 单例模式
  private static instance: AgentDIContainer;
  public static getInstance(): AgentDIContainer {
    if (!AgentDIContainer.instance) {
      AgentDIContainer.instance = new AgentDIContainer();
    }
    return AgentDIContainer.instance;
  }

  private constructor() {}

  // =============================================================================
  // 依赖管理
  // =============================================================================

  /**
   * 注册依赖
   */
  public register<T>(
    token: string,
    provider: DependencyProvider<T>,
    singleton: boolean = true,
  ): void {
    this.dependencies.set(token, {
      provider,
      singleton,
      instance: undefined,
      factory: undefined,
    });
  }

  /**
   * 注册工厂函数
   */
  public registerFactory<T>(
    token: string,
    factory: DependencyFactory<T>,
    singleton: boolean = false,
  ): void {
    this.dependencies.set(token, {
      provider: undefined,
      singleton,
      instance: undefined,
      factory,
    });
  }

  /**
   * 注册Agent配置
   */
  public registerAgentConfig(
    agentName: string,
    config: AgentCreationConfig,
  ): void {
    this.agentConfigs.set(agentName, config);
  }

  /**
   * 解析依赖
   */
  public resolve<T>(token: string): T {
    const registration = this.dependencies.get(token);
    if (!registration) {
      throw new Error(`Dependency '${token}' not found`);
    }

    // 单例模式
    if (registration.singleton && registration.instance !== undefined) {
      return registration.instance;
    }

    // 创建实例
    let instance: T;

    if (registration.factory) {
      instance = registration.factory();
    } else if (registration.provider) {
      instance =
        typeof registration.provider === "function"
          ? (registration.provider as () => T)()
          : registration.provider;
    } else {
      throw new Error(`Invalid provider for dependency '${token}'`);
    }

    // 单例模式缓存实例
    if (registration.singleton) {
      registration.instance = instance;
    }

    return instance;
  }

  /**
   * 尝试解析依赖（不抛出异常）
   */
  public tryResolve<T>(token: string): T | undefined {
    try {
      return this.resolve<T>(token);
    } catch {
      return undefined;
    }
  }

  /**
   * 检查依赖是否存在
   */
  public has(token: string): boolean {
    return this.dependencies.has(token);
  }

  /**
   * 移除依赖
   */
  public remove(token: string): boolean {
    const registration = this.dependencies.get(token);
    if (
      registration?.instance &&
      typeof registration.instance.cleanup === "function"
    ) {
      registration.instance.cleanup();
    }
    return this.dependencies.delete(token);
  }

  /**
   * 获取Agent配置
   */
  public getAgentConfig(agentName: string): AgentCreationConfig | undefined {
    return this.agentConfigs.get(agentName);
  }

  // =============================================================================
  // Agent创建支持
  // =============================================================================

  /**
   * 创建Agent实例
   */
  public createAgent<T extends Agent>(
    agentClass: new (...args: any[]) => T,
    agentName: string,
  ): T {
    const config = this.getAgentConfig(agentName) || {};

    // 准备构造函数参数 - agentName始终是第一个参数
    const constructorArgs = [agentName, ...this.prepareConstructorArgs(config)];

    // 创建实例
    const instance = new agentClass(...constructorArgs);

    // 注入配置
    if (config.options) {
      if (typeof instance.configure === "function") {
        instance.configure(config.options);
      }
    }

    // 初始化
    if (
      config.initialize !== false &&
      typeof instance.initialize === "function"
    ) {
      instance.initialize();
    }

    return instance;
  }

  /**
   * 准备构造函数参数
   */
  private prepareConstructorArgs(config: AgentCreationConfig): any[] {
    const args: any[] = [];

    // 使用预定义的构造函数参数
    if (config.constructorArgs) {
      args.push(...config.constructorArgs);
    }

    // 使用依赖注入
    if (config.dependencies) {
      for (const [paramName, dependencyToken] of Object.entries(
        config.dependencies,
      )) {
        const dependency = this.resolve(dependencyToken);
        args.push(dependency);
      }
    }

    return args;
  }

  // =============================================================================
  // 批量操作
  // =============================================================================

  /**
   * 批量创建Agent
   */
  public createAgents<T extends Agent>(
    agentClass: new (...args: any[]) => T,
    agentNames: string[],
  ): T[] {
    const agents: T[] = [];
    const errors: string[] = [];

    for (const agentName of agentNames) {
      try {
        const agent = this.createAgent(agentClass, agentName);
        agents.push(agent);
      } catch (error) {
        errors.push(`Failed to create agent '${agentName}': ${error}`);
      }
    }

    if (errors.length > 0) {
      console.warn("Batch agent creation errors:", errors);
    }

    return agents;
  }

  /**
   * 清空容器
   */
  public clear(): void {
    // 清理所有单例实例
    for (const [token, registration] of this.dependencies.entries()) {
      if (registration.singleton && registration.instance) {
        if (typeof registration.instance.cleanup === "function") {
          registration.instance.cleanup();
        }
      }
    }

    this.dependencies.clear();
    this.agentConfigs.clear();
  }

  // =============================================================================
  // 诊断信息
  // =============================================================================

  /**
   * 获取容器诊断信息
   */
  public getDiagnostics(): {
    timestamp: number;
    dependencies: Array<{
      token: string;
      singleton: boolean;
      hasInstance: boolean;
    }>;
    agentConfigs: Array<{
      agentName: string;
      hasDependencies: boolean;
      hasOptions: boolean;
    }>;
  } {
    const dependencies = Array.from(this.dependencies.entries()).map(
      ([token, registration]) => ({
        token,
        singleton: registration.singleton,
        hasInstance: registration.instance !== undefined,
      }),
    );

    const agentConfigs = Array.from(this.agentConfigs.entries()).map(
      ([agentName, config]) => ({
        agentName,
        hasDependencies:
          config.dependencies && Object.keys(config.dependencies).length > 0,
        hasOptions: config.options && Object.keys(config.options).length > 0,
      }),
    );

    return {
      timestamp: Date.now(),
      dependencies,
      agentConfigs,
    };
  }

  /**
   * 获取统计信息
   */
  public getStatistics(): {
    totalDependencies: number;
    singletonDependencies: number;
    agentConfigs: number;
  } {
    let singletonCount = 0;

    for (const registration of this.dependencies.values()) {
      if (registration.singleton) {
        singletonCount++;
      }
    }

    return {
      totalDependencies: this.dependencies.size,
      singletonDependencies: singletonCount,
      agentConfigs: this.agentConfigs.size,
    };
  }
}

// =============================================================================
// 导出单例实例
// =============================================================================

export const diContainer = AgentDIContainer.getInstance();

// =============================================================================
// 常用依赖令牌
// =============================================================================

export const DEPENDENCY_TOKENS = {
  // 数据库相关
  DATABASE: "database",
  CACHE: "cache",
  LOGGER: "logger",

  // AI服务相关
  AI_SERVICE: "aiService",
  AI_CLIENT: "aiClient",

  // 配置相关
  CONFIG: "config",
  ENVIRONMENT: "environment",

  // 工具相关
  METRICS: "metrics",
  MONITOR: "monitor",

  // Agent相关
  AGENT_REGISTRY: "agentRegistry",
} as const;
