import { NextRequest, NextResponse } from 'next/server';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import {
  calculateQuotaPercentage,
  getEffectiveQuotaIdentity,
  getQuotaStatusMessage,
  getUserQuotaConfigAsync,
  getUserQuotaUsage,
  hasUnlimitedQuotaAsync,
} from '@/lib/ai/quota';
import {
  checkDatabaseConnection,
  getConnectionInfo,
  prisma,
} from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  PermissionCheckMode,
  validatePermissions,
} from '@/lib/middleware/permission-check';
import { adaptiveRateLimit } from '@/lib/middleware/adaptive-rate-limit';
import { ipFilter } from '@/lib/middleware/ip-filter';
import { rateLimitConfig } from '@/lib/middleware/rate-limit-config';
import { rateLimitMonitor } from '@/lib/middleware/rate-limit-monitor';
import { getPrometheusMonitor } from '@/lib/monitoring/prometheus-metrics';
import { getUserNotificationService } from '@/lib/notification/user-notification-service';
import { logger } from '@/lib/logger';
import type {
  AIServiceHealth,
  DatabaseHealth,
  HealthStatus,
  SystemHealth,
} from '@/types/health';
import { ALERT_SEVERITY, ALERT_STATUS } from '@/types/log';
import { MemoryType, NotificationStatus } from '@prisma/client';
import { SYSTEM_PERMISSIONS } from '@/types/permission';

export const SYSTEM_MONITORING_READ_PERMISSIONS = [
  SYSTEM_PERMISSIONS.MONITOR,
  'admin:read',
] as const;

type SectionResult<T> = { ok: true; data: T } | { ok: false; error: string };

interface CurrentQuotaLimit {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  status: 'unlimited' | 'low' | 'medium' | 'high' | 'exceeded';
}

interface QuotaPolicyItem {
  role: string;
  label: string;
  dailyLimit: number;
  monthlyLimit: number;
  perRequestLimit: number;
  unlimited: boolean;
}

interface HealthSnapshot {
  status: HealthStatus;
  timestamp: string;
  database: DatabaseHealth;
  ai: AIServiceHealth;
  system: SystemHealth;
}

interface QuotaSnapshot {
  currentUser: {
    userId: string;
    role: string;
    roleLabel: string;
    quotaSource: 'role' | 'membership';
    quotaKey: string;
    daily: CurrentQuotaLimit;
    monthly: CurrentQuotaLimit;
    hasUnlimited: boolean;
  };
  policies: QuotaPolicyItem[];
}

interface NotificationSnapshot {
  unreadCount: number;
  channels: Array<{
    name: string;
    enabled: boolean;
    description: string;
    reason: string;
  }>;
  recent: Array<{
    id: string;
    type: string;
    priority: string;
    status: NotificationStatus;
    title: string;
    content: string;
    link: string | null;
    createdAt: string;
    readAt: string | null;
  }>;
}

interface MemorySnapshot {
  total: number;
  active: number;
  compressed: number;
  expired: number;
  byType: Record<string, number>;
}

interface AlertSnapshot {
  total: number;
  triggered: number;
  acknowledged: number;
  resolved: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  recent: Array<{
    alertId: string;
    ruleName: string;
    severity: string;
    status: string;
    errorType: string;
    message: string;
    triggeredAt: string;
  }>;
}

interface MonitoringSnapshot {
  prometheus: {
    totalCollectors: number;
    totalMetrics: number;
    metricsByType: Record<string, number>;
  };
  rateLimit: {
    monitor: {
      totalRequests: number;
      blockedRequests: number;
      blockRate: number;
      topOffenders: Array<{
        identifier: string;
        blockedCount: number;
        lastBlocked: string;
      }>;
      endpointStats: Record<string, { requests: number; blocked: number }>;
    };
    config: {
      totalEndpoints: number;
      enabledEndpoints: number;
      disabledEndpoints: number;
      byLimitType: Record<string, number>;
    };
    adaptive: {
      totalUsers: number;
      byLevel: Record<string, number>;
      averageScore: number;
      serverLoad: {
        cpuUsage: number;
        memoryUsage: number;
        requestsPerSecond: number;
        activeConnections: number;
        timestamp: string;
      };
    };
    ipFilter: {
      mode: 'blacklist' | 'whitelist' | 'off';
      blacklistSize: number;
      whitelistSize: number;
    };
  };
}

