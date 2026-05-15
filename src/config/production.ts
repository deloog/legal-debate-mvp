/**
 * 生产环境配置管理模块
 * 用于加载和管理应用配置
 */

import type { AppConfig, Environment } from '../types/config';
import { Environment as EnvEnum, LogLevel } from '../types/config';
import {
  getStringEnv,
  getNumberEnv,
  getBooleanEnv,
  getArrayEnv,
  getUrlEnv,
  getDurationEnv,
} from './load-env';

/**
 * 加载配置
 */
export function loadConfig(): AppConfig {
  const nodeEnv = getStringEnv('NODE_ENV', 'development');
  const environment: Environment =
    nodeEnv === 'production'
      ? EnvEnum.PRODUCTION
      : nodeEnv === 'test'
        ? EnvEnum.TEST
        : EnvEnum.DEVELOPMENT;

  return {
    environment,
    database: loadDatabaseConfig(),
    redis: loadRedisConfig(),
    cache: loadCacheConfig(),
    auth: loadAuthConfig(),
    ai: loadAIConfig(),
    ocr: loadOcrConfig(),
    lawstar: loadLawstarConfig(),
    payment: loadPaymentConfig(),
    membership: loadMembershipConfig(),
    nextjs: loadNextjsConfig(),
    security: loadSecurityConfig(),
    log: loadLogConfig(),
    monitoring: loadMonitoringConfig(),
    performance: loadPerformanceConfig(),
    backup: loadBackupConfig(),
    socialLogin: loadSocialLoginConfig(),
    storage: loadStorageConfig(),
    smtp: loadSmtpConfig(),
    misc: loadMiscConfig(environment),
  };
}

/**
 * 加载数据库配置
 */
function loadDatabaseConfig() {
  // 根据环境设置不同的默认连接池大小
  const isDevelopment = process.env.NODE_ENV === 'development';
  const defaultPoolMin = isDevelopment ? 2 : 5;
  const defaultPoolMax = isDevelopment ? 10 : 50; // 生产环境提高到50

  return {
    url: getUrlEnv('DATABASE_URL', ''),
    poolMin: getNumberEnv('DATABASE_POOL_MIN', defaultPoolMin),
    poolMax: getNumberEnv('DATABASE_POOL_MAX', defaultPoolMax),
    idleTimeout: getNumberEnv('DATABASE_POOL_IDLE_TIMEOUT', 30000),
    connectTimeout: getNumberEnv('DATABASE_POOL_CONNECT_TIMEOUT', 10000),
  };
}

/**
 * 加载Redis配置
 */
function loadRedisConfig() {
  const redisUrl = getUrlEnv('REDIS_URL', '');

  const persistenceMode = getStringEnv('REDIS_PERSISTENCE_MODE', 'off');
  const persistenceModeValue: 'aof' | 'rdb' | 'off' =
    persistenceMode === 'aof'
      ? 'aof'
      : persistenceMode === 'rdb'
        ? 'rdb'
        : 'off';

  return {
    url: redisUrl,
    maxRetries: getNumberEnv('REDIS_MAX_RETRIES', 3),
    connectTimeout: getNumberEnv('REDIS_CONNECT_TIMEOUT', 10000),
    idleTimeout: getNumberEnv('REDIS_IDLE_TIMEOUT', 30000),
    maxRetriesPerRequest: getNumberEnv('REDIS_MAX_RETRIES_PER_REQUEST', 3),
    enableOfflineQueue: getBooleanEnv('REDIS_ENABLE_OFFLINE_QUEUE', false),
    persistenceMode: persistenceModeValue,
    aofFsyncEverySec: getNumberEnv('REDIS_AOF_FSYNC_EVERYSEC', 1),
  };
}

/**
 * 加载缓存配置
 */
