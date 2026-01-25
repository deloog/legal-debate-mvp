/**
 * 案件共享列表组件
 * 显示案件共享状态和已共享的团队信息
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users as UsersIcon,
  Share as ShareIcon,
  XCircle as XCircleIcon,
  CheckCircle as CheckCircleIcon,
  ShieldCheck as ShieldCheckIcon,
} from 'lucide-react';

/**
 * 案件共享信息接口
 */
interface CaseShareInfo {
  id: string;
  title: string;
  ownerType: 'USER' | 'TEAM';
  sharedWithTeam: boolean;
  sharedAt: Date | null;
  sharedBy: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  } | null;
  sharedNotes: string | undefined;
}

/**
 * 响应数据接口
 */
interface ShareResponse {
  success: boolean;
  data: {
    case: CaseShareInfo;
    isOwner: boolean;
    accessType?: 'owner' | 'team-member' | 'shared-team';
    permissions?: string[];
  };
}

interface SharedWithListProps {
  caseId: string;
}

/**
 * 共享列表组件
 */
export function SharedWithList({ caseId }: SharedWithListProps) {
  const [loading, setLoading] = useState(true);
  const [shareInfo, setShareInfo] = useState<CaseShareInfo | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [unsharing, setUnsharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取共享信息
  useEffect(() => {
    const fetchShareInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/cases/${caseId}/share`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('获取共享信息失败');
        }

        const data: ShareResponse = await response.json();
        if (data.success && data.data) {
          setShareInfo(data.data.case);
          setIsOwner(data.data.isOwner);
        }
      } catch (err) {
        console.error('获取共享信息时出错:', err);
        setError(err instanceof Error ? err.message : '未知错误');
      } finally {
        setLoading(false);
      }
    };

    void fetchShareInfo();
  }, [caseId]);

  // 取消共享
  const handleUnshare = async () => {
    if (!shareInfo || !confirm('确定要取消共享此案件吗？')) {
      return;
    }

    try {
      setUnsharing(true);
      setError(null);
      const response = await fetch(`/api/cases/${caseId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sharedWithTeam: false,
          notes: '',
        }),
      });

      if (!response.ok) {
        throw new Error('取消共享失败');
      }

      const data: ShareResponse = await response.json();
      if (data.success) {
        if (data.data.case) {
          setShareInfo(data.data.case);
        }
      }
    } catch (err) {
      console.error('取消共享时出错:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setUnsharing(false);
    }
  };

  // 渲染加载状态
  if (loading) {
    return (
      <Card>
        <CardContent className='p-6'>
          <div className='flex items-center justify-center h-32'>
            <div className='text-muted-foreground'>加载中...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <UsersIcon className='h-5 w-5' />
            共享状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-destructive'>{error}</div>
        </CardContent>
      </Card>
    );
  }

  // 渲染无共享信息
  if (!shareInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <UsersIcon className='h-5 w-5' />
            共享状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground'>暂无共享信息</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <UsersIcon className='h-5 w-5' />
          共享状态
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* 所有权类型 */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <ShieldCheckIcon className='h-5 w-5 text-muted-foreground' />
            <span className='text-sm font-medium'>所有权类型:</span>
          </div>
          <span className='text-sm text-muted-foreground'>
            {shareInfo.ownerType === 'TEAM' ? '团队案件' : '个人案件'}
          </span>
        </div>

        {/* 共享状态 */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            {shareInfo.sharedWithTeam ? (
              <CheckCircleIcon className='h-5 w-5 text-green-500' />
            ) : (
              <XCircleIcon className='h-5 w-5 text-muted-foreground' />
            )}
            <span className='text-sm font-medium'>共享状态:</span>
          </div>
          <span
            className={`text-sm ${
              shareInfo.sharedWithTeam
                ? 'text-green-600'
                : 'text-muted-foreground'
            }`}
          >
            {shareInfo.sharedWithTeam ? '已共享' : '未共享'}
          </span>
        </div>

        {/* 共享信息 */}
        {shareInfo.sharedWithTeam && (
          <div className='space-y-3 pt-3 border-t'>
            {/* 共享时间 */}
            {shareInfo.sharedAt && (
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <ShareIcon className='h-4 w-4 text-muted-foreground' />
                  <span className='text-sm'>共享时间:</span>
                </div>
                <span className='text-sm text-muted-foreground'>
                  {new Date(shareInfo.sharedAt).toLocaleString('zh-CN')}
                </span>
              </div>
            )}

            {/* 共享者 */}
            {shareInfo.sharedBy && (
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <UsersIcon className='h-4 w-4 text-muted-foreground' />
                  <span className='text-sm'>共享者:</span>
                </div>
                <span className='text-sm text-muted-foreground'>
                  {shareInfo.sharedBy.name || shareInfo.sharedBy.email}
                </span>
              </div>
            )}

            {/* 共享说明 */}
            {shareInfo.sharedNotes && (
              <div className='flex flex-col gap-2'>
                <span className='text-sm font-medium'>共享说明:</span>
                <div className='text-sm text-muted-foreground bg-muted p-3 rounded-md'>
                  {shareInfo.sharedNotes}
                </div>
              </div>
            )}

            {/* 取消共享按钮 */}
            {isOwner && (
              <div className='pt-3'>
                <Button
                  variant='outline'
                  onClick={handleUnshare}
                  disabled={unsharing}
                  className='w-full'
                >
                  {unsharing ? '取消中...' : '取消共享'}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