interface SystemMonitoringDashboard {
  health: SectionResult<HealthSnapshot>;
  quota: SectionResult<QuotaSnapshot>;
  notifications: SectionResult<NotificationSnapshot>;
  memory: SectionResult<MemorySnapshot>;
  alerts: SectionResult<AlertSnapshot>;
  monitoring: SectionResult<MonitoringSnapshot>;
  generatedAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  FREE: '免费版',
  BASIC: '基础版',
  PROFESSIONAL: '专业版',
  ENTERPRISE: '企业版',
  ADMIN: '管理员',
  SUPER_ADMIN: '超级管理员',
  LAWYER: '律师',
};

const ROLE_ORDER = [
  'FREE',
  'BASIC',
  'PROFESSIONAL',
  'ENTERPRISE',
  'LAWYER',
  'ADMIN',
  'SUPER_ADMIN',
] as const;

function buildSystemHealth(): SystemHealth {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  if (process.env.NODE_ENV === 'production') {
    return { uptime };
  }

  return {
    uptime,
    memory: {
      used: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      rss: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
      external: Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100,
    },
    cpu: {
      usage: process.cpuUsage().user / 1000000,
    },
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    environment: process.env.NODE_ENV || 'development',
  };
}

function calculateOverallStatus(services: {
  database: DatabaseHealth;
  ai: AIServiceHealth;
}): HealthStatus {
  if (
    services.database.status === 'unhealthy' ||
    services.ai.status === 'unhealthy'
  ) {
    return 'unhealthy';
  }

  if (
    services.database.status === 'degraded' ||
    services.ai.status === 'degraded'
  ) {
    return 'degraded';
  }

  return 'healthy';
}

async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();

  try {
    const isConnected = await checkDatabaseConnection();
    const responseTime = Date.now() - startTime;

    if (!isConnected) {
      return {
        status: 'unhealthy',
        responseTime,
        message: '数据库连接失败',
      };
    }

    const connectionInfo = await getConnectionInfo();
    const normalizedConnectionInfo = connectionInfo
      ? {
          activeConnections: Number(connectionInfo.active_connections) || 0,
          totalConnections: Number(connectionInfo.total_connections) || 0,
        }
      : {
          activeConnections: 0,
        };

    return {
      status: 'healthy',
      responseTime,
      connectionInfo: normalizedConnectionInfo,
    };
  } catch {
    const responseTime = Date.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      message: '数据库健康检查失败',
    };
  }
}

async function checkAIServiceHealth(): Promise<AIServiceHealth> {
  const startTime = Date.now();

  try {
    const aiService = await AIServiceFactory.getInstance();
    const isHealthy = await aiService.healthCheck();
    const responseTime = Date.now() - startTime;

    if (!isHealthy) {
      return {
        status: 'unhealthy',
        responseTime,
        message: 'AI服务不可用',
        providers: [],
        availableProviders: [],
      };
    }

    const serviceStatus = aiService.getServiceStatus();
    const providerStats = Object.values(serviceStatus.providerStatus || {});

    const providers = providerStats.map(stat => ({
      provider: stat.provider,
      status: stat.healthy ? ('healthy' as const) : ('unhealthy' as const),
      responseTime: stat.responseTime,
      lastCheck: stat.lastCheck,
    }));

    return {
      status: 'healthy',
      responseTime,
      providers,
      availableProviders: aiService.getAvailableProviders(),
      availableModels: ['deepseek-chat', 'glm-4'],
    };
  } catch {
    const responseTime = Date.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      message: 'AI服务健康检查失败',
      providers: [],
      availableProviders: [],
    };
  }
}

