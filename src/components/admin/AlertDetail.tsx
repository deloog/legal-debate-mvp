import { useState } from 'react';
import {
  getSeverityColor,
  getSeverityIcon,
  getAlertStatusText,
  getAlertStatusColor,
  type AlertItem,
  type ErrorLogItem,
} from '@/types/log';

interface AlertDetailProps {
  alert: AlertItem | null;
  errorLog: ErrorLogItem | null;
  onAcknowledge: (alertId: string) => Promise<void>;
  onResolve: (alertId: string, notes: string) => Promise<void>;
  onClose: () => void;
}

export function AlertDetail({
  alert,
  errorLog,
  onAcknowledge,
  onResolve,
  onClose,
}: AlertDetailProps) {
  const [resolveNotes, setResolveNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!alert) {
    return null;
  }

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleAcknowledge = async () => {
    if (alert.status !== 'TRIGGERED' || isProcessing) return;
    setIsProcessing(true);
    await onAcknowledge(alert.alertId);
    setIsProcessing(false);
  };

  const handleResolve = async () => {
    if (alert.status === 'RESOLVED' || isProcessing) return;
    setIsProcessing(true);
    await onResolve(alert.alertId, resolveNotes);
    setIsProcessing(false);
    setResolveNotes('');
  };

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto m-4'>
        <div className='p-6'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-xl font-semibold text-gray-900'>告警详情</h2>
            <button
              onClick={onClose}
              className='text-gray-400 hover:text-gray-600'
            >
              <svg
                className='w-6 h-6'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>

          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  告警ID
                </label>
                <div className='text-sm text-gray-900'>{alert.alertId}</div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  规则名称
                </label>
                <div className='text-sm text-gray-900'>{alert.ruleName}</div>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  严重程度
                </label>
                <div
                  className='inline-flex items-center gap-1 font-medium'
                  style={{ color: getSeverityColor(alert.severity) }}
                >
                  <span>{getSeverityIcon(alert.severity)}</span>
                  <span>{alert.severity}</span>
                </div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  状态
                </label>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getAlertStatusColor(
                    alert.status
                  )}`}
                >
                  {getAlertStatusText(alert.status)}
                </span>
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                错误信息
              </label>
              <div className='text-sm text-gray-900 bg-gray-50 p-3 rounded'>
                {alert.errorMessage}
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                触发时间
              </label>
              <div className='text-sm text-gray-900'>
                {formatDate(alert.triggeredAt)}
              </div>
            </div>

            {alert.acknowledgedAt && (
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  确认时间
                </label>
                <div className='text-sm text-gray-900'>
                  {formatDate(alert.acknowledgedAt)}
                </div>
                <div className='text-sm text-gray-600 mt-1'>
                  确认人: {alert.acknowledgedBy || '未知'}
                </div>
              </div>
            )}

            {alert.resolvedAt && (
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  处理时间
                </label>
                <div className='text-sm text-gray-900'>
                  {formatDate(alert.resolvedAt)}
                </div>
                {alert.resolutionNotes && (
                  <div className='text-sm text-gray-600 mt-1'>
                    处理备注: {alert.resolutionNotes}
                  </div>
                )}
              </div>
            )}

            {errorLog && (
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  关联错误日志
                </label>
                <div className='text-sm text-gray-900 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto'>
                  <div className='mb-2'>
                    <strong>错误类型:</strong> {errorLog.errorType}
                  </div>
                  <div className='mb-2'>
                    <strong>错误代码:</strong> {errorLog.errorCode}
                  </div>
                  {errorLog.stackTrace && (
                    <div className='mt-2'>
                      <strong>堆栈跟踪:</strong>
                      <pre className='text-xs mt-1 whitespace-pre-wrap'>
                        {errorLog.stackTrace}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className='mt-6 flex gap-3 justify-end'>
            {alert.status === 'TRIGGERED' && (
              <button
                onClick={handleAcknowledge}
                disabled={isProcessing}
                className='px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {isProcessing ? '处理中...' : '确认告警'}
              </button>
            )}
            {alert.status !== 'RESOLVED' && (
              <div className='flex gap-3'>
                <input
                  type='text'
                  value={resolveNotes}
                  onChange={e => setResolveNotes(e.target.value)}
                  placeholder='输入处理备注...'
                  className='px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
                  disabled={isProcessing}
                />
                <button
                  onClick={handleResolve}
                  disabled={isProcessing}
                  className='px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isProcessing ? '处理中...' : '标记为已解决'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
