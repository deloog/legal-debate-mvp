/**
 * RiskAssessmentViewer - 风险评估查看器组件
 *
 * 功能：可视化展示案件风险评估结果
 */

'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Info,
  TrendingDown,
  TrendingUp,
  AlertOctagon,
  Shield,
  Activity,
  FileText,
  Clock,
} from 'lucide-react';
import type {
  RiskAssessmentResult,
  RiskIdentificationResult,
  RiskMitigationSuggestion,
} from '@/types/risk';

interface RiskAssessmentViewerProps {
  assessment: RiskAssessmentResult;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
}

/**
 * 风险等级映射
 */
const RISK_LEVEL_CONFIG = {
  low: {
    icon: <CheckCircle className='h-6 w-6 text-green-600' />,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: '整体风险较低，案件相对安全',
  },
  medium: {
    icon: <AlertCircle className='h-6 w-6 text-yellow-600' />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    description: '存在中等风险，需要关注',
  },
  high: {
    icon: <AlertTriangle className='h-6 w-6 text-orange-600' />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: '风险较高，建议制定应对策略',
  },
  critical: {
    icon: <AlertOctagon className='h-6 w-6 text-red-600' />,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: '严重风险，必须立即采取措施',
  },
};

/**
 * 风险类型标签映射
 */
const RISK_TYPE_LABELS = {
  legal_procedure: '程序问题',
  evidence_strength: '证据强度',
  statute_limitation: '时效问题',
  jurisdiction: '管辖权',
  cost_benefit: '成本效益',
  fact_verification: '事实核实',
  legal_basis: '法律依据',
  contradiction: '矛盾问题',
  proof_burden: '举证责任',
};

/**
 * 风险类别标签映射
 */
const RISK_CATEGORY_LABELS = {
  procedural: '程序性',
  evidentiary: '证据性',
  substantive: '实体性',
  strategic: '战略性',
};

/**
 * 建议类型图标映射
 */
const SUGGESTION_TYPE_ICONS = {
  gather_evidence: <FileText className='h-4 w-4' />,
  amend_claim: <FileText className='h-4 w-4' />,
  change_strategy: <TrendingUp className='h-4 w-4' />,
  add_legal_basis: <Activity className='h-4 w-4' />,
  consult_expert: <Shield className='h-4 w-4' />,
  consider_settlement: <TrendingDown className='h-4 w-4' />,
  verify_facts: <Info className='h-4 w-4' />,
};

/**
 * 优先级标签映射
 */
const PRIORITY_LABELS = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

/**
 * 优先级颜色映射
 */
const PRIORITY_COLORS = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

/**
 * RiskAssessmentViewer主组件
 */
