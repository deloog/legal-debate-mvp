/**
 * SimilarCasesPanel - 相似案例推荐面板
 *
 * TDD 绿阶段：实现组件以通过测试
 *
 * 功能：
 * - 显示与当前案件相似的案例推荐
 * - 支持相似度阈值筛选
 * - 展示匹配因素和相似度分数
 * - 可展开查看案例详情
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Scale,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type {
  SimilaritySearchResult,
  SimilarCaseMatch,
} from '@/types/case-example';
import { CaseResult } from '@prisma/client';

/**
 * 相似案例面板组件属性
 */
interface SimilarCasesPanelProps {
  /** 当前案件ID */
  caseId: string;
  /** 默认相似度阈值 */
  defaultThreshold?: number;
  /** 默认返回结果数量 */
  defaultTopK?: number;
  /** 案例选择回调 */
  onCaseSelect?: (match: SimilarCaseMatch) => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 案例结果标签映射
 */
const CASE_RESULT_LABELS: Record<CaseResult, string> = {
  [CaseResult.WIN]: '胜诉',
  [CaseResult.LOSE]: '败诉',
  [CaseResult.PARTIAL]: '部分胜诉',
  [CaseResult.WITHDRAW]: '撤诉',
};

/**
 * 案例结果样式映射
 */
const CASE_RESULT_STYLES: Record<CaseResult, { bg: string; text: string }> = {
  [CaseResult.WIN]: { bg: 'bg-green-100', text: 'text-green-800' },
  [CaseResult.LOSE]: { bg: 'bg-red-100', text: 'text-red-800' },
  [CaseResult.PARTIAL]: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  [CaseResult.WITHDRAW]: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

/**
 * 相似度分数颜色映射
 */
function getSimilarityColor(score: number): string {
  if (score >= 0.9) return 'text-green-600 bg-green-50';
  if (score >= 0.8) return 'text-blue-600 bg-blue-50';
  if (score >= 0.7) return 'text-yellow-600 bg-yellow-50';
  return 'text-gray-600 bg-gray-50';
}

/**
 * 相似案例面板组件
 */
export function SimilarCasesPanel({
  caseId,
  defaultThreshold = 0.7,
  defaultTopK = 10,
  onCaseSelect,
  className = '',
}: SimilarCasesPanelProps) {
  const [result, setResult] = useState<SimilaritySearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(defaultThreshold);
  const [topK, setTopK] = useState(defaultTopK);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5; // 每页显示5条

  /**
   * 获取相似案例数据
   */
  const fetchSimilarCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCurrentPage(1); // 重置到第一页

    try {
      const url = new URL(
        `/api/cases/${caseId}/similar`,
        window.location.origin
      );
      url.searchParams.set('threshold', threshold.toString());
      url.searchParams.set('topK', topK.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch similar cases');
      }

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        throw new Error(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '检索失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [caseId, threshold, topK]);

  // 初始加载
  useEffect(() => {
    fetchSimilarCases();
  }, [fetchSimilarCases]);

  /**
   * 处理阈值变更
   */
  const handleThresholdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setThreshold(parseFloat(e.target.value));
  };

  /**
   * 处理案例卡片点击
   */
  const handleCaseClick = (match: SimilarCaseMatch) => {
    onCaseSelect?.(match);
  };

  /**
   * 处理展开/折叠详情
   */
  const handleToggleExpand = (caseId: string) => {
    setExpandedCaseId(expandedCaseId === caseId ? null : caseId);
  };

  /**
   * 格式化搜索时间
   */
  const formatSearchTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // 加载状态
  if (loading) {
    return (
      <div className={`similar-cases-panel ${className}`}>
        <div className='panel-header'>
          <h3 className='panel-title'>相似案例推荐</h3>
        </div>
        <div className='loading-state'>
          <div className='skeleton skeleton-title' />
          <div className='skeleton skeleton-card' />
          <div className='skeleton skeleton-card' />
          <p className='loading-text'>正在检索相似案例...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={`similar-cases-panel ${className}`}>
        <div className='panel-header'>
          <h3 className='panel-title'>相似案例推荐</h3>
        </div>
        <div className='error-state'>
          <AlertCircle className='error-icon' />
          <p className='error-message'>{error}</p>
          <button onClick={fetchSimilarCases} className='retry-button'>
            重新加载
          </button>
        </div>
      </div>
    );
  }

  // 空状态
  if (!result || result.totalMatches === 0) {
    return (
      <div className={`similar-cases-panel ${className}`}>
        <div className='panel-header'>
          <h3 className='panel-title'>相似案例推荐</h3>
        </div>
        <div className='empty-state'>
          <FileText className='empty-icon' />
          <p className='empty-title'>未找到相似案例</p>
          <p className='empty-description'>
            尝试调整相似度阈值或添加更多案情描述
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`similar-cases-panel ${className}`}>
      {/* 面板头部 */}
      <div className='panel-header'>
        <div className='panel-title-wrapper'>
          <Scale className='panel-icon' />
          <h3 className='panel-title'>相似案例推荐</h3>
        </div>
        <div className='panel-stats'>
          <span className='stat-item'>
            找到 {result.totalMatches} 个相似案例
          </span>
          <span className='stat-separator'>·</span>
          <span className='stat-item'>
            耗时 {formatSearchTime(result.searchTime)}
          </span>
        </div>
      </div>

      {/* 筛选器 */}
      <div className='panel-filters'>
        <div className='filter-group'>
          <label htmlFor='threshold-select' className='filter-label'>
            相似度阈值
          </label>
          <select
            id='threshold-select'
            value={threshold}
            onChange={handleThresholdChange}
            className='filter-select'
            aria-label='相似度阈值'
          >
            <option value={0.5}>50%</option>
            <option value={0.6}>60%</option>
            <option value={0.7}>70%</option>
            <option value={0.8}>80%</option>
            <option value={0.9}>90%</option>
          </select>
        </div>
        <div className='filter-group'>
          <label htmlFor='topk-select' className='filter-label'>
            结果数量
          </label>
          <select
            id='topk-select'
            value={topK}
            onChange={e => setTopK(parseInt(e.target.value, 10))}
            className='filter-select'
            aria-label='结果数量'
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <button
          onClick={fetchSimilarCases}
          className='refresh-button'
          aria-label='重新检索'
          title='重新检索'
        >
          <RefreshCw className='refresh-icon' />
        </button>
      </div>

      {/* 案例列表 - 分页显示 */}
      <div className='cases-list'>
        {result.matches
          .slice((currentPage - 1) * pageSize, currentPage * pageSize)
          .map(match => {
            const { caseExample, similarity, matchingFactors } = match;
            const isExpanded = expandedCaseId === caseExample.id;

            return (
              <div
                key={caseExample.id}
                className={`case-card ${onCaseSelect ? 'clickable' : ''}`}
                onClick={() => handleCaseClick(match)}
                role={onCaseSelect ? 'button' : undefined}
                tabIndex={onCaseSelect ? 0 : undefined}
              >
                {/* 案例卡片头部 */}
                <div className='case-card-header'>
                  <div className='case-title-wrapper'>
                    <h4 className='case-title' title={caseExample.title}>
                      {caseExample.title}
                    </h4>
                    <span
                      className={`case-result-badge ${CASE_RESULT_STYLES[caseExample.result].bg} ${CASE_RESULT_STYLES[caseExample.result].text}`}
                    >
                      {CASE_RESULT_LABELS[caseExample.result]}
                    </span>
                  </div>
                  <div
                    className={`similarity-score ${getSimilarityColor(similarity)}`}
                  >
                    {Math.round(similarity * 100)}%
                  </div>
                </div>

                {/* 案例基本信息 */}
                <div className='case-meta'>
                  <span className='case-number'>{caseExample.caseNumber}</span>
                  <span className='case-court'>{caseExample.court}</span>
                </div>

                {/* 匹配因素 */}
                <div className='matching-factors'>
                  {matchingFactors.map((factor, index) => (
                    <span key={index} className='factor-tag'>
                      {factor}
                    </span>
                  ))}
                </div>

                {/* 展开的详情 */}
                {isExpanded && (
                  <div className='case-details'>
                    <div className='detail-section'>
                      <h5 className='detail-title'>案情摘要</h5>
                      <p className='detail-content'>{caseExample.facts}</p>
                    </div>
                    <div className='detail-section'>
                      <h5 className='detail-title'>判决结果</h5>
                      <p className='detail-content'>{caseExample.judgment}</p>
                    </div>
                  </div>
                )}

                {/* 展开/折叠按钮 */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleToggleExpand(caseExample.id);
                  }}
                  className='expand-button'
                  aria-label={isExpanded ? '收起详情' : '展开详情'}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className='expand-icon' />
                      <span>收起</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className='expand-icon' />
                      <span>详情</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
      </div>

      {/* 分页控件 */}
      {result.matches.length > pageSize && (
        <div className='pagination'>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className='pagination-button'
            aria-label='上一页'
          >
            <ChevronLeft className='pagination-icon' />
          </button>
          <span className='pagination-info'>
            第 {currentPage} / {Math.ceil(result.matches.length / pageSize)} 页
            （共 {result.matches.length} 条）
          </span>
          <button
            onClick={() =>
              setCurrentPage(p =>
                Math.min(Math.ceil(result.matches.length / pageSize), p + 1)
              )
            }
            disabled={
              currentPage >= Math.ceil(result.matches.length / pageSize)
            }
            className='pagination-button'
            aria-label='下一页'
          >
            <ChevronRight className='pagination-icon' />
          </button>
        </div>
      )}

      {/* 搜索元信息 */}
      {result.metadata && (
        <div className='search-metadata'>
          <span className='metadata-item'>
            算法: {result.metadata.algorithm}
          </span>
          <span className='metadata-item'>
            搜索范围: {result.metadata.casesSearched} 个案例
          </span>
        </div>
      )}

      <style jsx>{`
        .similar-cases-panel {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .panel-title-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .panel-icon {
          width: 20px;
          height: 20px;
          color: #3b82f6;
        }

        .panel-title {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .panel-stats {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #6b7280;
        }

        .stat-separator {
          color: #d1d5db;
        }

        .panel-filters {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-label {
          font-size: 14px;
          color: #4b5563;
        }

        .filter-select {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .refresh-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .refresh-button:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .refresh-icon {
          width: 16px;
          height: 16px;
          color: #6b7280;
        }

        .cases-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .case-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          transition: all 0.2s;
        }

        .case-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
        }

        .case-card.clickable {
          cursor: pointer;
        }

        .case-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .case-title-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }

        .case-title {
          font-size: 15px;
          font-weight: 600;
          color: #111827;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .case-result-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          flex-shrink: 0;
        }

        .similarity-score {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .case-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 12px;
        }

        .case-number {
          font-size: 13px;
          color: #6b7280;
          font-family: monospace;
        }

        .case-court {
          font-size: 13px;
          color: #9ca3af;
        }

        .matching-factors {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }

        .factor-tag {
          padding: 2px 8px;
          background: #eff6ff;
          color: #3b82f6;
          border-radius: 4px;
          font-size: 12px;
        }

        .case-details {
          margin: 12px 0;
          padding: 12px;
          background: #f9fafb;
          border-radius: 6px;
        }

        .detail-section {
          margin-bottom: 12px;
        }

        .detail-section:last-child {
          margin-bottom: 0;
        }

        .detail-title {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin: 0 0 6px 0;
        }

        .detail-content {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
          line-height: 1.5;
        }

        .expand-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          width: 100%;
          padding: 8px;
          border: none;
          border-top: 1px solid #e5e7eb;
          background: transparent;
          color: #6b7280;
          font-size: 13px;
          cursor: pointer;
          transition: color 0.2s;
          margin-top: 8px;
        }

        .expand-button:hover {
          color: #3b82f6;
        }

        .expand-icon {
          width: 16px;
          height: 16px;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .pagination-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pagination-button:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .pagination-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pagination-icon {
          width: 16px;
          height: 16px;
          color: #6b7280;
        }

        .pagination-info {
          font-size: 14px;
          color: #6b7280;
        }

        .search-metadata {
          display: flex;
          gap: 16px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #9ca3af;
        }

        /* 加载状态 */
        .loading-state {
          padding: 24px 0;
        }

        .skeleton {
          background: linear-gradient(
            90deg,
            #f3f4f6 25%,
            #e5e7eb 50%,
            #f3f4f6 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        .skeleton-title {
          height: 24px;
          width: 150px;
          margin-bottom: 16px;
        }

        .skeleton-card {
          height: 100px;
          margin-bottom: 12px;
        }

        .loading-text {
          text-align: center;
          color: #6b7280;
          font-size: 14px;
          margin-top: 16px;
        }

        /* 错误状态 */
        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 0;
          text-align: center;
        }

        .error-icon {
          width: 40px;
          height: 40px;
          color: #ef4444;
          margin-bottom: 12px;
        }

        .error-message {
          color: #ef4444;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .retry-button {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .retry-button:hover {
          background: #2563eb;
        }

        /* 空状态 */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 0;
          text-align: center;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          color: #d1d5db;
          margin-bottom: 12px;
        }

        .empty-title {
          font-size: 16px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 4px;
        }

        .empty-description {
          font-size: 14px;
          color: #9ca3af;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
