/**
 * 风险评估页面
 * 企业法务风险评估功能
 */

'use client';

import React, { useState } from 'react';
import type {
  RiskAssessmentFormData,
  RiskAssessmentResult,
} from '@/types/risk-assessment';
import { RiskLevel } from '@/types/risk';

/**
 * 风险评估页面组件
 */
export default function RiskAssessmentPage() {
  const [formData, setFormData] = useState<RiskAssessmentFormData>({
    caseId: `case_${Date.now()}`,
    caseTitle: '',
    caseType: '',
    caseDescription: '',
    parties: {
      plaintiff: '',
      defendant: '',
    },
    facts: [],
    claims: [],
    evidence: [],
    legalBasis: [],
  });

  const [result, setResult] = useState<RiskAssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 添加案件事实
  const addFact = () => {
    setFormData(prev => ({
      ...prev,
      facts: [...prev.facts, ''],
    }));
  };

  // 更新案件事实
  const updateFact = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      facts: prev.facts.map((fact, i) => (i === index ? value : fact)),
    }));
  };

  // 删除案件事实
  const deleteFact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      facts: prev.facts.filter((_, i) => i !== index),
    }));
  };

  // 添加诉讼请求
  const addClaim = () => {
    setFormData(prev => ({
      ...prev,
      claims: [...prev.claims, ''],
    }));
  };

  // 更新诉讼请求
  const updateClaim = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      claims: prev.claims.map((claim, i) => (i === index ? value : claim)),
    }));
  };

  // 删除诉讼请求
  const deleteClaim = (index: number) => {
    setFormData(prev => ({
      ...prev,
      claims: prev.claims.filter((_, i) => i !== index),
    }));
  };

  // 添加证据
  const addEvidence = () => {
    setFormData(prev => ({
      ...prev,
      evidence: [
        ...prev.evidence,
        {
          id: `evidence_${Date.now()}`,
          name: '',
          type: '',
          description: '',
        },
      ],
    }));
  };

  // 更新证据
  const updateEvidence = (
    index: number,
    field: 'name' | 'type' | 'description',
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      evidence: prev.evidence.map((ev, i) =>
        i === index ? { ...ev, [field]: value } : ev
      ),
    }));
  };

  // 删除证据
  const deleteEvidence = (index: number) => {
    setFormData(prev => ({
      ...prev,
      evidence: prev.evidence.filter((_, i) => i !== index),
    }));
  };

  // 添加法律依据
  const addLegalBasis = () => {
    setFormData(prev => ({
      ...prev,
      legalBasis: [
        ...prev.legalBasis,
        {
          id: `law_${Date.now()}`,
          lawName: '',
          articleNumber: '',
          content: '',
        },
      ],
    }));
  };

  // 更新法律依据
  const updateLegalBasis = (
    index: number,
    field: 'lawName' | 'articleNumber' | 'content',
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      legalBasis: prev.legalBasis.map((law, i) =>
        i === index ? { ...law, [field]: value } : law
      ),
    }));
  };

  // 删除法律依据
  const deleteLegalBasis = (index: number) => {
    setFormData(prev => ({
      ...prev,
      legalBasis: prev.legalBasis.filter((_, i) => i !== index),
    }));
  };

  // 验证表单
  const validateForm = (): boolean => {
    if (!formData.caseTitle.trim()) {
      setError('请填写案件标题');
      return false;
    }
    if (!formData.caseType.trim()) {
      setError('请填写案件类型');
      return false;
    }
    if (!formData.caseDescription.trim()) {
      setError('请填写案件描述');
      return false;
    }
    if (!formData.parties.plaintiff.trim()) {
      setError('请填写原告信息');
      return false;
    }
    if (!formData.parties.defendant.trim()) {
      setError('请填写被告信息');
      return false;
    }
    if (formData.facts.length === 0 || !formData.facts.some(f => f.trim())) {
      setError('请至少添加一项案件事实');
      return false;
    }
    if (formData.claims.length === 0 || !formData.claims.some(c => c.trim())) {
      setError('请至少添加一项诉讼请求');
      return false;
    }
    return true;
  };

  // 提交评估
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/risk-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || '评估失败');
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '评估失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取风险等级颜色
  const getRiskLevelColor = (level: RiskLevel): string => {
    switch (level) {
      case RiskLevel.LOW:
        return 'text-green-600';
      case RiskLevel.MEDIUM:
        return 'text-yellow-600';
      case RiskLevel.HIGH:
        return 'text-orange-600';
      case RiskLevel.CRITICAL:
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // 获取风险等级标签
  const getRiskLevelLabel = (level: RiskLevel): string => {
    switch (level) {
      case RiskLevel.LOW:
        return '低风险';
      case RiskLevel.MEDIUM:
        return '中风险';
      case RiskLevel.HIGH:
        return '高风险';
      case RiskLevel.CRITICAL:
        return '严重风险';
      default:
        return '未知';
    }
  };

  return (
    <div className='container mx-auto px-4 py-8'>
      <h1 className='text-3xl font-bold mb-8'>法律风险评估</h1>

      {/* 评估表单 */}
      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* 基本信息 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-xl font-semibold mb-4'>基本信息</h2>

          <div className='space-y-4'>
            <div>
              <label
                htmlFor='caseTitle'
                className='block text-sm font-medium mb-1'
              >
                案件标题 <span className='text-red-500'>*</span>
              </label>
              <input
                id='caseTitle'
                type='text'
                value={formData.caseTitle}
                onChange={e =>
                  setFormData(prev => ({ ...prev, caseTitle: e.target.value }))
                }
                className='w-full px-3 py-2 border rounded-md'
                placeholder='请输入案件标题'
              />
            </div>

            <div>
              <label
                htmlFor='caseType'
                className='block text-sm font-medium mb-1'
              >
                案件类型 <span className='text-red-500'>*</span>
              </label>
              <input
                id='caseType'
                type='text'
                value={formData.caseType}
                onChange={e =>
                  setFormData(prev => ({ ...prev, caseType: e.target.value }))
                }
                className='w-full px-3 py-2 border rounded-md'
                placeholder='如：劳动争议、合同纠纷等'
              />
            </div>

            <div>
              <label
                htmlFor='caseDescription'
                className='block text-sm font-medium mb-1'
              >
                案件描述 <span className='text-red-500'>*</span>
              </label>
              <textarea
                id='caseDescription'
                value={formData.caseDescription}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    caseDescription: e.target.value,
                  }))
                }
                className='w-full px-3 py-2 border rounded-md'
                rows={4}
                placeholder='请简要描述案件情况'
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label
                  htmlFor='plaintiff'
                  className='block text-sm font-medium mb-1'
                >
                  原告 <span className='text-red-500'>*</span>
                </label>
                <input
                  id='plaintiff'
                  type='text'
                  value={formData.parties.plaintiff}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      parties: { ...prev.parties, plaintiff: e.target.value },
                    }))
                  }
                  className='w-full px-3 py-2 border rounded-md'
                  placeholder='原告姓名/名称'
                />
              </div>

              <div>
                <label
                  htmlFor='defendant'
                  className='block text-sm font-medium mb-1'
                >
                  被告 <span className='text-red-500'>*</span>
                </label>
                <input
                  id='defendant'
                  type='text'
                  value={formData.parties.defendant}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      parties: { ...prev.parties, defendant: e.target.value },
                    }))
                  }
                  className='w-full px-3 py-2 border rounded-md'
                  placeholder='被告姓名/名称'
                />
              </div>
            </div>
          </div>
        </div>

        {/* 案件事实 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-xl font-semibold'>
              案件事实 <span className='text-red-500'>*</span>
            </h2>
            <button
              type='button'
              onClick={addFact}
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
            >
              添加事实
            </button>
          </div>

          <div className='space-y-3'>
            {formData.facts.map((fact, index) => (
              <div key={index} className='flex gap-2'>
                <input
                  type='text'
                  value={fact}
                  onChange={e => updateFact(index, e.target.value)}
                  className='flex-1 px-3 py-2 border rounded-md'
                  placeholder={`请输入案件事实 ${index + 1}`}
                />
                <button
                  type='button'
                  onClick={() => deleteFact(index)}
                  className='px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700'
                  aria-label='删除事实'
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 诉讼请求 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-xl font-semibold'>
              诉讼请求 <span className='text-red-500'>*</span>
            </h2>
            <button
              type='button'
              onClick={addClaim}
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
            >
              添加诉讼请求
            </button>
          </div>

          <div className='space-y-3'>
            {formData.claims.map((claim, index) => (
              <div key={index} className='flex gap-2'>
                <input
                  type='text'
                  value={claim}
                  onChange={e => updateClaim(index, e.target.value)}
                  className='flex-1 px-3 py-2 border rounded-md'
                  placeholder={`请输入诉讼请求 ${index + 1}`}
                />
                <button
                  type='button'
                  onClick={() => deleteClaim(index)}
                  className='px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700'
                  aria-label='删除诉讼请求'
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 证据材料 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-xl font-semibold'>证据材料</h2>
            <button
              type='button'
              onClick={addEvidence}
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
            >
              添加证据
            </button>
          </div>

          <div className='space-y-4'>
            {formData.evidence.map((evidence, index) => (
              <div key={evidence.id} className='border rounded-md p-4'>
                <div className='grid grid-cols-2 gap-4 mb-3'>
                  <input
                    type='text'
                    value={evidence.name}
                    onChange={e =>
                      updateEvidence(index, 'name', e.target.value)
                    }
                    className='px-3 py-2 border rounded-md'
                    placeholder='证据名称'
                  />
                  <input
                    type='text'
                    value={evidence.type}
                    onChange={e =>
                      updateEvidence(index, 'type', e.target.value)
                    }
                    className='px-3 py-2 border rounded-md'
                    placeholder='证据类型（如：书证、物证）'
                  />
                </div>
                <textarea
                  value={evidence.description}
                  onChange={e =>
                    updateEvidence(index, 'description', e.target.value)
                  }
                  className='w-full px-3 py-2 border rounded-md mb-3'
                  rows={2}
                  placeholder='证据描述'
                />
                <button
                  type='button'
                  onClick={() => deleteEvidence(index)}
                  className='px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700'
                >
                  删除证据
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 法律依据 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-xl font-semibold'>法律依据</h2>
            <button
              type='button'
              onClick={addLegalBasis}
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
            >
              添加法律依据
            </button>
          </div>

          <div className='space-y-4'>
            {formData.legalBasis.map((law, index) => (
              <div key={law.id} className='border rounded-md p-4'>
                <div className='grid grid-cols-2 gap-4 mb-3'>
                  <input
                    type='text'
                    value={law.lawName}
                    onChange={e =>
                      updateLegalBasis(index, 'lawName', e.target.value)
                    }
                    className='px-3 py-2 border rounded-md'
                    placeholder='法律名称'
                  />
                  <input
                    type='text'
                    value={law.articleNumber}
                    onChange={e =>
                      updateLegalBasis(index, 'articleNumber', e.target.value)
                    }
                    className='px-3 py-2 border rounded-md'
                    placeholder='条款编号'
                  />
                </div>
                <textarea
                  value={law.content}
                  onChange={e =>
                    updateLegalBasis(index, 'content', e.target.value)
                  }
                  className='w-full px-3 py-2 border rounded-md mb-3'
                  rows={2}
                  placeholder='法律条文内容'
                />
                <button
                  type='button'
                  onClick={() => deleteLegalBasis(index)}
                  className='px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700'
                >
                  删除法律依据
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md'>
            {error}
          </div>
        )}

        {/* 提交按钮 */}
        <div className='flex justify-center'>
          <button
            type='submit'
            disabled={loading}
            className='px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          >
            {loading ? '评估中...' : '开始评估'}
          </button>
        </div>
      </form>

      {/* 评估结果 */}
      {result && (
        <div className='mt-8 space-y-6'>
          <h2 className='text-2xl font-bold'>评估结果</h2>

          {/* 总体评估 */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h3 className='text-xl font-semibold mb-4'>总体评估</h3>
            <div className='grid grid-cols-3 gap-4'>
              <div>
                <div className='text-sm text-gray-600 mb-1'>总体风险等级</div>
                <div
                  className={`text-2xl font-bold ${getRiskLevelColor(result.overallRiskLevel)}`}
                >
                  {getRiskLevelLabel(result.overallRiskLevel)}
                </div>
              </div>
              <div>
                <div className='text-sm text-gray-600 mb-1'>风险评分</div>
                <div className='text-2xl font-bold'>
                  {result.overallRiskScore}
                </div>
              </div>
              <div>
                <div className='text-sm text-gray-600 mb-1'>胜诉概率</div>
                <div className='text-2xl font-bold text-green-600'>
                  {result.winProbability}%
                </div>
              </div>
            </div>
          </div>

          {/* 风险分布 */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h3 className='text-xl font-semibold mb-4'>风险分布</h3>
            <div className='grid grid-cols-4 gap-4'>
              <div className='text-center'>
                <div className='text-3xl font-bold text-red-600'>
                  {result.statistics.criticalRisks}
                </div>
                <div className='text-sm text-gray-600'>严重风险</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-orange-600'>
                  {result.statistics.highRisks}
                </div>
                <div className='text-sm text-gray-600'>高风险</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-yellow-600'>
                  {result.statistics.mediumRisks}
                </div>
                <div className='text-sm text-gray-600'>中风险</div>
              </div>
              <div className='text-center'>
                <div className='text-3xl font-bold text-green-600'>
                  {result.statistics.lowRisks}
                </div>
                <div className='text-sm text-gray-600'>低风险</div>
              </div>
            </div>
          </div>

          {/* 风险详情 */}
          {result.risks.length > 0 && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h3 className='text-xl font-semibold mb-4'>风险详情</h3>
              <div className='space-y-4'>
                {result.risks.map(risk => (
                  <div key={risk.id} className='border rounded-md p-4'>
                    <div className='flex justify-between items-start mb-2'>
                      <h4 className='font-semibold'>{risk.description}</h4>
                      <span
                        className={`px-2 py-1 rounded text-sm ${getRiskLevelColor(risk.riskLevel)}`}
                      >
                        {getRiskLevelLabel(risk.riskLevel)}
                      </span>
                    </div>
                    <div className='text-sm text-gray-600'>
                      置信度: {(risk.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 缓解建议 */}
          {result.suggestions.length > 0 && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h3 className='text-xl font-semibold mb-4'>缓解建议</h3>
              <div className='space-y-4'>
                {result.suggestions.map(suggestion => (
                  <div key={suggestion.id} className='border rounded-md p-4'>
                    <h4 className='font-semibold mb-2'>{suggestion.action}</h4>
                    <p className='text-sm text-gray-600 mb-2'>
                      {suggestion.reason}
                    </p>
                    <div className='flex gap-4 text-sm'>
                      <span>预计影响: {suggestion.estimatedImpact}</span>
                      <span>预计工作量: {suggestion.estimatedEffort}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
