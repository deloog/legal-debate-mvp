import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ReportDetailResponse, ReportContent } from '@/types/stats';

export const metadata = {
  title: '报告详情',
  description: '查看报告详情',
};

export default function ReportDetailPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;
  const [report, setReport] = useState<ReportDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`);

      if (!response.ok) {
        throw new Error('获取报告详情失败');
      }

      const result = await response.json();
      if (result.success) {
        setReport(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载报告失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!report) return;

    const link = document.createElement('a');
    link.href = `/api/admin/reports/${report.id}/download`;
    link.download = report.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除此报告吗？')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除报告失败');
      }

      const result = await response.json();
      if (result.success) {
        alert('报告已删除');
        router.push('/admin/reports');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除报告失败');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      PENDING: '待处理',
      GENERATING: '生成中',
      COMPLETED: '已完成',
      FAILED: '失败',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      PENDING: 'text-gray-600 bg-gray-50',
      GENERATING: 'text-blue-600 bg-blue-50',
      COMPLETED: 'text-green-600 bg-green-50',
      FAILED: 'text-red-600 bg-red-50',
    };
    return colorMap[status] || 'text-gray-600 bg-gray-50';
  };

  const getTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      WEEKLY: '周报',
      MONTHLY: '月报',
      CUSTOM: '自定义',
    };
    return typeMap[type] || type;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <div className='text-center py-8'>
          <div className='text-gray-600'>加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <div className='bg-red-50 border border-red-200 rounded-md p-6'>
          <p className='text-red-600'>{error}</p>
          <button
            onClick={() => router.push('/admin/reports')}
            className='mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* 页头 */}
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-4 mb-2'>
            <button
              onClick={() => router.push('/admin/reports')}
              className='text-blue-600 hover:text-blue-900'
            >
              ← 返回列表
            </button>
            <span
              className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(
                report.status
              )}`}
            >
              {getStatusLabel(report.status)}
            </span>
          </div>
          <h1 className='text-3xl font-bold text-gray-900'>
            {report.fileName}
          </h1>
          <p className='text-gray-600 mt-2'>
            {getTypeLabel(report.type)} · {report.periodStart} ~{' '}
            {report.periodEnd}
          </p>
        </div>
        <div className='flex gap-2'>
          {report.status === 'COMPLETED' && (
            <button
              onClick={handleDownload}
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
            >
              下载报告
            </button>
          )}
          {report.status === 'FAILED' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {deleting ? '删除中...' : '删除报告'}
            </button>
          )}
        </div>
      </div>

      {/* 报告信息卡片 */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6'>
        {/* 基本信息 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>基本信息</h2>
          <div className='space-y-3'>
            <div>
              <p className='text-sm text-gray-500'>报告类型</p>
              <p className='text-sm font-medium text-gray-900'>
                {getTypeLabel(report.type)}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>文件大小</p>
              <p className='text-sm font-medium text-gray-900'>
                {formatFileSize(report.fileSize)}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>下载次数</p>
              <p className='text-sm font-medium text-gray-900'>
                {report.downloadCount} 次
              </p>
            </div>
            {report.generatedAt && (
              <div>
                <p className='text-sm text-gray-500'>生成时间</p>
                <p className='text-sm font-medium text-gray-900'>
                  {new Date(report.generatedAt).toLocaleString('zh-CN')}
                </p>
              </div>
            )}
            <div>
              <p className='text-sm text-gray-500'>创建时间</p>
              <p className='text-sm font-medium text-gray-900'>
                {new Date(report.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        </div>

        {/* 元数据 */}
        <div className='bg-white rounded-lg shadow p-6 lg:col-span-2'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>元数据</h2>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <p className='text-sm text-gray-500'>数据点数</p>
              <p className='text-sm font-medium text-gray-900'>
                {report.metadata.dataPoints.toLocaleString()} 个
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>生成耗时</p>
              <p className='text-sm font-medium text-gray-900'>
                {(report.metadata.generationTime / 1000).toFixed(2)} 秒
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>开始时间</p>
              <p className='text-sm font-medium text-gray-900'>
                {new Date(report.metadata.periodStart).toLocaleString('zh-CN')}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>结束时间</p>
              <p className='text-sm font-medium text-gray-900'>
                {new Date(report.metadata.periodEnd).toLocaleString('zh-CN')}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>生成者</p>
              <p className='text-sm font-medium text-gray-900'>
                {report.metadata.generatedBy}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 报告内容 */}
      {report.content && (
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>报告内容</h2>
          <ReportContentDisplay content={report.content} />
        </div>
      )}
    </div>
  );
}

interface ReportContentDisplayProps {
  content: ReportContent;
}