function loadCacheConfig() {
  return {
    defaultTTL: getNumberEnv('CACHE_DEFAULT_TTL', 3600),
    sessionTTL: getNumberEnv('CACHE_SESSION_TTL', 1800),
    configTTL: getNumberEnv('CACHE_CONFIG_TTL', 86400),
    keyPrefix: getStringEnv('CACHE_KEY_PREFIX', 'legal_debate:'),
    maxSize: getNumberEnv('CACHE_MAX_SIZE', 1000),
    updateAgeOnGet: getBooleanEnv('CACHE_UPDATE_AGE_ON_GET', false),
  };
}

/**
 * 加载认证配置
 */
function loadAuthConfig() {
  return {
    jwtSecret: getStringEnv('JWT_SECRET', ''),
    jwtExpiresIn: getDurationEnv('JWT_EXPIRES_IN', '7d'),
    bcryptSaltRounds: getNumberEnv('BCRYPT_SALT_ROUNDS', 12),
  };
}

/**
 * 加载AI配置
 */
function loadAIConfig() {
  const useRealAI = getBooleanEnv('USE_REAL_AI', false);

  return {
    useRealAI,
    zhipu: {
      apiKey: getStringEnv('ZHIPUAI_API_KEY', ''),
      baseUrl: getStringEnv(
        'ZHIPUAI_BASE_URL',
        'https://open.bigmodel.cn/api/paas/v4'
      ),
      model: getStringEnv('ZHIPUAI_MODEL', 'glm-4-flash'),
      maxTokens: getNumberEnv('ZHIPUAI_MAX_TOKENS', 1000000),
      rateLimit: getNumberEnv('ZHIPUAI_RATE_LIMIT', 100),
    },
    deepseek: {
      apiKey: getStringEnv('DEEPSEEK_API_KEY', ''),
      baseUrl: getStringEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
      model: getStringEnv('DEEPSEEK_MODEL', 'deepseek-chat'),
      maxTokens: getNumberEnv('DEEPSEEK_MAX_TOKENS', 1000000),
      rateLimit: getNumberEnv('DEEPSEEK_RATE_LIMIT', 100),
    },
    openai: {
      apiKey: getStringEnv('OPENAI_API_KEY', ''),
      baseUrl: getStringEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      model: getStringEnv('OPENAI_MODEL', 'gpt-4'),
      maxTokens: getNumberEnv('OPENAI_MAX_TOKENS', 1000000),
      rateLimit: getNumberEnv('OPENAI_RATE_LIMIT', 100),
    },
    timeout: getNumberEnv('AI_SERVICE_TIMEOUT', 30000),
    retryCount: getNumberEnv('AI_SERVICE_RETRY_COUNT', 3),
    retryDelay: getNumberEnv('AI_SERVICE_RETRY_DELAY', 1000),
  };
}

function loadOcrConfig() {
  return {
    provider: getStringEnv('OCR_PROVIDER', 'disabled'),
    tencent: {
      secretId: getStringEnv('TENCENT_OCR_SECRET_ID', ''),
      secretKey: getStringEnv('TENCENT_OCR_SECRET_KEY', ''),
      region: getStringEnv('TENCENT_OCR_REGION', 'ap-beijing'),
      endpoint: getStringEnv('TENCENT_OCR_ENDPOINT', 'ocr.tencentcloudapi.com'),
    },
  };
}

/**
 * 加载法律之星配置
 */
function loadLawstarConfig() {
  return {
    regulation: {
      baseUrl: getUrlEnv('LAWSTAR_REGULATION_BASE_URL', ''),
      appId: getStringEnv('LAWSTAR_REGULATION_APP_ID', ''),
      appSecret: getStringEnv('LAWSTAR_REGULATION_APP_SECRET', ''),
      rateLimit: getNumberEnv('LAWSTAR_REGULATION_RATE_LIMIT', 1000),
    },
    vector: {
      baseUrl: getUrlEnv('LAWSTAR_VECTOR_BASE_URL', ''),
      appId: getStringEnv('LAWSTAR_VECTOR_APP_ID', ''),
      appSecret: getStringEnv('LAWSTAR_VECTOR_APP_SECRET', ''),
      rateLimit: getNumberEnv('LAWSTAR_RATE_LIMIT', 1000),
    },
  };
}

