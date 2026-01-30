/**
 * 案件详情页面
 * 显示案件详细信息，包含团队成员管理和讨论功能
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CaseTeamList } from '@/components/case/CaseTeamList';
import { DiscussionList } from '@/components/discussion/DiscussionList';
import { WitnessList } from '@/components/witness/WitnessList';
import { EvidenceTab } from './components/EvidenceTab';

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
}

/**
 * 标签页类型
 */
type TabType =
  | 'overview'
  | 'team'
  | 'timeline'
  | 'evidence'
  | 'witnesses'
  | 'discussions';

/**
 * 案件访问权限接口
 */
interface CaseAccessInfo {
  hasAccess: boolean;
  isOwner: boolean;
  accessType?: 'owner' | 'team-member' | 'shared-team';
  permissions?: string[];
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [canManage, setCanManage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [caseAccessInfo] = useState<CaseAccessInfo | null>(null);

  // 加载案件详情
  const loadCaseDetail = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${caseId}`);

      if (!response.ok) {
        throw new Error('加载案件详情失败');
      }

      const data = (await response.json()) as { data: CaseDetail };
      setCaseDetail(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
      console.error('加载案件详情失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  // 加载当前用户信息，判断是否可以管理
  const loadCurrentUser = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setCanManage(data.data?.id === caseDetail?.userId);
        setCurrentUserId(data.data?.id || null);
      }
    } catch (err) {
      console.error('加载用户信息失败:', err);
    }
  }, [caseDetail?.userId]);

  useEffect(() => {
    void loadCaseDetail();
  }, [loadCaseDetail]);

  useEffect(() => {
    if (caseDetail) {
      void loadCurrentUser();
    }
  }, [caseDetail, loadCurrentUser]);

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
        return (
          <div className='py-8 text-center text-gray-500'>
            时间线功能开发中...
          </div>
        );
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
            canViewDiscussions={caseAccessInfo?.hasAccess || false}
            canCreateDiscussions={caseAccessInfo?.hasAccess || false}
            canEditDiscussions={canManage || false}
            canPinDiscussions={canManage || false}
            canDeleteDiscussions={canManage || false}
          />
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
                <dt className='text-sm font-medium text-gray-500'>案件标题</dt>
                <dd className='mt-1 text-sm text-gray-900'>
                  {caseDetail.title}
                </dd>
              </div>
              <div>
                <dt className='text-sm font-medium text-gray-500'>案件类型</dt>
                <dd className='mt-1 text-sm text-gray-900'>
                  {caseDetail.type}
                </dd>
              </div>
              <div>
                <dt className='text-sm font-medium text-gray-500'>状态</dt>
                <dd className='mt-1 text-sm text-gray-900'>
                  {caseDetail.status}
                </dd>
              </div>
              <div>
                <dt className='text-sm font-medium text-gray-500'>创建时间</dt>
                <dd className='mt-1 text-sm text-gray-900'>
                  {new Date(caseDetail.createdAt).toLocaleString('zh-CN')}
                </dd>
              </div>
              {caseDetail.description && (
                <div className='md:col-span-2'>
                  <dt className='text-sm font-medium text-gray-500'>
                    案件描述
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900 whitespace-pre-wrap'>
                    {caseDetail.description}
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
              <Button variant='outline' size='sm'>
                编辑案件
              </Button>
              <Button variant='outline' size='sm'>
                开始辩论
              </Button>
              <Button variant='outline' size='sm'>
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
      <div className='min-h-screen bg-gray-50'>
        <div className='mx-auto max-w-7xl px-6 py-6'>
          <div className='animate-pulse'>
            <div className='h-8 w-1/3 rounded bg-gray-200 mb-6' />
            <div className='h-96 rounded-lg bg-white p-6'>
              <div className='h-6 w-1/4 rounded bg-gray-200 mb-4' />
              <div className='space-y-3'>
                <div className='h-4 w-full rounded bg-gray-200' />
                <div className='h-4 w-2/3 rounded bg-gray-200' />
                <div className='h-4 w-full rounded bg-gray-200' />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50'>
        <div className='mx-auto max-w-7xl px-6 py-6'>
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-red-800'>
            <h2 className='text-lg font-semibold mb-2'>加载失败</h2>
            <p className='mb-4'>{error}</p>
            <Button onClick={() => router.back()}>返回</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* 页面头部 */}
      <header className='border-b border-gray-200 bg-white px-6 py-4'>
        <div className='mx-auto max-w-7xl'>
          <div className='flex items-center justify-between'>
            <div>
              <Button
                variant='ghost'
                onClick={() => router.back()}
                className='mb-2'
              >
                ← 返回
              </Button>
              <h1 className='text-2xl font-semibold text-gray-900'>
                {caseDetail?.title}
              </h1>
              <p className='mt-1 text-sm text-gray-600'>案件ID: {caseId}</p>
            </div>
            <div className='flex gap-3'>
              {canManage && (
                <Button variant='outline' size='sm'>
                  设置
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        {/* 标签页导航 */}
        <div className='mb-6 border-b border-gray-200'>
          <nav className='-mb-px flex space-x-8'>
            <button
              onClick={() => setActiveTab('overview')}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              概览
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'team'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              团队成员
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'timeline'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              时间线
            </button>
            <button
              onClick={() => setActiveTab('evidence')}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'evidence'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              证据
            </button>
            <button
              onClick={() => setActiveTab('witnesses')}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'witnesses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              证人
            </button>
            <button
              onClick={() => setActiveTab('discussions')}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'discussions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              讨论
            </button>
          </nav>
        </div>

        {/* 标签页内容 */}
        {renderTabContent()}
      </main>
    </div>
  );
}
