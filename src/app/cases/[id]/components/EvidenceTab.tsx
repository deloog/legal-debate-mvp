/**
 * 证据管理标签页组件
 * 集成证据链分析、质证预判、证据分类等功能
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { EvidenceList } from '@/components/evidence/EvidenceList';
import { CrossExaminationCard } from '@/components/evidence/CrossExaminationCard';
import { EvidenceCategoryPanel } from '@/components/evidence/EvidenceCategoryPanel';
import { EVIDENCE_CATEGORIES } from '@/lib/evidence/evidence-category-config';
import { EvidenceType } from '@/types/evidence';
import type { EvidenceListResponse } from '@/types/evidence';
import type { CrossExaminationResult } from '@/lib/evidence/cross-examination-service';
import type { EvidenceChainAnalysisResult } from '@/lib/evidence/evidence-chain-service';

/** 单次分析记录 */
interface AnalysisRecord {
  id: string;
  timestamp: string; // ISO string
  evidenceCount: number;
  result: EvidenceChainAnalysisResult;
}

/**
 * 组件属性
 */
interface EvidenceTabProps {
  caseId: string;
  caseType?: string;
  canManage: boolean;
}

/**
 * 视图类型
 */
type ViewType = 'list' | 'chain' | 'category' | 'cross-exam';

/**
 * 证据管理标签页组件
 */
/** 添加/编辑证据表单数据 */
interface EvidenceFormData {
  name: string;
  type: EvidenceType;
  description: string;
  source: string;
}

const EVIDENCE_TYPE_OPTIONS: { value: EvidenceType; label: string }[] = [
  { value: EvidenceType.DOCUMENT, label: '书证' },
  { value: EvidenceType.PHYSICAL, label: '物证' },
  { value: EvidenceType.WITNESS, label: '证人证言' },
  { value: EvidenceType.EXPERT_OPINION, label: '鉴定意见' },
  { value: EvidenceType.AUDIO_VIDEO, label: '音视频' },
  { value: EvidenceType.OTHER, label: '其他' },
];

const EMPTY_FORM: EvidenceFormData = {
  name: '',
  type: EvidenceType.DOCUMENT,
  description: '',
  source: '',
};

