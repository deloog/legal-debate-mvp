/**
 * RiskAnalysisCharts - 风险分析图表组件
 *
 * TDD 绿阶段：实现组件以通过测试
 *
 * 功能：
 * - 风险等级分布饼图
 * - 风险类别分布条形图
 * - 风险趋势分析
 * - 支持导出和交互
 */

'use client';

import { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Download,
  PieChart as PieChartIcon,
  BarChart3,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
} from 'lucide-react';
import type { RiskAssessmentResult } from '@/types/risk';
import { RiskLevel, RiskCategory } from '@/types/risk';

/**
 * 风险分析图表组件属性
 */
interface RiskAnalysisChartsProps {
  /** 风险评估结果 */
  assessment: RiskAssessmentResult;
  /** 加载状态 */
  loading?: boolean;
  /** 选中的风险等级 */
  selectedLevel?: RiskLevel | null;
  /** 图表点击回调 */
  onChartClick?: (data: { level: RiskLevel; count: number }) => void;
  /** 导出回调 */
  onExport?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 风险等级颜色映射
 */
const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: '#22c55e',
  [RiskLevel.MEDIUM]: '#f59e0b',
  [RiskLevel.HIGH]: '#f97316',
  [RiskLevel.CRITICAL]: '#dc2626',
};

/**
 * 风险等级标签映射
 */
const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: '低',
  [RiskLevel.MEDIUM]: '中',
  [RiskLevel.HIGH]: '高',
  [RiskLevel.CRITICAL]: '严重',
};

/**
 * 风险类别颜色映射
 */
const RISK_CATEGORY_COLORS: Record<RiskCategory, string> = {
  [RiskCategory.PROCEDURAL]: '#3b82f6',
  [RiskCategory.EVIDENTIARY]: '#8b5cf6',
  [RiskCategory.SUBSTANTIVE]: '#f59e0b',
  [RiskCategory.STRATEGIC]: '#10b981',
};

type TabType = 'distribution' | 'category' | 'trend';

/**
 * 风险分析图表组件
 */
