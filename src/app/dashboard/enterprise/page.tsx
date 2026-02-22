/**
 * 企业法务工作台页面
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type {
  EnterpriseDashboardData,
  RiskAlert,
  RecentContract,
  UpcomingTask,
} from '@/types/dashboard';

export default function EnterpriseDashboardPage() {
  const [data, setData] = useState<EnterpriseDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/dashboard/enterprise');
      
      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }
      
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error?.message || '加载数据失败');
      }
    } catch (err) {
      console.error('加载工作台数据失败:', err);
      setError(err instanceof Error ? err.message : '加载数据失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 p-6'>
        <div className='mx-auto max-w-7xl'>
          <div className='text-center text-gray-500'>加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 p-6'>
        <div className='mx-auto max-w-7xl'>
          <div className='rounded-lg bg-red-50 p-4 text-sm text-red-800'>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        {/* 页面标题 */}
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900'>企业法务工作台</h1>
          <p className='mt-1 text-sm text-gray-500'>
            企业法务管理中心，查看合同审查、风险预警、合规状态等信息
          </p>
        </div>

        {/* 统计卡片 */}
        <div className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {/* 待审查合同 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>待审查合同</p>
                <p className='mt-2 text-3xl font-semibold text-gray-900'>
                  {data.stats.pendingReviewContracts}
                </p>
              </div>
              <div className='rounded-full bg-blue-100 p-3'>
                <svg
                  className='h-6 w-6 text-blue-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* 高风险合同 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>高风险合同</p>
                <p className='mt-2 text-3xl font-semibold text-gray-900'>
                  {data.stats.highRiskContracts}
                </p>
              </div>
              <div className='rounded-full bg-red-100 p-3'>
                <svg
                  className='h-6 w-6 text-red-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* 合规评分 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>合规评分</p>
                <p className='mt-2 text-3xl font-semibold text-gray-900'>
                  {data.stats.complianceScore}
                </p>
              </div>
              <div className='rounded-full bg-green-100 p-3'>
                <svg
                  className='h-6 w-6 text-green-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* 待处理任务 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>待处理任务</p>
                <p className='mt-2 text-3xl font-semibold text-gray-900'>
                  {data.stats.pendingTasks}
                </p>
              </div>
              <div className='rounded-full bg-yellow-100 p-3'>
                <svg
                  className='h-6 w-6 text-yellow-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          {/* 风险告警 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <h2 className='mb-4 text-lg font-semibold text-gray-900'>
              风险告警
            </h2>
            {data.riskAlerts.length === 0 ? (
              <p className='text-sm text-gray-500'>暂无风险告警</p>
            ) : (
              <div className='space-y-3'>
                {data.riskAlerts.map((alert: RiskAlert) => (
                  <div
                    key={alert.id}
                    className='rounded-lg border border-gray-200 p-4'
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              alert.severity === 'CRITICAL'
                                ? 'bg-red-100 text-red-800'
                                : alert.severity === 'HIGH'
                                  ? 'bg-orange-100 text-orange-800'
                                  : alert.severity === 'MEDIUM'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {alert.severity === 'CRITICAL'
                              ? '严重'
                              : alert.severity === 'HIGH'
                                ? '高'
                                : alert.severity === 'MEDIUM'
                                  ? '中'
                                  : '低'}
                          </span>
                          <h3 className='text-sm font-medium text-gray-900'>
                            {alert.title}
                          </h3>
                        </div>
                        <p className='mt-1 text-sm text-gray-600'>
                          {alert.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 合规状态 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <h2 className='mb-4 text-lg font-semibold text-gray-900'>
              合规状态
            </h2>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600'>总检查项</span>
                <span className='text-sm font-semibold text-gray-900'>
                  {data.complianceStatus.totalChecks}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600'>通过</span>
                <span className='text-sm font-semibold text-green-600'>
                  {data.complianceStatus.passedChecks}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600'>未通过</span>
                <span className='text-sm font-semibold text-red-600'>
                  {data.complianceStatus.failedChecks}
                </span>
              </div>
              <div className='mt-4 pt-4 border-t border-gray-200'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium text-gray-900'>
                    合规评分
                  </span>
                  <span className='text-2xl font-bold text-gray-900'>
                    {data.complianceStatus.score}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 最近审查的合同 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-lg font-semibold text-gray-900'>
                最近审查的合同
              </h2>
              <Link
                href='/contracts'
                className='text-sm text-blue-600 hover:text-blue-700'
              >
                查看全部
              </Link>
            </div>
            {data.recentContracts.length === 0 ? (
              <p className='text-sm text-gray-500'>暂无审查记录</p>
            ) : (
              <div className='space-y-3'>
                {data.recentContracts.map((contract: RecentContract) => (
                  <Link
                    key={contract.id}
                    href={`/contracts/${contract.id}`}
                    className='block rounded-lg border border-gray-200 p-4 hover:bg-gray-50'
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <h3 className='text-sm font-medium text-gray-900'>
                          {contract.contractNumber}
                        </h3>
                        <p className='mt-1 text-sm text-gray-600'>
                          {contract.clientName} · {contract.caseType}
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='text-sm font-medium text-gray-900'>
                          ¥{contract.totalFee.toLocaleString()}
                        </p>
                        <p className='mt-1 text-xs text-gray-500'>
                          {new Date(contract.reviewedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 即将到期的任务 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-lg font-semibold text-gray-900'>
                即将到期的任务
              </h2>
              <Link
                href='/dashboard/follow-up-tasks'
                className='text-sm text-blue-600 hover:text-blue-700'
              >
                查看全部
              </Link>
            </div>
            {data.upcomingTasks.length === 0 ? (
              <p className='text-sm text-gray-500'>暂无即将到期的任务</p>
            ) : (
              <div className='space-y-3'>
                {data.upcomingTasks.map((task: UpcomingTask) => (
                  <div
                    key={task.id}
                    className='rounded-lg border border-gray-200 p-4'
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              task.priority === 'URGENT'
                                ? 'bg-red-100 text-red-800'
                                : task.priority === 'HIGH'
                                  ? 'bg-orange-100 text-orange-800'
                                  : task.priority === 'MEDIUM'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {task.priority === 'URGENT'
                              ? '紧急'
                              : task.priority === 'HIGH'
                                ? '高'
                                : task.priority === 'MEDIUM'
                                  ? '中'
                                  : '低'}
                          </span>
                          <h3 className='text-sm font-medium text-gray-900'>
                            {task.title}
                          </h3>
                        </div>
                        <p className='mt-1 text-sm text-gray-600'>
                          {task.description}
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='text-xs text-gray-500'>
                          {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
