import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReportType, ReportStatus, ReportListResponse } from '@/types/stats';

export const metadata = {
  title: '报告管理',
  description: '管理系统报告',
};

interface ReportFilters {
  type?: ReportType;
  status?: ReportStatus;
  periodStart?: string;
  periodEnd?: string;
  search?: string;
}

export default function ReportsPage(): React.ReactElement {
  const router = useRouter();
  const [reports, setReports] = useState<ReportListResponse['reports']>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    type: undefined,
    status: undefined,
    periodStart: '',
    periodEnd: '',
    search: '',
  });
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters.type) {
        queryParams.append('type', filters.type);
      }
      if (filters.status) {
        queryParams.append('status', filters.status);
      }
      if (filters.periodStart) {
        queryParams.append('periodStart', filters.periodStart);
      }
      if (filters.periodEnd) {
        queryParams.append('periodEnd', filters.periodEnd);
      }
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());

      const response = await fetch(
        `/api/admin/reports?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取报告列表失败');
      }

      const result = await response.json();
      if (result.success) {
        setReports(result.data.reports);
        setTotal(result.data.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载报告失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此报告吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/reports/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除报告失败');
      }

      const result = await response.json();
      if (result.success) {
        await loadReports();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除报告失败');
    }
  };

  const handleDownload = (reportId: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = `/api/admin/reports/${reportId}/download`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const handleSearch = () => {
    loadReports();
  };

  const getStatusColor = (status: ReportStatus): string => {
    switch (status) {
      case ReportStatus.COMPLETED:
        return 'text-green-600 bg-green-50';
      case ReportStatus.FAILED:
        return 'text-red-600 bg-red-50';
      case ReportStatus.GENERATING:
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: ReportStatus): string => {
    switch (status) {
      case ReportStatus.COMPLETED:
        return '已完成';
      case ReportStatus.FAILED:
        return '失败';
      case ReportStatus.GENERATING:
        return '生成中';
      default:
        return '待处理';
    }
  };

  const getTypeLabel = (type: ReportType): string => {
    switch (type) {
      case ReportType.WEEKLY:
        return '周报';
      case ReportType.MONTHLY:
        return '月报';
      case ReportType.CUSTOM:
        return '自定义';
      default:
        return '未知';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  return (
    <div>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold text-gray-900'>报告管理</h2>
          <p className='text-gray-600 mt-2'>管理系统生成的各类报告</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          生成报告
        </button>
      </div>

      {/* 筛选栏 */}
      <div className='bg-white rounded-lg shadow p-6 mb-6'>
        <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
          {/* 报告类型 */}
          <div>
            <label
              htmlFor='report-type'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              报告类型
            </label>
            <select
              id='report-type'
              value={filters.type || ''}
              onChange={e => handleFilterChange('type', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>全部</option>
              <option value={ReportType.WEEKLY}>周报</option>
              <option value={ReportType.MONTHLY}>月报</option>
              <option value={ReportType.CUSTOM}>自定义</option>
            </select>
          </div>

          {/* 状态 */}
          <div>
            <label
              htmlFor='report-status'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              状态
            </label>
            <select
              id='report-status'
              value={filters.status || ''}
              onChange={e => handleFilterChange('status', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>全部</option>
              <option value={ReportStatus.PENDING}>待处理</option>
              <option value={ReportStatus.GENERATING}>生成中</option>
              <option value={ReportStatus.COMPLETED}>已完成</option>
              <option value={ReportStatus.FAILED}>失败</option>
            </select>
          </div>

          {/* 开始日期 */}
          <div>
            <label
              htmlFor='period-start'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              开始日期
            </label>
            <input
              id='period-start'
              type='date'
              value={filters.periodStart}
              onChange={e => handleFilterChange('periodStart', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          {/* 结束日期 */}
          <div>
            <label
              htmlFor='period-end'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              结束日期
            </label>
            <input
              id='period-end'
              type='date'
              value={filters.periodEnd}
              onChange={e => handleFilterChange('periodEnd', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          {/* 搜索按钮 */}
          <div className='flex items-end'>
            <button
              onClick={handleSearch}
              className='w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              搜索
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-sm text-red-600'>{error}</p>
        </div>
      )}

      {/* 报告列表 */}
      {loading ? (
        <div className='bg-white rounded-lg shadow p-6'>
          <div className='text-center py-8'>
            <div className='text-gray-600'>加载中...</div>
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className='bg-white rounded-lg shadow p-6'>
          <div className='text-center py-8'>
            <p className='text-gray-500'>暂无报告记录</p>
          </div>
        </div>
      ) : (
        <div className='bg-white rounded-lg shadow overflow-hidden'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  报告名称
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  类型
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  状态
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  时间范围
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  大小
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  生成时间
                </th>
                <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  操作
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {reports.map(report => (
                <tr key={report.id} className='hover:bg-gray-50'>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div
                      className='text-sm font-medium text-blue-600 hover:text-blue-900 cursor-pointer'
                      onClick={() => router.push(`/admin/reports/${report.id}`)}
                    >
                      {report.fileName}
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <span className='text-sm text-gray-900'>
                      {getTypeLabel(report.type)}
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                        report.status
                      )}`}
                    >
                      {getStatusLabel(report.status)}
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {report.periodStart} ~ {report.periodEnd}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {formatFileSize(report.fileSize)}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {report.generatedAt
                      ? new Date(report.generatedAt).toLocaleString('zh-CN')
                      : '-'}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                    {report.status === ReportStatus.COMPLETED && (
                      <button
                        onClick={() =>
                          handleDownload(report.id, report.fileName)
                        }
                        className='text-blue-600 hover:text-blue-900 mr-4'
                      >
                        下载
                      </button>
                    )}
                    {report.status === ReportStatus.FAILED && (
                      <button
                        onClick={() => handleDelete(report.id)}
                        className='text-red-600 hover:text-red-900'
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 分页 */}
          <div className='bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200'>
            <div className='text-sm text-gray-700'>
              共 {total} 条记录，第 {page} 页
            </div>
            <div className='flex gap-2'>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className='px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p + 1))}
                disabled={page * limit >= total}
                className='px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 生成报告弹窗 */}
      {showGenerateModal && (
        <GenerateReportModal
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => {
            setShowGenerateModal(false);
            loadReports();
          }}
        />
      )}
    </div>
  );
}

