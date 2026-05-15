/**
 * 法条关系图谱可视化组件
 *
 * 功能：
 * 1. 使用D3.js渲染力导向图
 * 2. 支持节点拖拽
 * 3. 显示图例和节点详情
 * 4. 加载状态和错误处理
 */

'use client';

import _React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import type { CommunityColorResult } from '@/lib/knowledge-graph/community/community-service';

interface Props {
  // 优化功能：直接传入完整的图谱数据，避免重复API调用
  graphData?: { nodes: GraphNode[]; links: GraphLink[] };

  // 原有功能：传入中心法条ID，组件自动获取数据（向后兼容）
  centerArticleId?: string;
  depth?: number;
}

function normalizeGraphPayload(payload: unknown): {
  nodes: GraphNode[];
  links: GraphLink[];
} {
  if (!payload || typeof payload !== 'object') {
    throw new Error('无效的图谱数据格式');
  }

  const candidate =
    'data' in payload && payload.data && typeof payload.data === 'object'
      ? payload.data
      : payload;

  return {
    nodes:
      'nodes' in candidate && Array.isArray(candidate.nodes)
        ? (candidate.nodes as GraphNode[])
        : [],
    links:
      'links' in candidate && Array.isArray(candidate.links)
        ? (candidate.links as GraphLink[])
        : [],
  };
}

function isDirectColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/**
 * 法条关系图谱可视化组件
 */
