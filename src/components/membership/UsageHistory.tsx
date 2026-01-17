import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, ChevronLeft, ChevronRight } from 'lucide-react';
import { MembershipHistory } from '@/types/membership';

interface UsageHistoryProps {
  history: MembershipHistory[];
  isLoading: boolean;
}

export function UsageHistory({ history, isLoading }: UsageHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const getChangeTypeColor = (type: string): string => {
    switch (type) {
      case 'UPGRADE':
        return 'bg-green-100 text-green-800';
      case 'DOWNGRADE':
        return 'bg-orange-100 text-orange-800';
      case 'CANCEL':
        return 'bg-red-100 text-red-800';
      case 'RENEW':
        return 'bg-blue-100 text-blue-800';
      case 'PAUSE':
        return 'bg-yellow-100 text-yellow-800';
      case 'RESUME':
        return 'bg-teal-100 text-teal-800';
      case 'EXPIRE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getChangeTypeText = (type: string): string => {
    switch (type) {
      case 'UPGRADE':
        return '升级';
      case 'DOWNGRADE':
        return '降级';
      case 'CANCEL':
        return '取消';
      case 'RENEW':
        return '续费';
      case 'PAUSE':
        return '暂停';
      case 'RESUME':
        return '恢复';
      case 'EXPIRE':
        return '过期';
      default:
        return type;
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>会员变更历史</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col items-center justify-center py-8'>
            <div className='mb-2 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent' />
            <p className='text-sm text-gray-500'>加载中...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>会员变更历史</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col items-center justify-center py-8 text-gray-500'>
            <History className='mb-2 h-12 w-12' />
            <p className='text-center'>暂无变更记录</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(history.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentHistory = history.slice(startIndex, endIndex);

  const handlePreviousPage = (): void => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = (): void => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>会员变更历史</CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* 历史记录列表 */}
        <div className='space-y-4'>
          {currentHistory.map(record => (
            <div
              key={record.id}
              className='rounded-lg border border-gray-200 bg-gray-50 p-4'
            >
              <div className='flex items-start justify-between'>
                <div className='flex-1'>
                  <div className='mb-2 flex items-center gap-2'>
                    <Badge className={getChangeTypeColor(record.changeType)}>
                      {getChangeTypeText(record.changeType)}
                    </Badge>
                    <span className='text-sm text-gray-600'>
                      {formatDate(record.createdAt)}
                    </span>
                  </div>
                  <div className='space-y-1 text-sm'>
                    {/* 等级变更 */}
                    {record.fromTier !== record.toTier && (
                      <div className='text-gray-700'>
                        等级:
                        <span className='font-medium text-gray-900'>
                          {record.fromTier || 'FREE'}
                        </span>
                        →
                        <span className='font-medium text-gray-900'>
                          {record.toTier || 'FREE'}
                        </span>
                      </div>
                    )}
                    {/* 状态变更 */}
                    {record.fromStatus !== record.toStatus && (
                      <div className='text-gray-700'>
                        状态:
                        <span className='font-medium text-gray-900'>
                          {record.fromStatus}
                        </span>
                        →
                        <span className='font-medium text-gray-900'>
                          {record.toStatus}
                        </span>
                      </div>
                    )}
                    {/* 原因 */}
                    {record.reason && (
                      <div className='text-gray-700'>
                        原因:
                        <span className='text-gray-900'> {record.reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 分页控件 */}
        {totalPages > 1 && (
          <div className='flex items-center justify-between'>
            <div className='text-sm text-gray-600'>
              第 {currentPage} 页，共 {totalPages} 页
            </div>
            <div className='flex items-center gap-2'>
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className='inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
              >
                <ChevronLeft className='h-4 w-4' />
                上一页
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className='inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
              >
                下一页
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
