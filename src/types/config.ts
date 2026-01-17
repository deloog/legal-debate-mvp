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
 * 完整配置接口
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