export function LawArticleGraphVisualization({
  graphData: propsGraphData,
  centerArticleId,
  depth = 2,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);

  // 社区着色状态
  const [showCommunityColors, setShowCommunityColors] = useState(false);
  const [communityData, setCommunityData] =
    useState<CommunityColorResult | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);

  // 加载图谱数据
  useEffect(() => {
    // 如果传入了 graphData，直接使用，无需API调用
    if (propsGraphData) {
      setGraphData(propsGraphData);
      setLoading(false);
      return;
    }

    // 如果没有传入 graphData，但有 centerArticleId，则调用API
    if (centerArticleId) {
      async function loadGraph() {
        setLoading(true);
        try {
          const response = await fetch(
            `/api/v1/law-articles/${centerArticleId}/graph?depth=${depth}`
          );

          // 检查响应状态
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `请求失败: ${response.status}`);
          }

          setGraphData(normalizeGraphPayload(await response.json()));
        } catch {
          // 客户端错误处理：显示空数据而非使用console
          setGraphData({ nodes: [], links: [] });
        } finally {
          setLoading(false);
        }
      }
      loadGraph();
      return;
    }

    // 如果两者都没有，显示空状态
    setGraphData({ nodes: [], links: [] });
    setLoading(false);
  }, [propsGraphData, centerArticleId, depth]);

  // 加载社区颜色（懒加载，仅当 toggle 开启且尚未加载时）
  const loadCommunityColors = useCallback(async () => {
    const id = centerArticleId;
    if (!id || communityData) return;
    setCommunityLoading(true);
    try {
      const res = await fetch(
        `/api/knowledge-graph/communities?articleId=${id}&depth=${depth}`
      );
      if (res.ok) {
        const json = (await res.json()) as {
          success: boolean;
          data: CommunityColorResult;
        };
        if (json.success) {
          setCommunityData(json.data);
        }
      }
    } finally {
      setCommunityLoading(false);
    }
  }, [centerArticleId, depth, communityData]);

  // 当 toggle 开启时触发加载
  useEffect(() => {
    if (showCommunityColors && !communityData && !communityLoading) {
      void loadCommunityColors();
    }
  }, [
    showCommunityColors,
    communityData,
    communityLoading,
    loadCommunityColors,
  ]);

  // 渲染图谱
  useEffect(() => {
    // 检查数据是否存在且包含有效的 nodes 和 links 数组
    if (
      !graphData ||
      !svgRef.current ||
      !Array.isArray(graphData.nodes) ||
      !Array.isArray(graphData.links)
    ) {
      return;
    }

    const width = 1600;
    const height = 1000;

    // 清空SVG
    d3.select(svgRef.current).selectAll('*').remove();

    // 节点预置初始位置：在画布中心附近随机分布，避免全部堆在 (0,0)
    const cx = width / 2;
    const cy = height / 2;
    (graphData.nodes as (GraphNode & { x?: number; y?: number })[]).forEach(
      node => {
        if (node.x === undefined || node.x === 0) {
          node.x = cx + (Math.random() - 0.5) * 400;
        }
        if (node.y === undefined || node.y === 0) {
          node.y = cy + (Math.random() - 0.5) * 400;
        }
      }
    );

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // 缩放平移支持
    const zoomG = svg.append('g');
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', event => {
          zoomG.attr('transform', event.transform);
        })
    );

    // 根据节点数量动态调整力参数
    const nodeCount = graphData.nodes.length;
    const chargeStrength = nodeCount > 200 ? -80 : nodeCount > 50 ? -200 : -300;
    const linkDistance = nodeCount > 200 ? 60 : 100;

    // 创建力导向图
    const simulation = d3
      .forceSimulation(graphData.nodes as d3.SimulationNodeDatum[])
      .force(
        'link',
        d3
          .forceLink(graphData.links as d3.SimulationLinkDatum<GraphNode>[])
          .id((d: d3.SimulationNodeDatum) => (d as GraphNode).id)
          .distance(linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(cx, cy).strength(0.1))
      .force('x', d3.forceX(cx).strength(0.05))
      .force('y', d3.forceY(cy).strength(0.05))
      .force('collision', d3.forceCollide().radius(18));

    // 绘制连线（放入可缩放组 zoomG）
    const link = zoomG
      .append('g')
      .selectAll('line')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('stroke', (d: GraphLink) => getRelationColor(d.relationType))
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.5);

    // 绘制节点（放入可缩放组 zoomG）
    const node = zoomG
      .append('g')
      .selectAll('circle')
      .data(graphData.nodes)
      .enter()
      .append('circle')
      .attr('r', (d: GraphNode) => {
        if (d.id === centerArticleId) return 15;
        if (d.level === 0) return 9; // 种子节点
        return 6; // 邻居节点稍小
      })
      .attr('fill', (d: GraphNode) =>
        showCommunityColors && communityData?.nodeColors[d.id]
          ? communityData.nodeColors[d.id]
          : getCategoryColor(d.category)
      )
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      )
      .on('click', (_event: MouseEvent, d: GraphNode) => {
        setSelectedNode(d);
      });

    // 添加标签（只在节点较少时显示，避免文字堆叠）
    const showLabels = graphData.nodes.length <= 120;
    const label = zoomG
      .append('g')
      .selectAll('text')
      .data(showLabels ? graphData.nodes : [])
      .enter()
      .append('text')
      .text((d: GraphNode) => `${d.lawName.slice(0, 8)}-${d.articleNumber}`)
      .attr('font-size', 9)
      .attr('dx', 10)
      .attr('dy', 3)
      .style('pointer-events', 'none')
      .style('fill', '#555');

    // 更新位置
    simulation.on('tick', () => {
      link
        .attr('x1', (d: d3.SimulationLinkDatum<GraphNode>) => {
          const source = d.source as GraphNode & { x: number };
          return source.x;
        })
        .attr('y1', (d: d3.SimulationLinkDatum<GraphNode>) => {
          const source = d.source as GraphNode & { y: number };
          return source.y;
        })
        .attr('x2', (d: d3.SimulationLinkDatum<GraphNode>) => {
          const target = d.target as GraphNode & { x: number };
          return target.x;
        })
        .attr('y2', (d: d3.SimulationLinkDatum<GraphNode>) => {
          const target = d.target as GraphNode & { y: number };
          return target.y;
        });

      node
        .attr('cx', (d: GraphNode) => (d as GraphNode & { x: number }).x)
        .attr('cy', (d: GraphNode) => (d as GraphNode & { y: number }).y);

      label
        .attr('x', (d: GraphNode) => (d as GraphNode & { x: number }).x)
        .attr('y', (d: GraphNode) => (d as GraphNode & { y: number }).y);
    });

    // 拖拽函数
    function dragstarted(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>
    ) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      const subject = event.subject as GraphNode & {
        fx?: number | null;
        fy?: number | null;
      };
      subject.fx = (event.subject as GraphNode & { x: number }).x;
      subject.fy = (event.subject as GraphNode & { y: number }).y;
    }

    function dragged(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>
    ) {
      const subject = event.subject as GraphNode & {
        fx?: number | null;
        fy?: number | null;
      };
      subject.fx = event.x;
      subject.fy = event.y;
    }

    function dragended(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>
    ) {
      if (!event.active) simulation.alphaTarget(0);
      const subject = event.subject as GraphNode & {
        fx?: number | null;
        fy?: number | null;
      };
      subject.fx = null;
      subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [graphData, centerArticleId, showCommunityColors, communityData]);

  // 关系类型颜色映射
  function getRelationColor(type: string): string {
    const colors: Record<string, string> = {
      CITES: '#3b82f6',
      CITED_BY: '#60a5fa',
      CONFLICTS: '#ef4444',
      COMPLETES: '#22c55e',
      COMPLETED_BY: '#4ade80',
      SUPERSEDES: '#a855f7',
      SUPERSEDED_BY: '#c084fc',
      IMPLEMENTS: '#f59e0b',
      IMPLEMENTED_BY: '#fbbf24',
      RELATED: '#6b7280',
    };
    return colors[type] || '#6b7280';
  }

  // 分类颜色映射
  function getCategoryColor(category: string): string {
    if (isDirectColor(category)) return category;

    const colors: Record<string, string> = {
      CIVIL: '#3b82f6',
      CRIMINAL: '#ef4444',
      ADMINISTRATIVE: '#22c55e',
      COMMERCIAL: '#f59e0b',
      LABOR: '#a855f7',
    };
    return colors[category] || '#6b7280';
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>加载中...</div>
    );
  }

  // 检查是否有数据
  const hasData = graphData && graphData.nodes && graphData.nodes.length > 0;

  return (
    <div className='relative'>
      {/* 社区着色切换按钮（仅在有 centerArticleId 时显示） */}
      {centerArticleId && (
        <div className='flex items-center gap-2 mb-2'>
          <button
            onClick={() => setShowCommunityColors(v => !v)}
            disabled={communityLoading}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              showCommunityColors
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {communityLoading
              ? '分析中...'
              : showCommunityColors
                ? '✦ 社区着色 已开启'
                : '✦ 社区着色'}
          </button>
          {showCommunityColors && communityData && (
            <span className='text-xs text-gray-500'>
              检测到 {communityData.communityCount} 个法律社区
            </span>
          )}
        </div>
      )}

      {!hasData && !loading && (
        <div className='flex items-center justify-center h-96 text-gray-500'>
          暂无图谱数据
        </div>
      )}
      <svg
        ref={svgRef}
        className={`border rounded-lg w-full ${!hasData ? 'hidden' : ''}`}
        role='img'
      />

      {/* 图例 */}
      <div className='absolute top-12 right-4 bg-white p-4 rounded shadow-lg'>
        {showCommunityColors &&
        communityData &&
        communityData.communityLegend.length > 0 ? (
          <>
            <h3 className='font-bold mb-2 text-sm'>法律社区</h3>
            <div className='space-y-1 text-xs max-h-48 overflow-y-auto'>
              {communityData.communityLegend.slice(0, 10).map(item => (
                <div key={item.communityId} className='flex items-center gap-2'>
                  <span
                    className='inline-block w-3 h-3 rounded-full flex-shrink-0'
                    style={{ backgroundColor: item.color }}
                  />
                  <span className='text-gray-600'>
                    社区 {item.communityId + 1}
                  </span>
                  <span className='text-gray-400'>({item.count} 条)</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3 className='font-bold mb-2 text-sm'>关系类型</h3>
            <div className='space-y-1 text-sm'>
              <div>
                <span className='inline-block w-4 h-1 bg-blue-500 mr-2'></span>
                引用
              </div>
              <div>
                <span className='inline-block w-4 h-1 bg-red-500 mr-2'></span>
                冲突
              </div>
              <div>
                <span className='inline-block w-4 h-1 bg-green-500 mr-2'></span>
                补全
              </div>
              <div>
                <span className='inline-block w-4 h-1 bg-purple-500 mr-2'></span>
                替代
              </div>
              <div>
                <span className='inline-block w-4 h-1 bg-orange-500 mr-2'></span>
                实施
              </div>
            </div>
          </>
        )}
      </div>

      {/* 节点详情 */}
      {selectedNode && (
        <div className='absolute bottom-4 left-4 bg-white p-4 rounded shadow-lg'>
          <h3 className='font-bold mb-2'>{selectedNode.lawName}</h3>
          <p className='text-sm text-gray-600'>
            第{selectedNode.articleNumber}条
          </p>
          <p className='text-sm text-gray-500'>{selectedNode.category}</p>
          <button
            onClick={() => setSelectedNode(null)}
            className='mt-2 px-3 py-1 bg-gray-200 rounded text-sm'
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