async function resolveSection<T>(
  label: string,
  task: Promise<T>
): Promise<SectionResult<T>> {
  try {
    return {
      ok: true,
      data: await task,
    };
  } catch (error) {
    logger.error(`[SystemMonitoring] ${label} failed:`, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

function buildQuotaLimit(
  used: number,
  limit: number,
  isUnlimited: boolean
): CurrentQuotaLimit {
  if (isUnlimited || limit <= 0) {
    return {
      used,
      limit,
      remaining: -1,
      percentage: 0,
      status: 'unlimited',
    };
  }

  const percentage = calculateQuotaPercentage(used, limit);
  const status = getQuotaStatusMessage(percentage);

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percentage,
    status,
  };
}

function getNotificationChannels() {
  const emailEnabled = Boolean(
    process.env.ALERT_EMAIL_TO &&
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
  const webhookEnabled = Boolean(process.env.ALERT_WEBHOOK_URL);
  const smsEnabled = Boolean(
    process.env.ALERT_SMS_ENABLED === 'true' &&
    process.env.ALERT_SMS_RECIPIENTS &&
    process.env.ALERT_SMS_RECIPIENTS.trim().length > 0 &&
    process.env.SMS_PROVIDER &&
    ((process.env.SMS_PROVIDER === 'aliyun' &&
      process.env.ALIYUN_SMS_ACCESS_KEY_ID &&
      process.env.ALIYUN_SMS_ACCESS_KEY_SECRET) ||
      (process.env.SMS_PROVIDER === 'tencent' &&
        process.env.TENCENT_SMS_SECRET_ID &&
        process.env.TENCENT_SMS_SECRET_KEY))
  );

  return [
    {
      name: 'LOG',
      enabled: true,
      description: '日志告警',
      reason: '始终启用',
    },
    {
      name: 'EMAIL',
      enabled: emailEnabled,
      description: '邮件通知',
      reason: emailEnabled
        ? '收件人与SMTP凭据已配置'
        : '缺少 ALERT_EMAIL_TO 或 SMTP 配置',
    },
    {
      name: 'WEBHOOK',
      enabled: webhookEnabled,
      description: 'Webhook 通知',
      reason: webhookEnabled ? 'Webhook URL 已配置' : '缺少 ALERT_WEBHOOK_URL',
    },
    {
      name: 'SMS',
      enabled: smsEnabled,
      description: '短信通知',
      reason: smsEnabled
        ? '短信供应商凭据与接收人已配置'
        : '缺少 ALERT_SMS_RECIPIENTS / 供应商凭据或未开启 ALERT_SMS_ENABLED',
    },
  ];
}

async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const [database, ai] = await Promise.all([
    checkDatabaseHealth(),
    checkAIServiceHealth(),
  ]);

  return {
    status: calculateOverallStatus({ database, ai }),
    timestamp: new Date().toISOString(),
    database,
    ai,
    system: buildSystemHealth(),
  };
}

async function getQuotaSnapshot(
  userId: string,
  role: string
): Promise<QuotaSnapshot> {
  const quotaUsage = await getUserQuotaUsage(userId, role);
  const hasUnlimited = await hasUnlimitedQuotaAsync(role);
  const quotaIdentity = await getEffectiveQuotaIdentity(userId, role);

  const currentRole = ROLE_LABELS[role] ?? role;
  const currentUser = {
    userId,
    role,
    roleLabel: currentRole,
    quotaSource: quotaIdentity.source,
    quotaKey: quotaIdentity.quotaKey,
    daily: buildQuotaLimit(
      quotaUsage.daily.used,
      quotaUsage.daily.limit,
      hasUnlimited
    ),
    monthly: buildQuotaLimit(
      quotaUsage.monthly.used,
      quotaUsage.monthly.limit,
      hasUnlimited
    ),
    hasUnlimited,
  };

  const policies = ROLE_ORDER.map(roleName => {
    return roleName;
  });

  const policyConfigs = await Promise.all(
    policies.map(async roleName => {
      const config = await getUserQuotaConfigAsync(roleName);
      return {
        role: roleName,
        label: ROLE_LABELS[roleName] ?? roleName,
        dailyLimit: config.dailyLimit,
        monthlyLimit: config.monthlyLimit,
        perRequestLimit: config.perRequestLimit,
        unlimited: config.dailyLimit === -1,
      };
    })
  );

  return {
    currentUser,
    policies: policyConfigs,
  };
}

async function getNotificationSnapshot(
  userId: string
): Promise<NotificationSnapshot> {
  const service = getUserNotificationService();
  const result = await service.getNotifications(
    { userId },
    { page: 1, pageSize: 5, sortBy: 'createdAt', sortOrder: 'desc' }
  );

  return {
    unreadCount: result.unreadCount,
    channels: getNotificationChannels(),
    recent: result.notifications.map(notification => ({
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      status: notification.status,
      title: notification.title,
      content: notification.content,
      link: notification.link,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
    })),
  };
}

async function getMemorySnapshot(): Promise<MemorySnapshot> {
  const [total, compressed, expired, grouped] = await Promise.all([
    prisma.agentMemory.count(),
    prisma.agentMemory.count({ where: { compressed: true } }),
    prisma.agentMemory.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    }),
    prisma.agentMemory.groupBy({
      by: ['memoryType'],
      _count: {
        memoryType: true,
      },
    }),
  ]);

  const byType: Record<string, number> = {
    [MemoryType.WORKING]: 0,
    [MemoryType.HOT]: 0,
    [MemoryType.COLD]: 0,
  };

  grouped.forEach(item => {
    byType[item.memoryType] = item._count.memoryType;
  });

  return {
    total,
    active: Math.max(0, total - expired),
    compressed,
    expired,
    byType,
  };
}

