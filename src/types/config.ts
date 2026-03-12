/**
 * 配置类型定义
 * 用于类型安全的配置管理
 */

/**
 * 环境类型
 */
export enum Environment {
  DEVELOPMENT = 'development',
  TEST = 'test',
  PRODUCTION = 'production',
}

/**
 * 日志级别
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  url: string;
  poolMin: number;
  poolMax: number;
  idleTimeout: number;
  connectTimeout: number;
}

/**
 * Redis配置
 */
export interface RedisConfig {
  url: string;
  maxRetries: number;
  connectTimeout: number;
  idleTimeout: number;
  maxRetriesPerRequest: number;
  enableOfflineQueue: boolean;
  persistenceMode?: 'aof' | 'rdb' | 'off';
  aofFsyncEverySec?: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  defaultTTL: number;
  sessionTTL: number;
  configTTL: number;
  keyPrefix: string;
  maxSize?: number;
  updateAgeOnGet?: boolean;
}

/**
 * 认证配置
 */
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptSaltRounds: number;
}

/**
 * AI服务配置
 */
export interface AIServiceConfig {
  useRealAI: boolean;
  zhipu?: {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    rateLimit: number;
  };
  deepseek?: {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    rateLimit: number;
  };
  openai?: {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    rateLimit: number;
  };
  anthropic?: {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    rateLimit: number;
  };
  timeout: number;
  retryCount: number;
  retryDelay: number;
}

/**
 * 法律之星API配置
 */
export interface LawstarConfig {
  regulation: {
    baseUrl: string;
    appId: string;
    appSecret: string;
    rateLimit: number;
  };
  vector: {
    baseUrl: string;
    appId: string;
    appSecret: string;
    rateLimit: number;
  };
}

/**
 * 微信支付配置
 */
export interface WechatPayConfig {
  appId: string;
  mchId: string;
  apiKey: string;
  apiV3Key: string;
  serialNo: string;
  certPath: string;
  notifyUrl: string;
  sandbox: boolean;
}

/**
 * 支付宝配置
 */
export interface AlipayConfig {
  appId: string;
  privateKey: string;
  publicKey: string;
  notifyUrl: string;
  sandbox: boolean;
}

/**
 * 支付系统配置
 */
export interface PaymentConfig {
  wechat: WechatPayConfig;
  alipay: AlipayConfig;
  timeout: number;
  retryCount: number;
  successCallbackAttempts: number;
}

/**
 * 会员价格配置
 */
export interface MembershipPriceConfig {
  free: number;
  basic: number;
  professional: number;
  enterprise: number;
}

/**
 * 会员折扣配置
 */
export interface MembershipDiscountConfig {
  quarterly: number;
  yearly: number;
}

/**
 * 会员系统配置
 */
export interface MembershipConfig {
  prices: MembershipPriceConfig;
  discounts: MembershipDiscountConfig;
  orderExpireHours: number;
  retryPaymentCount: number;
}

/**
 * Next.js配置
 */
export interface NextjsConfig {
  authUrl: string;
  secret: string;
  apiUrl: string;
  appUrl: string;
  appName: string;
  appDescription: string;
}

/**
 * CORS配置
 */
export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * Rate Limiting配置
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
}

/**
 * 安全头配置
 */
export interface SecurityHeadersConfig {
  contentSecurityPolicy: string;
  hstsMaxAge: number;
  xFrameOptions: string;
  xContentTypeOptions: string;
}

/**
 * 安全配置
 */
export interface SecurityConfig {
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  headers: SecurityHeadersConfig;
}

/**
 * Winston日志配置
 */
export interface WinstonConfig {
  level: LogLevel;
  fileMaxSize: string;
  fileMaxFiles: string;
  datePattern: string;
  format: string;
  path: string;
}

/**
 * Prometheus配置
 */
export interface PrometheusConfig {
  enabled: boolean;
  port: number;
  metricsPath: string;
}

/**
 * Grafana配置
 */
export interface GrafanaConfig {
  adminPassword: string;
  adminUser: string;
  url: string;
}

/**
 * Alertmanager配置
 */
export interface AlertmanagerConfig {
  enabled: boolean;
  url: string;
}

/**
 * 告警邮件配置
 */
export interface AlertEmailConfig {
  enabled: boolean;
  to: string;
  from: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
}

/**
 * 监控告警配置
 */
export interface MonitoringConfig {
  prometheus: PrometheusConfig;
  grafana: GrafanaConfig;
  alertmanager: AlertmanagerConfig;
  email: AlertEmailConfig;
}

/**
 * API性能配置
 */
export interface ApiPerformanceConfig {
  timeout: number;
  maxConcurrentRequests: number;
}

