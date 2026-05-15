'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

type ReputationLevel =
  | 'unknown'
  | 'trusted'
  | 'normal'
  | 'suspicious'
  | 'malicious';

interface RateLimitStatsResponse {
  success: boolean;
  data?: {
    rateLimitStats: {
      totalRequests: number;
      blockedRequests: number;
      blockRate: number;
    };
    configStats: {
      totalEndpoints: number;
      enabledEndpoints: number;
      disabledEndpoints: number;
      byLimitType: Record<string, number>;
    };
    globalSettings: {
      enabled: boolean;
      defaultWindowMs: number;
      defaultMaxRequests: number;
      autoBlockEnabled: boolean;
      autoBlockThreshold: number;
      autoBlockDuration: number;
    };
    adaptiveStats: {
      totalUsers: number;
      byLevel: Record<ReputationLevel, number>;
      averageScore: number;
    };
    ipFilterStats: {
      mode: 'blacklist' | 'whitelist' | 'off';
      blacklistSize: number;
      whitelistSize: number;
    };
    timestamp: string;
  };
  error?: string;
}

interface RateLimitConfigResponse {
  success: boolean;
  data?: {
    endpoints: Array<{
      endpoint: string;
      windowMs: number;
      maxRequests: number;
      limitType: 'strict' | 'moderate' | 'lenient' | 'custom';
      enabled: boolean;
      message?: string;
      updatedAt: string;
    }>;
    globalSettings: {
      enabled: boolean;
      defaultWindowMs: number;
      defaultMaxRequests: number;
      autoBlockEnabled: boolean;
      autoBlockThreshold: number;
      autoBlockDuration: number;
    };
  };
  error?: string;
}

interface IpFilterResponse {
  success: boolean;
  data?: {
    blacklist: Array<{
      ip: string;
      reason?: string;
      addedAt: string;
      expiresAt?: string;
    }>;
    whitelist: Array<{
      ip: string;
      reason?: string;
      addedAt: string;
      expiresAt?: string;
    }>;
    stats: {
      mode: 'blacklist' | 'whitelist' | 'off';
      blacklistSize: number;
      whitelistSize: number;
    };
  };
  error?: string;
}

interface ReputationResponse {
  success: boolean;
  data?: {
    reputations: Array<{
      identifier: string;
      level: ReputationLevel;
      score: number;
      violationCount: number;
      successfulRequests: number;
      updatedAt: string;
    }>;
    total: number;
  };
  error?: string;
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
}

async function requestStepUp(): Promise<string | null> {
  const password = window.prompt('请输入当前管理员密码以完成二次认证');
  if (!password) {
    return null;
  }

  const response = await fetch('/api/admin/security/step-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const result = (await response.json()) as {
    success?: boolean;
    data?: { token?: string };
    message?: string;
  };

  if (!response.ok || !result.success || !result.data?.token) {
    window.alert(result.message || '二次认证失败');
    return null;
  }

  return result.data.token;
}

function withStepUpHeaders(
  headers: HeadersInit = {},
  token?: string
): HeadersInit {
  const finalHeaders = new Headers(headers);
  if (token) {
    finalHeaders.set('x-admin-step-up-token', token);
  }
  return finalHeaders;
}