async function getAlertSnapshot(): Promise<AlertSnapshot> {
  const [total, triggered, acknowledged, resolved, recent] = await Promise.all([
    prisma.alert.count(),
    prisma.alert.count({ where: { status: 'TRIGGERED' } }),
    prisma.alert.count({ where: { status: 'ACKNOWLEDGED' } }),
    prisma.alert.count({ where: { status: 'RESOLVED' } }),
    prisma.alert.findMany({
      orderBy: { triggeredAt: 'desc' },
      take: 5,
      select: {
        alertId: true,
        ruleName: true,
        severity: true,
        status: true,
        errorType: true,
        message: true,
        triggeredAt: true,
      },
    }),
  ]);

  const bySeverity: Record<string, number> = {};
  ALERT_SEVERITY.forEach(severity => {
    bySeverity[severity] = 0;
  });

  const byStatus: Record<string, number> = {};
  ALERT_STATUS.forEach(status => {
    byStatus[status] = 0;
  });

  const severityCounts = await Promise.all(
    ALERT_SEVERITY.map(async severity => ({
      severity,
      count: await prisma.alert.count({ where: { severity } }),
    }))
  );
  severityCounts.forEach(item => {
    bySeverity[item.severity] = item.count;
  });

  const statusCounts = await Promise.all(
    ALERT_STATUS.map(async status => ({
      status,
      count: await prisma.alert.count({ where: { status } }),
    }))
  );
  statusCounts.forEach(item => {
    byStatus[item.status] = item.count;
  });

  return {
    total,
    triggered,
    acknowledged,
    resolved,
    bySeverity,
    byStatus,
    recent: recent.map(alert => ({
      alertId: alert.alertId,
      ruleName: alert.ruleName,
      severity: alert.severity,
      status: alert.status,
      errorType: alert.errorType,
      message: alert.message,
      triggeredAt: alert.triggeredAt.toISOString(),
    })),
  };
}

