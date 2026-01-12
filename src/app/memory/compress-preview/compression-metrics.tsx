/**
 * CompressionMetrics - 压缩指标展示组件
 */

'use client';

export interface CompressionMetricsData {
  compressionRatio: number;
  spaceSaved: number;
  keyInfoCount: number;
}

export interface CompressionMetricsProps {
  metrics: CompressionMetricsData;
}

/**
 * 压缩指标组件
 */
export function CompressionMetrics(props: CompressionMetricsProps) {
  const { metrics } = props;

  const percentageSaved = Math.round(metrics.compressionRatio * 100);

  return (
    <div className='compression-metrics'>
      <h2 className='text-2xl font-bold mb-4'>压缩指标</h2>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        {/* 压缩比例 */}
        <div className='p-4 bg-blue-50 rounded'>
          <div className='text-sm text-gray-600'>压缩比例</div>
          <div className='text-2xl font-bold text-blue-600'>
            {metrics.compressionRatio.toFixed(2)}
          </div>
          <div className='text-sm text-gray-600'>节省 {percentageSaved}%</div>
        </div>

        {/* 空间节省 */}
        <div className='p-4 bg-green-50 rounded'>
          <div className='text-sm text-gray-600'>空间节省</div>
          <div className='text-2xl font-bold text-green-600'>
            {metrics.spaceSaved}
          </div>
          <div className='text-sm text-gray-600'>字符</div>
        </div>

        {/* 关键信息数量 */}
        <div className='p-4 bg-purple-50 rounded'>
          <div className='text-sm text-gray-600'>关键信息</div>
          <div className='text-2xl font-bold text-purple-600'>
            {metrics.keyInfoCount}
          </div>
          <div className='text-sm text-gray-600'>条</div>
        </div>
      </div>
    </div>
  );
}
