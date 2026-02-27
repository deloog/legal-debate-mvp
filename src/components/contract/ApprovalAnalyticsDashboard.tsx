/**
 * 审批效率分析仪表板
 * 展示审批流程的效率统计、瓶颈分析和优化建议
 */

'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  BarChart2,
  Clock,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ThumbsUp,
} from 'lucide-react';
import type {
  ApprovalAnalytics,
  BottleneckInfo,
} from '@/lib/contract/approval-analytics-service';

// ==================== 类型定义 ====================

interface ApprovalAnalyticsDashboardProps {
  analytics: ApprovalAnalytics | null;
  loading?: boolean;
}

// ==================== 辅助组件 ====================

function StatCard({
  testId,
  icon,
  label,
  value,
  subtitle,
  colorClass = 'text-gray-900',
}: {
  testId: string;
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  colorClass?: string;
}) {
  return (
    <div
      data-testid={testId}
      className='rounded-lg bg-white border border-gray-200 p-4 shadow-sm'
    >
      <div className='flex items-center gap-3 mb-2'>
        <div className='text-gray-400'>{icon}</div>
        <span className='text-sm text-gray-500'>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      {subtitle && <div className='text-xs text-gray-400 mt-1'>{subtitle}</div>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: BottleneckInfo['severity'] }) {
  const config = {
    critical: { label: '极严重', class: 'bg-red-100 text-red-800' },
    high: { label: '严重', class: 'bg-orange-100 text-orange-800' },
    medium: { label: '中等', class: 'bg-yellow-100 text-yellow-800' },
    low: { label: '轻微', class: 'bg-green-100 text-green-800' },
  };
  const { label, class: cls } = config[severity];

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

// ==================== 主组件 ====================

export function ApprovalAnalyticsDashboard({
  analytics,
  loading = false,
}: ApprovalAnalyticsDashboardProps) {
  // 加载状态
  if (loading) {
    return (
      <div data-testid='analytics-loading' className='p-6 space-y-4'>
        <div className='grid grid-cols-4 gap-4'>
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className='h-24 rounded-lg bg-gray-100 animate-pulse'
            />
          ))}
        </div>
        <div className='h-48 rounded-lg bg-gray-100 animate-pulse' />
      </div>
    );
  }

  // 空状态
  if (!analytics) {
    return (
      <div
        data-testid='analytics-empty'
        className='py-12 text-center text-gray-400'
      >
        <BarChart2 className='h-12 w-12 mx-auto mb-3 opacity-30' />
        <p className='text-sm'>暂无审批数据</p>
      </div>
    );
  }

  const passRatePercent = Math.round(analytics.approvalPassRate * 100);
  const avgHoursRounded = Math.round(analytics.avgCompletionTimeHours);

  return (
    <div data-testid='analytics-dashboard' className='space-y-6'>
      {/* 时间范围 */}
      <div data-testid='analytics-period' className='text-xs text-gray-500'>
        统计期间：
        {format(new Date(analytics.period.start), 'yyyy-MM-dd', {
          locale: zhCN,
        })}
        {' 至 '}
        {format(new Date(analytics.period.end), 'yyyy-MM-dd', {
          locale: zhCN,
        })}
      </div>

      {/* 概览统计卡片 */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <StatCard
          testId='stat-total-approvals'
          icon={<BarChart2 className='h-5 w-5' />}
          label='审批总量'
          value={analytics.totalApprovals}
          subtitle='件'
        />
        <StatCard
          testId='stat-completed-approvals'
          icon={<CheckCircle className='h-5 w-5' />}
          label='已完成'
          value={analytics.completedApprovals}
          subtitle='件'
          colorClass='text-blue-700'
        />
        <StatCard
          testId='stat-pass-rate'
          icon={<TrendingUp className='h-5 w-5' />}
          label='通过率'
          value={`${passRatePercent}%`}
          colorClass={
            passRatePercent >= 80 ? 'text-green-700' : 'text-orange-700'
          }
        />
        <StatCard
          testId='stat-avg-time'
          icon={<Clock className='h-5 w-5' />}
          label='平均审批时长'
          value={avgHoursRounded}
          subtitle='小时'
          colorClass={
            avgHoursRounded <= 24
              ? 'text-green-700'
              : avgHoursRounded <= 72
                ? 'text-yellow-700'
                : 'text-red-700'
          }
        />
      </div>

      {/* 各角色步骤分析 */}
      <section data-testid='step-analytics-section'>
        <h4 className='text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2'>
          <BarChart2 className='h-4 w-4 text-blue-500' />
          各审批角色效率
        </h4>
        {analytics.stepAnalytics.length === 0 ? (
          <p className='text-sm text-gray-400 py-4 text-center'>暂无步骤数据</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='border-b border-gray-200'>
                  <th className='text-left py-2 px-3 text-gray-500 font-medium'>
                    审批角色
                  </th>
                  <th className='text-right py-2 px-3 text-gray-500 font-medium'>
                    平均时长（时）
                  </th>
                  <th className='text-right py-2 px-3 text-gray-500 font-medium'>
                    处理量
                  </th>
                  <th className='text-right py-2 px-3 text-gray-500 font-medium'>
                    通过率
                  </th>
                  <th className='text-right py-2 px-3 text-gray-500 font-medium'>
                    拒绝率
                  </th>
                </tr>
              </thead>
              <tbody>
                {analytics.stepAnalytics.map(step => (
                  <tr
                    key={step.approverRole}
                    data-testid={`step-row-${step.approverRole}`}
                    className='border-b border-gray-100 hover:bg-gray-50'
                  >
                    <td className='py-2 px-3 font-medium text-gray-800'>
                      {step.approverRole}
                    </td>
                    <td className='py-2 px-3 text-right'>
                      <span
                        className={
                          step.avgProcessingTimeHours > 48
                            ? 'text-red-600 font-semibold'
                            : step.avgProcessingTimeHours > 24
                              ? 'text-yellow-600'
                              : 'text-green-600'
                        }
                      >
                        {Math.round(step.avgProcessingTimeHours)}
                      </span>
                    </td>
                    <td className='py-2 px-3 text-right text-gray-700'>
                      {step.totalProcessed}
                    </td>
                    <td className='py-2 px-3 text-right text-green-600'>
                      {Math.round(step.approveRate * 100)}%
                    </td>
                    <td className='py-2 px-3 text-right text-red-600'>
                      {Math.round(step.rejectRate * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 瓶颈分析 */}
      <section data-testid='bottlenecks-section'>
        <h4 className='text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2'>
          <AlertTriangle className='h-4 w-4 text-orange-500' />
          审批瓶颈
        </h4>
        {analytics.bottlenecks.length === 0 ? (
          <div
            data-testid='no-bottleneck-message'
            className='flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700'
          >
            <ThumbsUp className='h-4 w-4' />
            <span className='text-sm'>暂未检测到明显瓶颈，流程运行良好</span>
          </div>
        ) : (
          <div className='space-y-2'>
            {analytics.bottlenecks.map(b => (
              <div
                key={b.approverRole}
                className='rounded-lg border border-orange-200 bg-orange-50 p-3'
              >
                <div className='flex items-center gap-2 mb-1'>
                  <span className='font-medium text-sm text-gray-800'>
                    {b.approverRole}
                  </span>
                  <span
                    data-testid={`bottleneck-severity-${b.approverRole}`}
                    data-severity={b.severity}
                  >
                    <SeverityBadge severity={b.severity} />
                  </span>
                  <span className='text-xs text-gray-500'>
                    平均 {Math.round(b.avgProcessingTimeHours)} 小时
                  </span>
                </div>
                <p className='text-xs text-orange-700'>{b.suggestion}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 优化建议 */}
      <section data-testid='suggestions-section'>
        <h4 className='text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2'>
          <Lightbulb className='h-4 w-4 text-yellow-500' />
          优化建议
        </h4>
        {analytics.suggestions.length === 0 ? (
          <div
            data-testid='no-suggestions-message'
            className='text-sm text-gray-400 py-2'
          >
            当前流程运行良好，暂无优化建议
          </div>
        ) : (
          <ul className='space-y-2'>
            {analytics.suggestions.map((suggestion, idx) => (
              <li
                key={idx}
                className='flex items-start gap-2 text-sm text-gray-700 p-3 rounded-lg bg-yellow-50 border border-yellow-100'
              >
                <Lightbulb className='h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5' />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
