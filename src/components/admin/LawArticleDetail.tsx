'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface LawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  lawType: string;
  category: string;
  subCategory: string | null;
  tags: string[];
  keywords: string[];
  version: string;
  effectiveDate: Date;
  expiryDate: Date | null;
  status: string;
  amendmentHistory: Record<string, unknown> | null;
  issuingAuthority: string;
  jurisdiction: string | null;
  relatedArticles: string[];
  legalBasis: string | null;
  viewCount: number;
  referenceCount: number;
  createdAt: Date;
  updatedAt: Date;
  parent?: {
    id: string;
    lawName: string;
    articleNumber: string;
  } | null;
  children?: {
    id: string;
    lawName: string;
    articleNumber: string;
    status: string;
  }[];
}

interface LawArticleDetailProps {
  id: string;
}

/**
 * 法条详情组件
 * 显示法条完整信息，支持编辑和审核
 */
export function LawArticleDetail({
  id,
}: LawArticleDetailProps): React.ReactElement {
  const router = useRouter();
  const [article, setArticle] = useState<LawArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 加载法条详情
  const loadArticle = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/admin/law-articles/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '加载法条详情失败');
      }

      const result = await response.json();
      setArticle(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 保存法条更新
  const handleSave = async () => {
    if (!article) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const updateData = {
        lawName: article.lawName,
        articleNumber: article.articleNumber,
        fullText: article.fullText,
        lawType: article.lawType,
        category: article.category,
        subCategory: article.subCategory,
        tags: article.tags,
        keywords: article.keywords,
        issuingAuthority: article.issuingAuthority,
        jurisdiction: article.jurisdiction,
      };

      const response = await fetch(`/api/admin/law-articles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '更新法条失败');
      }

      const result = await response.json();
      setArticle(result.data);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 审核法条
  const handleReview = async (reviewStatus: 'APPROVED' | 'REJECTED') => {
    try {
      const response = await fetch(`/api/admin/law-articles/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: reviewStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '审核法条失败');
      }

      loadArticle();
    } catch (err) {
      alert(err instanceof Error ? err.message : '审核失败');
    }
  };

  // 删除法条
  const handleDelete = async () => {
    if (!confirm('确定要删除这条法条吗？此操作不可恢复！')) {
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

      router.push('/admin/law-articles');
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 初始加载
  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  // 加载状态
  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg'>
        {error}
        <button
          onClick={loadArticle}
          className='ml-4 text-red-600 underline hover:text-red-800'
        >
          重试
        </button>
      </div>
    );
  }

  // 法条不存在
  if (!article) {
    return (
      <div className='bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg'>
        法条不存在
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 成功提示 */}
      {saveSuccess && (
        <div className='bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg'>
          保存成功！
        </div>
      )}

      {/* 错误提示 */}
      {error && !loading && (
        <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg'>
          {error}
        </div>
      )}

      {/* 操作栏 */}
      <div className='flex flex-wrap gap-4 items-center justify-between border-b pb-4'>
        <div className='flex items-center gap-2'>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              article.status === 'VALID'
                ? 'bg-green-100 text-green-800'
                : article.status === 'DRAFT'
                  ? 'bg-yellow-100 text-yellow-800'
                  : article.status === 'REPEALED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
            }`}
          >
            {article.status}
          </span>
          <span className='text-sm text-gray-600'>版本{article.version}</span>
        </div>
        <div className='flex gap-2'>
          {article.status === 'DRAFT' && !isEditing && (
            <>
              <button
                onClick={() => handleReview('APPROVED')}
                className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'
              >
                通过
              </button>
              <button
                onClick={() => handleReview('REJECTED')}
                className='px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500'
              >
                拒绝
              </button>
            </>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            {isEditing ? '取消编辑' : '编辑'}
          </button>
          <button
            onClick={handleDelete}
            className='px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500'
          >
            删除
          </button>
        </div>
      </div>

      {/* 法条基本信息 */}
      <div className='bg-white border border-gray-200 rounded-lg p-6'>
        <h2 className='text-xl font-bold text-gray-900 mb-4'>基本信息</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              法条名称
            </label>
            {isEditing ? (
              <input
                type='text'
                value={article.lawName}
                onChange={e =>
                  setArticle({ ...article, lawName: e.target.value })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            ) : (
              <p className='text-gray-900'>{article.lawName}</p>
            )}
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              条号
            </label>
            {isEditing ? (
              <input
                type='text'
                value={article.articleNumber}
                onChange={e =>
                  setArticle({ ...article, articleNumber: e.target.value })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            ) : (
              <p className='text-gray-900'>{article.articleNumber}</p>
            )}
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              法律类型
            </label>
            {isEditing ? (
              <select
                value={article.lawType}
                onChange={e =>
                  setArticle({ ...article, lawType: e.target.value })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='CONSTITUTION'>宪法</option>
                <option value='LAW'>法律</option>
                <option value='ADMINISTRATIVE_REGULATION'>行政法规</option>
                <option value='LOCAL_REGULATION'>地方法规</option>
                <option value='JUDICIAL_INTERPRETATION'>司法解释</option>
                <option value='DEPARTMENTAL_RULE'>部门规章</option>
                <option value='OTHER'>其他</option>
              </select>
            ) : (
              <p className='text-gray-900'>{article.lawType}</p>
            )}
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              类别
            </label>
            {isEditing ? (
              <select
                value={article.category}
                onChange={e =>
                  setArticle({ ...article, category: e.target.value })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='CIVIL'>民法</option>
                <option value='CRIMINAL'>刑法</option>
                <option value='ADMINISTRATIVE'>行政法</option>
                <option value='COMMERCIAL'>商法</option>
                <option value='ECONOMIC'>经济法</option>
                <option value='LABOR'>劳动法</option>
                <option value='INTELLECTUAL_PROPERTY'>知识产权</option>
                <option value='PROCEDURE'>诉讼法</option>
                <option value='OTHER'>其他</option>
              </select>
            ) : (
              <p className='text-gray-900'>{article.category}</p>
            )}
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              生效日期
            </label>
            <p className='text-gray-900'>
              {new Date(article.effectiveDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              颁布机关
            </label>
            {isEditing ? (
              <input
                type='text'
                value={article.issuingAuthority}
                onChange={e =>
                  setArticle({ ...article, issuingAuthority: e.target.value })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            ) : (
              <p className='text-gray-900'>{article.issuingAuthority}</p>
            )}
          </div>
        </div>
      </div>

      {/* 法条内容 */}
      <div className='bg-white border border-gray-200 rounded-lg p-6'>
        <h2 className='text-xl font-bold text-gray-900 mb-4'>法条内容</h2>
        {isEditing ? (
          <textarea
            value={article.fullText}
            onChange={e =>
              setArticle({
                ...article,
                fullText: e.target.value,
              })
            }
            rows={10}
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        ) : (
          <div className='prose max-w-none'>
            <p className='text-gray-900 whitespace-pre-wrap'>
              {article.fullText}
            </p>
          </div>
        )}
      </div>

      {/* 标签和关键词 */}
      <div className='bg-white border border-gray-200 rounded-lg p-6'>
        <h2 className='text-xl font-bold text-gray-900 mb-4'>标签和关键词</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              标签
            </label>
            {isEditing ? (
              <input
                type='text'
                value={article.tags.join(', ')}
                onChange={e =>
                  setArticle({
                    ...article,
                    tags: e.target.value.split(',').map(t => t.trim()),
                  })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='用逗号分隔多个标签'
              />
            ) : (
              <div className='flex flex-wrap gap-2'>
                {article.tags.map((tag, index) => (
                  <span
                    key={index}
                    className='px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm'
                  >
                    {tag}
                  </span>
                ))}
                {article.tags.length === 0 && (
                  <span className='text-gray-500'>无标签</span>
                )}
              </div>
            )}
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              关键词
            </label>
            {isEditing ? (
              <input
                type='text'
                value={article.keywords.join(', ')}
                onChange={e =>
                  setArticle({
                    ...article,
                    keywords: e.target.value.split(',').map(k => k.trim()),
                  })
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='用逗号分隔多个关键词'
              />
            ) : (
              <div className='flex flex-wrap gap-2'>
                {article.keywords.map((keyword, index) => (
                  <span
                    key={index}
                    className='px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm'
                  >
                    {keyword}
                  </span>
                ))}
                {article.keywords.length === 0 && (
                  <span className='text-gray-500'>无关键词</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className='bg-white border border-gray-200 rounded-lg p-6'>
        <h2 className='text-xl font-bold text-gray-900 mb-4'>统计信息</h2>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <div>
            <p className='text-sm text-gray-600'>浏览次数</p>
            <p className='text-2xl font-bold text-gray-900'>
              {article.viewCount}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-600'>引用次数</p>
            <p className='text-2xl font-bold text-gray-900'>
              {article.referenceCount}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-600'>创建时间</p>
            <p className='text-sm text-gray-900'>
              {new Date(article.createdAt).toLocaleString()}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-600'>更新时间</p>
            <p className='text-sm text-gray-900'>
              {new Date(article.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* 保存按钮 */}
      {isEditing && (
        <div className='flex gap-4 justify-end'>
          <button
            onClick={() => {
              setIsEditing(false);
              loadArticle();
            }}
            disabled={saving}
            className='px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50'
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
          >
            {saving ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                保存中...
              </>
            ) : (
              '保存'
            )}
          </button>
        </div>
      )}

      {/* 返回按钮 */}
      <button
        onClick={() => router.push('/admin/law-articles')}
        className='px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500'
      >
        返回列表
      </button>
    </div>
  );
}
