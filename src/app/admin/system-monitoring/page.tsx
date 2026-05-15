'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  Bell,
  Clock,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Server,
  TrendingUp,
  Wifi,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

type SectionResult<T> = { ok: true; data: T } | { ok: false; error: string };

interface CurrentQuotaLimit {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  status: 'unlimited' | 'low' | 'medium' | 'high' | 'exceeded';
}

interface HealthSnapshot {
  status: HealthStatus;
  timestamp: string;
  database: {
    status: HealthStatus;
    responseTime?: number;
    message?: string;
    connectionInfo?: {
      activeConnections: number;
      totalConnections?: number;
    };
  };
  ai: {
    status: HealthStatus;
    responseTime?: number;
    message?: string;
    providers: Array<{
      provider: string;
      status: HealthStatus;
      responseTime?: number;
      lastCheck: number;
    }>;
    availableProviders: string[];
    availableModels?: string[];
  };
  system: {
    uptime: number;
    memory?: {
      used: number;
      total: number;
      rss: number;
      external: number;
    };
    cpu?: {
      usage: number;
    };
    nodeVersion?: string;
    platform?: string;
    arch?: string;
    environment?: string;
  };
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
  policies: Array<{
    role: string;
    label: string;
    dailyLimit: number;
    monthlyLimit: number;
    perRequestLimit: number;
    unlimited: boolean;
  }>;
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
    status: string;
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

interface DashboardResponse {
  success: boolean;
  data?: SystemMonitoringDashboard;
  error?: {
    code?: string;
    message: string;
  };
}

const QUICK_LINKS = [
  { href: '/admin/configs', label: '系统配置', icon: SettingsIcon },
  { href: '/admin/alerts', label: '告警监控', icon: ShieldAlert },
  { href: '/admin/agent-monitor', label: 'Agent 监控', icon: Activity },
  { href: '/admin/memories', label: '记忆管理', icon: HardDrive },
  { href: '/admin/logs', label: '系统日志', icon: Server },
  { href: '/admin/reputation', label: '信誉管理', icon: TrendingUp },
] as const;

const MONITOR_ACTION_LINKS = [
  {
    href: '/admin/system-monitoring/control',
    label: '系统防护控制台',
    description: '统一管理限流、IP过滤与信誉治理',
  },
  {
    href: '/admin/system-monitoring/control',
    label: '限流配置管理',
    description: '查看与调整端点限流策略',
  },
  {
    href: '/admin/system-monitoring/control',
    label: 'IP过滤管理',
    description: '维护黑白名单与过滤模式',
  },
  {
    href: '/admin/system-monitoring/control',
    label: '信誉管理',
    description: '查看与调整自适应信誉等级',
  },
] as const;

function SettingsIcon() {
  return <Database className='h-4 w-4' />;
}

function getStatusTone(status: HealthStatus | string): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-100 text-emerald-700';
    case 'degraded':
      return 'bg-amber-100 text-amber-700';
    case 'unhealthy':
      return 'bg-rose-100 text-rose-700';
    case 'unlimited':
      return 'bg-sky-100 text-sky-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function SectionShell({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div id={id}>
      <Card className='border-slate-200 shadow-sm'>
        <CardHeader className='space-y-1'>
          <CardTitle className='text-lg'>{title}</CardTitle>
          <p className='text-sm text-slate-500'>{description}</p>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

function ValueCard({
  title,
  value,
  hint,
  tone = 'bg-slate-100 text-slate-700',
  icon,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <div className='text-sm text-slate-500'>{title}</div>
          <div className='mt-2 text-2xl font-semibold text-slate-900'>
            {value}
          </div>
          {hint && <div className='mt-1 text-xs text-slate-500'>{hint}</div>}
        </div>
        <div className={`rounded-xl p-2 ${tone}`}>{icon}</div>
      </div>
    </div>
  );
}

export default function SystemMonitoringPage() {
  const [dashboard, setDashboard] = useState<SystemMonitoringDashboard | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/system-monitoring');
      const result = (await response.json()) as DashboardResponse;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error?.message || '加载系统监控数据失败');
      }

      setDashboard(result.data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const timer = setInterval(() => {
      void loadDashboard();
    }, 60000);

    return () => clearInterval(timer);
  }, [loadDashboard]);

  if (loading && !dashboard) {
    return (
      <div className='flex min-h-[60vh] items-center justify-center'>
        <div className='flex items-center gap-3 text-slate-500'>
          <Loader2 className='h-5 w-5 animate-spin' />
          <span>加载系统支撑与监控数据...</span>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className='flex min-h-[60vh] items-center justify-center'>
        <div className='max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center'>
          <AlertCircle className='mx-auto h-8 w-8 text-rose-600' />
          <h1 className='mt-3 text-lg font-semibold text-rose-900'>
            系统监控加载失败
          </h1>
          <p className='mt-2 text-sm text-rose-700'>{error}</p>
          <button
            onClick={() => void loadDashboard()}
            className='mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white'
          >
            <RefreshCw className='h-4 w-4' />
            重试
          </button>
        </div>
      </div>
    );
  }

  const data = dashboard;
  if (!data) {
    return null;
  }

  const health = data.health.ok ? data.health.data : null;
  const quota = data.quota.ok ? data.quota.data : null;
  const notifications = data.notifications.ok ? data.notifications.data : null;
  const memory = data.memory.ok ? data.memory.data : null;
  const alerts = data.alerts.ok ? data.alerts.data : null;
  const monitoring = data.monitoring.ok ? data.monitoring.data : null;

  const overallStatus = health?.status ?? 'degraded';
  const generatedAt = formatDateTime(data.generatedAt);

  return (
    <div className='space-y-6'>
      <div className='rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-lg'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            <div className='flex items-center gap-2 text-sm text-slate-300'>
              <Activity className='h-4 w-4' />
              <span>模块 20 · 系统支撑与监控</span>
            </div>
            <h1 className='mt-2 text-3xl font-bold'>系统支撑与监控总览</h1>
            <p className='mt-2 max-w-2xl text-sm text-slate-300'>
              汇总健康检查、AI
              配额、通知、记忆、告警与限流状态，方便快速定位系统支撑层异常。配置与治理请进入“系统防护控制台”。
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <Badge className={getStatusTone(overallStatus)}>
              {overallStatus === 'healthy'
                ? '健康'
                : overallStatus === 'degraded'
                  ? '降级'
                  : '异常'}
            </Badge>
            <button
              onClick={() => void loadDashboard()}
              className='inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20'
            >
              <RefreshCw className='h-4 w-4' />
              刷新
            </button>
          </div>
        </div>
        <div className='mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300'>
          <span>更新时间 {generatedAt}</span>
          {error && (
            <span className='rounded-full bg-rose-500/20 px-3 py-1'>
              部分模块加载失败
            </span>
          )}
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <ValueCard
          title='整体健康'
          value={
            health?.status === 'healthy'
              ? '健康'
              : health?.status === 'degraded'
                ? '降级'
                : '异常'
          }
          hint={
            health?.timestamp
              ? `检查时间 ${formatDateTime(health.timestamp)}`
              : '健康检查不可用'
          }
          tone={getStatusTone(health?.status ?? 'unhealthy')}
          icon={<ShieldAlert className='h-5 w-5' />}
        />
        <ValueCard
          title='未读通知'
          value={notifications ? formatCount(notifications.unreadCount) : '--'}
          hint='当前管理员账户的通知箱'
          tone='bg-blue-100 text-blue-700'
          icon={<Bell className='h-5 w-5' />}
        />
        <ValueCard
          title='记忆总量'
          value={memory ? formatCount(memory.total) : '--'}
          hint={
            memory
              ? `已压缩 ${formatCount(memory.compressed)} 条`
              : '记忆数据不可用'
          }
          tone='bg-emerald-100 text-emerald-700'
          icon={<HardDrive className='h-5 w-5' />}
        />
        <ValueCard
          title='告警总数'
          value={alerts ? formatCount(alerts.total) : '--'}
          hint={
            alerts
              ? `已触发 ${formatCount(alerts.triggered)} 条`
              : '告警数据不可用'
          }
          tone='bg-amber-100 text-amber-700'
          icon={<AlertCircle className='h-5 w-5' />}
        />
      </div>

      <div className='grid gap-3 md:grid-cols-3 lg:grid-cols-6'>
        {QUICK_LINKS.map(link => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className='flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700'
            >
              <Icon className='h-4 w-4' />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>

      <SectionShell
        id='health'
        title='健康检查'
        description='数据库、AI 服务与系统运行状态'
      >
        {health ? (
          <div className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-3'>
              <div className='rounded-2xl border border-slate-200 p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <div className='text-sm text-slate-500'>数据库</div>
                    <div className='mt-1 text-lg font-semibold text-slate-900'>
                      {health.database.status === 'healthy'
                        ? '健康'
                        : health.database.status === 'degraded'
                          ? '降级'
                          : '异常'}
                    </div>
                  </div>
                  <Badge className={getStatusTone(health.database.status)}>
                    {health.database.status}
                  </Badge>
                </div>
                <div className='mt-3 text-xs text-slate-500'>
                  响应 {health.database.responseTime ?? 0} ms
                </div>
                {health.database.connectionInfo && (
                  <div className='mt-2 text-xs text-slate-500'>
                    活跃连接 {health.database.connectionInfo.activeConnections}
                    {health.database.connectionInfo.totalConnections !==
                    undefined
                      ? ` / ${health.database.connectionInfo.totalConnections}`
                      : ''}
                  </div>
                )}
              </div>

              <div className='rounded-2xl border border-slate-200 p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <div className='text-sm text-slate-500'>AI 服务</div>
                    <div className='mt-1 text-lg font-semibold text-slate-900'>
                      {health.ai.status === 'healthy'
                        ? '健康'
                        : health.ai.status === 'degraded'
                          ? '降级'
                          : '异常'}
                    </div>
                  </div>
                  <Badge className={getStatusTone(health.ai.status)}>
                    {health.ai.status}
                  </Badge>
                </div>
                <div className='mt-3 text-xs text-slate-500'>
                  可用提供商 {health.ai.availableProviders.length}
                </div>
              </div>

              <div className='rounded-2xl border border-slate-200 p-4'>
                <div className='text-sm text-slate-500'>系统资源</div>
                <div className='mt-1 text-lg font-semibold text-slate-900'>
                  {health.system.uptime.toFixed(0)} 秒
                </div>
                {health.system.memory && (
                  <div className='mt-3 space-y-1 text-xs text-slate-500'>
                    <div>
                      Heap {health.system.memory.used} /{' '}
                      {health.system.memory.total} MB
                    </div>
                    <div>RSS {health.system.memory.rss} MB</div>
                  </div>
                )}
              </div>
            </div>

            <div className='overflow-hidden rounded-2xl border border-slate-200'>
              <table className='min-w-full divide-y divide-slate-200 text-sm'>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>AI 提供商</th>
                    <th className='px-4 py-3'>状态</th>
                    <th className='px-4 py-3'>响应时间</th>
                    <th className='px-4 py-3'>最后检查</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100 bg-white'>
                  {health.ai.providers.map(provider => (
                    <tr key={provider.provider}>
                      <td className='px-4 py-3 font-medium text-slate-900'>
                        {provider.provider}
                      </td>
                      <td className='px-4 py-3'>
                        <Badge className={getStatusTone(provider.status)}>
                          {provider.status}
                        </Badge>
                      </td>
                      <td className='px-4 py-3 text-slate-600'>
                        {provider.responseTime ?? 0} ms
                      </td>
                      <td className='px-4 py-3 text-slate-600'>
                        {new Date(provider.lastCheck).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                  {health.ai.providers.length === 0 && (
                    <tr>
                      <td className='px-4 py-6 text-slate-500' colSpan={4}>
                        暂无 AI 健康数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className='rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
            {data.health.ok ? '暂无健康数据' : data.health.error}
          </div>
        )}
      </SectionShell>

      <SectionShell
        id='quota'
        title='AI 配额'
        description='当前账号配额与系统角色配额策略'
      >
        {quota ? (
          <div className='space-y-4'>
            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='rounded-2xl border border-slate-200 p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <div className='text-sm text-slate-500'>当前账号</div>
                    <div className='mt-1 text-lg font-semibold text-slate-900'>
                      {quota.currentUser.roleLabel}
                    </div>
                  </div>
                  <Badge
                    className={getStatusTone(
                      quota.currentUser.hasUnlimited
                        ? 'unlimited'
                        : quota.currentUser.daily.status
                    )}
                  >
                    {quota.currentUser.hasUnlimited
                      ? '无限制'
                      : quota.currentUser.daily.status}
                  </Badge>
                </div>

                <div className='mt-4 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-xl bg-slate-50 p-3'>
                    <div className='text-xs text-slate-500'>每日配额</div>
                    <div className='mt-1 text-xl font-semibold text-slate-900'>
                      {quota.currentUser.daily.limit <= 0
                        ? '无限制'
                        : `${formatCount(quota.currentUser.daily.used)} / ${formatCount(quota.currentUser.daily.limit)}`}
                    </div>
                    {quota.currentUser.daily.limit > 0 && (
                      <div className='mt-1 text-xs text-slate-500'>
                        剩余 {formatCount(quota.currentUser.daily.remaining)}
                        ，使用率{' '}
                        {formatPercent(quota.currentUser.daily.percentage)}
                      </div>
                    )}
                  </div>
                  <div className='rounded-xl bg-slate-50 p-3'>
                    <div className='text-xs text-slate-500'>每月配额</div>
                    <div className='mt-1 text-xl font-semibold text-slate-900'>
                      {quota.currentUser.monthly.limit <= 0
                        ? '无限制'
                        : `${formatCount(quota.currentUser.monthly.used)} / ${formatCount(quota.currentUser.monthly.limit)}`}
                    </div>
                    {quota.currentUser.monthly.limit > 0 && (
                      <div className='mt-1 text-xs text-slate-500'>
                        剩余 {formatCount(quota.currentUser.monthly.remaining)}
                        ，使用率{' '}
                        {formatPercent(quota.currentUser.monthly.percentage)}
                      </div>
                    )}
                  </div>
                </div>
                <div className='mt-3 text-xs text-slate-500'>
                  当前生效配额来源：
                  {quota.currentUser.quotaSource === 'membership'
                    ? `会员等级 ${quota.currentUser.quotaKey}`
                    : `角色 ${quota.currentUser.quotaKey}`}
                </div>
              </div>

              <div className='rounded-2xl border border-slate-200 p-4'>
                <div className='text-sm font-medium text-slate-900'>
                  系统角色策略
                </div>
                <div className='mt-3 space-y-2'>
                  {quota.policies.map(policy => (
                    <div
                      key={policy.role}
                      className='flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm'
                    >
                      <div>
                        <div className='font-medium text-slate-900'>
                          {policy.label}
                        </div>
                        <div className='text-xs text-slate-500'>
                          单次{' '}
                          {policy.perRequestLimit <= 0
                            ? '无限制'
                            : policy.perRequestLimit}
                        </div>
                      </div>
                      <div className='text-right text-xs text-slate-600'>
                        <div>
                          {policy.dailyLimit <= 0
                            ? '每日无限制'
                            : `日 ${policy.dailyLimit}`}
                        </div>
                        <div>
                          {policy.monthlyLimit <= 0
                            ? '每月无限制'
                            : `月 ${policy.monthlyLimit}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className='rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
            {data.quota.ok ? '暂无配额数据' : data.quota.error}
          </div>
        )}
      </SectionShell>

      <SectionShell
        id='notifications'
        title='通知'
        description='通知渠道与最近通知'
      >
        {notifications ? (
          <div className='space-y-4'>
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
              {notifications.channels.map(channel => (
                <div
                  key={channel.name}
                  className='rounded-2xl border border-slate-200 p-4'
                >
                  <div className='flex items-center justify-between'>
                    <div className='font-medium text-slate-900'>
                      {channel.name}
                    </div>
                    <Badge
                      className={getStatusTone(
                        channel.enabled ? 'healthy' : 'unhealthy'
                      )}
                    >
                      {channel.enabled ? '启用' : '关闭'}
                    </Badge>
                  </div>
                  <div className='mt-2 text-xs text-slate-500'>
                    {channel.description}
                  </div>
                  <div className='mt-1 text-xs text-slate-400'>
                    {channel.reason}
                  </div>
                </div>
              ))}
            </div>

            <div className='overflow-hidden rounded-2xl border border-slate-200'>
              <table className='min-w-full divide-y divide-slate-200 text-sm'>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>标题</th>
                    <th className='px-4 py-3'>类型</th>
                    <th className='px-4 py-3'>状态</th>
                    <th className='px-4 py-3'>时间</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100 bg-white'>
                  {notifications.recent.map(item => (
                    <tr key={item.id}>
                      <td className='px-4 py-3'>
                        <div className='font-medium text-slate-900'>
                          {item.title}
                        </div>
                        <div className='max-w-2xl truncate text-xs text-slate-500'>
                          {item.content}
                        </div>
                      </td>
                      <td className='px-4 py-3 text-slate-600'>{item.type}</td>
                      <td className='px-4 py-3'>
                        <Badge
                          className={getStatusTone(
                            item.status === 'UNREAD' ? 'unhealthy' : 'healthy'
                          )}
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className='px-4 py-3 text-slate-600'>
                        {formatDateTime(item.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {notifications.recent.length === 0 && (
                    <tr>
                      <td className='px-4 py-6 text-slate-500' colSpan={4}>
                        暂无通知
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className='rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
            {data.notifications.ok ? '暂无通知数据' : data.notifications.error}
          </div>
        )}
      </SectionShell>

      <SectionShell
        id='memory'
        title='记忆'
        description='Agent 记忆容量与类型分布'
      >
        {memory ? (
          <div className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-4'>
              <ValueCard
                title='总记忆'
                value={formatCount(memory.total)}
                icon={<HardDrive className='h-5 w-5' />}
              />
              <ValueCard
                title='活跃记忆'
                value={formatCount(memory.active)}
                icon={<Activity className='h-5 w-5' />}
              />
              <ValueCard
                title='已压缩'
                value={formatCount(memory.compressed)}
                icon={<TrendingUp className='h-5 w-5' />}
              />
              <ValueCard
                title='已过期'
                value={formatCount(memory.expired)}
                icon={<Clock className='h-5 w-5' />}
              />
            </div>

            <div className='overflow-hidden rounded-2xl border border-slate-200'>
              <table className='min-w-full divide-y divide-slate-200 text-sm'>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>类型</th>
                    <th className='px-4 py-3'>数量</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100 bg-white'>
                  {Object.entries(memory.byType).map(([type, count]) => (
                    <tr key={type}>
                      <td className='px-4 py-3 font-medium text-slate-900'>
                        {type}
                      </td>
                      <td className='px-4 py-3 text-slate-600'>
                        {formatCount(count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className='rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
            {data.memory.ok ? '暂无记忆数据' : data.memory.error}
          </div>
        )}
      </SectionShell>

      <SectionShell
        id='alerts'
        title='告警'
        description='告警状态与最新触发记录'
      >
        {alerts ? (
          <div className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-4'>
              <ValueCard
                title='已触发'
                value={formatCount(alerts.triggered)}
                icon={<AlertCircle className='h-5 w-5' />}
              />
              <ValueCard
                title='已确认'
                value={formatCount(alerts.acknowledged)}
                icon={<ShieldAlert className='h-5 w-5' />}
              />
              <ValueCard
                title='已解决'
                value={formatCount(alerts.resolved)}
                icon={<Activity className='h-5 w-5' />}
              />
              <ValueCard
                title='总告警'
                value={formatCount(alerts.total)}
                icon={<Server className='h-5 w-5' />}
              />
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='overflow-hidden rounded-2xl border border-slate-200'>
                <table className='min-w-full divide-y divide-slate-200 text-sm'>
                  <thead className='bg-slate-50 text-left text-slate-500'>
                    <tr>
                      <th className='px-4 py-3'>严重程度</th>
                      <th className='px-4 py-3'>数量</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-100 bg-white'>
                    {Object.entries(alerts.bySeverity).map(
                      ([severity, count]) => (
                        <tr key={severity}>
                          <td className='px-4 py-3 font-medium text-slate-900'>
                            {severity}
                          </td>
                          <td className='px-4 py-3 text-slate-600'>
                            {formatCount(count)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className='overflow-hidden rounded-2xl border border-slate-200'>
                <table className='min-w-full divide-y divide-slate-200 text-sm'>
                  <thead className='bg-slate-50 text-left text-slate-500'>
                    <tr>
                      <th className='px-4 py-3'>状态</th>
                      <th className='px-4 py-3'>数量</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-100 bg-white'>
                    {Object.entries(alerts.byStatus).map(([status, count]) => (
                      <tr key={status}>
                        <td className='px-4 py-3 font-medium text-slate-900'>
                          {status}
                        </td>
                        <td className='px-4 py-3 text-slate-600'>
                          {formatCount(count)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className='overflow-hidden rounded-2xl border border-slate-200'>
              <table className='min-w-full divide-y divide-slate-200 text-sm'>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>规则</th>
                    <th className='px-4 py-3'>严重程度</th>
                    <th className='px-4 py-3'>状态</th>
                    <th className='px-4 py-3'>时间</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100 bg-white'>
                  {alerts.recent.map(alert => (
                    <tr key={alert.alertId}>
                      <td className='px-4 py-3'>
                        <div className='font-medium text-slate-900'>
                          {alert.ruleName}
                        </div>
                        <div className='max-w-xl truncate text-xs text-slate-500'>
                          {alert.message}
                        </div>
                      </td>
                      <td className='px-4 py-3 text-slate-600'>
                        {alert.severity}
                      </td>
                      <td className='px-4 py-3 text-slate-600'>
                        {alert.status}
                      </td>
                      <td className='px-4 py-3 text-slate-600'>
                        {formatDateTime(alert.triggeredAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className='rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
            {data.alerts.ok ? '暂无告警数据' : data.alerts.error}
          </div>
        )}
      </SectionShell>

      <SectionShell
        id='monitoring'
        title='监控'
        description='Prometheus、限流与防护状态'
      >
        {monitoring ? (
          <div className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-3 xl:grid-cols-4'>
              <ValueCard
                title='Prometheus 收集器'
                value={formatCount(monitoring.prometheus.totalCollectors)}
                icon={<Database className='h-5 w-5' />}
              />
              <ValueCard
                title='Prometheus 指标'
                value={formatCount(monitoring.prometheus.totalMetrics)}
                icon={<TrendingUp className='h-5 w-5' />}
              />
              <ValueCard
                title='限流请求'
                value={formatCount(monitoring.rateLimit.monitor.totalRequests)}
                icon={<Wifi className='h-5 w-5' />}
              />
              <ValueCard
                title='被拦截请求'
                value={formatCount(
                  monitoring.rateLimit.monitor.blockedRequests
                )}
                icon={<ShieldAlert className='h-5 w-5' />}
              />
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='rounded-2xl border border-slate-200 p-4'>
                <div className='text-sm font-medium text-slate-900'>
                  限流配置
                </div>
                <div className='mt-3 space-y-2 text-sm text-slate-600'>
                  <div>
                    端点总数{' '}
                    {formatCount(monitoring.rateLimit.config.totalEndpoints)}
                  </div>
                  <div>
                    启用端点{' '}
                    {formatCount(monitoring.rateLimit.config.enabledEndpoints)}
                  </div>
                  <div>
                    禁用端点{' '}
                    {formatCount(monitoring.rateLimit.config.disabledEndpoints)}
                  </div>
                  <div>全局模式 {monitoring.rateLimit.ipFilter.mode}</div>
                </div>
              </div>

              <div className='rounded-2xl border border-slate-200 p-4'>
                <div className='text-sm font-medium text-slate-900'>
                  服务器负载
                </div>
                <div className='mt-3 space-y-2 text-sm text-slate-600'>
                  <div>
                    CPU{' '}
                    {formatPercent(
                      monitoring.rateLimit.adaptive.serverLoad.cpuUsage
                    )}
                  </div>
                  <div>
                    内存{' '}
                    {formatPercent(
                      monitoring.rateLimit.adaptive.serverLoad.memoryUsage
                    )}
                  </div>
                  <div>
                    每秒请求{' '}
                    {formatCount(
                      monitoring.rateLimit.adaptive.serverLoad.requestsPerSecond
                    )}
                  </div>
                  <div>
                    活跃连接{' '}
                    {formatCount(
                      monitoring.rateLimit.adaptive.serverLoad.activeConnections
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className='grid gap-3 lg:grid-cols-2'>
              {MONITOR_ACTION_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition hover:border-blue-300 hover:bg-white'
                >
                  <div className='font-medium text-slate-900'>{link.label}</div>
                  <div className='mt-1 text-xs text-slate-500'>
                    {link.description}
                  </div>
                </Link>
              ))}
            </div>

            <div className='overflow-hidden rounded-2xl border border-slate-200'>
              <table className='min-w-full divide-y divide-slate-200 text-sm'>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>指标类型</th>
                    <th className='px-4 py-3'>数量</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100 bg-white'>
                  {Object.entries(monitoring.prometheus.metricsByType).map(
                    ([type, count]) => (
                      <tr key={type}>
                        <td className='px-4 py-3 font-medium text-slate-900'>
                          {type}
                        </td>
                        <td className='px-4 py-3 text-slate-600'>
                          {formatCount(count)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className='rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
            {data.monitoring.ok ? '暂无监控数据' : data.monitoring.error}
          </div>
        )}
      </SectionShell>
    </div>
  );
}
