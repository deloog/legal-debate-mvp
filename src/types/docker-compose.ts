/**
 * Docker Compose 配置类型定义
 */

/**
 * Docker Compose 服务定义
 */
export interface DockerComposeService {
  image?: string;
  build?: DockerComposeBuildConfig;
  container_name?: string;
  restart?: string;
  environment?: Record<string, string | undefined>;
  ports?: string[];
  volumes?: string[];
  healthcheck?: DockerHealthCheck;
  depends_on?: Record<string, DockerDependencyCondition>;
  networks?: string[];
  command?: string[] | string;
  deploy?: DockerDeployConfig;
  logging?: DockerLoggingConfig;
}

/**
 * Docker Compose 构建配置
 */
export interface DockerComposeBuildConfig {
  context: string;
  dockerfile: string;
}

/**
 * Docker 健康检查配置
 */
export interface DockerHealthCheck {
  test: string[];
  interval: string;
  timeout: string;
  retries: number;
  start_period?: string;
}

/**
 * Docker 依赖条件
 */
export interface DockerDependencyCondition {
  condition: string;
}

/**
 * Docker 部署配置
 */
export interface DockerDeployConfig {
  resources?: DockerResources;
  restart_policy?: DockerRestartPolicy;
}

/**
 * Docker 资源限制
 */
export interface DockerResources {
  limits?: DockerResourceLimit;
  reservations?: DockerResourceLimit;
}

/**
 * Docker 资源限制配置
 */
export interface DockerResourceLimit {
  cpus: string;
  memory: string;
}

/**
 * Docker 重启策略
 */
export interface DockerRestartPolicy {
  condition: string;
  delay: string;
  max_attempts: number;
  window: string;
}

/**
 * Docker 日志配置
 */
export interface DockerLoggingConfig {
  driver: string;
  options: {
    'max-size': string;
    'max-file': string;
  };
}

/**
 * Docker 网络配置
 */
export interface DockerComposeNetwork {
  driver: string;
}

/**
 * Docker 数据卷配置
 */
export interface DockerComposeVolume {
  driver: string;
}

/**
 * Docker Compose 配置
 */
export interface DockerComposeConfig {
  version: string;
  services: Record<string, DockerComposeService>;
  networks?: Record<string, DockerComposeNetwork>;
  volumes?: Record<string, DockerComposeVolume>;
}

/**
 * Docker Compose 环境配置
 */
export interface DockerComposeEnvironment {
  // PostgreSQL 配置
  POSTGRES_DB?: string;
  POSTGRES_USER?: string;
  POSTGRES_PASSWORD?: string;
  POSTGRES_PORT?: string;

  // Redis 配置
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  REDIS_TLS?: string;

  // 应用配置
  NODE_ENV?: string;
  APP_PORT?: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;
  BCRYPT_SALT_ROUNDS?: string;
  USE_REAL_AI?: string;

  // AI 服务配置
  ZHIPU_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

/**
 * Docker Compose 验证结果
 */
export interface DockerComposeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
