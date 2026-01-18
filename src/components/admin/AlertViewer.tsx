import {
  getSeverityColor,
  getSeverityIcon,
  getAlertStatusText,
  getAlertStatusColor,
  type AlertItem,
} from '@/types/log';

interface AlertViewerProps {
  alerts: AlertItem[];
  loading: boolean;
  onSelectAlert: (alert: AlertItem) => void;
  selectedAlertId: string | null;
}

export function AlertViewer({
  alerts,
  loading,
  onSelectAlert,
  selectedAlertId,
}: AlertViewerProps) {
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-500'>加载中...</div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-500'>暂无告警数据</div>
      </div>
    );
  }

  return (
    <div className='overflow-x-auto'>
      <table className='min-w-full bg-white border border-gray-200'>
        <thead className='bg-gray-50'>
          <tr>
            <th className='px-4 py-3 text-left text-sm font-medium text-gray-700'>
              严重程度
            </th>
            <th className='px-4 py-3 text-left text-sm font-medium text-gray-700'>
              规则名称
            </th>
            <th className='px-4 py-3 text-left text-sm font-medium text-gray-700'>
              状态
            </th>
            <th className='px-4 py-3 text-left text-sm font-medium text-gray-700'>
              错误类型
            </th>
            <th className='px-4 py-3 text-left text-sm font-medium text-gray-700'>
              触发时间
            </th>
            <th className='px-4 py-3 text-left text-sm font-medium text-gray-700'>
              操作
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200'>
          {alerts.map(alert => (
            <tr
              key={alert.alertId}
              className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedAlertId === alert.alertId ? 'bg-blue-50' : ''
              }`}
              onClick={() => onSelectAlert(alert)}
            >
              <td className='px-4 py-3 whitespace-nowrap'>
                <span
                  className='inline-flex items-center gap-1'
                  style={{ color: getSeverityColor(alert.severity) }}
                >
                  <span>{getSeverityIcon(alert.severity)}</span>
                  <span className='font-medium'>{alert.severity}</span>
                </span>
              </td>
              <td className='px-4 py-3'>
                <div className='font-medium text-gray-900'>
                  {alert.ruleName}
                </div>
                <div className='text-sm text-gray-500 truncate max-w-xs'>
                  {alert.errorMessage}
                </div>
              </td>
              <td className='px-4 py-3 whitespace-nowrap'>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getAlertStatusColor(
                    alert.status
                  )}`}
                >
                  {getAlertStatusText(alert.status)}
                </span>
              </td>
              <td className='px-4 py-3 text-sm text-gray-600'>
                {alert.errorType}
              </td>
              <td className='px-4 py-3 text-sm text-gray-600'>
                {formatDate(alert.triggeredAt)}
              </td>
              <td className='px-4 py-3 whitespace-nowrap'>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onSelectAlert(alert);
                  }}
                  className='text-blue-600 hover:text-blue-800 text-sm font-medium'
                >
                  查看详情
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