interface GenerateReportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const GenerateReportModal: React.FC<GenerateReportModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<{
    type: ReportType;
    periodStart: string;
    periodEnd: string;
  }>({
    type: ReportType.WEEKLY,
    periodStart: '',
    periodEnd: '',
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('生成报告失败');
      }

      const result = await response.json();
      if (result.success) {
        alert('报告生成请求已提交，请稍后查看');
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成报告失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-xl max-w-md w-full mx-4'>
        <div className='p-6 border-b border-gray-200'>
          <h3 className='text-lg font-semibold text-gray-900'>生成报告</h3>
        </div>
        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          {/* 报告类型 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              报告类型
            </label>
            <select
              value={formData.type}
              onChange={e =>
                setFormData({
                  ...formData,
                  type: e.target.value as ReportType,
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value={ReportType.WEEKLY}>周报</option>
              <option value={ReportType.MONTHLY}>月报</option>
              <option value={ReportType.CUSTOM}>自定义</option>
            </select>
          </div>

          {/* 时间范围 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              时间范围
            </label>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <input
                  type='date'
                  value={formData.periodStart}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      periodStart: e.target.value,
                    })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  required
                />
              </div>
              <div>
                <input
                  type='date'
                  value={formData.periodEnd}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      periodEnd: e.target.value,
                    })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  required
                />
              </div>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className='p-4 bg-red-50 border border-red-200 rounded-md'>
              <p className='text-sm text-red-600'>{error}</p>
            </div>
          )}

          {/* 按钮 */}
          <div className='flex gap-3'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500'
            >
              取消
            </button>
            <button
              type='submit'
              disabled={loading}
              className='flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? '生成中...' : '生成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
