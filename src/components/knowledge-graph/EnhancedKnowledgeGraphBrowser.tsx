/**
 * 增强版知识图谱浏览器组件
 *
 * 功能：
 * 1. 显示知识图谱可视化
 * 2. 支持搜索法条
 * 3. 支持按分类和关系类型过滤
 * 4. 支持分页
 * 5. 支持导出JSON
 * 6. 双击节点展开更多关系
 * 7. 错误处理和重试
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { GraphVisualizer, GraphNode, GraphLink } from './GraphVisualizer';
import { logger } from '@/lib/logger';

/**
 * 分页信息类型
 */
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 图谱数据类型
 */
interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  pagination: Pagination;
}

/**
 * 增强版知识图谱浏览器组件
 */
export function EnhancedKnowledgeGraphBrowser() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCenterNode, setCurrentCenterNode] = useState<GraphNode | null>(
    null
  );

  // 搜索和过滤状态
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('');
  const [relationType, setRelationType] = useState('');
  const [page, setPage] = useState(1);

  /**
   * 加载图谱数据
   */
  const loadGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 构建查询参数
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (category) params.append('category', category);
      if (relationType) params.append('relationType', relationType);
      params.append('page', page.toString());
      params.append('pageSize', '100');

      const response = await fetch(
        `/api/v1/knowledge-graph/browse?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('加载失败');
      }

      const apiResponse = await response.json();
      // 统一 API 格式: { success, data: { nodes, links }, pagination }
      const graphData = {
        nodes: apiResponse.data?.nodes || [],
        links: apiResponse.data?.links || [],
        pagination: apiResponse.pagination,
      };
      setGraphData(graphData);

      // 设置初始中心节点
      if (graphData.nodes.length > 0 && !currentCenterNode) {
        setCurrentCenterNode(graphData.nodes[0]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载失败';
      logger.error('加载图谱数据失败', { error: err });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, category, relationType, page, currentCenterNode]);

  // 初始加载和参数变化时重新加载
  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  /**
   * 处理搜索
   */
  const handleSearch = () => {
    setPage(1); // 重置到第一页
    setCurrentCenterNode(null);
    loadGraphData();
  };

  /**
   * 处理分类变化
   */
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
    setPage(1);
    setCurrentCenterNode(null);
  };

  /**
   * 处理关系类型变化
   */
  const handleRelationTypeChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setRelationType(e.target.value);
    setPage(1);
    setCurrentCenterNode(null);
  };

  /**
   * 处理翻页
   */
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setCurrentCenterNode(null);
  };

  /**
   * 处理节点点击
   */
  const handleNodeClick = (node: GraphNode) => {
    setCurrentCenterNode(node);
  };

  /**
   * 处理节点双击 - 展开更多关系
   */
  const handleNodeDoubleClick = async (node: GraphNode) => {
    try {
      const response = await fetch(
        `/api/v1/law-articles/${node.id}/graph?depth=3`
      );

      if (!response.ok) {
        throw new Error('加载更多关系失败');
      }

      const data = await response.json();

      // 合并节点和边
      if (graphData && data.nodes && data.links) {
        const existingNodeIds = new Set(graphData.nodes.map(n => n.id));
        const newNodes = data.nodes.filter(
          (n: GraphNode) => !existingNodeIds.has(n.id)
        );

        const existingLinks = new Set(
          graphData.links.map(
            l =>
              `${typeof l.source === 'string' ? l.source : l.source.id}-${typeof l.target === 'string' ? l.target : l.target.id}`
          )
        );
        const newLinks = data.links.filter(
          (l: GraphLink) =>
            !existingLinks.has(
              `${typeof l.source === 'string' ? l.source : l.source.id}-${typeof l.target === 'string' ? l.target : l.target.id}`
            )
        );

        setGraphData({
          nodes: [...graphData.nodes, ...newNodes],
          links: [...graphData.links, ...newLinks],
          pagination: graphData.pagination,
        });

        setCurrentCenterNode(node);
      }
    } catch (err) {
      logger.error('展开节点关系失败', { error: err, nodeId: node.id });
    }
  };

  /**
   * 导出JSON
   */
  const handleExport = () => {
    if (!graphData) return;

    const dataStr = JSON.stringify(graphData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `knowledge-graph-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  // 加载状态
  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-lg'>加载中...</div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className='flex flex-col items-center justify-center h-96 space-y-4'>
        <div className='text-lg text-red-600'>加载失败: {error}</div>
        <button
          onClick={loadGraphData}
          className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 搜索和过滤栏 */}
      <div className='bg-white p-4 rounded-lg shadow space-y-4'>
        {/* 搜索框 */}
        <div className='flex gap-2'>
          <input
            type='text'
            placeholder='搜索法条名称或条文号'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSearch()}
            className='flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <button
            onClick={handleSearch}
            className='px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
          >
            搜索
          </button>
        </div>

        {/* 过滤器 */}
        <div className='flex gap-4 flex-wrap'>
          <div className='flex items-center gap-2'>
            <label htmlFor='category' className='text-sm font-medium'>
              分类
            </label>
            <select
              id='category'
              value={category}
              onChange={handleCategoryChange}
              className='px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>全部</option>
              <option value='CIVIL'>民事</option>
              <option value='CRIMINAL'>刑事</option>
              <option value='ADMINISTRATIVE'>行政</option>
              <option value='COMMERCIAL'>商事</option>
              <option value='LABOR'>劳动</option>
            </select>
          </div>

          <div className='flex items-center gap-2'>
            <label htmlFor='relationType' className='text-sm font-medium'>
              关系类型
            </label>
            <select
              id='relationType'
              value={relationType}
              onChange={handleRelationTypeChange}
              className='px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>全部</option>
              <option value='CITES'>引用</option>
              <option value='CONFLICTS'>冲突</option>
              <option value='COMPLETES'>补全</option>
              <option value='SUPERSEDES'>替代</option>
              <option value='IMPLEMENTS'>实施</option>
              <option value='RELATED'>相关</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            className='ml-auto px-4 py-1 bg-green-500 text-white rounded hover:bg-green-600'
          >
            导出
          </button>
        </div>
      </div>

      {/* 统计信息 */}
      {graphData && (
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='flex gap-6 text-sm'>
            <div>
              共{' '}
              <span className='font-bold text-blue-600'>
                {graphData.pagination.total}
              </span>{' '}
              个法条
            </div>
            <div>
              当前显示{' '}
              <span className='font-bold text-green-600'>
                {graphData.nodes.length}
              </span>{' '}
              个节点，{' '}
              <span className='font-bold text-orange-600'>
                {graphData.links.length}
              </span>{' '}
              个关系
            </div>
          </div>
        </div>
      )}

      {/* 图谱可视化 */}
      {graphData && graphData.nodes.length > 0 && (
        <div className='bg-white p-4 rounded-lg shadow h-[800px]'>
          <GraphVisualizer
            nodes={graphData.nodes}
            links={graphData.links}
            centerNodeId={currentCenterNode?.id}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            filterCategory={category || undefined}
            filterRelationType={relationType || undefined}
          />
        </div>
      )}

      {/* 空状态 */}
      {graphData && graphData.nodes.length === 0 && (
        <div className='bg-white p-8 rounded-lg shadow text-center text-gray-500'>
          未找到匹配的法条
        </div>
      )}

      {/* 分页 */}
      {graphData && graphData.pagination.totalPages > 1 && (
        <div className='bg-white p-4 rounded-lg shadow flex items-center justify-between'>
          <div className='text-sm text-gray-600'>
            第 {graphData.pagination.page} 页，共{' '}
            {graphData.pagination.totalPages} 页
          </div>
          <div className='flex gap-2'>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className='px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              上一页
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === graphData.pagination.totalPages}
              className='px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
