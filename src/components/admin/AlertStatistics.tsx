import {
  getSeverityColor,
  getSeverityIcon,
  type AlertSeverity,
} from '@/types/log';

interface AlertStatisticsProps {
  statistics: {
    total: number;
    triggered: number;
    acknowledged: number;
    resolved: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<string, number>;
  };
}

export function AlertStatistics({ statistics }: AlertStatisticsProps) {
  const severityColors: Record<AlertSeverity, string> = {
    CRITICAL: getSeverityColor('CRITICAL'),
    HIGH: getSeverityColor('HIGH'),
    MEDIUM: getSeverityColor('MEDIUM'),
    LOW: getSeverityColor('LOW'),
  };

  const calculatePercentage = (value: number, total: number): number => {
    return total === 0 ? 0 : Math.round((value / total) * 100);
  };

  return (
    <div className='bg-white rounded-lg shadow p-6'>
      <h3 className='text-lg font-semibold text-gray-900 mb-4'>告警统计</h3>

      <div className='grid grid-cols-4 gap-4 mb-6'>
        <div className='bg-blue-50 rounded-lg p-4'>
          <div className='text-2xl font-bold text-blue-600'>
            {statistics.total}
          </div>
          <div className='text-sm text-gray-600 mt-1'>总数</div>
        </div>

        <div className='bg-red-50 rounded-lg p-4'>
          <div className='text-2xl font-bold text-red-600'>
            {statistics.triggered}
          </div>
          <div className='text-sm text-gray-600 mt-1'>已触发</div>
        </div>

        <div className='bg-yellow-50 rounded-lg p-4'>
          <div className='text-2xl font-bold text-yellow-600'>
            {statistics.acknowledged}
          </div>
          <div className='text-sm text-gray-600 mt-1'>已确认</div>
        </div>

        <div className='bg-green-50 rounded-lg p-4'>
          <div className='text-2xl font-bold text-green-600'>
            {statistics.resolved}
          </div>
          <div className='text-sm text-gray-600 mt-1'>已解决</div>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-6'>
        <div>
          <h4 className='text-sm font-medium text-gray-700 mb-3'>按严重程度</h4>
          <div className='space-y-2'>
            {Object.entries(statistics.bySeverity).map(([severity, count]) => (
              <div key={severity} className='flex items-center gap-2'>
                <span className='text-lg'>
                  {getSeverityIcon(severity as AlertSeverity)}
                </span>
                <div className='flex-1'>
                  <div className='flex justify-between text-sm mb-1'>
                    <span className='font-medium text-gray-900'>
                      {severity}
                    </span>
                    <span className='text-gray-600'>{count}</span>
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-2'>
                    <div
                      className='h-2 rounded-full'
                      style={{
                        width: `${calculatePercentage(count, statistics.total)}%`,
                        backgroundColor: severityColors[severity] ?? '#6c757d',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className='text-sm font-medium text-gray-700 mb-3'>按错误类型</h4>
          <div className='space-y-2 max-h-48 overflow-y-auto'>
            {Object.entries(statistics.byType)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([type, count]) => (
                <div key={type} className='flex items-center gap-2'>
                  <div className='flex-1'>
                    <div className='flex justify-between text-sm mb-1'>
                      <span className='font-medium text-gray-900 truncate max-w-xs'>
                        {type}
                      </span>
                      <span className='text-gray-600'>{count}</span>
                    </div>
                    <div className='w-full bg-gray-200 rounded-full h-2'>
                      <div
                        className='h-2 rounded-full bg-blue-500'
                        style={{
                          width: `${calculatePercentage(count, statistics.total)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
