'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { SuccessRateAnalysis } from '@/types/case-example';

export interface SuccessRateChartProps {
  analysis: SuccessRateAnalysis | null;
  loading?: boolean;
  error?: string | null;
}

export function SuccessRateChart({
  analysis,
  loading = false,
  error = null,
}: SuccessRateChartProps) {
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!analysis) {
    return <EmptyState />;
  }

  const winPercentage = Math.round(analysis.winRate * 100);
  const winProbabilityPercentage = Math.round(analysis.winProbability * 100);
  const confidencePercentage = Math.round(analysis.confidence * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>胜败率分析</CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* 风险等级 */}
        <RiskLevelCard riskLevel={analysis.analysis.riskLevel} />

        {/* 关键指标 */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          <MetricCard
            label='胜诉率'
            value={`${winPercentage}%`}
            description={`基于${analysis.similarCasesCount}个相似案例`}
            color='blue'
          />
          <MetricCard
            label='预测胜诉概率'
            value={`${winProbabilityPercentage}%`}
            description='基于历史数据分析'
            color='green'
          />
          <MetricCard
            label='分析置信度'
            value={`${confidencePercentage}%`}
            description='数据可靠性评估'
            color='purple'
          />
        </div>

        {/* 案例分布 */}
        <DistributionSection analysis={analysis} />

        {/* 趋势分析 */}
        <TrendSection trend={analysis.analysis.trend} />

        {/* 分析建议 */}
        <RecommendationSection
          recommendation={analysis.analysis.recommendation}
        />

        {/* 数据质量提示 */}
        <DataQualityWarnings analysis={analysis} />
      </CardContent>
    </Card>
  );
}

function RiskLevelCard({
  riskLevel,
}: {
  riskLevel: 'low' | 'medium' | 'high';
}) {
  const configs = {
    low: {
      label: '低风险',
      icon: '✅',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      borderColor: 'border-green-200',
    },
    medium: {
      label: '中风险',
      icon: '⚠️',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-200',
    },
    high: {
      label: '高风险',
      icon: '❌',
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-200',
    },
  };

  const config = configs[riskLevel];

  return (
    <div
      className={`rounded-lg border-2 p-6 ${config.bgColor} ${config.textColor} ${config.borderColor}`}
    >
      <div className='mb-4 flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <span className='text-4xl'>{config.icon}</span>
          <div>
            <div className='text-2xl font-bold'>{config.label}</div>
            <div className='text-sm opacity-75'>风险评估等级</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  color: 'blue' | 'green' | 'purple';
}

function MetricCard({ label, value, description, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
  };

  return (
    <div
      className={`rounded-lg border-2 p-6 ${colorClasses[color].split(' ').slice(0, 2).join(' ')}`}
    >
      <div className='mb-2 text-sm text-gray-600'>{label}</div>
      <div
        className={`text-3xl font-bold ${colorClasses[color].split(' ')[2]}`}
      >
        {value}
      </div>
      <div className='mt-1 text-xs text-gray-500'>{description}</div>
    </div>
  );
}

function DistributionSection({ analysis }: { analysis: SuccessRateAnalysis }) {
  const total =
    analysis.winCasesCount +
    analysis.loseCasesCount +
    analysis.partialCasesCount +
    analysis.withdrawCasesCount;

  const distributions = [
    {
      label: '胜诉',
      count: analysis.winCasesCount,
      color: 'bg-green-500',
    },
    {
      label: '败诉',
      count: analysis.loseCasesCount,
      color: 'bg-red-500',
    },
    {
      label: '部分胜诉',
      count: analysis.partialCasesCount,
      color: 'bg-yellow-500',
    },
    {
      label: '撤诉',
      count: analysis.withdrawCasesCount,
      color: 'bg-gray-500',
    },
  ];

  return (
    <div className='rounded-lg border-2 border-gray-200 p-6'>
      <h4 className='mb-4 text-lg font-semibold text-gray-900'>案例分布</h4>
      <div className='space-y-3'>
        {distributions.map(dist => {
          const percentage =
            total > 0 ? Math.round((dist.count / total) * 100) : 0;
          return (
            <div key={dist.label}>
              <div className='mb-1 flex items-center justify-between text-sm'>
                <span className='font-medium text-gray-900'>{dist.label}</span>
                <span className='text-gray-600'>
                  {dist.count}个（{percentage}%）
                </span>
              </div>
              <div className='h-4 w-full rounded-full bg-gray-200 overflow-hidden'>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${dist.color}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendSection({
  trend,
}: {
  trend: 'increasing' | 'decreasing' | 'stable';
}) {
  const trendConfig = {
    increasing: {
      label: '上升趋势',
      icon: '📈',
    },
    decreasing: {
      label: '下降趋势',
      icon: '📉',
    },
    stable: {
      label: '稳定',
      icon: '📊',
    },
  };

  const config = trendConfig[trend];

  return (
    <div className='rounded-lg border-2 border-gray-200 p-6'>
      <div className='flex items-center justify-between'>
        <h4 className='text-lg font-semibold text-gray-900'>胜诉趋势</h4>
        <div className='flex items-center gap-2 text-2xl'>
          <span>{config.icon}</span>
          <span className='text-sm text-gray-600'>{config.label}</span>
        </div>
      </div>
    </div>
  );
}

function RecommendationSection({ recommendation }: { recommendation: string }) {
  return (
    <div className='rounded-lg border-2 border-blue-200 bg-blue-50 p-6'>
      <h4 className='mb-3 flex items-center gap-2 text-lg font-semibold text-blue-900'>
        <span>💡</span>
        <span>分析建议</span>
      </h4>
      <p className='text-sm text-blue-900 leading-relaxed'>{recommendation}</p>
    </div>
  );
}

function DataQualityWarnings({ analysis }: { analysis: SuccessRateAnalysis }) {
  const warnings: string[] = [];

  if (analysis.similarCasesCount < 5) {
    warnings.push(
      `⚠️ 相似案例数量较少（${analysis.similarCasesCount}个），分析结果可能不够准确`
    );
  }

  if (analysis.confidence < 0.7) {
    warnings.push('🔍 分析置信度较低，建议增加相似案例数量以提高准确性');
  }

  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className='rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4'>
      <h4 className='mb-2 text-sm font-semibold text-yellow-900'>
        数据质量提示
      </h4>
      <div className='space-y-1'>
        {warnings.map((warning, index) => (
          <p key={index} className='text-xs text-yellow-800'>
            {warning}
          </p>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <Card>
      <CardContent className='p-8 text-center'>
        <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600' />
        </div>
        <p className='text-gray-600'>分析中...</p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <Card>
      <CardContent className='p-8 text-center'>
        <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100'>
          <span className='text-4xl'>❌</span>
        </div>
        <p className='text-red-600'>{error}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className='py-16 text-center'>
        <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100'>
          <span className='text-4xl'>📊</span>
        </div>
        <h3 className='mb-2 text-lg font-semibold text-gray-900'>
          暂无分析数据
        </h3>
        <p className='text-gray-500'>请先检索相似案例</p>
      </CardContent>
    </Card>
  );
}