export default function SystemMonitoringControlPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<RateLimitStatsResponse['data'] | null>(
    null
  );
  const [configData, setConfigData] = useState<
    RateLimitConfigResponse['data'] | null
  >(null);
  const [ipData, setIpData] = useState<IpFilterResponse['data'] | null>(null);
  const [reputationData, setReputationData] = useState<
    ReputationResponse['data'] | null
  >(null);

  const [newIp, setNewIp] = useState('');
  const [ipReason, setIpReason] = useState('');
  const [ipListType, setIpListType] = useState<'blacklist' | 'whitelist'>(
    'blacklist'
  );
  const [ipMode, setIpMode] = useState<'blacklist' | 'whitelist' | 'off'>(
    'blacklist'
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, configRes, ipRes, reputationRes] = await Promise.all([
        fetch('/api/admin/rate-limit/stats'),
        fetch('/api/admin/rate-limit/config'),
        fetch('/api/admin/ip-filter'),
        fetch('/api/admin/reputation'),
      ]);

      const statsJson = (await statsRes.json()) as RateLimitStatsResponse;
      const configJson = (await configRes.json()) as RateLimitConfigResponse;
      const ipJson = (await ipRes.json()) as IpFilterResponse;
      const reputationJson = (await reputationRes.json()) as ReputationResponse;

      if (!statsRes.ok || !statsJson.success || !statsJson.data) {
        throw new Error(statsJson.error || '加载限流统计失败');
      }
      if (!configRes.ok || !configJson.success || !configJson.data) {
        throw new Error(configJson.error || '加载限流配置失败');
      }
      if (!ipRes.ok || !ipJson.success || !ipJson.data) {
        throw new Error(ipJson.error || '加载IP过滤失败');
      }
      if (
        !reputationRes.ok ||
        !reputationJson.success ||
        !reputationJson.data
      ) {
        throw new Error(reputationJson.error || '加载信誉数据失败');
      }

      setStats(statsJson.data);
      setConfigData(configJson.data);
      setIpData(ipJson.data);
      setReputationData(reputationJson.data);
      setIpMode(ipJson.data.stats.mode);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const mutateWithStepUp = async (
    request: () => Promise<Response>,
    successMessage: string
  ) => {
    let response = await request();
    let result = (await response.json()) as {
      success?: boolean;
      error?: string | { code?: string; message?: string };
      message?: string;
    };

    let errorCode =
      typeof result.error === 'string' ? result.error : result.error?.code;
    let errorMessage =
      typeof result.error === 'string' ? result.error : result.error?.message;
    if (!errorMessage) {
      errorMessage = result.message;
    }

    if (response.status === 403 && errorCode === 'STEP_UP_REQUIRED') {
      const token = await requestStepUp();
      if (!token) return;
      response = await request();
      result = (await response.json()) as {
        success?: boolean;
        error?: string | { code?: string; message?: string };
        message?: string;
      };
      errorCode =
        typeof result.error === 'string' ? result.error : result.error?.code;
      errorMessage =
        typeof result.error === 'string' ? result.error : result.error?.message;
      if (!errorMessage) {
        errorMessage = result.message;
      }
    }

    if (!response.ok || !result.success) {
      window.alert(errorMessage || '操作失败');
      return;
    }

    window.alert(successMessage);
    await loadAll();
  };

  const addIp = async () => {
    if (!newIp.trim()) {
      window.alert('请输入IP');
      return;
    }

    await mutateWithStepUp(
      () =>
        fetch('/api/admin/ip-filter', {
          method: 'POST',
          headers: withStepUpHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            ip: newIp.trim(),
            listType: ipListType,
            reason: ipReason || undefined,
            changeReason: ipReason || `手动添加IP到${ipListType}`,
          }),
        }),
      'IP已添加'
    );
    setNewIp('');
    setIpReason('');
  };

  const removeIp = async (ip: string, listType: 'blacklist' | 'whitelist') => {
    await mutateWithStepUp(
      () =>
        fetch(
          `/api/admin/ip-filter?ip=${encodeURIComponent(ip)}&listType=${listType}&changeReason=${encodeURIComponent('手动移除IP')}`,
          {
            method: 'DELETE',
            headers: withStepUpHeaders({}),
          }
        ),
      'IP已移除'
    );
  };

  const updateMode = async () => {
    await mutateWithStepUp(
      () =>
        fetch('/api/admin/ip-filter', {
          method: 'PUT',
          headers: withStepUpHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            mode: ipMode,
            changeReason: `切换IP过滤模式到 ${ipMode}`,
          }),
        }),
      '过滤模式已更新'
    );
  };

  if (loading) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center text-slate-500'>
        <Loader2 className='mr-2 h-5 w-5 animate-spin' />
        正在加载系统防护控制台...
      </div>
    );
  }

  if (error) {
    return (
      <div className='rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700'>
        <div className='font-semibold'>加载失败</div>
        <div className='mt-2 text-sm'>{error}</div>
        <button
          onClick={() => void loadAll()}
          className='mt-4 inline-flex items-center rounded-lg bg-rose-600 px-3 py-2 text-sm text-white'
        >
          <RefreshCw className='mr-2 h-4 w-4' />
          重试
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
        <h1 className='text-2xl font-bold text-slate-900'>系统防护控制台</h1>
        <p className='mt-2 text-sm text-slate-500'>
          集中管理限流、IP过滤与信誉治理配置，所有写操作均需要二次认证。
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <div className='rounded-xl border border-slate-200 bg-white p-4'>
          <div className='text-sm text-slate-500'>限流请求</div>
          <div className='mt-1 text-2xl font-semibold text-slate-900'>
            {stats?.rateLimitStats.totalRequests ?? 0}
          </div>
        </div>
        <div className='rounded-xl border border-slate-200 bg-white p-4'>
          <div className='text-sm text-slate-500'>拦截请求</div>
          <div className='mt-1 text-2xl font-semibold text-rose-600'>
            {stats?.rateLimitStats.blockedRequests ?? 0}
          </div>
        </div>
        <div className='rounded-xl border border-slate-200 bg-white p-4'>
          <div className='text-sm text-slate-500'>拦截率</div>
          <div className='mt-1 text-2xl font-semibold text-slate-900'>
            {stats?.rateLimitStats.blockRate ?? 0}%
          </div>
        </div>
        <div className='rounded-xl border border-slate-200 bg-white p-4'>
          <div className='text-sm text-slate-500'>信誉样本</div>
          <div className='mt-1 text-2xl font-semibold text-slate-900'>
            {reputationData?.total ?? 0}
          </div>
        </div>
      </div>

      <div className='grid gap-6 lg:grid-cols-2'>
        <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
          <h2 className='text-lg font-semibold text-slate-900'>限流配置概览</h2>
          <div className='mt-4 space-y-2 text-sm text-slate-600'>
            <div>
              端点总数: {configData?.endpoints.length ?? 0}（启用{' '}
              {stats?.configStats.enabledEndpoints ?? 0}）
            </div>
            <div>默认窗口: {stats?.globalSettings.defaultWindowMs ?? 0}ms</div>
            <div>默认阈值: {stats?.globalSettings.defaultMaxRequests ?? 0}</div>
            <div>
              自动封禁:{' '}
              {stats?.globalSettings.autoBlockEnabled ? '开启' : '关闭'}
            </div>
            <div>最近统计时间: {formatDateTime(stats?.timestamp)}</div>
          </div>
        </div>

        <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
          <h2 className='text-lg font-semibold text-slate-900'>IP过滤模式</h2>
          <div className='mt-4 flex items-center gap-3'>
            <select
              value={ipMode}
              onChange={e =>
                setIpMode(e.target.value as 'blacklist' | 'whitelist' | 'off')
              }
              className='rounded-lg border border-slate-300 px-3 py-2 text-sm'
            >
              <option value='blacklist'>blacklist</option>
              <option value='whitelist'>whitelist</option>
              <option value='off'>off</option>
            </select>
            <button
              onClick={() => void updateMode()}
              className='rounded-lg bg-blue-600 px-3 py-2 text-sm text-white'
            >
              应用模式
            </button>
          </div>
          <div className='mt-3 text-sm text-slate-600'>
            黑名单 {ipData?.stats.blacklistSize ?? 0} 条，白名单{' '}
            {ipData?.stats.whitelistSize ?? 0} 条
          </div>
        </div>
      </div>

      <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
        <h2 className='text-lg font-semibold text-slate-900'>IP名单管理</h2>
        <div className='mt-4 grid gap-3 md:grid-cols-4'>
          <input
            value={newIp}
            onChange={e => setNewIp(e.target.value)}
            placeholder='IP 地址'
            className='rounded-lg border border-slate-300 px-3 py-2 text-sm'
          />
          <select
            value={ipListType}
            onChange={e =>
              setIpListType(e.target.value as 'blacklist' | 'whitelist')
            }
            className='rounded-lg border border-slate-300 px-3 py-2 text-sm'
          >
            <option value='blacklist'>blacklist</option>
            <option value='whitelist'>whitelist</option>
          </select>
          <input
            value={ipReason}
            onChange={e => setIpReason(e.target.value)}
            placeholder='操作原因（必填）'
            className='rounded-lg border border-slate-300 px-3 py-2 text-sm'
          />
          <button
            onClick={() => void addIp()}
            className='rounded-lg bg-slate-900 px-3 py-2 text-sm text-white'
          >
            添加IP
          </button>
        </div>

        <div className='mt-6 grid gap-4 lg:grid-cols-2'>
          <div>
            <h3 className='mb-2 text-sm font-medium text-slate-900'>黑名单</h3>
            <div className='space-y-2'>
              {(ipData?.blacklist ?? []).map(item => (
                <div
                  key={`b-${item.ip}`}
                  className='flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm'
                >
                  <div>
                    <div className='font-medium text-slate-900'>{item.ip}</div>
                    <div className='text-xs text-slate-500'>
                      {item.reason || '无备注'} · {formatDateTime(item.addedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => void removeIp(item.ip, 'blacklist')}
                    className='text-xs text-rose-600'
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className='mb-2 text-sm font-medium text-slate-900'>白名单</h3>
            <div className='space-y-2'>
              {(ipData?.whitelist ?? []).map(item => (
                <div
                  key={`w-${item.ip}`}
                  className='flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm'
                >
                  <div>
                    <div className='font-medium text-slate-900'>{item.ip}</div>
                    <div className='text-xs text-slate-500'>
                      {item.reason || '无备注'} · {formatDateTime(item.addedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => void removeIp(item.ip, 'whitelist')}
                    className='text-xs text-rose-600'
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
        <h2 className='text-lg font-semibold text-slate-900'>信誉分布</h2>
        <div className='mt-4 overflow-x-auto'>
          <table className='min-w-full divide-y divide-slate-200 text-sm'>
            <thead className='bg-slate-50 text-left text-slate-500'>
              <tr>
                <th className='px-3 py-2'>标识符</th>
                <th className='px-3 py-2'>等级</th>
                <th className='px-3 py-2'>分数</th>
                <th className='px-3 py-2'>违规次数</th>
                <th className='px-3 py-2'>成功请求</th>
                <th className='px-3 py-2'>更新时间</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100 bg-white'>
              {(reputationData?.reputations ?? []).slice(0, 20).map(item => (
                <tr key={item.identifier}>
                  <td className='px-3 py-2 font-mono text-xs text-slate-700'>
                    {item.identifier}
                  </td>
                  <td className='px-3 py-2 text-slate-700'>{item.level}</td>
                  <td className='px-3 py-2 text-slate-700'>{item.score}</td>
                  <td className='px-3 py-2 text-slate-700'>
                    {item.violationCount}
                  </td>
                  <td className='px-3 py-2 text-slate-700'>
                    {item.successfulRequests}
                  </td>
                  <td className='px-3 py-2 text-slate-500'>
                    {formatDateTime(item.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
