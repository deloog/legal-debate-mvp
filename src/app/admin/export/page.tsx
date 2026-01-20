import { useEffect, useState } from 'react';
import {
  ExportFormat,
  TimeRange,
  CaseExportQueryParams,
  StatsExportQueryParams,
  StatsExportType,
  ExportTask,
  ExportTaskStatus,
} from '@/types/stats';

export const metadata = {
  title: '数据导出',
  description: '管理系统数据导出',
};

interface ExportFormData {
  exportType: 'CASES' | 'STATS';
  format: ExportFormat;
  timeRange: TimeRange;
  customStartDate: string;
  customEndDate: string;
  statsExportType?: StatsExportType;
}

export default function ExportPage(): React.ReactElement {
  const [formData, setFormData] = useState<ExportFormData>({
    exportType: 'CASES',
    format: ExportFormat.CSV,
    timeRange: TimeRange.LAST_30_DAYS,
    customStartDate: '',
    customEndDate: '',
    statsExportType: StatsExportType.USER_REGISTRATION,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [exportTasks, setExportTasks] = useState<ExportTask[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExportTasks();
  }, []);

  const loadExportTasks = async () => {
    try {
      // TODO: 实现从API获取导出任务列表
      setExportTasks([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载导出历史失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (formData.exportType === 'CASES') {
        await exportCases();
      } else {
        await exportStats();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setLoading(false);
    }
  };

  const exportCases = async () => {
    const params: CaseExportQueryParams = {
      format: formData.format,
      timeRange:
        formData.timeRange === TimeRange.CUSTOM
          ? undefined
          : formData.timeRange,
      customRange:
        formData.timeRange === TimeRange.CUSTOM
          ? {
              startDate: formData.customStartDate,
              endDate: formData.customEndDate,
            }
          : undefined,
    };

    const response = await fetch('/api/admin/export/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('导出案件数据失败');
    }

    const result = await response.json();
    if (result.success && result.data.filename) {
      downloadFile(result.data.filename, result.data.filename);
      await loadExportTasks();
    }
  };

  const exportStats = async () => {
    if (!formData.statsExportType) {
      throw new Error('请选择统计导出类型');
    }

    const params: StatsExportQueryParams = {
      format: formData.format,
      exportType: formData.statsExportType,
      timeRange:
        formData.timeRange === TimeRange.CUSTOM
          ? undefined
          : formData.timeRange,
      customRange:
        formData.timeRange === TimeRange.CUSTOM
          ? {
              startDate: formData.customStartDate,
              endDate: formData.customEndDate,
            }
          : undefined,
    };

    const response = await fetch('/api/admin/export/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('导出统计数据失败');
    }

    const result = await response.json();
    if (result.success && result.data.filename) {
      downloadFile(result.data.filename, result.data.filename);
      await loadExportTasks();
    }
  };

  const downloadFile = (filename: string, displayName: string) => {
    const link = document.createElement('a');
    link.href = `/api/admin/export/download?filename=${encodeURIComponent(filename)}`;
    link.download = displayName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className='mb-6'>
        <h2 className='text-2xl font-bold text-gray-900'>数据导出</h2>
        <p className='text-gray-600 mt-2'>导出系统数据用于离线分析</p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* 导出表单 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>
            创建导出任务
          </h2>

          <form onSubmit={handleSubmit} className='space-y-4'>
            {/* 导出类型 */}
            <div>
              <label
                htmlFor='export-type'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                导出类型
              </label>
              <select
                id='export-type'
                value={formData.exportType}
                onChange={e =>
                  setFormData({
                    ...formData,
                    exportType: e.target.value as 'CASES' | 'STATS',
                  })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='CASES'>案件数据</option>
                <option value='STATS'>统计数据</option>
              </select>
            </div>

            {/* 导出格式 */}
            <div>
              <label
                htmlFor='export-format'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                导出格式
              </label>
              <select
                id='export-format'
                value={formData.format}
                onChange={e =>
                  setFormData({
                    ...formData,
                    format: e.target.value as ExportFormat,
                  })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value={ExportFormat.CSV}>CSV</option>
                <option value={ExportFormat.EXCEL}>Excel</option>
                <option value={ExportFormat.JSON}>JSON</option>
              </select>
            </div>

            {/* 时间范围 */}
            <div>
              <label
                htmlFor='time-range'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                时间范围
              </label>
              <select
                id='time-range'
                value={formData.timeRange}
                onChange={e =>
                  setFormData({
                    ...formData,
                    timeRange: e.target.value as TimeRange,
                  })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value={TimeRange.LAST_7_DAYS}>近7天</option>
                <option value={TimeRange.LAST_30_DAYS}>近30天</option>
                <option value={TimeRange.LAST_90_DAYS}>近90天</option>
                <option value={TimeRange.CUSTOM}>自定义</option>
              </select>
            </div>

            {/* 自定义时间范围 */}
            {formData.timeRange === TimeRange.CUSTOM && (
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label
                    htmlFor='custom-start-date'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    开始日期
                  </label>
                  <input
                    id='custom-start-date'
                    type='date'
                    value={formData.customStartDate}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        customStartDate: e.target.value,
                      })
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor='custom-end-date'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    结束日期
                  </label>
                  <input
                    id='custom-end-date'
                    type='date'
                    value={formData.customEndDate}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        customEndDate: e.target.value,
                      })
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                    required
                  />
                </div>
              </div>
            )}

            {/* 统计导出类型 */}
            {formData.exportType === 'STATS' && (
              <div>
                <label
                  htmlFor='stats-export-type'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  统计类型
                </label>
                <select
                  id='stats-export-type'
                  value={formData.statsExportType}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      statsExportType: e.target.value as StatsExportType,
                    })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value={StatsExportType.USER_REGISTRATION}>
                    用户注册
                  </option>
                  <option value={StatsExportType.USER_ACTIVITY}>
                    用户活跃度
                  </option>
                  <option value={StatsExportType.CASE_TYPE_DISTRIBUTION}>
                    案件类型分布
                  </option>
                  <option value={StatsExportType.CASE_EFFICIENCY}>
                    案件效率
                  </option>
                  <option value={StatsExportType.DEBATE_GENERATION}>
                    辩论生成
                  </option>
                  <option value={StatsExportType.DEBATE_QUALITY}>
                    辩论质量
                  </option>
                  <option value={StatsExportType.PERFORMANCE_RESPONSE_TIME}>
                    性能响应时间
                  </option>
                  <option value={StatsExportType.PERFORMANCE_ERROR_RATE}>
                    性能错误率
                  </option>
                </select>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className='p-4 bg-red-50 border border-red-200 rounded-md'>
                <p className='text-sm text-red-600'>{error}</p>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type='submit'
              disabled={loading}
              className='w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? '导出中...' : '导出数据'}
            </button>
          </form>
        </div>

        {/* 导出历史 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>导出历史</h2>

          {exportTasks.length === 0 ? (
            <p className='text-gray-500 text-center py-8'>暂无导出记录</p>
          ) : (
            <div className='space-y-3'>
              {exportTasks.map(task => (
                <ExportTaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ExportTaskItemProps {
  task: ExportTask;
}

const ExportTaskItem: React.FC<ExportTaskItemProps> = ({ task }) => {
  const getStatusColor = (status: ExportTaskStatus): string => {
    switch (status) {
      case ExportTaskStatus.COMPLETED:
        return 'text-green-600 bg-green-50';
      case ExportTaskStatus.FAILED:
        return 'text-red-600 bg-red-50';
      case ExportTaskStatus.PROCESSING:
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: ExportTaskStatus): string => {
    switch (status) {
      case ExportTaskStatus.COMPLETED:
        return '已完成';
      case ExportTaskStatus.FAILED:
        return '失败';
      case ExportTaskStatus.PROCESSING:
        return '处理中';
      default:
        return '待处理';
    }
  };

  return (
    <div className='p-4 border border-gray-200 rounded-md hover:bg-gray-50'>
      <div className='flex items-center justify-between'>
        <div className='flex-1'>
          <h3 className='text-sm font-medium text-gray-900'>{task.filename}</h3>
          <p className='text-xs text-gray-500 mt-1'>
            {task.exportType} · {task.format}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
              task.status
            )}`}
          >
            {getStatusLabel(task.status)}
          </span>
          {task.status === ExportTaskStatus.COMPLETED && (
            <button
              onClick={() => downloadFile(task.filename, task.filename)}
              className='text-blue-600 hover:text-blue-900 text-sm'
            >
              下载
            </button>
          )}
        </div>
      </div>
      {task.progress < 100 && task.status !== ExportTaskStatus.COMPLETED && (
        <div className='mt-2'>
          <div className='w-full bg-gray-200 rounded-full h-2'>
            <div
              className='bg-blue-600 h-2 rounded-full transition-all'
              style={{ width: `${task.progress}%` }}
            ></div>
          </div>
          <p className='text-xs text-gray-500 mt-1'>{task.progress}% 完成</p>
        </div>
      )}
    </div>
  );
};

const downloadFile = (filename: string, displayName: string): void => {
  const link = document.createElement('a');
  link.href = `/api/admin/export/download?filename=${encodeURIComponent(filename)}`;
  link.download = displayName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
