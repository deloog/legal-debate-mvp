/**
 * 证据管理标签页组件
 * 集成证据链分析、质证预判、证据分类等功能
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { EvidenceList } from '@/components/evidence/EvidenceList';
import { CrossExaminationCard } from '@/components/evidence/CrossExaminationCard';
import { EvidenceCategoryPanel } from '@/components/evidence/EvidenceCategoryPanel';
import { EvidenceChainVisualizer } from '@/components/evidence/EvidenceChainVisualizer';
import { EVIDENCE_CATEGORIES } from '@/lib/evidence/evidence-category-config';
import type { EvidenceListResponse } from '@/types/evidence';
import type { CrossExaminationResult } from '@/lib/evidence/cross-examination-service';
import type {
  EvidenceChainGraph,
  EvidenceChainPath,
} from '@/types/evidence-chain';

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
export function EvidenceTab({
  caseId,
  caseType,
  canManage: _canManage,
}: EvidenceTabProps) {
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [evidenceData, setEvidenceData] = useState<EvidenceListResponse | null>(
    null
  );
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null
  );
  const [crossExamResult, setCrossExamResult] =
    useState<CrossExaminationResult | null>(null);
  const [chainAnalysisResult, setChainAnalysisResult] = useState<{
    graph: EvidenceChainGraph;
    chains: EvidenceChainPath[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
   * 加载证据链分析
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
      setChainAnalysisResult(data.data);
    } catch (err) {
      console.error('证据链分析失败:', err);
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setIsLoading(false);
    }
  }, [caseId, evidenceData]);

  /**
   * 初始加载
   */
  useEffect(() => {
    void loadEvidenceList();
  }, [loadEvidenceList]);

  /**
   * 切换视图时的处理
   */
  useEffect(() => {
    if (currentView === 'chain' && !chainAnalysisResult && evidenceData) {
      void loadChainAnalysis();
    }
  }, [currentView, chainAnalysisResult, evidenceData, loadChainAnalysis]);

  /**
   * 渲染视图切换按钮
   */
  const renderViewButtons = () => (
    <div className='flex gap-2 mb-4'>
      <Button
        variant={currentView === 'list' ? 'primary' : 'outline'}
        size='sm'
        onClick={() => setCurrentView('list')}
      >
        证据列表
      </Button>
      <Button
        variant={currentView === 'chain' ? 'primary' : 'outline'}
        size='sm'
        onClick={() => setCurrentView('chain')}
      >
        证据链分析
      </Button>
      <Button
        variant={currentView === 'category' ? 'primary' : 'outline'}
        size='sm'
        onClick={() => setCurrentView('category')}
      >
        证据分类
      </Button>
      {selectedEvidenceId && (
        <Button
          variant={currentView === 'cross-exam' ? 'primary' : 'outline'}
          size='sm'
          onClick={() => setCurrentView('cross-exam')}
        >
          质证预判
        </Button>
      )}
    </div>
  );

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
            caseId={caseId}
            initialData={evidenceData || undefined}
            showSelection={true}
            onSelectEvidence={id => {
              setSelectedEvidenceId(id);
              void loadCrossExamination(id);
            }}
          />
        );

      case 'chain':
        if (isLoading) {
          return (
            <Card>
              <CardContent className='py-8 text-center'>
                <div className='text-gray-500'>正在分析证据链...</div>
              </CardContent>
            </Card>
          );
        }

        if (!chainAnalysisResult) {
          return (
            <Card>
              <CardContent className='py-8 text-center'>
                <div className='text-gray-500 mb-4'>暂无证据链分析结果</div>
                <Button onClick={() => void loadChainAnalysis()}>
                  开始分析
                </Button>
              </CardContent>
            </Card>
          );
        }

        return (
          <div className='space-y-4'>
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <CardTitle>证据链分析</CardTitle>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => void loadChainAnalysis()}
                  >
                    重新分析
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <EvidenceChainVisualizer
                  chainGraph={chainAnalysisResult.graph}
                  chains={chainAnalysisResult.chains}
                />
              </CardContent>
            </Card>
          </div>
        );

      case 'category':
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
          categoryCode: null, // 需要从metadata中获取
        }));

        return (
          <EvidenceCategoryPanel
            categories={categories}
            evidenceList={evidenceList}
            caseType={caseType}
          />
        );

      case 'cross-exam':
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
            {chainAnalysisResult && (
              <div>
                <div className='text-sm text-gray-600'>证据链完整性</div>
                <div className='text-2xl font-bold text-orange-600'>
                  {chainAnalysisResult.graph.statistics.chainCompleteness.toFixed(
                    1
                  )}
                  %
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 视图切换 */}
      {renderViewButtons()}

      {/* 当前视图内容 */}
      {renderCurrentView()}
    </div>
  );
}
