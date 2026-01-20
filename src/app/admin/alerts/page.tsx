'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertViewer } from '@/components/admin/AlertViewer';
import { AlertDetail } from '@/components/admin/AlertDetail';
import { AlertStatistics } from '@/components/admin/AlertStatistics';
import { type AlertItem, type ErrorLogItem } from '@/types/log';

interface FilterState {
  severity: string;
  status: string;
  errorType: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [errorLog, setErrorLog] = useState<ErrorLogItem | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    severity: '',
    status: '',
    errorType: '',
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (filters.severity) {
        params.append('severity', filters.severity);
      }
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.errorType) {
        params.append('errorType', filters.errorType);
      }

      const response = await fetch(`/api/admin/alerts?${params.toString()}`);

      if (!response.ok) {
        throw new Error('获取告警列表失败');
      }

      const data = await response.json();
      setAlerts(data.data ?? []);
      setTotalCount(data.total ?? 0);
    } catch (error) {
      console.error('获取告警列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const fetchErrorLog = async (errorLogId: string) => {
    try {
      const response = await fetch(`/api/admin/logs/error/${errorLogId}`);

      if (!response.ok) {
        throw new Error('获取错误日志失败');
      }

      const data = await response.json();
      setErrorLog(data.data ?? null);
    } catch (error) {
      console.error('获取错误日志失败:', error);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleSelectAlert = (alert: AlertItem) => {
    setSelectedAlert(alert);
    if (alert.errorLogId) {
      fetchErrorLog(alert.errorLogId);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('确认告警失败');
      }

      await fetchAlerts();
      if (selectedAlert?.alertId === alertId) {
        const updatedAlert = await fetch(`/api/admin/alerts/${alertId}`);
        if (updatedAlert.ok) {
          const data = await updatedAlert.json();
          setSelectedAlert(data.data?.alert ?? null);
        }
      }
    } catch (error) {
      console.error('确认告警失败:', error);
    }
  };

  const handleResolve = async (alertId: string, notes: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error('处理告警失败');
      }

      await fetchAlerts();
      if (selectedAlert?.alertId === alertId) {
        const updatedAlert = await fetch(`/api/admin/alerts/${alertId}`);
        if (updatedAlert.ok) {
          const data = await updatedAlert.json();
          setSelectedAlert(data.data?.alert ?? null);
        }
      }
    } catch (error) {
      console.error('处理告警失败:', error);
    }
  };

  const calculateStatistics = () => {
    const statistics = {
      total: alerts.length,
      triggered: alerts.filter(a => a.status === 'TRIGGERED').length,
      acknowledged: alerts.filter(a => a.status === 'ACKNOWLEDGED').length,
      resolved: alerts.filter(a => a.status === 'RESOLVED').length,
      bySeverity: {
        CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
        HIGH: alerts.filter(a => a.severity === 'HIGH').length,
        MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
        LOW: alerts.filter(a => a.severity === 'LOW').length,
      },
      byType: {} as Record<string, number>,
    };

    alerts.forEach(alert => {
      const errorType = alert.errorType ?? 'UNKNOWN';
      statistics.byType[errorType] = (statistics.byType[errorType] ?? 0) + 1;
    });

    return statistics;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div>
      <div className='mb-6'>
        <h2 className='text-2xl font-bold text-gray-900'>告警监控</h2>
      </div>

      <div className='mb-6'>
        <AlertStatistics statistics={calculateStatistics()} />
      </div>

      <div className='bg-white rounded-lg shadow mb-6'>
        <div className='p-4 border-b border-gray-200'>
          <div className='flex gap-4'>
            <select
              value={filters.severity}
              onChange={e => {
                setFilters({ ...filters, severity: e.target.value });
                setPage(1);
              }}
              className='px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>所有严重程度</option>
              <option value='CRITICAL'>严重</option>
              <option value='HIGH'>高</option>
              <option value='MEDIUM'>中</option>
              <option value='LOW'>低</option>
            </select>

            <select
              value={filters.status}
              onChange={e => {
                setFilters({ ...filters, status: e.target.value });
                setPage(1);
              }}
              className='px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>所有状态</option>
              <option value='TRIGGERED'>已触发</option>
              <option value='ACKNOWLEDGED'>已确认</option>
              <option value='RESOLVED'>已解决</option>
            </select>

            <select
              value={filters.errorType}
              onChange={e => {
                setFilters({ ...filters, errorType: e.target.value });
                setPage(1);
              }}
              className='px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>所有错误类型</option>
              <option value='API_ERROR'>API错误</option>
              <option value='DATABASE_ERROR'>数据库错误</option>
              <option value='VALIDATION_ERROR'>验证错误</option>
              <option value='AUTHENTICATION_ERROR'>认证错误</option>
              <option value='AUTHORIZATION_ERROR'>授权错误</option>
            </select>
          </div>
        </div>

        <AlertViewer
          alerts={alerts}
          loading={loading}
          onSelectAlert={handleSelectAlert}
          selectedAlertId={selectedAlert?.alertId ?? null}
        />
      </div>

      {totalPages > 1 && (
        <div className='flex justify-center items-center gap-2 mt-4'>
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            上一页
          </button>
          <span className='text-gray-600'>
            第 {page} 页 / 共 {totalPages} 页
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            下一页
          </button>
        </div>
      )}

      {selectedAlert && (
        <AlertDetail
          alert={selectedAlert}
          errorLog={errorLog}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          onClose={() => {
            setSelectedAlert(null);
            setErrorLog(null);
          }}
        />
      )}
    </div>
  );
}