/**
 * 数据库性能配置
 */
export interface DatabasePerformanceConfig {
  queryTimeout: number;
  maxExecutionTime: number;
}

/**
 * 性能配置
 */
export interface PerformanceConfig {
  cache?: CacheConfig;
  api: ApiPerformanceConfig;
  database: DatabasePerformanceConfig;
}

/**
 * 备份存储配置（S3）
 */
export interface BackupStorageConfig {
  enabled: boolean;
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
}

/**
 * 备份配置
 */
export interface BackupConfig {
  enabled: boolean;
  schedule: string;
  retentionDays: number;
  path: string;
  storage?: BackupStorageConfig;
}

/**
 * 第三方登录配置
 */
export interface SocialLoginConfig {
  wechat?: {
    appId: string;
    appSecret: string;
    redirectUri: string;
  };
  qq?: {
    appId: string;
    appKey: string;
    redirectUri: string;
  };
}

/**
 * 文件存储配置（OSS）
 */
export interface StorageConfig {
  type: 'local' | 'oss';
  uploadPath?: string;
  maxSize: number;
  allowedTypes: string[];
  oss?: {
    enabled: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
    endpoint: string;
  };
}

/**
 * SMTP配置
 */
export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  replyTo: string;
}

/**
 * 其他配置
 */
export interface MiscConfig {
  version: string;
  environment: Environment;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  timezone: string;
}

/**
 * 应用配置（完整配置）
 */
export interface AppConfig {
  environment: Environment;
  database: DatabaseConfig;
  redis: RedisConfig;
  cache: CacheConfig;
  auth: AuthConfig;
  ai: AIServiceConfig;
  lawstar: LawstarConfig;
  payment: PaymentConfig;
  membership: MembershipConfig;
  nextjs: NextjsConfig;
  security: SecurityConfig;
  log: WinstonConfig;
  monitoring: MonitoringConfig;
  performance: PerformanceConfig;
  backup: BackupConfig;
  socialLogin?: SocialLoginConfig;
  storage: StorageConfig;
  smtp: SmtpConfig;
  misc: MiscConfig;
}

/**
 * 配置类型（从Prisma导出）
 */
export type ConfigType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';

/**
 * 配置分类
 */
export type ConfigCategory =
  | 'general'
  | 'ai'
  | 'storage'
  | 'security'
  | 'feature'
  | 'ui'
  | 'notification'
  | 'other';

/**
 * 配置查询参数
 */
export interface ConfigQueryParams {
  page?: string;
  limit?: string;
  category?: string;
  type?: string;
  isPublic?: string;
  search?: string;
}

/**
 * 配置响应数据
 */
export interface ConfigResponse {
  configs: unknown[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 创建配置请求
 */
export interface CreateConfigRequest {
  key: string;
  value: unknown;
  type: ConfigType;
  category: ConfigCategory;
  description?: string;
  isPublic?: boolean;
  isRequired?: boolean;
  defaultValue?: unknown;
  validationRules?: Record<string, unknown> | null;
}

/**
 * 更新配置请求
 */
export interface UpdateConfigRequest {
  value: unknown;
  description?: string;
  isPublic?: boolean;
  isRequired?: boolean;
  defaultValue?: unknown;
  validationRules?: Record<string, unknown> | null;
}

/**
 * 批量更新配置请求
 */
export interface BatchUpdateConfigRequest {
  configs: Array<{
    key: string;
    value: unknown;
  }>;
}

/**
 * 验证配置类型
 */
export function isValidConfigType(type: string): type is ConfigType {
  return ['STRING', 'NUMBER', 'BOOLEAN', 'ARRAY', 'OBJECT'].includes(type);
}

/**
 * 验证配置分类
 */
export function isValidConfigCategory(
  category: string
): category is ConfigCategory {
  return [
    'general',
    'ai',
    'storage',
    'security',
    'feature',
    'ui',
    'notification',
    'other',
  ].includes(category);
}

/**
 * 解析配置值
 */
export function parseConfigValue(value: string, type: ConfigType): unknown {
  switch (type) {
    case 'NUMBER':
      return Number.parseFloat(value);
    case 'BOOLEAN':
      return value.toLowerCase() === 'true';
    case 'ARRAY':
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map(s => s.trim());
      }
    case 'OBJECT':
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    default:
      return value;
  }
}

/**
 * 格式化配置值显示
 */
export function formatConfigValue(value: unknown, type: ConfigType): string {
  switch (type) {
    case 'BOOLEAN':
      return value === true ? '是' : '否';
    case 'ARRAY':
    case 'OBJECT':
      return typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);
    default:
      return String(value);
  }
}
