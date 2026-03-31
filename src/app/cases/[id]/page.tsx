/**
 * 案件详情页面
 * 显示案件详细信息，包含团队成员管理和讨论功能
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CaseTeamList } from '@/components/case/CaseTeamList';
import { DiscussionList } from '@/components/discussion/DiscussionList';
import { WitnessList } from '@/components/witness/WitnessList';
import { EvidenceTab } from './components/EvidenceTab';
import { LawGraphTab } from './components/LawGraphTab';
import { DocumentsTab } from './components/DocumentsTab';
import { SimilarCasesPanel } from '@/components/cases/SimilarCasesPanel';
import { useAuth } from '@/app/providers/AuthProvider';

/**
 * 案件详情接口
 */
interface CaseDetail {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  debates?: Array<{ id: string; status: string }>;
}

/**
 * 标签页类型
 */
type TabType =
  | 'overview'
  | 'team'
  | 'timeline'
  | 'documents'
  | 'evidence'
  | 'witnesses'
  | 'discussions'
  | 'law-graph'
  | 'similar-cases';

/** 案件类型中文映射 */
const caseTypeLabels: Record<string, string> = {
  CIVIL: '民事案件',
  CRIMINAL: '刑事案件',
  ADMINISTRATIVE: '行政案件',
  COMMERCIAL: '商事案件',
  LABOR: '劳动案件',
  INTELLECTUAL_PROPERTY: '知识产权案件',
};

/** 案件状态中文映射 */
const caseStatusLabels: Record<string, string> = {
  ACTIVE: '进行中',
  PENDING: '待处理',
  CLOSED: '已结案',
  ARCHIVED: '已归档',
};

