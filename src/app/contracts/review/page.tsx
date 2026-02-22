/**
 * 合同智能审查页面
 */
'use client';

import { useState } from 'react';
import type {
  ReviewReport,
  RiskItem,
  Suggestion,
} from '@/types/contract-review';

export default function ContractReviewPage() {
  const [reviewData, setReviewData] = useState<ReviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // 上传文件
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/contracts/review/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error(`HTTP ${uploadRes.status}: 上传失败`);
      }

      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error?.message || '上传失败');
      }

      // 自动开始审查
      await reviewContract(uploadData.data.contractId);
    } catch (err) {
      console.error('上传合同失败:', err);
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const reviewContract = async (contractId: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/contracts/review/${contractId}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: 审查失败`);
      }

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || '审查失败');
      }

      setReviewData(data.data);
    } catch (err) {
      console.error('审查合同失败:', err);
      setError(err instanceof Error ? err.message : '审查失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskLevelText = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return '严重';
      case 'HIGH':
        return '高';
      case 'MEDIUM':
        return '中';
      case 'LOW':
        return '低';
      default:
        return '未知';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <div className='border-b border-gray-200 bg-white px-6 py-4'>
        <div className='mx-auto max-w-7xl'>
          <h1 className='text-2xl font-bold text-gray-900'>合同智能审查</h1>
          <p className='mt-1 text-sm text-gray-600'>
            AI自动识别合同风险点，生成专业审查报告
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className='mx-auto max-w-7xl p-6'>
        {error && (
          <div className='mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800'>
            {error}
          </div>
        )}

        {!reviewData ? (
          /* Upload Section */
          <div className='mx-auto max-w-2xl'>
            <div className='rounded-lg bg-white p-8 shadow'>
              <div className='text-center'>
                <svg
                  className='mx-auto h-12 w-12 text-gray-400'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
                  />
                </svg>
                <h3 className='mt-4 text-lg font-medium text-gray-900'>
                  上传合同文件
                </h3>
                <p className='mt-2 text-sm text-gray-600'>
                  支持PDF、DOC、DOCX格式，最大10MB
                </p>

                <div className='mt-6'>
                  <label
                    htmlFor='file-upload'
                    className='inline-flex cursor-pointer items-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700'
                  >
                    {uploading ? '上传中...' : '选择文件'}
                    <input
                      id='file-upload'
                      name='file-upload'
                      type='file'
                      className='sr-only'
                      accept='.pdf,.doc,.docx'
                      onChange={handleFileChange}
                      disabled={uploading}
                      aria-label='上传合同'
                    />
                  </label>
                </div>

                {loading && (
                  <div className='mt-6'>
                    <div className='text-sm text-gray-600'>正在审查合同...</div>
                    <div className='mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200'>
                      <div
                        className='h-full animate-pulse bg-blue-600'
                        style={{ width: '60%' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className='mt-8 border-t border-gray-200 pt-6'>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className='text-sm text-blue-600 hover:text-blue-700'
                >
                  审查历史
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Review Result Section */
          <div className='space-y-6'>
            {/* Score Cards */}
            <div className='grid grid-cols-1 gap-6 sm:grid-cols-3'>
              <div className='rounded-lg bg-white p-6 shadow'>
                <div className='text-sm font-medium text-gray-600'>
                  总体评分
                </div>
                <div
                  className={`mt-2 text-4xl font-bold ${getScoreColor(reviewData.overallScore)}`}
                >
                  {reviewData.overallScore}
                </div>
                <div className='mt-1 text-xs text-gray-500'>满分100分</div>
              </div>

              <div className='rounded-lg bg-white p-6 shadow'>
                <div className='text-sm font-medium text-gray-600'>
                  风险评分
                </div>
                <div
                  className={`mt-2 text-4xl font-bold ${getScoreColor(reviewData.riskScore)}`}
                >
                  {reviewData.riskScore}
                </div>
                <div className='mt-1 text-xs text-gray-500'>满分100分</div>
              </div>

              <div className='rounded-lg bg-white p-6 shadow'>
                <div className='text-sm font-medium text-gray-600'>
                  合规评分
                </div>
                <div
                  className={`mt-2 text-4xl font-bold ${getScoreColor(reviewData.complianceScore)}`}
                >
                  {reviewData.complianceScore}
                </div>
                <div className='mt-1 text-xs text-gray-500'>满分100分</div>
              </div>
            </div>

            {/* Risk Statistics */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='text-lg font-semibold text-gray-900'>风险统计</h2>
              <div className='mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4'>
                <div>
                  <div className='text-sm text-gray-600'>总风险数</div>
                  <div className='mt-1 text-2xl font-bold text-gray-900'>
                    {reviewData.totalRisks}
                  </div>
                </div>
                <div>
                  <div className='text-sm text-gray-600'>严重风险</div>
                  <div className='mt-1 text-2xl font-bold text-red-600'>
                    {reviewData.criticalRisks}
                  </div>
                </div>
                <div>
                  <div className='text-sm text-gray-600'>高风险</div>
                  <div className='mt-1 text-2xl font-bold text-orange-600'>
                    {reviewData.highRisks}
                  </div>
                </div>
                <div>
                  <div className='text-sm text-gray-600'>中风险</div>
                  <div className='mt-1 text-2xl font-bold text-yellow-600'>
                    {reviewData.mediumRisks}
                  </div>
                </div>
              </div>
            </div>

            {/* Risk List */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='text-lg font-semibold text-gray-900'>风险详情</h2>
              {reviewData.risks.length === 0 ? (
                <p className='mt-4 text-sm text-gray-500'>未发现风险项</p>
              ) : (
                <div className='mt-4 space-y-4'>
                  {reviewData.risks.map((risk: RiskItem) => (
                    <div
                      key={risk.id}
                      className={`rounded-lg border p-4 ${getRiskLevelColor(risk.level)}`}
                    >
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <div className='flex items-center gap-2'>
                            <span className='text-xs font-semibold'>
                              {getRiskLevelText(risk.level)}
                            </span>
                            <h3 className='text-sm font-medium'>
                              {risk.title}
                            </h3>
                          </div>
                          <p className='mt-2 text-sm'>{risk.description}</p>
                          <div className='mt-2 text-xs'>
                            <span className='font-medium'>影响：</span>
                            {risk.impact}
                          </div>
                          {risk.location.page && (
                            <div className='mt-1 text-xs text-gray-600'>
                              位置：第{risk.location.page}页
                              {risk.location.paragraph &&
                                ` 第${risk.location.paragraph}段`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suggestions */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='text-lg font-semibold text-gray-900'>修改建议</h2>
              {reviewData.suggestions.length === 0 ? (
                <p className='mt-4 text-sm text-gray-500'>暂无修改建议</p>
              ) : (
                <div className='mt-4 space-y-4'>
                  {reviewData.suggestions.map((suggestion: Suggestion) => (
                    <div
                      key={suggestion.id}
                      className='rounded-lg border border-gray-200 p-4'
                    >
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <div className='flex items-center gap-2'>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                suggestion.priority === 'HIGH'
                                  ? 'bg-red-100 text-red-800'
                                  : suggestion.priority === 'MEDIUM'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {suggestion.priority === 'HIGH'
                                ? '高优先级'
                                : suggestion.priority === 'MEDIUM'
                                  ? '中优先级'
                                  : '低优先级'}
                            </span>
                            <h3 className='text-sm font-medium text-gray-900'>
                              {suggestion.title}
                            </h3>
                          </div>
                          <p className='mt-2 text-sm text-gray-600'>
                            {suggestion.description}
                          </p>
                          {suggestion.suggestedText && (
                            <div className='mt-3 rounded bg-green-50 p-3'>
                              <div className='text-xs font-medium text-green-800'>
                                建议文本：
                              </div>
                              <div className='mt-1 text-sm text-green-900'>
                                {suggestion.suggestedText}
                              </div>
                            </div>
                          )}
                          <div className='mt-2 text-xs text-gray-600'>
                            <span className='font-medium'>原因：</span>
                            {suggestion.reason}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className='flex gap-4'>
              <button
                onClick={() => setReviewData(null)}
                className='rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700'
              >
                审查新合同
              </button>
              <button
                onClick={() => window.print()}
                className='rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50'
              >
                导出报告
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
