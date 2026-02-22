/**
 * 合规管理页面
 * 企业法务合规管理功能
 */

'use client';

import React, { useState, useEffect } from 'react';
import type {
  ComplianceDashboard,
  ComplianceChecklist,
  ComplianceReport,
} from '@/types/compliance';
import {
  ComplianceCheckStatus,
  getComplianceStatusLabel,
  getComplianceStatusColor,
  getComplianceCategoryLabel,
  getCompliancePriorityLabel,
} from '@/types/compliance';

type TabType = 'dashboard' | 'checklist' | 'report';

/**
 * 合规管理页面组件
 */
export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 仪表盘数据
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);

  // 检查清单数据
  const [checklists, setChecklists] = useState<ComplianceChecklist[]>([]);

  // 报告数据
  const [report, setReport] = useState<ComplianceReport | null>(null);

  // 加载仪表盘数据
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/compliance/dashboard');

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || '加载失败');
      }

      setDashboard(data.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载检查清单
  const loadChecklists = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/compliance/checklist');

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || '加载失败');
      }

      setChecklists(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载报告
  const loadReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/compliance/report');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || '加载失败');
      }

      setReport(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新检查项状态
  const updateCheckItem = async (
    checklistId: string,
    itemId: string,
    status: ComplianceCheckStatus
  ) => {
    try {
      const response = await fetch('/api/compliance/checklist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checklistId,
          itemId,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || '更新失败');
      }

      // 重新加载检查清单
      await loadChecklists();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    }
  };

  // 切换标签页
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);

    if (tab === 'dashboard' && !dashboard) {
      loadDashboard();
    } else if (tab === 'checklist' && checklists.length === 0) {
      loadChecklists();
    } else if (tab === 'report' && !report) {
      loadReport();
    }
  };

  // 初始加载
  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className='container mx-auto px-4 py-8'>
      <h1 className='text-3xl font-bold mb-8'>合规管理</h1>

      {/* 标签页 */}
      <div className='flex gap-4 mb-6 border-b'>
        <button
          onClick={() => handleTabChange('dashboard')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'dashboard'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          合规仪表盘
        </button>
        <button
          onClick={() => handleTabChange('checklist')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'checklist'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          检查清单
        </button>
        <button
          onClick={() => handleTabChange('report')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'report'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          合规报告
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6'>
          {error}
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className='text-center py-8'>
          <div className='text-gray-600'>加载中...</div>
        </div>
      )}

      {/* 合规仪表盘 */}
      {!loading && activeTab === 'dashboard' && dashboard && (
        <div className='space-y-6'>
          {/* 总体评分 */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-xl font-semibold mb-4'>总体合规评分</h2>
            <div className='flex items-center gap-4'>
              <div className='text-5xl font-bold text-blue-600'>
                {dashboard.overallScore}
              </div>
              <div>
                <div className='text-sm text-gray-600'>满分100分</div>
                <div className='text-sm'>
                  趋势:{' '}
                  <span
                    className={
                      dashboard.trend === 'up'
                        ? 'text-green-600'
                        : dashboard.trend === 'down'
                          ? 'text-red-600'
                          : 'text-gray-600'
                    }
                  >
                    {dashboard.trend === 'up'
                      ? '↑ 上升'
                      : dashboard.trend === 'down'
                        ? '↓ 下降'
                        : '→ 稳定'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 统计信息 */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-xl font-semibold mb-4'>统计信息</h2>
            <div className='grid grid-cols-5 gap-4'>
              <div className='text-center'>
                <div className='text-3xl font-bold text-gray-900'>
                  {dashboard.statistics.totalChecks}
                </div>
                <div className='text-sm text-gray-600'>总检查项</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-green-600'>
                  {dashboard.statistics.passedChecks}
                </div>
                <div className='text-sm text-gray-600'>通过</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-red-600'>
                  {dashboard.statistics.failedChecks}
                </div>
                <div className='text-sm text-gray-600'>未通过</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-yellow-600'>
                  {dashboard.statistics.warningChecks}
                </div>
                <div className='text-sm text-gray-600'>警告</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-gray-600'>
                  {dashboard.statistics.pendingChecks}
                </div>
                <div className='text-sm text-gray-600'>待检查</div>
              </div>
            </div>
          </div>

          {/* 类别评分 */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-xl font-semibold mb-4'>各类别评分</h2>
            <div className='space-y-3'>
              {Object.entries(dashboard.categoryScores).map(
                ([category, score]) => (
                  <div key={category} className='flex items-center gap-4'>
                    <div className='w-32 text-sm font-medium'>
                      {getComplianceCategoryLabel(category as never)}
                    </div>
                    <div className='flex-1'>
                      <div className='bg-gray-200 rounded-full h-4'>
                        <div
                          className='bg-blue-600 rounded-full h-4'
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                    <div className='w-12 text-right font-semibold'>{score}</div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* 最近的合规问题 */}
          {dashboard.recentIssues.length > 0 && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>最近的合规问题</h2>
              <div className='space-y-3'>
                {dashboard.recentIssues.map(issue => (
                  <div key={issue.id} className='border rounded-md p-4'>
                    <div className='flex justify-between items-start mb-2'>
                      <h3 className='font-semibold'>{issue.title}</h3>
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          issue.severity === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : issue.severity === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : issue.severity === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {getCompliancePriorityLabel(issue.severity)}
                      </span>
                    </div>
                    <p className='text-sm text-gray-600 mb-2'>
                      {issue.description}
                    </p>
                    <div className='text-xs text-gray-500'>
                      状态:{' '}
                      {issue.status === 'open'
                        ? '待处理'
                        : issue.status === 'in_progress'
                          ? '处理中'
                          : '已解决'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 即将到期的任务 */}
          {dashboard.upcomingDeadlines.length > 0 && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>即将到期的任务</h2>
              <div className='space-y-3'>
                {dashboard.upcomingDeadlines.map(deadline => (
                  <div
                    key={deadline.id}
                    className='flex justify-between items-center border-b pb-3'
                  >
                    <div>
                      <div className='font-medium'>{deadline.title}</div>
                      <div className='text-sm text-gray-600'>
                        截止日期:{' '}
                        {new Date(deadline.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        deadline.priority === 'critical' ||
                        deadline.priority === 'high'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {getCompliancePriorityLabel(deadline.priority)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 检查清单 */}
      {!loading && activeTab === 'checklist' && (
        <div className='space-y-6'>
          {checklists.map(checklist => (
            <div key={checklist.id} className='bg-white rounded-lg shadow p-6'>
              <div className='flex justify-between items-start mb-4'>
                <div>
                  <h2 className='text-xl font-semibold'>{checklist.name}</h2>
                  <p className='text-sm text-gray-600'>
                    {checklist.description}
                  </p>
                </div>
                <div className='text-right'>
                  <div className='text-2xl font-bold text-blue-600'>
                    {checklist.completionRate}%
                  </div>
                  <div className='text-sm text-gray-600'>完成率</div>
                </div>
              </div>

              <div className='space-y-3'>
                {checklist.items.map(item => (
                  <div key={item.id} className='border rounded-md p-4'>
                    <div className='flex justify-between items-start mb-2'>
                      <div className='flex-1'>
                        <h3 className='font-medium'>{item.title}</h3>
                        <p className='text-sm text-gray-600'>
                          {item.description}
                        </p>
                      </div>
                      <div className='flex items-center gap-2'>
                        <span
                          className='px-2 py-1 rounded text-sm'
                          style={{
                            backgroundColor: `${getComplianceStatusColor(item.status)}20`,
                            color: getComplianceStatusColor(item.status),
                          }}
                        >
                          {getComplianceStatusLabel(item.status)}
                        </span>
                        {item.status === ComplianceCheckStatus.PENDING && (
                          <button
                            onClick={() =>
                              updateCheckItem(
                                checklist.id,
                                item.id,
                                ComplianceCheckStatus.PASSED
                              )
                            }
                            className='px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700'
                          >
                            标记为通过
                          </button>
                        )}
                      </div>
                    </div>
                    {item.dueDate && (
                      <div className='text-xs text-gray-500'>
                        截止日期: {new Date(item.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 合规报告 */}
      {!loading && activeTab === 'report' && report && (
        <div className='space-y-6'>
          {/* 报告概览 */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-xl font-semibold mb-4'>{report.title}</h2>
            <div className='grid grid-cols-2 gap-4 mb-4'>
              <div>
                <div className='text-sm text-gray-600'>报告日期</div>
                <div className='font-medium'>
                  {new Date(report.reportDate).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className='text-sm text-gray-600'>报告期间</div>
                <div className='font-medium'>
                  {new Date(report.period.startDate).toLocaleDateString()} -{' '}
                  {new Date(report.period.endDate).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className='mb-4'>
              <div className='text-sm text-gray-600 mb-1'>总体评分</div>
              <div className='text-4xl font-bold text-blue-600'>
                {report.overallScore}
              </div>
            </div>
            <div>
              <div className='text-sm text-gray-600 mb-1'>摘要</div>
              <p className='text-gray-700'>{report.summary}</p>
            </div>
          </div>

          {/* 统计信息 */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-xl font-semibold mb-4'>统计信息</h2>
            <div className='grid grid-cols-5 gap-4'>
              <div className='text-center'>
                <div className='text-3xl font-bold'>
                  {report.statistics.totalChecks}
                </div>
                <div className='text-sm text-gray-600'>总检查项</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-green-600'>
                  {report.statistics.passedChecks}
                </div>
                <div className='text-sm text-gray-600'>通过</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-red-600'>
                  {report.statistics.failedChecks}
                </div>
                <div className='text-sm text-gray-600'>未通过</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-yellow-600'>
                  {report.statistics.warningChecks}
                </div>
                <div className='text-sm text-gray-600'>警告</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-gray-600'>
                  {report.statistics.pendingChecks}
                </div>
                <div className='text-sm text-gray-600'>待检查</div>
              </div>
            </div>
          </div>

          {/* 合规问题 */}
          {report.issues.length > 0 && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>合规问题</h2>
              <div className='space-y-3'>
                {report.issues.map(issue => (
                  <div key={issue.id} className='border rounded-md p-4'>
                    <div className='flex justify-between items-start mb-2'>
                      <h3 className='font-semibold'>{issue.title}</h3>
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          issue.severity === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : issue.severity === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {getCompliancePriorityLabel(issue.severity)}
                      </span>
                    </div>
                    <p className='text-sm text-gray-600 mb-2'>
                      {issue.description}
                    </p>
                    {issue.recommendations.length > 0 && (
                      <div className='mt-2'>
                        <div className='text-sm font-medium mb-1'>建议:</div>
                        <ul className='list-disc list-inside text-sm text-gray-600'>
                          {issue.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 改进建议 */}
          {report.recommendations.length > 0 && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>改进建议</h2>
              <ul className='list-disc list-inside space-y-2 text-gray-700'>
                {report.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