async function getMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  const prometheusMonitor = getPrometheusMonitor();

  // 记录模块20聚合 API 访问和关键实时快照，避免“有监控模块但无运行时信号”。
  prometheusMonitor.incrementCounter('system_monitoring_requests_total', 1, {
    route: '/api/admin/system-monitoring',
    method: 'GET',
  });
  prometheusMonitor.setGauge(
    'system_monitoring_last_request_timestamp_ms',
    Date.now()
  );

  const monitorStats = rateLimitMonitor.getStats(60);
  const configStats = rateLimitConfig.getEndpointStats();
  const adaptiveStats = adaptiveRateLimit.getStats();
  const ipFilterStats = ipFilter.getStats();
  const endpointCount = Object.keys(monitorStats.endpointStats).length;
  const topOffenderCount = monitorStats.topOffenders.length;

  prometheusMonitor.setGauge(
    'system_monitoring_rate_limit_block_rate',
    monitorStats.blockRate
  );
  prometheusMonitor.setGauge(
    'system_monitoring_rate_limit_endpoint_count',
    endpointCount
  );
  prometheusMonitor.setGauge(
    'system_monitoring_rate_limit_top_offender_count',
    topOffenderCount
  );
  prometheusMonitor.setGauge(
    'system_monitoring_adaptive_average_score',
    adaptiveStats.averageScore
  );
  prometheusMonitor.setGauge(
    'system_monitoring_adaptive_server_cpu_usage',
    adaptiveStats.serverLoad.cpuUsage
  );
  prometheusMonitor.setGauge(
    'system_monitoring_adaptive_server_memory_usage',
    adaptiveStats.serverLoad.memoryUsage
  );
  prometheusMonitor.setGauge(
    'system_monitoring_ip_blacklist_size',
    ipFilterStats.blacklistSize
  );
  prometheusMonitor.setGauge(
    'system_monitoring_ip_whitelist_size',
    ipFilterStats.whitelistSize
  );

  const prometheus = prometheusMonitor.getStats();

  return {
    prometheus: {
      totalCollectors: prometheus.totalCollectors,
      totalMetrics: prometheus.totalMetrics,
      metricsByType: {
        counter: prometheus.metricsByType.counter,
        gauge: prometheus.metricsByType.gauge,
        histogram: prometheus.metricsByType.histogram,
        summary: prometheus.metricsByType.summary,
      },
    },
    rateLimit: {
      monitor: {
        totalRequests: monitorStats.totalRequests,
        blockedRequests: monitorStats.blockedRequests,
        blockRate: monitorStats.blockRate,
        topOffenders: monitorStats.topOffenders.map(offender => ({
          identifier: offender.identifier,
          blockedCount: offender.blockedCount,
          lastBlocked: offender.lastBlocked.toISOString(),
        })),
        endpointStats: monitorStats.endpointStats,
      },
      config: configStats,
      adaptive: {
        totalUsers: adaptiveStats.totalUsers,
        byLevel: {
          unknown: adaptiveStats.byLevel.unknown,
          trusted: adaptiveStats.byLevel.trusted,
          normal: adaptiveStats.byLevel.normal,
          suspicious: adaptiveStats.byLevel.suspicious,
          malicious: adaptiveStats.byLevel.malicious,
        },
        averageScore: adaptiveStats.averageScore,
        serverLoad: {
          cpuUsage: adaptiveStats.serverLoad.cpuUsage,
          memoryUsage: adaptiveStats.serverLoad.memoryUsage,
          requestsPerSecond: adaptiveStats.serverLoad.requestsPerSecond,
          activeConnections: adaptiveStats.serverLoad.activeConnections,
          timestamp: adaptiveStats.serverLoad.timestamp.toISOString(),
        },
      },
      ipFilter: {
        mode: ipFilterStats.mode,
        blacklistSize: ipFilterStats.blacklistSize,
        whitelistSize: ipFilterStats.whitelistSize,
      },
    },
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '请先登录',
          },
        },
        { status: 401 }
      );
    }

    const permissionError = await validatePermissions(
      request,
      [...SYSTEM_MONITORING_READ_PERMISSIONS],
      { mode: PermissionCheckMode.ANY }
    );
    if (permissionError) {
      return permissionError;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: {
        role: true,
      },
    });

    const role = dbUser?.role ?? 'FREE';

    const [health, quota, notifications, memory, alerts, monitoring] =
      await Promise.all([
        resolveSection('health', getHealthSnapshot()),
        resolveSection('quota', getQuotaSnapshot(authUser.userId, role)),
        resolveSection(
          'notifications',
          getNotificationSnapshot(authUser.userId)
        ),
        resolveSection('memory', getMemorySnapshot()),
        resolveSection('alerts', getAlertSnapshot()),
        resolveSection('monitoring', getMonitoringSnapshot()),
      ]);

    const payload: SystemMonitoringDashboard = {
      health,
      quota,
      notifications,
      memory,
      alerts,
      monitoring,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    logger.error('[SystemMonitoring] API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取系统支撑与监控数据失败',
        },
      },
      { status: 500 }
    );
  }
}
