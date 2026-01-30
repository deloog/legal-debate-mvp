/**
 * 法务报表页面
 * 企业法务报表生成和导出功能
 */

'use client';

import React, { useState } from 'react';
import type {
  ReportFilter,
  ReportData,
  CaseStatistics,
  CostAnalysis,
  RiskReportData,
  ComplianceReportData,
} from '@/types/report';
import {
  ReportType,
  ReportPeriod,
  ExportFormat,
  getReportTypeLabel,
  getReportPeriodLabel,
} from '@/types/report';

/**
 * 法务报表页面组件
 */
export default function ReportsPage() {
  const [filter, setFilter] = useState<ReportFilter>({
    reportType: ReportType.CASE_STATISTICS,
    period: ReportPeriod.LAST_YEAR,
  });

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 生成报表
  const handleGenerateReport = async () => {
    // 验证必填字段
    if (!filter.reportType) {
      setError('请选择报表类型');
      return;
    }

    if (filter.period === ReportPeriod.CUSTOM) {
      if (!filter.startDate || !filter.endDate) {
        setError('请选择开始日期和结束日期');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filter }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || '生成报表失败');
      }

      setReport(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 导出报表
  const handleExportReport = async (format: ExportFormat) => {
    if (!report) return;

    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId: report.id,
          format,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || '导出失败');
      }

      // 下载文件
      window.open(data.data.downloadUrl, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    }
  };

  // 渲染案件统计数据
  const renderCaseStatistics = (data: CaseStatistics) => (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>总案件数</div>
          <div className='text-2xl font-bold'>{data.totalCases}</div>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>已结案</div>
          <div className='text-2xl font-bold'>{data.closedCases}</div>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>胜诉率</div>
          <div className='text-2xl font-bold'>
            {data.successRate.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className='bg-white p-6 rounded-lg shadow'>
        <h3 className='text-lg font-semibold mb-4'>案件类型分布</h3>
        <div className='space-y-2'>
          {data.byCaseType.map((item, index) => (
            <div key={index} className='flex items-center justify-between'>
              <span>{item.caseType}</span>
              <span className='font-semibold'>
                {item.count}件 ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 渲染费用分析数据
  const renderCostAnalysis = (data: CostAnalysis) => (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>总费用</div>
          <div className='text-2xl font-bold'>
            ¥{(data.totalCost / 10000).toFixed(1)}万
          </div>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>平均每案费用</div>
          <div className='text-2xl font-bold'>
            ¥{(data.averageCostPerCase / 10000).toFixed(1)}万
          </div>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>预算使用率</div>
          <div className='text-2xl font-bold'>{data.budgetUtilization}%</div>
        </div>
      </div>

      <div className='bg-white p-6 rounded-lg shadow'>
        <h3 className='text-lg font-semibold mb-4'>费用分类</h3>
        <div className='space-y-2'>
          {data.costByCategory.map((item, index) => (
            <div key={index} className='flex items-center justify-between'>
              <span>{item.category}</span>
              <span className='font-semibold'>
                ¥{(item.amount / 10000).toFixed(1)}万 ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 渲染风险报告数据
  const renderRiskReport = (data: RiskReportData) => (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>总风险数</div>
          <div className='text-2xl font-bold'>{data.totalRisks}</div>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>严重风险</div>
          <div className='text-2xl font-bold text-red-600'>
            {data.criticalRisks}
          </div>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>高风险</div>
          <div className='text-2xl font-bold text-orange-600'>
            {data.highRisks}
          </div>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>风险缓解率</div>
          <div className='text-2xl font-bold'>{data.mitigationRate}%</div>
        </div>
      </div>
    </div>
  );

  // 渲染合规报告数据
  const renderComplianceReport = (data: ComplianceReportData) => (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>合规评分</div>
          <div className='text-2xl font-bold'>{data.overallScore}分</div>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>通过检查</div>
          <div className='text-2xl font-bold text-green-600'>
            {data.passedChecks}
          </div>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>未通过检查</div>
          <div className='text-2xl font-bold text-red-600'>
            {data.failedChecks}
          </div>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='text-sm text-gray-600'>改进率</div>
          <div className='text-2xl font-bold'>{data.improvementRate}%</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className='container mx-auto px-4 py-8'>
      <h1 className='text-3xl font-bold mb-8'>法务报表系统</h1>

      {/* 筛选条件 */}
      <div className='bg-white p-6 rounded-lg shadow mb-8'>
        <h2 className='text-xl font-semibold mb-4'>报表筛选</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label
              htmlFor='reportType'
              className='block text-sm font-medium mb-2'
            >
              报表类型
            </label>
            <select
              id='reportType'
              value={filter.reportType}
              onChange={e =>
                setFilter({
                  ...filter,
                  reportType: e.target.value as ReportType,
                })
              }
              className='w-full px-3 py-2 border rounded-lg'
            >
              <option value={ReportType.CASE_STATISTICS}>
                {getReportTypeLabel(ReportType.CASE_STATISTICS)}
              </option>
              <option value={ReportType.COST_ANALYSIS}>
                {getReportTypeLabel(ReportType.COST_ANALYSIS)}
              </option>
              <option value={ReportType.RISK_REPORT}>
                {getReportTypeLabel(ReportType.RISK_REPORT)}
              </option>
              <option value={ReportType.COMPLIANCE_REPORT}>
                {getReportTypeLabel(ReportType.COMPLIANCE_REPORT)}
              </option>
            </select>
          </div>

          <div>
            <label htmlFor='period' className='block text-sm font-medium mb-2'>
              时间范围
            </label>
            <select
              id='period'
              value={filter.period}
              onChange={e =>
                setFilter({ ...filter, period: e.target.value as ReportPeriod })
              }
              className='w-full px-3 py-2 border rounded-lg'
            >
              <option value={ReportPeriod.LAST_7_DAYS}>
                {getReportPeriodLabel(ReportPeriod.LAST_7_DAYS)}
              </option>
              <option value={ReportPeriod.LAST_30_DAYS}>
                {getReportPeriodLabel(ReportPeriod.LAST_30_DAYS)}
              </option>
              <option value={ReportPeriod.LAST_90_DAYS}>
                {getReportPeriodLabel(ReportPeriod.LAST_90_DAYS)}
              </option>
              <option value={ReportPeriod.LAST_YEAR}>
                {getReportPeriodLabel(ReportPeriod.LAST_YEAR)}
              </option>
              <option value={ReportPeriod.CUSTOM}>
                {getReportPeriodLabel(ReportPeriod.CUSTOM)}
              </option>
            </select>
          </div>

          {filter.period === ReportPeriod.CUSTOM && (
            <>
              <div>
                <label
                  htmlFor='startDate'
                  className='block text-sm font-medium mb-2'
                >
                  开始日期
                </label>
                <input
                  type='date'
                  id='startDate'
                  onChange={e =>
                    setFilter({
                      ...filter,
                      startDate: new Date(e.target.value),
                    })
                  }
                  className='w-full px-3 py-2 border rounded-lg'
                />
              </div>

              <div>
                <label
                  htmlFor='endDate'
                  className='block text-sm font-medium mb-2'
                >
                  结束日期
                </label>
                <input
                  type='date'
                  id='endDate'
                  onChange={e =>
                    setFilter({ ...filter, endDate: new Date(e.target.value) })
                  }
                  className='w-full px-3 py-2 border rounded-lg'
                />
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={loading}
          className='mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400'
        >
          {loading ? '生成中...' : '生成报表'}
        </button>

        {error && (
          <div className='mt-4 p-4 bg-red-50 text-red-600 rounded-lg'>
            {error}
          </div>
        )}
      </div>

      {/* 报表结果 */}
      {report && (
        <div className='space-y-8'>
          <div className='bg-white p-6 rounded-lg shadow'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-2xl font-bold'>{report.title}</h2>
              <div className='space-x-2'>
                <button
                  onClick={() => handleExportReport(ExportFormat.PDF)}
                  className='px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700'
                >
                  导出为PDF
                </button>
                <button
                  onClick={() => handleExportReport(ExportFormat.EXCEL)}
                  className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700'
                >
                  导出为Excel
                </button>
                <button
                  onClick={() => handleExportReport(ExportFormat.CSV)}
                  className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                >
                  导出为CSV
                </button>
              </div>
            </div>

            <div className='text-sm text-gray-600 mb-4'>
              生成时间：{new Date(report.generatedAt).toLocaleString()}
            </div>

            <div className='mb-6'>
              <h3 className='text-lg font-semibold mb-2'>报表摘要</h3>
              <p className='text-gray-700'>{report.summary}</p>
            </div>

            {report.reportType === ReportType.CASE_STATISTICS &&
              renderCaseStatistics(report.data as CaseStatistics)}
            {report.reportType === ReportType.COST_ANALYSIS &&
              renderCostAnalysis(report.data as CostAnalysis)}
            {report.reportType === ReportType.RISK_REPORT &&
              renderRiskReport(report.data as RiskReportData)}
            {report.reportType === ReportType.COMPLIANCE_REPORT &&
              renderComplianceReport(report.data as ComplianceReportData)}

            {report.recommendations.length > 0 && (
              <div className='mt-6'>
                <h3 className='text-lg font-semibold mb-2'>建议</h3>
                <ul className='list-disc list-inside space-y-1'>
                  {report.recommendations.map((rec, index) => (
                    <li key={index} className='text-gray-700'>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
