'use client';

import { useState, useEffect, useCallback } from 'react';
import { LawArticleImportDialog } from './LawArticleImportDialog';

interface LawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  lawType: string;
  category: string;
  subCategory: string | null;
  status: string;
  version: string;
  effectiveDate: Date;
  viewCount: number;
  referenceCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface LawArticleListResponse {
  articles: LawArticle[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 法条管理列表组件
 */
export function LawArticleList(): React.ReactElement {
  const [articles, setArticles] = useState<LawArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    lawType: '',
    category: '',
    status: '',
    search: '',
  });
  const [showImportDialog, setShowImportDialog] = useState(false);

  // 加载法条列表
  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(filters.lawType && { lawType: filters.lawType }),
        ...(filters.category && { category: filters.category }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(
        `/api/admin/law-articles?${queryParams.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '加载法条列表失败');
      }

      const result = (await response.json()) as {
        data: LawArticleListResponse;
      };

      setArticles(result.data.articles);
      setTotalPages(result.data.pagination.totalPages);
      setTotal(result.data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  // 导入成功后重新加载
  const handleImportSuccess = () => {
    setShowImportDialog(false);
    loadArticles();
  };

  // 删除法条
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条法条吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/law-articles/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '删除法条失败');
      }

      loadArticles();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 审核法条
  const handleReview = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/law-articles/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '审核法条失败');
      }

      loadArticles();
    } catch (err) {
      alert(err instanceof Error ? err.message : '审核失败');
    }
  };

  // 初始加载和分页变化时加载
  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  return (
    <div className='space-y-6'>
      {/* 操作栏 */}
      <div className='flex flex-wrap gap-4 items-center justify-between'>
        <div className='flex flex-wrap gap-2'>
          <input
            type='text'
            placeholder='搜索法条...'
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <select
            value={filters.lawType}
            onChange={e => setFilters({ ...filters, lawType: e.target.value })}
            className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value=''>全部法律类型</option>
            <option value='CONSTITUTIONAL'>宪法</option>
            <option value='CIVIL'>民法</option>
            <option value='CRIMINAL'>刑法</option>
            <option value='ADMINISTRATIVE'>行政法</option>
            <option value='PROCEDURAL'>诉讼法</option>
            <option value='COMMERCIAL'>商法</option>
            <option value='LABOR'>劳动法</option>
            <option value='INTELLECTUAL'>知识产权</option>
          </select>
          <select
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value })}
            className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value=''>全部状态</option>
            <option value='VALID'>有效</option>
            <option value='DRAFT'>草稿</option>
            <option value='AMENDED'>已修订</option>
            <option value='REPEALED'>已废止</option>
            <option value='EXPIRED'>已过期</option>
          </select>
        </div>
        <button
          onClick={() => setShowImportDialog(true)}
          className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          导入法条
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg'>
          {error}
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className='text-center py-8'>
          <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
        </div>
      )}

      {/* 法条列表 */}
      {!loading && articles.length === 0 && (
        <div className='text-center py-12 text-gray-500'>暂无法条数据</div>
      )}

      {!loading && articles.length > 0 && (
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  法条名称
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  条号
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  类型
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  类别
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  状态
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  生效日期
                </th>
                <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  操作
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {articles.map(article => (
                <tr key={article.id} className='hover:bg-gray-50'>
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>
                    {article.lawName}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {article.articleNumber}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {article.lawType}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {article.category}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        article.status === 'VALID'
                          ? 'bg-green-100 text-green-800'
                          : article.status === 'DRAFT'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {article.status}
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {new Date(article.effectiveDate).toLocaleDateString()}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                    {article.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => handleReview(article.id, 'APPROVED')}
                          className='text-green-600 hover:text-green-900'
                        >
                          通过
                        </button>
                        <button
                          onClick={() => handleReview(article.id, 'REJECTED')}
                          className='text-red-600 hover:text-red-900'
                        >
                          拒绝
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(article.id)}
                      className='text-red-600 hover:text-red-900'
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      {!loading && totalPages > 1 && (
        <div className='flex items-center justify-between'>
          <div className='text-sm text-gray-700'>
            共 {total} 条法条，第 {page} / {totalPages} 页
          </div>
          <div className='flex space-x-2'>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className='px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'
            >
              上一页
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className='px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 导入对话框 */}
      {showImportDialog && (
        <LawArticleImportDialog
          open={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}
