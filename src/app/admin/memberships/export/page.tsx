'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MembershipExportForm } from '@/components/admin/MembershipExportForm';
import { ExportHistoryList } from '@/components/admin/ExportHistoryList';

// =============================================================================
// 类型定义
// =============================================================================

interface ExportHistoryItem {
  id: string;
  fileName: string;
  format: string;
  recordCount: number;
  filters: {
    tier?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  };
  exportedAt: Date;
  fileUrl?: string;
}

interface ExportParams {
  tier: string;
  status: string;
  format: 'csv' | 'json' | 'excel';
  startDate?: string;
  endDate?: string;
}

// =============================================================================
// 主页面组件
// =============================================================================

export default function MembershipExportPage(): React.ReactElement {
  const router = useRouter();
  const [exporting, setExporting] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<ExportHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 加载导出历史
  useEffect(() => {
    loadExportHistory();
  }, []);

  const loadExportHistory = async (): Promise<void> => {
    try {
      setHistoryLoading(true);
      setError(null);

      const response = await fetch('/api/admin/memberships/export/history');
      const data = await response.json();
      setHistory(data.data || []);
    } catch (err) {
      console.error('加载导出历史失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleExport = async (params: ExportParams): Promise<void> => {
    try {
      setExporting(true);
      setError(null);

      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (params.tier) {
        queryParams.set('tier', params.tier);
      }
      if (params.status) {
        queryParams.set('status', params.status);
      }
      if (params.startDate) {
        queryParams.set('startDate', params.startDate);
      }
      if (params.endDate) {
        queryParams.set('endDate', params.endDate);
      }
      queryParams.set('format', params.format);

      // 调用导出API
      const response = await fetch(
        `/api/admin/memberships/export?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('导出失败');
      }

      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch
        ? filenameMatch[1]
        : `memberships_${new Date().toISOString().slice(0, 10)}.csv`;

      // 下载文件
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 刷新导出历史
      await loadExportHistory();
    } catch (err) {
      console.error('导出失败:', err);
      setError(err instanceof Error ? err.message : '导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className='min-h-screen bg-gray-50 py-8 px-4'>
      <div className='max-w-7xl mx-auto'>
        {/* 页面标题 */}
        <div className='mb-8'>
          <button
            onClick={() => router.push('/admin/memberships')}
            className='mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors'
          >
            <ArrowLeft className='h-4 w-4' />
            返回会员列表
          </button>
          <h1 className='text-3xl font-bold text-gray-900'>会员数据导出</h1>
          <p className='mt-2 text-gray-600'>导出会员数据进行分析和备份</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className='mb-6 rounded-lg border border-red-200 bg-red-50 p-4'>
            <div className='text-sm text-red-800'>{error}</div>
          </div>
        )}

        <div className='grid gap-6 lg:grid-cols-2'>
          {/* 左侧：导出表单 */}
          <MembershipExportForm onExport={handleExport} exporting={exporting} />

          {/* 右侧：导出历史 */}
          <ExportHistoryList history={history} loading={historyLoading} />
        </div>
      </div>
    </div>
  );
}