export function EvidenceTab({ caseId, caseType, canManage }: EvidenceTabProps) {
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [evidenceData, setEvidenceData] = useState<EvidenceListResponse | null>(
    null
  );
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null
  );
  const [crossExamResult, setCrossExamResult] =
    useState<CrossExaminationResult | null>(null);
  const [chainHistory, setChainHistory] = useState<AnalysisRecord[]>([]);
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 列表刷新计数器：+1 时强制 EvidenceList 重新挂载
  const [listRefreshKey, setListRefreshKey] = useState(0);

  // 添加/编辑表单状态
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EvidenceFormData>(EMPTY_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 文件上传状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /**
   * 加载证据列表
   */
  const loadEvidenceList = useCallback(async () => {
    try {
      const response = await fetch(`/api/evidence?caseId=${caseId}`);
      if (!response.ok) {
        throw new Error('加载证据列表失败');
      }
      const data = await response.json();
      setEvidenceData(data.data);
    } catch (err) {
      console.error('加载证据列表失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }, [caseId]);

  /**
   * 打开添加表单
   */
  const openAddForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setUploadedFileUrl(null);
    setUploadedFileName(null);
    setUploadError(null);
    setShowForm(true);
  };

  /**
   * 上传证据文件
   */
  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const response = await fetch('/api/evidence/upload', {
        method: 'POST',
        body: fd,
      });
      const result = (await response.json()) as {
        success: boolean;
        fileUrl?: string;
        fileName?: string;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? '上传失败');
      }
      setUploadedFileUrl(result.fileUrl ?? null);
      setUploadedFileName(result.fileName ?? file.name);
      // 如果证据名称还未填写，自动填入文件名
      setFormData(prev => ({
        ...prev,
        name: prev.name || (result.fileName ?? file.name),
      }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }, []);

  /**
   * 打开编辑表单
   */
  const openEditForm = useCallback(async (evidenceId: string) => {
    setFormError(null);
    try {
      const response = await fetch(`/api/evidence/${evidenceId}`);
      if (!response.ok) throw new Error('加载证据详情失败');
      const data = await response.json();
      const ev = data.data as {
        name: string;
        type: EvidenceType;
        description?: string;
        source?: string;
      };
      setFormData({
        name: ev.name,
        type: ev.type,
        description: ev.description ?? '',
        source: ev.source ?? '',
      });
      setEditingId(evidenceId);
      setShowForm(true);
    } catch (err) {
      console.error('加载证据详情失败:', err);
    }
  }, []);

  /**
   * 提交添加/编辑表单
   */
  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim()) {
        setFormError('证据名称不能为空');
        return;
      }
      setFormSubmitting(true);
      setFormError(null);
      try {
        const url = editingId ? `/api/evidence/${editingId}` : '/api/evidence';
        const method = editingId ? 'PUT' : 'POST';
        // 相对路径转绝对 URL（z.string().url() 要求完整 URL）
        const absoluteFileUrl = uploadedFileUrl
          ? uploadedFileUrl.startsWith('http')
            ? uploadedFileUrl
            : `${window.location.origin}${uploadedFileUrl}`
          : undefined;
        const body = editingId
          ? {
              ...formData,
              ...(absoluteFileUrl ? { fileUrl: absoluteFileUrl } : {}),
            }
          : {
              ...formData,
              caseId,
              ...(absoluteFileUrl ? { fileUrl: absoluteFileUrl } : {}),
            };
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const errData = (await response.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(
            errData.message ?? (editingId ? '更新失败' : '添加失败')
          );
        }
        setShowForm(false);
        setFormData(EMPTY_FORM);
        setEditingId(null);
        setUploadedFileUrl(null);
        setUploadedFileName(null);
        // 刷新 EvidenceList（通过 key 重新挂载）和链分析数据源
        setListRefreshKey(k => k + 1);
        await loadEvidenceList();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : '操作失败');
      } finally {
        setFormSubmitting(false);
      }
    },
    [caseId, editingId, formData, uploadedFileUrl, loadEvidenceList]
  );

  /**
   * 加载质证预判
   */
  const loadCrossExamination = useCallback(
    async (evidenceId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/evidence/${evidenceId}/cross-examination`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ourPosition: 'plaintiff',
              caseType: caseType || 'CIVIL',
            }),
          }
        );

        if (!response.ok) {
          throw new Error('质证预判失败');
        }

        const data = await response.json();
        setCrossExamResult(data.data);
      } catch (err) {
        console.error('质证预判失败:', err);
        setError(err instanceof Error ? err.message : '预判失败');
      } finally {
        setIsLoading(false);
      }
    },
    [caseType]
  );

  /**
   * 执行证据链分析，结果写入历史
   */
  const loadChainAnalysis = useCallback(async () => {
    if (!evidenceData?.evidence || evidenceData.evidence.length === 0) {
      setError('没有可分析的证据');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const evidenceIds = evidenceData.evidence.map(e => e.id);
      const response = await fetch('/api/evidence/chain-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          evidenceIds,
          targetFact: '证明案件事实',
        }),
      });

      if (!response.ok) {
        throw new Error('证据链分析失败');
      }

      const data = await response.json();
      const result = data.data as EvidenceChainAnalysisResult;

      const record: AnalysisRecord = {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        evidenceCount: evidenceIds.length,
        result,
      };

      // 写入历史（最多保留 10 条）
      const updated = [record, ...chainHistory].slice(0, 10);
      setChainHistory(updated);
      setSelectedHistoryIdx(0);

      // 持久化到 localStorage
      try {
        localStorage.setItem(`ec-history-${caseId}`, JSON.stringify(updated));
        // 最新结果供辩论页面读取
        localStorage.setItem(
          `ec-latest-${caseId}`,
          JSON.stringify({
            completeness: result.completeness,
            gaps: result.gaps,
            suggestions: result.suggestions,
            timestamp: record.timestamp,
          })
        );
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error('证据链分析失败:', err);
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setIsLoading(false);
    }
  }, [caseId, evidenceData, chainHistory]);

  /**
   * 初始加载
   */
  useEffect(() => {
    void loadEvidenceList();
  }, [loadEvidenceList]);

  /**
   * 从 localStorage 加载历史记录
   */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`ec-history-${caseId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as AnalysisRecord[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChainHistory(parsed);
          setSelectedHistoryIdx(0);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [caseId]);

  /** 切换视图（同时关闭表单） */
  const switchView = (view: ViewType) => {
    setCurrentView(view);
    setShowForm(false);
  };

  /**
   * 渲染视图切换按钮
   */
  const renderViewButtons = () => (
    <div className='flex flex-wrap gap-2 mb-4'>
      <Button
        variant={currentView === 'list' ? 'primary' : 'outline'}
        size='sm'
        onClick={() => switchView('list')}
      >
        证据列表
      </Button>
      <Button
        variant={currentView === 'chain' ? 'primary' : 'outline'}
        size='sm'
        onClick={() => switchView('chain')}
      >
        证据链分析
      </Button>
      <Button
        variant={currentView === 'category' ? 'primary' : 'outline'}
        size='sm'
        onClick={() => switchView('category')}
      >
        证据分类
      </Button>
      {selectedEvidenceId && (
        <Button
          variant={currentView === 'cross-exam' ? 'primary' : 'outline'}
          size='sm'
          onClick={() => switchView('cross-exam')}
        >
          质证预判
        </Button>
      )}
      {canManage && (
        <Button
          variant='primary'
          size='sm'
          className='ml-auto'
          onClick={openAddForm}
        >
          + 添加证据
        </Button>
      )}
    </div>
  );

  /**
   * 渲染添加/编辑证据表单
   */
  const renderForm = () => {
    if (!showForm) return null;
    return (
      <Card className='mb-4 border-blue-200 dark:border-blue-700'>
        <CardHeader>
          <CardTitle className='text-base'>
            {editingId ? '编辑证据' : '添加证据'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={e => void handleFormSubmit(e)} className='space-y-3'>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              <div>
                <label className='block text-sm font-medium mb-1'>
                  证据名称 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={e =>
                    setFormData(p => ({ ...p, name: e.target.value }))
                  }
                  className='w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800'
                  placeholder='请输入证据名称'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1'>
                  证据类型
                </label>
                <select
                  value={formData.type}
                  onChange={e =>
                    setFormData(p => ({
                      ...p,
                      type: e.target.value as EvidenceType,
                    }))
                  }
                  className='w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800'
                >
                  {EVIDENCE_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium mb-1'>来源</label>
                <input
                  type='text'
                  value={formData.source}
                  onChange={e =>
                    setFormData(p => ({ ...p, source: e.target.value }))
                  }
                  className='w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800'
                  placeholder='证据来源'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1'>说明</label>
                <input
                  type='text'
                  value={formData.description}
                  onChange={e =>
                    setFormData(p => ({ ...p, description: e.target.value }))
                  }
                  className='w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800'
                  placeholder='简要说明'
                />
              </div>
            </div>
            {/* 文件上传区 */}
            <div>
              <label className='block text-sm font-medium mb-1'>上传文件</label>
              <div
                className='flex items-center justify-center gap-3 rounded border-2 border-dashed border-gray-300 px-4 py-5 text-sm dark:border-zinc-600 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors'
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) void handleFileUpload(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  type='file'
                  className='hidden'
                  accept='.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.mp4,.mp3,.wav'
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                />
                {uploading ? (
                  <span className='text-gray-500'>上传中...</span>
                ) : uploadedFileName ? (
                  <div className='flex items-center gap-2 text-green-700 dark:text-green-400'>
                    <span>✓</span>
                    <span className='max-w-[280px] truncate'>
                      {uploadedFileName}
                    </span>
                    <button
                      type='button'
                      className='ml-1 text-xs text-gray-400 hover:text-red-500'
                      onClick={e => {
                        e.stopPropagation();
                        setUploadedFileUrl(null);
                        setUploadedFileName(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = '';
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span className='text-gray-400 dark:text-zinc-500'>
                    点击或拖拽上传（图片 / PDF / Word / Excel / 音视频，≤10MB）
                  </span>
                )}
              </div>
              {uploadError && (
                <p className='mt-1 text-xs text-red-600'>{uploadError}</p>
              )}
            </div>

            {formError && <p className='text-sm text-red-600'>{formError}</p>}
            <div className='flex gap-2'>
              <Button
                type='submit'
                size='sm'
                variant='primary'
                disabled={formSubmitting || uploading}
              >
                {formSubmitting ? '提交中...' : editingId ? '保存' : '添加'}
              </Button>
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={() => {
                  setShowForm(false);
                  setFormData(EMPTY_FORM);
                  setEditingId(null);
                  setUploadedFileUrl(null);
                  setUploadedFileName(null);
                }}
              >
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  };

  /**
   * 渲染当前视图
   */
  const renderCurrentView = () => {
    if (error) {
      return (
        <Card>
          <CardContent className='py-8'>
            <div className='text-center text-red-600'>
              <p className='mb-4'>{error}</p>
              <Button onClick={() => setError(null)}>关闭</Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    switch (currentView) {
      case 'list':
        return (
          <EvidenceList
            key={listRefreshKey}
            caseId={caseId}
            showSelection={true}
            onSelectEvidence={id => {
              setSelectedEvidenceId(id);
              void loadCrossExamination(id);
            }}
            onEditEvidence={canManage ? id => void openEditForm(id) : undefined}
          />
        );

      case 'chain': {
        const selectedRecord = chainHistory[selectedHistoryIdx] ?? null;
        const chainResult = selectedRecord?.result ?? null;

        return (
          <div className='space-y-4'>
            {/* 顶部操作栏 */}
            <Card>
              <CardContent className='py-3'>
                <div className='flex items-center justify-between gap-3'>
                  <span className='text-sm font-medium text-gray-700 dark:text-zinc-300'>
                    证据链分析历史
                    {chainHistory.length > 0 && (
                      <span className='ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'>
                        {chainHistory.length} 条
                      </span>
                    )}
                  </span>
                  <Button
                    variant='primary'
                    size='sm'
                    onClick={() => void loadChainAnalysis()}
                    disabled={isLoading || !evidenceData?.evidence?.length}
                  >
                    {isLoading ? 'AI 分析中...' : '开始新分析'}
                  </Button>
                </div>

                {/* AI 分析进度 */}
                {isLoading && (
                  <div className='mt-3 flex items-center gap-3'>
                    <div className='h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-r-transparent' />
                    <span className='text-sm text-gray-500 dark:text-zinc-400'>
                      AI 正在分析证据链关联关系，请稍候...
                    </span>
                  </div>
                )}

                {/* 历史记录列表 */}
                {chainHistory.length > 0 && !isLoading && (
                  <div className='mt-3 space-y-1'>
                    {chainHistory.map((rec, idx) => (
                      <button
                        key={rec.id}
                        onClick={() => setSelectedHistoryIdx(idx)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          idx === selectedHistoryIdx
                            ? 'bg-blue-50 dark:bg-blue-950/30'
                            : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${idx === 0 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-zinc-600'}`}
                        />
                        <span className='flex-1 text-gray-700 dark:text-zinc-300'>
                          {new Date(rec.timestamp).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className='text-xs text-gray-500'>
                          证据 {rec.evidenceCount} 项
                        </span>
                        <span
                          className={`text-xs font-semibold ${rec.result.completeness >= 70 ? 'text-green-600' : rec.result.completeness >= 40 ? 'text-orange-500' : 'text-red-500'}`}
                        >
                          {rec.result.completeness.toFixed(0)}%
                        </span>
                        {idx === 0 && (
                          <span className='rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'>
                            最新
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {chainHistory.length === 0 && !isLoading && (
                  <p className='mt-2 text-sm text-gray-400 dark:text-zinc-500'>
                    暂无分析记录。添加证据后点击&quot;开始新分析&quot;，AI
                    将分析各证据之间的关联关系。
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 分析详情 */}
            {chainResult && (
              <div className='space-y-4'>
                {/* 完整性 */}
                <Card>
                  <CardContent className='py-4'>
                    <div className='mb-2 flex items-center justify-between text-sm'>
                      <span className='font-medium'>证据链完整性</span>
                      <span
                        className={`font-bold text-lg ${chainResult.completeness >= 70 ? 'text-green-600' : chainResult.completeness >= 40 ? 'text-orange-500' : 'text-red-500'}`}
                      >
                        {chainResult.completeness.toFixed(0)}%
                      </span>
                    </div>
                    <div className='h-2.5 w-full rounded-full bg-gray-100 dark:bg-zinc-700'>
                      <div
                        className={`h-2.5 rounded-full transition-all ${chainResult.completeness >= 70 ? 'bg-green-500' : chainResult.completeness >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                        style={{ width: `${chainResult.completeness}%` }}
                      />
                    </div>
                    <p className='mt-1.5 text-xs text-gray-400 dark:text-zinc-500'>
                      分析时间：
                      {selectedRecord
                        ? new Date(selectedRecord.timestamp).toLocaleString(
                            'zh-CN'
                          )
                        : '—'}
                    </p>
                  </CardContent>
                </Card>

                {/* 证据节点角色 */}
                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>证据节点分析</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chainResult.chains.length === 0 ? (
                      <p className='text-sm text-gray-400'>暂无节点数据</p>
                    ) : (
                      <div className='space-y-2'>
                        {chainResult.chains.map(node => (
                          <div
                            key={node.evidenceId}
                            className='flex items-start gap-3 rounded-lg border border-gray-100 p-3 dark:border-zinc-700'
                          >
                            <span
                              className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                node.role === 'key'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  : node.role === 'supporting'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-400'
                              }`}
                            >
                              {node.role === 'key'
                                ? '关键'
                                : node.role === 'supporting'
                                  ? '支持'
                                  : '边缘'}
                            </span>
                            <div className='min-w-0'>
                              <div className='text-sm font-medium text-gray-900 dark:text-zinc-100'>
                                {node.evidenceName}
                              </div>
                              {node.description && (
                                <div className='mt-0.5 text-xs text-gray-500 dark:text-zinc-400'>
                                  {node.description}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 证据关联关系 */}
                {chainResult.connections.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-base'>证据关联关系</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='space-y-2'>
                        {chainResult.connections.map((conn, i) => (
                          <div
                            key={i}
                            className='flex items-center gap-2 text-sm'
                          >
                            <span className='rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-zinc-700'>
                              {conn.from}
                            </span>
                            <span className='text-gray-400'>→</span>
                            <span className='flex-1 text-xs text-gray-600 dark:text-zinc-400'>
                              {conn.relation}
                            </span>
                            <span className='rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-zinc-700'>
                              {conn.to}
                            </span>
                            <span className='text-xs text-orange-500'>
                              强度 {(conn.strength * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 证据链缺口 */}
                {chainResult.gaps.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-base text-red-600 dark:text-red-400'>
                        ⚠ 证据链缺口
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className='space-y-1.5'>
                        {chainResult.gaps.map((gap, i) => (
                          <li
                            key={i}
                            className='flex items-start gap-2 text-sm text-gray-700 dark:text-zinc-300'
                          >
                            <span className='mt-1 shrink-0 text-red-400'>
                              •
                            </span>
                            {gap}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* 改进建议 */}
                {chainResult.suggestions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-base text-green-700 dark:text-green-400'>
                        改进建议
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className='space-y-1.5'>
                        {chainResult.suggestions.map((s, i) => (
                          <li
                            key={i}
                            className='flex items-start gap-2 text-sm text-gray-700 dark:text-zinc-300'
                          >
                            <span className='mt-1 shrink-0 text-green-500'>
                              ✓
                            </span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'category': {
        if (!evidenceData) {
          return (
            <Card>
              <CardContent className='py-8 text-center text-gray-500'>
                加载中...
              </CardContent>
            </Card>
          );
        }

        const categories = caseType ? EVIDENCE_CATEGORIES[caseType] || [] : [];
        const evidenceList = evidenceData.evidence.map(e => ({
          id: e.id,
          name: e.name,
          categoryCode: null as null,
        }));

        return (
          <EvidenceCategoryPanel
            categories={categories}
            evidenceList={evidenceList}
            caseType={caseType}
          />
        );
      }

      case 'cross-exam': {
        if (!selectedEvidenceId) {
          return (
            <Card>
              <CardContent className='py-8 text-center text-gray-500'>
                请先选择一个证据
              </CardContent>
            </Card>
          );
        }

        if (isLoading) {
          return (
            <Card>
              <CardContent className='py-8 text-center'>
                <div className='text-gray-500'>正在预判质证意见...</div>
              </CardContent>
            </Card>
          );
        }

        if (!crossExamResult) {
          return (
            <Card>
              <CardContent className='py-8 text-center'>
                <div className='text-gray-500 mb-4'>暂无质证预判结果</div>
                <Button
                  onClick={() => void loadCrossExamination(selectedEvidenceId)}
                >
                  开始预判
                </Button>
              </CardContent>
            </Card>
          );
        }

        const selectedEvidence = evidenceData?.evidence.find(
          e => e.id === selectedEvidenceId
        );

        return (
          <CrossExaminationCard
            evidenceName={selectedEvidence?.name || '未知证据'}
            result={crossExamResult}
            onRefresh={() => void loadCrossExamination(selectedEvidenceId)}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className='space-y-4'>
      {/* 统计信息 */}
      <Card>
        <CardContent className='py-4'>
          <div className='flex items-center gap-6'>
            <div>
              <div className='text-sm text-gray-600'>总证据数</div>
              <div className='text-2xl font-bold text-blue-600'>
                {evidenceData?.total || 0}
              </div>
            </div>
            <div>
              <div className='text-sm text-gray-600'>已选择</div>
              <div className='text-2xl font-bold text-green-600'>
                {selectedEvidenceId ? 1 : 0}
              </div>
            </div>
            {chainHistory.length > 0 && (
              <div>
                <div className='text-sm text-gray-600'>证据链完整性</div>
                <div className='text-2xl font-bold text-orange-600'>
                  {chainHistory[
                    selectedHistoryIdx
                  ]?.result.completeness.toFixed(0) ?? '—'}
                  %
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 视图切换 */}
      {renderViewButtons()}

      {/* 添加/编辑表单 */}
      {renderForm()}

      {/* 当前视图内容 */}
      {renderCurrentView()}
    </div>
  );
}