export function RiskAnalysisCharts({
  assessment,
  loading = false,
  selectedLevel,
  onChartClick,
  onExport,
  className = '',
}: RiskAnalysisChartsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('distribution');

  // 准备风险分布数据
  const distributionData = [
    {
      name: '严重',
      level: RiskLevel.CRITICAL,
      value: assessment.statistics.criticalRisks,
    },
    {
      name: '高',
      level: RiskLevel.HIGH,
      value: assessment.statistics.highRisks,
    },
    {
      name: '中',
      level: RiskLevel.MEDIUM,
      value: assessment.statistics.mediumRisks,
    },
    { name: '低', level: RiskLevel.LOW, value: assessment.statistics.lowRisks },
  ].filter(item => item.value > 0);

  // 准备类别分析数据
  const categoryData = [
    {
      name: '程序性',
      category: RiskCategory.PROCEDURAL,
      count: assessment.statistics.byCategory[RiskCategory.PROCEDURAL],
    },
    {
      name: '证据性',
      category: RiskCategory.EVIDENTIARY,
      count: assessment.statistics.byCategory[RiskCategory.EVIDENTIARY],
    },
    {
      name: '实体性',
      category: RiskCategory.SUBSTANTIVE,
      count: assessment.statistics.byCategory[RiskCategory.SUBSTANTIVE],
    },
    {
      name: '策略性',
      category: RiskCategory.STRATEGIC,
      count: assessment.statistics.byCategory[RiskCategory.STRATEGIC],
    },
  ].filter(item => item.count > 0);

  // 准备趋势数据（模拟累积风险趋势）
  const trendData = assessment.risks.map((risk, index) => ({
    name: `风险 ${index + 1}`,
    score: Math.round(risk.score * 100),
    cumulative: Math.round(
      (assessment.risks
        .slice(0, index + 1)
        .reduce((sum, r) => sum + r.score, 0) *
        100) /
        (index + 1)
    ),
  }));

  // 计算统计摘要
  const totalRisks = assessment.statistics.totalRisks;
  const highestLevel =
    totalRisks > 0
      ? (Object.entries(assessment.statistics.byLevel)
          .filter(([, count]) => count > 0)
          .sort(([, a], [, b]) => b - a)[0]?.[0] as RiskLevel)
      : null;
  const dominantCategory =
    categoryData.length > 0
      ? categoryData.sort((a, b) => b.count - a.count)[0]?.name
      : '-';

  // 处理图表点击
  const handleChartClick = (data: { level: RiskLevel; value: number }) => {
    if (data && onChartClick) {
      onChartClick({ level: data.level, count: data.value });
    }
  };

  // 加载状态
  if (loading) {
    return (
      <div className={`risk-analysis-charts ${className}`}>
        <div className='charts-header'>
          <h3 className='charts-title'>风险分析图表</h3>
        </div>
        <div className='chart-skeleton'>
          <div className='skeleton-tabs' />
          <div className='skeleton-chart' />
          <div className='skeleton-summary' />
        </div>
      </div>
    );
  }

  // 空状态
  if (totalRisks === 0) {
    return (
      <div className={`risk-analysis-charts ${className}`}>
        <div className='charts-header'>
          <h3 className='charts-title'>风险分析图表</h3>
        </div>
        <div className='empty-state'>
          <Info className='empty-icon' />
          <p className='empty-text'>暂无风险数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`risk-analysis-charts ${className}`}>
      {/* 头部 */}
      <div className='charts-header'>
        <h3 className='charts-title'>风险分析图表</h3>
        <button
          onClick={onExport}
          className='export-button'
          aria-label='导出图表'
          title='导出图表'
        >
          <Download className='export-icon' />
        </button>
      </div>

      {/* 标签页 */}
      <div className='chart-tabs' role='tablist'>
        <button
          role='tab'
          aria-selected={activeTab === 'distribution'}
          className={`tab-button ${activeTab === 'distribution' ? 'active' : ''}`}
          onClick={() => setActiveTab('distribution')}
        >
          <PieChartIcon className='tab-icon' />
          <span>风险分布</span>
        </button>
        <button
          role='tab'
          aria-selected={activeTab === 'category'}
          className={`tab-button ${activeTab === 'category' ? 'active' : ''}`}
          onClick={() => setActiveTab('category')}
        >
          <BarChart3 className='tab-icon' />
          <span>类别分析</span>
        </button>
        <button
          role='tab'
          aria-selected={activeTab === 'trend'}
          className={`tab-button ${activeTab === 'trend' ? 'active' : ''}`}
          onClick={() => setActiveTab('trend')}
        >
          <TrendingUp className='tab-icon' />
          <span>趋势分析</span>
        </button>
      </div>

      {/* 图表内容 */}
      <div className='chart-content'>
        {/* 风险分布饼图 */}
        {activeTab === 'distribution' && (
          <div className='risk-distribution-chart'>
            <ResponsiveContainer width='100%' height={280}>
              <PieChart>
                <Pie
                  data={distributionData}
                  cx='50%'
                  cy='50%'
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey='value'
                  onClick={(_, index) =>
                    handleChartClick(distributionData[index])
                  }
                >
                  {distributionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={RISK_LEVEL_COLORS[entry.level]}
                      className={`chart-segment ${selectedLevel === entry.level ? 'selected' : ''}`}
                      stroke={
                        selectedLevel === entry.level ? '#111827' : 'none'
                      }
                      strokeWidth={selectedLevel === entry.level ? 2 : 0}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => [
                    `${value} 个`,
                    `${RISK_LEVEL_LABELS[(props?.payload as { level: RiskLevel })?.level]}风险`,
                  ]}
                />
                <Legend
                  formatter={(_value, entry) =>
                    `${RISK_LEVEL_LABELS[(entry?.payload as { level: RiskLevel })?.level]}风险`
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 类别分析条形图 */}
        {activeTab === 'category' && (
          <div className='category-analysis-chart'>
            <ResponsiveContainer width='100%' height={280}>
              <BarChart data={categoryData} className='bar-chart'>
                <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
                <XAxis dataKey='name' tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={value => [`${value} 个`, '数量']} />
                <Bar dataKey='count' radius={[4, 4, 0, 0]}>
                  {categoryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={RISK_CATEGORY_COLORS[entry.category]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 趋势分析 */}
        {activeTab === 'trend' && (
          <div className='trend-analysis-chart'>
            <h4 className='trend-title'>风险累积趋势</h4>
            <ResponsiveContainer width='100%' height={240}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
                <XAxis dataKey='name' tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip
                  formatter={(value, name) => [
                    `${value}%`,
                    name === 'score' ? '单个风险评分' : '平均风险评分',
                  ]}
                />
                <Area
                  type='monotone'
                  dataKey='score'
                  stroke='#3b82f6'
                  fill='#3b82f6'
                  fillOpacity={0.3}
                  name='单个风险评分'
                />
                <Area
                  type='monotone'
                  dataKey='cumulative'
                  stroke='#f59e0b'
                  fill='#f59e0b'
                  fillOpacity={0.3}
                  name='平均风险评分'
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 统计摘要 */}
      <div className='chart-summary'>
        <div className='summary-card'>
          <div className='summary-icon total'>
            <AlertCircle className='icon' />
          </div>
          <div className='summary-content'>
            <span className='summary-value'>{totalRisks}</span>
            <span className='summary-label'>风险总数</span>
          </div>
        </div>
        <div className='summary-card'>
          <div className={`summary-icon ${highestLevel || 'low'}`}>
            {highestLevel === RiskLevel.CRITICAL ? (
              <AlertOctagon className='icon' />
            ) : highestLevel === RiskLevel.HIGH ? (
              <AlertTriangle className='icon' />
            ) : (
              <AlertCircle className='icon' />
            )}
          </div>
          <div className='summary-content'>
            <span className='summary-value'>
              {highestLevel ? RISK_LEVEL_LABELS[highestLevel] : '-'}
            </span>
            <span className='summary-label'>最高风险等级</span>
          </div>
        </div>
        <div className='summary-card'>
          <div className='summary-icon category'>
            <BarChart3 className='icon' />
          </div>
          <div className='summary-content'>
            <span className='summary-value'>{dominantCategory}</span>
            <span className='summary-label'>主要风险类别</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .risk-analysis-charts {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }

        .charts-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .charts-title {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .export-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .export-button:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .export-icon {
          width: 16px;
          height: 16px;
          color: #6b7280;
        }

        .chart-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border: none;
          background: transparent;
          color: #6b7280;
          font-size: 14px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
          margin-bottom: -1px;
        }

        .tab-button:hover {
          color: #374151;
          background: #f9fafb;
        }

        .tab-button.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
          font-weight: 500;
        }

        .tab-icon {
          width: 16px;
          height: 16px;
        }

        .chart-content {
          min-height: 280px;
        }

        .trend-title {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin: 0 0 12px 0;
          text-align: center;
        }

        .chart-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .summary-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .summary-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: #e5e7eb;
        }

        .summary-icon.total {
          background: #dbeafe;
          color: #3b82f6;
        }

        .summary-icon.low {
          background: #dcfce7;
          color: #22c55e;
        }

        .summary-icon.medium {
          background: #fef3c7;
          color: #f59e0b;
        }

        .summary-icon.high {
          background: #ffedd5;
          color: #f97316;
        }

        .summary-icon.critical {
          background: #fee2e2;
          color: #dc2626;
        }

        .summary-icon.category {
          background: #f3e8ff;
          color: #8b5cf6;
        }

        .summary-icon .icon {
          width: 20px;
          height: 20px;
        }

        .summary-content {
          display: flex;
          flex-direction: column;
        }

        .summary-value {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .summary-label {
          font-size: 12px;
          color: #6b7280;
        }

        /* 空状态 */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 0;
          text-align: center;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          color: #d1d5db;
          margin-bottom: 12px;
        }

        .empty-text {
          font-size: 14px;
          color: #9ca3af;
          margin: 0;
        }

        /* 骨架屏 */
        .chart-skeleton {
          padding: 20px 0;
        }

        .skeleton-tabs {
          height: 40px;
          background: linear-gradient(
            90deg,
            #f3f4f6 25%,
            #e5e7eb 50%,
            #f3f4f6 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .skeleton-chart {
          height: 280px;
          background: linear-gradient(
            90deg,
            #f3f4f6 25%,
            #e5e7eb 50%,
            #f3f4f6 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .skeleton-summary {
          height: 80px;
          background: linear-gradient(
            90deg,
            #f3f4f6 25%,
            #e5e7eb 50%,
            #f3f4f6 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        /* 响应式 */
        @media (max-width: 640px) {
          .chart-summary {
            grid-template-columns: 1fr;
          }

          .chart-tabs {
            flex-wrap: wrap;
          }

          .tab-button {
            flex: 1;
            justify-content: center;
            padding: 8px 12px;
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}