/**
 * 加载支付配置
 */
function loadPaymentConfig() {
  return {
    wechat: {
      appId: getStringEnv('WECHAT_APP_ID', ''),
      mchId: getStringEnv('WECHAT_MCH_ID', ''),
      apiKey: getStringEnv('WECHAT_API_KEY', ''),
      apiV3Key: getStringEnv('WECHAT_API_V3_KEY', ''),
      serialNo: getStringEnv('WECHAT_SERIAL_NO', ''),
      certPath: getStringEnv('WECHAT_CERT_PATH', ''),
      notifyUrl: getUrlEnv('WECHAT_NOTIFY_URL', ''),
      sandbox: getBooleanEnv('WECHAT_SANDBOX', false),
    },
    alipay: {
      appId: getStringEnv('ALIPAY_APP_ID', ''),
      privateKey: getStringEnv('ALIPAY_PRIVATE_KEY', ''),
      publicKey: getStringEnv('ALIPAY_PUBLIC_KEY', ''),
      notifyUrl: getUrlEnv('ALIPAY_NOTIFY_URL', ''),
      sandbox: getBooleanEnv('ALIPAY_SANDBOX', false),
    },
    timeout: getNumberEnv('PAYMENT_TIMEOUT', 7200000),
    retryCount: getNumberEnv('PAYMENT_RETRY_COUNT', 3),
    successCallbackAttempts: getNumberEnv(
      'PAYMENT_SUCCESS_CALLBACK_ATTEMPTS',
      5
    ),
  };
}

/**
 * 加载会员配置
 */
function loadMembershipConfig() {
  return {
    prices: {
      free: getNumberEnv('MEMBERSHIP_FREE_PRICE', 0),
      basic: getNumberEnv('MEMBERSHIP_BASIC_PRICE', 9900),
      professional: getNumberEnv('MEMBERSHIP_PROFESSIONAL_PRICE', 29900),
      enterprise: getNumberEnv('MEMBERSHIP_ENTERPRISE_PRICE', 99900),
    },
    discounts: {
      quarterly: getNumberEnv('MEMBERSHIP_QUARTERLY_DISCOUNT', 1.0),
      yearly: getNumberEnv('MEMBERSHIP_YEARLY_DISCOUNT', 0.83),
    },
    orderExpireHours: getNumberEnv('ORDER_EXPIRE_HOURS', 2),
    retryPaymentCount: getNumberEnv('ORDER_RETRY_PAYMENT_COUNT', 3),
  };
}

/**
 * 加载Next.js配置
 */
function loadNextjsConfig() {
  return {
    authUrl: getUrlEnv('NEXTAUTH_URL', ''),
    secret: getStringEnv('NEXTAUTH_SECRET', ''),
    apiUrl: getUrlEnv('NEXT_PUBLIC_API_URL', ''),
    appUrl: getUrlEnv('NEXT_PUBLIC_APP_URL', ''),
    appName: getStringEnv('NEXT_PUBLIC_APP_NAME', '律伴AI助手'),
    appDescription: getStringEnv(
      'NEXT_PUBLIC_APP_DESCRIPTION',
      '专业的法律辩论与分析系统'
    ),
  };
}

/**
 * 加载安全配置
 */