const TAB_LIST: { key: TabType; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'team', label: '团队成员' },
  { key: 'documents', label: '📄 文档分析' },
  { key: 'evidence', label: '证据' },
  { key: 'witnesses', label: '证人' },
  { key: 'discussions', label: '讨论' },
  { key: 'law-graph', label: '⚡ 法条图谱' },
  { key: 'similar-cases', label: '🔍 相似案例' },
];

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = typeof params?.id === 'string' ? params.id : '';

  // 验证 caseId 是否有效（不能是 'create' 或其他特殊路径）
  const isValidCaseId =
    caseId && !['create', 'new'].includes(caseId.toLowerCase());

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // 从 AuthProvider 获取当前登录用户，无需额外 fetch
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  // 案件所有者 或 团队成员（canManage 在加载案件后由 useMemo 计算）
  const canManage = useMemo(
    () =>
      !!currentUserId && !!caseDetail && currentUserId === caseDetail.userId,
    [currentUserId, caseDetail]
  );

  // 处理开始辩论按钮点击
  const handleStartDebate = useCallback(async () => {
    // 如果案件已有辩论，跳转到第一个辩论
    if (caseDetail?.debates && caseDetail.debates.length > 0) {
      const firstDebate = caseDetail.debates[0];
      router.push(`/debates/${firstDebate.id}`);
      return;
    }

    // 如果没有辩论，创建新辩论
    try {
      const response = await fetch('/api/v1/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseId,
          title: `${caseDetail?.title || '案件'}辩论`,
        }),
      });

      if (!response.ok) {
        throw new Error('创建辩论失败');
      }

      const data = await response.json();
      router.push(`/debates/${data.data.id}`);
    } catch (err) {
      console.error('创建辩论失败:', err);
      alert('创建辩论失败，请重试');
    }
  }, [caseId, caseDetail, router]);

  // 加载案件详情
  const loadCaseDetail = useCallback(async (): Promise<void> => {
    // 跳过无效的 caseId
    if (!isValidCaseId) {
      setError('无效的案件ID');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/cases/${caseId}`);

      if (!response.ok) {
        throw new Error('加载案件详情失败');
      }

      const data = (await response.json()) as { data: CaseDetail };

      // 验证返回的数据结构
      if (!data.data || !data.data.id) {
        throw new Error('案件数据格式无效');
      }

      setCaseDetail(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
      console.error('加载案件详情失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [caseId, isValidCaseId]);

  useEffect(() => {
    void loadCaseDetail();
  }, [loadCaseDetail]);

  /**
   * 渲染标签页内容
   */
  function renderTabContent(): React.ReactNode {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'team':
        return (
          <CaseTeamList
            caseId={caseId}
            canManage={canManage}
            currentUserId={caseDetail?.userId}
          />
        );
      case 'timeline':
        return null; // 不再显示，已从导航移除
      case 'documents':
        return <DocumentsTab caseId={caseId} canManage={canManage} />;
      case 'law-graph':
        return <LawGraphTab caseId={caseId} />;
      case 'evidence':
        return (
          <EvidenceTab
            caseId={caseId}
            caseType={caseDetail?.type}
            canManage={canManage}
          />
        );
      case 'witnesses':
        return (
          <WitnessList
            caseId={caseId}
            canManage={canManage}
            currentUserId={currentUserId || ''}
          />
        );
      case 'discussions':
        return (
          <DiscussionList
            caseId={caseId}
            currentUserId={currentUserId || ''}
            canViewDiscussions={!!currentUserId}
            canCreateDiscussions={!!currentUserId}
            canEditDiscussions={canManage}
            canPinDiscussions={canManage}
            canDeleteDiscussions={canManage}
          />
        );
      case 'similar-cases':
        return (
          <div className='space-y-6'>
            <SimilarCasesPanel
              caseId={caseId}
              defaultThreshold={0.7}
              defaultTopK={10}
            />
          </div>
        );
      default:
        return null;
    }
  }

  /**
   * 渲染概览标签页
   */
  function renderOverviewTab(): React.ReactNode {
    if (!caseDetail) {
      return null;
    }

    return (
      <div className='space-y-6'>
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>案件信息</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div>
                <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>
                  案件标题
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-zinc-100'>
                  {caseDetail.title}
                </dd>
              </div>
              <div>
                <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>
                  案件类型
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-zinc-100'>
                  {caseTypeLabels[caseDetail.type] ?? caseDetail.type}
                </dd>
              </div>
              <div>
                <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>
                  状态
                </dt>
                <dd className='mt-1'>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      caseDetail.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : caseDetail.status === 'CLOSED'
                          ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}
                  >
                    {caseStatusLabels[caseDetail.status] ?? caseDetail.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>
                  创建时间
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-zinc-100'>
                  {new Date(caseDetail.createdAt).toLocaleString('zh-CN')}
                </dd>
              </div>
              {caseDetail.description ? (
                <div className='md:col-span-2'>
                  <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>
                    案件描述
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900 dark:text-zinc-100 whitespace-pre-wrap'>
                    {caseDetail.description}
                  </dd>
                </div>
              ) : (
                <div className='md:col-span-2'>
                  <dt className='text-sm font-medium text-gray-500 dark:text-zinc-400'>
                    案件描述
                  </dt>
                  <dd className='mt-1 text-sm italic text-gray-400 dark:text-zinc-500'>
                    暂无描述
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* 快速操作 */}
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex flex-wrap gap-3'>
              {canManage && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => router.push(`/cases/${caseId}/edit`)}
                >
                  编辑案件
                </Button>
              )}
              <Button
                variant='primary'
                size='sm'
                onClick={handleStartDebate}
                disabled={!caseDetail}
              >
                开始辩论
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setActiveTab('documents')}
              >
                上传文档
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setActiveTab('evidence')}
              >
                添加证据
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950'>
        <div className='mx-auto max-w-7xl px-6 py-6'>
          <div className='animate-pulse'>
            <div className='mb-6 h-8 w-1/3 rounded bg-gray-200 dark:bg-zinc-700' />
            <div className='rounded-lg bg-white p-6 dark:bg-zinc-900'>
              <div className='mb-4 h-6 w-1/4 rounded bg-gray-200 dark:bg-zinc-700' />
              <div className='space-y-3'>
                <div className='h-4 w-full rounded bg-gray-200 dark:bg-zinc-700' />
                <div className='h-4 w-2/3 rounded bg-gray-200 dark:bg-zinc-700' />
                <div className='h-4 w-full rounded bg-gray-200 dark:bg-zinc-700' />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950'>
        <div className='mx-auto max-w-7xl px-6 py-6'>
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'>
            <h2 className='mb-2 text-lg font-semibold'>加载失败</h2>
            <p className='mb-4'>{error}</p>
            <div className='flex gap-3'>
              <Button onClick={() => void loadCaseDetail()}>重试</Button>
              <Button variant='ghost' onClick={() => router.back()}>
                返回
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-zinc-950'>
      {/* 页面头部 */}
      <header className='border-b border-gray-200 bg-white px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900'>
        <div className='mx-auto max-w-7xl'>
          <div className='flex items-center justify-between'>
            <div>
              <Button
                variant='ghost'
                onClick={() => router.back()}
                className='mb-2 text-sm'
              >
                ← 返回
              </Button>
              <h1 className='text-2xl font-semibold text-gray-900 dark:text-zinc-100'>
                {caseDetail?.title}
              </h1>
              <p className='mt-1 text-sm text-gray-500 dark:text-zinc-400'>
                创建于{' '}
                {caseDetail
                  ? new Date(caseDetail.createdAt).toLocaleDateString('zh-CN')
                  : '—'}
              </p>
            </div>
            <div className='flex gap-3'>
              {canManage && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => router.push(`/cases/${caseId}/edit`)}
                >
                  编辑案件
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        {/* 标签页导航 */}
        <div className='mb-6 border-b border-gray-200 dark:border-zinc-700'>
          <nav className='-mb-px flex space-x-1'>
            {TAB_LIST.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 标签页内容 */}
        {renderTabContent()}
      </main>
    </div>
  );
}
