/**
 * 健康检查相关类型定义
 */

/**
 * 健康状态
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * 服务健康检查结果
 */
export interface ServiceHealth {
  status: HealthStatus;
  responseTime?: number;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * 数据库健康检查结果
 */
export interface DatabaseHealth extends ServiceHealth {
  connectionInfo?: {
    activeConnections: number;
    totalConnections?: number;
  };
}

/**
 * AI服务健康检查结果
 */
export interface AIServiceHealth extends ServiceHealth {
  providers: Array<{
    provider: string;
    status: HealthStatus;
    responseTime?: number;
    lastCheck: number;
  }>;
  availableProviders: string[];
  availableModels?: string[];
}

/**
 * Redis健康检查结果
 */
export interface RedisHealth extends ServiceHealth {
  connected?: boolean;
  pingResponseTime?: number;
}

/**
 * 系统健康信息
 */
export interface SystemHealth {
  uptime: number;
  memory: {
    used: number;
    total: number;
    rss: number;
    external: number;
  };
  cpu: {
    usage: number;
  };
  nodeVersion: string;
  platform: string;
  arch: string;
  environment: string;
}

/**
 * 健康检查响应
 */
export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  services: {
    database: DatabaseHealth;
    ai: AIServiceHealth;
    redis?: RedisHealth;
  };
  system: SystemHealth;
  meta: {
    status: HealthStatus;
    timestamp: string;
    version: string;
  };
}

/**
 * 依赖服务检查响应
 */
export interface DependenciesCheckResponse {
  status: HealthStatus;
  timestamp: string;
  dependencies: {
    database: DatabaseHealth;
    ai: AIServiceHealth;
    redis?: RedisHealth;
  };
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  meta: {
    status: HealthStatus;
    timestamp: string;
    version: string;
  };
}

/**
 * 健康检查选项
 */
export interface HealthCheckOptions {
  includeSystemInfo?: boolean;
  includeConnectionInfo?: boolean;
  timeout?: number;
}