export function RiskAssessmentViewer({
  assessment,
  loading = false,
  error,
  onRefresh,
}: RiskAssessmentViewerProps) {
  const levelConfig = RISK_LEVEL_CONFIG[assessment.overallRiskLevel];
  const scorePercentage = Math.round(assessment.overallRiskScore * 100);

  if (loading) {
    return (
      <div className='space-y-4'>
        <div className='animate-pulse'>
          <div className='h-24 bg-gray-200 rounded-lg mb-4' />
          <div className='h-16 bg-gray-200 rounded-lg mb-2' />
          <div className='h-16 bg-gray-200 rounded-lg mb-2' />
          <div className='h-16 bg-gray-200 rounded-lg' />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-4 bg-red-50 border border-red-200 rounded-lg'>
        <div className='flex items-center gap-2 mb-2'>
          <AlertTriangle className='h-5 w-5 text-red-600' />
          <p className='font-medium text-red-900'>加载失败</p>
        </div>
        <p className='text-sm text-red-700'>{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className='mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700'
          >
            重试
          </button>
        )}
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 风险概览 */}
      <div
        className={`p-6 border-2 rounded-lg ${levelConfig.bgColor} ${levelConfig.borderColor}`}
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            {levelConfig.icon}
            <div>
              <h3 className='text-xl font-bold text-gray-900'>
                整体风险：{levelConfig.description}
              </h3>
              <p className={`text-sm ${levelConfig.color} mt-1`}>
                风险等级：{assessment.overallRiskLevel} | 评分：
                {scorePercentage}%
              </p>
            </div>
          </div>
          <div className='text-right'>
            <p className='text-sm text-gray-600'>评估耗时</p>
            <p className='text-lg font-semibold text-gray-900'>
              {assessment.assessmentTime}ms
            </p>
          </div>
        </div>
      </div>

      {/* 风险统计 */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <StatCard
          icon={<AlertOctagon className='h-5 w-5 text-red-600' />}
          label='严重风险'
          value={assessment.statistics.criticalRisks}
          color='text-red-600'
        />
        <StatCard
          icon={<AlertTriangle className='h-5 w-5 text-orange-600' />}
          label='高风险'
          value={assessment.statistics.highRisks}
          color='text-orange-600'
        />
        <StatCard
          icon={<AlertCircle className='h-5 w-5 text-yellow-600' />}
          label='中风险'
          value={assessment.statistics.mediumRisks}
          color='text-yellow-600'
        />
        <StatCard
          icon={<Info className='h-5 w-5 text-green-600' />}
          label='低风险'
          value={assessment.statistics.lowRisks}
          color='text-green-600'
        />
      </div>

      {/* 风险列表 */}
      {assessment.risks.length > 0 && (
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold text-gray-900'>识别到的风险</h3>
          {assessment.risks.map(risk => (
            <RiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      )}

      {/* 风险建议 */}
      {assessment.suggestions && assessment.suggestions.length > 0 && (
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold text-gray-900'>风险规避建议</h3>
          {assessment.suggestions.map(suggestion => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))}
        </div>
      )}

      {/* 无风险情况 */}
      {assessment.risks.length === 0 && (
        <div className='p-6 bg-green-50 border border-green-200 rounded-lg'>
          <div className='flex items-center gap-3'>
            <CheckCircle className='h-8 w-8 text-green-600' />
            <div>
              <p className='font-medium text-green-900'>未发现明显风险</p>
              <p className='text-sm text-green-700'>
                该案件整体风险较低，可以继续推进
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 数据质量提示 */}
      <DataQualityHint assessment={assessment} />
    </div>
  );
}

/**
 * 统计卡片组件
 */
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className='p-4 bg-white border border-gray-200 rounded-lg'>
      <div className='flex items-center gap-2 mb-2'>
        {icon}
        <span className='text-sm text-gray-600'>{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

/**
 * 风险卡片组件
 */
function RiskCard({ risk }: { risk: RiskIdentificationResult }) {
  const levelConfig = RISK_LEVEL_CONFIG[risk.riskLevel];
  const scorePercentage = Math.round(risk.score * 100);
  const confidencePercentage = Math.round(risk.confidence * 100);

  return (
    <div className='p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow'>
      <div className='flex items-start justify-between mb-3'>
        <div className='flex items-center gap-2'>
          {levelConfig.icon}
          <div>
            <h4 className='font-semibold text-gray-900'>
              {RISK_TYPE_LABELS[risk.riskType] || risk.riskType}
            </h4>
            <p className='text-sm text-gray-600'>
              {RISK_CATEGORY_LABELS[risk.riskCategory] || risk.riskCategory}
            </p>
          </div>
        </div>
        <div className='text-right'>
          <span
            className={`inline-block px-2 py-1 text-xs font-medium rounded ${levelConfig.bgColor} ${levelConfig.color}`}
          >
            {risk.riskLevel}
          </span>
        </div>
      </div>

      <p className='text-sm text-gray-700 mb-3'>{risk.description}</p>

      <div className='grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2'>
        <div>
          <span className='font-medium'>风险评分：</span>
          <span
            className={scorePercentage >= 70 ? 'text-red-600' : 'text-gray-700'}
          >
            {scorePercentage}%
          </span>
        </div>
        <div>
          <span className='font-medium'>置信度：</span>
          <span
            className={
              confidencePercentage < 70 ? 'text-yellow-600' : 'text-gray-700'
            }
          >
            {confidencePercentage}%
          </span>
        </div>
      </div>

      {risk.evidence && risk.evidence.length > 0 && (
        <div className='mt-2'>
          <p className='text-xs font-medium text-gray-600 mb-1'>支持证据：</p>
          <ul className='text-xs text-gray-600 list-disc list-inside'>
            {risk.evidence.map((evidence, idx) => (
              <li key={idx}>{evidence}</li>
            ))}
          </ul>
        </div>
      )}

      {risk.suggestions && risk.suggestions.length > 0 && (
        <div className='mt-3 pt-3 border-t border-gray-200'>
          <p className='text-xs font-medium text-gray-600 mb-1'>建议措施：</p>
          {risk.suggestions.slice(0, 2).map(suggestion => (
            <div key={suggestion.id} className='text-xs text-gray-700 mb-1'>
              • {suggestion.action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 建议卡片组件
 */
function SuggestionCard({
  suggestion,
}: {
  suggestion: RiskMitigationSuggestion;
}) {
  const priorityClass = PRIORITY_COLORS[suggestion.priority];
  const icon = SUGGESTION_TYPE_ICONS[suggestion.suggestionType];

  return (
    <div className='p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow'>
      <div className='flex items-start gap-3'>
        <div className='shrink-0 mt-1 p-2 bg-blue-50 rounded-lg'>{icon}</div>
        <div className='flex-1'>
          <div className='flex items-center justify-between mb-2'>
            <h4 className='font-semibold text-gray-900'>{suggestion.action}</h4>
            <span
              className={`inline-block px-2 py-1 text-xs font-medium rounded ${priorityClass}`}
            >
              {PRIORITY_LABELS[suggestion.priority]}
            </span>
          </div>
          <p className='text-sm text-gray-700 mb-2'>{suggestion.reason}</p>
          <div className='flex items-center gap-4 text-xs text-gray-600'>
            <div className='flex items-center gap-1'>
              <TrendingUp className='h-3 w-3' />
              <span>预期影响：{suggestion.estimatedImpact}</span>
            </div>
            <div className='flex items-center gap-1'>
              <Clock className='h-3 w-3' />
              <span>预估时间：{suggestion.estimatedEffort}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 数据质量提示组件
 */
function DataQualityHint({ assessment }: { assessment: RiskAssessmentResult }) {
  const hints: React.ReactNode[] = [];

  if (assessment.statistics.totalRisks === 0) {
    hints.push(
      <div
        key='no-risks'
        className='flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg'
      >
        <Info className='h-4 w-4 text-blue-600' />
        <p className='text-sm text-blue-900'>
          未发现明显风险，建议定期更新案件信息以保持评估的准确性
        </p>
      </div>
    );
  }

  const highRiskCount =
    assessment.statistics.criticalRisks + assessment.statistics.highRisks;
  if (highRiskCount > 3) {
    hints.push(
      <div
        key='many-risks'
        className='flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg'
      >
        <AlertTriangle className='h-4 w-4 text-orange-600' />
        <p className='text-sm text-orange-900'>
          存在较多高风险因素，建议优先处理最严重的问题
        </p>
      </div>
    );
  }

  if (assessment.risks.some(r => r.confidence < 0.6)) {
    hints.push(
      <div
        key='low-confidence'
        className='flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg'
      >
        <AlertCircle className='h-4 w-4 text-yellow-600' />
        <p className='text-sm text-yellow-900'>
          部分风险评估的置信度较低，建议补充更多信息以提高准确性
        </p>
      </div>
    );
  }

  if (hints.length === 0) {
    hints.push(
      <div
        key='good-quality'
        className='flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg'
      >
        <CheckCircle className='h-4 w-4 text-green-600' />
        <p className='text-sm text-green-900'>
          评估数据质量良好，建议定期更新以保持时效性
        </p>
      </div>
    );
  }

  return <div className='space-y-2'>{hints}</div>;
}
