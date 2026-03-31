'use client';

import { useState, useCallback } from 'react';
import { MemoryType } from '@prisma/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MemoryFilter } from './components/MemoryFilter';
import { MemoryTable } from './components/MemoryTable';
import { MemoryStats } from './components/MemoryStats';
import { Loader2, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';

interface Memory {
  id: string;
  memoryType: MemoryType;
  memoryKey: string;
  memoryValue: unknown;
  importance: number;
  accessCount: number;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  compressed: boolean;
  compressionRatio: number | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function MemoryManagementPage() {
  // toast from sonner

  // 筛选状态
  const [selectedType, setSelectedType] = useState<MemoryType | 'ALL'>('ALL');
  const [keyword, setKeyword] = useState('');
  const [showExpired, setShowExpired] = useState(false);

  // 数据状态
  const [memories, setMemories] = useState<Memory[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsRefresh, setStatsRefresh] = useState(0);

  // 清理对话框状态
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupDryRun, setCleanupDryRun] = useState(true);
  const [cleanupResult, setCleanupResult] = useState<{
    deletedCount: number;
    wouldDelete: number;
    deletedMemories: Array<{
      id: string;
      memoryKey: string;
      memoryType: string;
    }>;
  } | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // 搜索记忆
  const searchMemories = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (selectedType !== 'ALL') params.append('type', selectedType);
      if (keyword) params.append('keyword', keyword);
      if (showExpired) params.append('expired', 'true');
      params.append('page', pagination.page.toString());
      params.append('pageSize', pagination.pageSize.toString());

      const response = await fetch(`/api/v1/memory/search?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '搜索失败');
      }

      setMemories(result.data.memories);
      setPagination(result.data.pagination);
      setSelectedIds([]);
    } catch (error) {
      toast.error('搜索失败', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [
    selectedType,
    keyword,
    showExpired,
    pagination.page,
    pagination.pageSize,
    toast,
  ]);

  // 执行清理
  const executeCleanup = async (dryRun: boolean) => {
    try {
      setCleanupLoading(true);

      const response = await fetch('/api/v1/memory/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType !== 'ALL' ? selectedType : undefined,
          dryRun,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '清理失败');
      }

      setCleanupResult({
        deletedCount: result.data.deletedCount,
        wouldDelete: result.data.wouldDelete,
        deletedMemories: result.data.deletedMemories,
      });

      if (!dryRun) {
        toast.success('清理完成', {
          description: `成功删除 ${result.data.deletedCount} 条记忆`,
        });
        setCleanupDialogOpen(false);
        searchMemories();
        setStatsRefresh(prev => prev + 1);
      }
    } catch (error) {
      toast.error(dryRun ? '预览失败' : '清理失败', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  // 删除选中的记忆
  const deleteSelected = async (ids: string[]) => {
    if (ids.length === 0) return;

    try {
      setLoading(true);

      const response = await fetch('/api/v1/memory/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryIds: ids }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '删除失败');
      }

      toast.success('删除成功', {
        description: `已删除 ${result.data.deletedCount} 条记忆`,
      });

      searchMemories();
      setStatsRefresh(prev => prev + 1);
    } catch (error) {
      toast.error('删除失败', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  // 页码变更
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  return (
    <div className='container mx-auto py-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>记忆管理</h1>
        <Button onClick={searchMemories} disabled={loading} variant='outline'>
          {loading ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <RefreshCw className='h-4 w-4' />
          )}
          <span className='ml-2'>刷新</span>
        </Button>
      </div>

      <Tabs defaultValue='list' className='w-full'>
        <TabsList>
          <TabsTrigger value='list'>记忆列表</TabsTrigger>
          <TabsTrigger value='stats'>迁移统计</TabsTrigger>
        </TabsList>

        <TabsContent value='list' className='space-y-4'>
          {/* 筛选栏 */}
          <MemoryFilter
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            keyword={keyword}
            onKeywordChange={setKeyword}
            showExpired={showExpired}
            onShowExpiredChange={setShowExpired}
            onSearch={searchMemories}
            onCleanup={() => {
              setCleanupDryRun(true);
              setCleanupResult(null);
              setCleanupDialogOpen(true);
              executeCleanup(true);
            }}
            loading={loading}
          />

          {/* 批量操作 */}
          {selectedIds.length > 0 && (
            <Card className='bg-yellow-50 border-yellow-200'>
              <CardContent className='py-3 flex items-center justify-between'>
                <span className='text-sm text-yellow-800'>
                  已选择 {selectedIds.length} 条记忆
                </span>
                <Button
                  variant='destructive'
                  size='sm'
                  onClick={() => deleteSelected(selectedIds)}
                >
                  <Trash2 className='h-4 w-4 mr-1' />
                  批量删除
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 记忆表格 */}
          <MemoryTable
            memories={memories}
            loading={loading}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            onDelete={deleteSelected}
          />

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className='flex items-center justify-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1 || loading}
              >
                上一页
              </Button>
              <span className='text-sm text-muted-foreground'>
                第 {pagination.page} / {pagination.totalPages} 页 (共{' '}
                {pagination.total} 条)
              </span>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages || loading}
              >
                下一页
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value='stats'>
          <MemoryStats refreshTrigger={statsRefresh} />
        </TabsContent>
      </Tabs>

      {/* 清理确认对话框 */}
      <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-yellow-500' />
              清理过期记忆
            </DialogTitle>
            <DialogDescription>
              {cleanupDryRun
                ? '预览模式：以下记忆将被清理'
                : '确认删除以下记忆？此操作不可撤销。'}
            </DialogDescription>
          </DialogHeader>

          {cleanupLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          ) : cleanupResult ? (
            <div className='space-y-4'>
              <div className='text-sm'>
                <span className='font-medium'>待清理数量: </span>
                <span
                  className={cleanupDryRun ? 'text-yellow-600' : 'text-red-600'}
                >
                  {cleanupDryRun
                    ? cleanupResult.wouldDelete
                    : cleanupResult.deletedCount}{' '}
                  条
                </span>
              </div>

              {cleanupResult.deletedMemories.length > 0 && (
                <div className='max-h-60 overflow-auto border rounded-md'>
                  <table className='w-full text-sm'>
                    <thead className='bg-muted'>
                      <tr>
                        <th className='px-3 py-2 text-left'>Key</th>
                        <th className='px-3 py-2 text-left'>类型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cleanupResult.deletedMemories.map(memory => (
                        <tr key={memory.id} className='border-t'>
                          <td className='px-3 py-2 font-mono text-xs truncate max-w-[300px]'>
                            {memory.memoryKey}
                          </td>
                          <td className='px-3 py-2'>
                            <Badge variant='outline'>{memory.memoryType}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            {cleanupDryRun && cleanupResult && cleanupResult.wouldDelete > 0 ? (
              <>
                <Button
                  variant='outline'
                  onClick={() => setCleanupDialogOpen(false)}
                >
                  取消
                </Button>
                <Button
                  variant='destructive'
                  onClick={() => executeCleanup(false)}
                  disabled={cleanupLoading}
                >
                  {cleanupLoading && (
                    <Loader2 className='h-4 w-4 animate-spin mr-1' />
                  )}
                  确认清理
                </Button>
              </>
            ) : (
              <Button onClick={() => setCleanupDialogOpen(false)}>关闭</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