function loadSecurityConfig() {
  // 根据环境设置不同的默认CORS源
  const isDevelopment = process.env.NODE_ENV === 'development';
  const defaultCorsOrigins = isDevelopment
    ? ['http://localhost:3000', 'http://localhost:3001'] // 开发环境
    : []; // 生产环境必须明确配置，不提供默认值

  return {
    cors: {
      allowedOrigins: getArrayEnv('CORS_ALLOWED_ORIGINS', defaultCorsOrigins),
      allowedMethods: getArrayEnv('CORS_ALLOWED_METHODS', [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'OPTIONS',
      ]),
      allowedHeaders: getArrayEnv('CORS_ALLOWED_HEADERS', [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
      ]),
      credentials: getBooleanEnv('CORS_CREDENTIALS', true),
      maxAge: getNumberEnv('CORS_MAX_AGE', 86400),
    },
    rateLimit: {
      windowMs: getNumberEnv('RATE_LIMIT_WINDOW_MS', 60000),
      maxRequests: getNumberEnv('RATE_LIMIT_MAX_REQUESTS', 100),
      skipSuccessfulRequests: getBooleanEnv(
        'RATE_LIMIT_SKIP_SUCCESS_REQUESTS',
        false
      ),
    },
    headers: {
      contentSecurityPolicy: getStringEnv(
        'SECURITY_CONTENT_SECURITY_POLICY',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
      ),
      hstsMaxAge: getNumberEnv('SECURITY_HSTS_MAX_AGE', 31536000),
      xFrameOptions: getStringEnv('SECURITY_X_FRAME_OPTIONS', 'DENY'),
      xContentTypeOptions: getStringEnv(
        'SECURITY_X_CONTENT_TYPE_OPTIONS',
        'nosniff'
      ),
    },
  };
}

/**
 * 加载日志配置
 */
function loadLogConfig() {
  const levelStr = getStringEnv('LOG_LEVEL', 'error');

  const level: LogLevel =
    levelStr === 'error'
      ? LogLevel.ERROR
      : levelStr === 'warn'
        ? LogLevel.WARN
        : levelStr === 'info'
          ? LogLevel.INFO
          : levelStr === 'debug'
            ? LogLevel.DEBUG
            : LogLevel.ERROR;

  return {
    level,
    fileMaxSize: getStringEnv('LOG_FILE_MAX_SIZE', '20m'),
    fileMaxFiles: getStringEnv('LOG_FILE_MAX_FILES', '14d'),
    datePattern: getStringEnv('LOG_DATE_PATTERN', 'YYYY-MM-DD'),
    format: getStringEnv('LOG_FORMAT', 'json'),
    path: getStringEnv('LOG_FILE_PATH', './logs'),
  };
}

/**
 * 加载监控配置
 */
function loadMonitoringConfig() {
  return {
    prometheus: {
      enabled: getBooleanEnv('PROMETHEUS_ENABLED', false),
      port: getNumberEnv('PROMETHEUS_PORT', 9090),
      metricsPath: getStringEnv('PROMETHEUS_METRICS_PATH', '/metrics'),
    },
    grafana: {
      adminPassword: getStringEnv('GRAFANA_ADMIN_PASSWORD', ''),
      adminUser: getStringEnv('GRAFANA_ADMIN_USER', 'admin'),
      url: getUrlEnv('GRAFANA_URL', ''),
    },
    alertmanager: {
      enabled: getBooleanEnv('ALERTMANAGER_ENABLED', false),
      url: getUrlEnv('ALERTMANAGER_URL', ''),
    },
    email: {
      enabled: getBooleanEnv('ALERT_EMAIL_ENABLED', false),
      to: getStringEnv('ALERT_EMAIL_TO', ''),
      from: getStringEnv('ALERT_EMAIL_FROM', ''),
      smtpHost: getStringEnv('ALERT_EMAIL_SMTP_HOST', ''),
      smtpPort: getNumberEnv('ALERT_EMAIL_SMTP_PORT', 587),
      smtpUser: getStringEnv('ALERT_EMAIL_SMTP_USER', ''),
      smtpPassword: getStringEnv('ALERT_EMAIL_SMTP_PASSWORD', ''),
    },
  };
}

/**
 * 加载性能配置
 */
function loadPerformanceConfig() {
  return {
    api: {
      timeout: getNumberEnv('API_TIMEOUT', 30000),
      maxConcurrentRequests: getNumberEnv('API_MAX_CONCURRENT_REQUESTS', 100),
    },
    database: {
      queryTimeout: getNumberEnv('DB_QUERY_TIMEOUT', 30000),
      maxExecutionTime: getNumberEnv('DB_MAX_EXECUTION_TIME', 5000),
    },
  };
}

/**
 * 加载备份配置
 */