const ReportContentDisplay: React.FC<ReportContentDisplayProps> = ({
  content,
}) => {
  return (
    <div className='space-y-6'>
      {/* 摘要 */}
      {content.summary && (
        <div>
          <h3 className='text-md font-semibold text-gray-900 mb-3'>摘要</h3>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <p className='text-sm text-gray-500 mb-2'>关键指标</p>
              <div className='space-y-2'>
                {content.summary.keyMetrics.map((metric, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between p-3 bg-gray-50 rounded-md'
                  >
                    <span className='text-sm text-gray-700'>
                      {metric.label}
                    </span>
                    <span className='text-sm font-medium text-gray-900'>
                      {metric.value} {metric.unit}
                      <span
                        className={`ml-2 ${
                          metric.change >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {metric.change >= 0 ? '+' : ''}
                        {metric.change}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className='space-y-4'>
              <div>
                <p className='text-sm text-gray-500 mb-2'>亮点</p>
                <ul className='space-y-1'>
                  {content.summary.highlights.map((highlight, index) => (
                    <li
                      key={index}
                      className='text-sm text-green-700 flex items-start'
                    >
                      <span className='mr-2'>✓</span>
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className='text-sm text-gray-500 mb-2'>问题</p>
                <ul className='space-y-1'>
                  {content.summary.issues.map((issue, index) => (
                    <li
                      key={index}
                      className='text-sm text-red-700 flex items-start'
                    >
                      <span className='mr-2'>⚠</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className='text-sm text-gray-500 mb-2'>建议</p>
                <ul className='space-y-1'>
                  {content.summary.recommendations.map(
                    (recommendation, index) => (
                      <li
                        key={index}
                        className='text-sm text-blue-700 flex items-start'
                      >
                        <span className='mr-2'>💡</span>
                        {recommendation}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 用户统计 */}
      {content.userStats && (
        <SectionCard title='用户统计' color='blue'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
            <StatItem
              label='总用户数'
              value={content.userStats.summary.totalUsers}
            />
            <StatItem
              label='新增用户'
              value={content.userStats.summary.newUsers}
            />
            <StatItem
              label='活跃用户'
              value={content.userStats.summary.activeUsers}
            />
            <StatItem
              label='增长率'
              value={`${content.userStats.summary.growthRate}%`}
            />
          </div>
        </SectionCard>
      )}

      {/* 案件统计 */}
      {content.caseStats && (
        <SectionCard title='案件统计' color='green'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
            <StatItem
              label='总案件数'
              value={content.caseStats.summary.totalCases}
            />
            <StatItem
              label='已完成'
              value={content.caseStats.summary.completedCases}
            />
            <StatItem
              label='活跃案件'
              value={content.caseStats.summary.activeCases}
            />
            <StatItem
              label='平均完成时间'
              value={`${content.caseStats.summary.averageCompletionTime}h`}
            />
          </div>
        </SectionCard>
      )}

      {/* 辩论统计 */}
      {content.debateStats && (
        <SectionCard title='辩论统计' color='purple'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
            <StatItem
              label='总辩论数'
              value={content.debateStats.summary.totalDebates}
            />
            <StatItem
              label='总论点数'
              value={content.debateStats.summary.totalArguments}
            />
            <StatItem
              label='平均论点数'
              value={content.debateStats.summary.averageArgumentsPerDebate.toFixed(
                1
              )}
            />
            <StatItem
              label='平均质量分'
              value={content.debateStats.summary.averageQualityScore.toFixed(2)}
            />
          </div>
        </SectionCard>
      )}

      {/* 性能统计 */}
      {content.performanceStats && (
        <SectionCard title='性能统计' color='orange'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
            <StatItem
              label='总请求数'
              value={content.performanceStats.summary.totalRequests.toLocaleString()}
            />
            <StatItem
              label='平均响应时间'
              value={`${content.performanceStats.summary.averageResponseTime}ms`}
            />
            <StatItem
              label='P95响应时间'
              value={`${content.performanceStats.summary.p95ResponseTime}ms`}
            />
            <StatItem
              label='错误率'
              value={`${content.performanceStats.summary.errorRate}%`}
            />
          </div>
        </SectionCard>
      )}
    </div>
  );
};

interface SectionCardProps {
  title: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  color,
  children,
}) => {
  const colorClasses = {
    blue: 'border-blue-200',
    green: 'border-green-200',
    purple: 'border-purple-200',
    orange: 'border-orange-200',
  };

  return (
    <div className={`border-2 rounded-lg p-4 ${colorClasses[color]}`}>
      <h4 className='text-md font-semibold text-gray-900 mb-3'>{title}</h4>
      {children}
    </div>
  );
};

interface StatItemProps {
  label: string;
  value: string | number;
}

const StatItem: React.FC<StatItemProps> = ({ label, value }) => (
  <div>
    <p className='text-sm text-gray-500 mb-1'>{label}</p>
    <p className='text-lg font-semibold text-gray-900'>{value}</p>
  </div>
);