function loadBackupConfig() {
  const s3Enabled = getBooleanEnv('BACKUP_S3_ENABLED', false);

  return {
    enabled: getBooleanEnv('BACKUP_ENABLED', false),
    schedule: getStringEnv('BACKUP_SCHEDULE', '0 2 * * *'),
    retentionDays: getNumberEnv('BACKUP_RETENTION_DAYS', 30),
    path: getStringEnv('BACKUP_PATH', './backups'),
    storage: s3Enabled
      ? {
          enabled: s3Enabled,
          bucket: getStringEnv('BACKUP_S3_BUCKET', ''),
          region: getStringEnv('BACKUP_S3_REGION', ''),
          accessKey: getStringEnv('BACKUP_S3_ACCESS_KEY', ''),
          secretKey: getStringEnv('BACKUP_S3_SECRET_KEY', ''),
        }
      : undefined,
  };
}

/**
 * 加载第三方登录配置
 */
function loadSocialLoginConfig() {
  const wechatAppId = getStringEnv('WECHAT_OPEN_APP_ID', '');
  const qqAppId = getStringEnv('QQ_APP_ID', '');

  const hasWechat = wechatAppId !== '';
  const hasQQ = qqAppId !== '';

  if (!hasWechat && !hasQQ) {
    return undefined;
  }

  return {
    wechat: hasWechat
      ? {
          appId: wechatAppId,
          appSecret: getStringEnv('WECHAT_OPEN_APP_SECRET', ''),
          redirectUri: getUrlEnv('WECHAT_OPEN_REDIRECT_URI', ''),
        }
      : undefined,
    qq: hasQQ
      ? {
          appId: qqAppId,
          appKey: getStringEnv('QQ_APP_KEY', ''),
          redirectUri: getUrlEnv('QQ_REDIRECT_URI', ''),
        }
      : undefined,
  };
}

/**
 * 加载存储配置
 */
function loadStorageConfig() {
  const storageType = getStringEnv('STORAGE_TYPE', 'local');
  const ossEnabled = getBooleanEnv('OSS_ENABLED', false);

  return {
    type: (storageType === 'oss' ? 'oss' : 'local') as 'local' | 'oss',
    uploadPath: getStringEnv('UPLOAD_PATH', './public/uploads'),
    maxSize: getNumberEnv('UPLOAD_MAX_SIZE', 10485760),
    allowedTypes: getArrayEnv('UPLOAD_ALLOWED_TYPES', [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
    ]),
    oss: ossEnabled
      ? {
          enabled: ossEnabled,
          accessKey: getStringEnv('OSS_ACCESS_KEY', ''),
          secretKey: getStringEnv('OSS_SECRET_KEY', ''),
          bucket: getStringEnv('OSS_BUCKET', ''),
          region: getStringEnv('OSS_REGION', ''),
          endpoint: getStringEnv('OSS_ENDPOINT', ''),
        }
      : undefined,
  };
}

/**
 * 加载SMTP配置
 */
function loadSmtpConfig() {
  return {
    enabled: getBooleanEnv('SMTP_ENABLED', false),
    host: getStringEnv('SMTP_HOST', ''),
    port: getNumberEnv('SMTP_PORT', 587),
    secure: getBooleanEnv('SMTP_SECURE', false),
    user: getStringEnv('SMTP_USER', ''),
    password: getStringEnv('SMTP_PASSWORD', ''),
    from: getStringEnv('SMTP_FROM', ''),
    replyTo: getStringEnv('SMTP_REPLY_TO', ''),
  };
}

/**
 * 加载其他配置
 */
function loadMiscConfig(environment: Environment) {
  return {
    version: getStringEnv('APP_VERSION', '1.0.0'),
    environment,
    maintenanceMode: getBooleanEnv('MAINTENANCE_MODE', false),
    maintenanceMessage: getStringEnv(
      'MAINTENANCE_MESSAGE',
      '系统正在维护中，请稍后再试'
    ),
    timezone: getStringEnv('TZ', 'Asia/Shanghai'),
  };
}
