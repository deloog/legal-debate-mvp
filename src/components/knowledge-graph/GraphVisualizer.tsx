/**
 * 增强版知识图谱可视化组件
 *
 * 功能：
 * 1. 支持节点拖拽和缩放
 * 2. 双击节点展开更多关系
 * 3. 支持过滤显示
 * 4. 性能优化（虚拟渲染）
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { logger } from '@/lib/logger';

/**
 * 图节点类型
 */
export interface GraphNode {
  id: string;
  lawName: string;
  articleNumber: string;
  category: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

/**
 * 图边类型
 */
export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relationType: string;
  strength: number;
  confidence: number;
}

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  centerNodeId?: string;
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
  width?: number;
  height?: number;
  filterCategory?: string;
  filterRelationType?: string;
}

/**
 * 增强版知识图谱可视化组件
 */
export function GraphVisualizer({
  nodes: initialNodes,
  links: initialLinks,
  centerNodeId,
  onNodeClick,
  onNodeDoubleClick,
  width = 1200,
  height = 800,
  filterCategory,
  filterRelationType,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(
    null
  );

  const [filteredNodes, setFilteredNodes] = useState<GraphNode[]>(initialNodes);
  const [filteredLinks, setFilteredLinks] = useState<GraphLink[]>(initialLinks);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // 过滤数据
  useEffect(() => {
    let filteredNodes = [...initialNodes];
    let filteredLinks = [...initialLinks];

    // 按分类过滤
    if (filterCategory) {
      filteredNodes = filteredNodes.filter(n => n.category === filterCategory);
    }

    // 按关系类型过滤
    if (filterRelationType) {
      filteredLinks = filteredLinks.filter(
        l => l.relationType === filterRelationType
      );
    }

    // 只保留连接到已过滤节点的边
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    filteredLinks = filteredLinks.filter(
      l =>
        filteredNodeIds.has(
          typeof l.source === 'string' ? l.source : l.source.id
        ) &&
        filteredNodeIds.has(
          typeof l.target === 'string' ? l.target : l.target.id
        )
    );

    setFilteredNodes(filteredNodes);
    setFilteredLinks(filteredLinks);
  }, [initialNodes, initialLinks, filterCategory, filterRelationType]);

  // 渲染图谱
  useEffect(() => {
    if (
      !svgRef.current ||
      filteredNodes.length === 0 ||
      filteredLinks.length === 0
    ) {
      return;
    }

    // 停止旧的模拟
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 创建容器组用于缩放
    const container = svg.append('g');

    // 设置缩放行为
    if (zoomRef.current) {
      svg.call(zoomRef.current);
    } else {
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', event => {
          container.attr('transform', event.transform);
        });
      zoomRef.current = zoom;
      svg.call(zoom);
    }

    // 创建力导向图
    const simulation = d3
      .forceSimulation<GraphNode>(filteredNodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(filteredLinks)
          .id((d: GraphNode) => d.id)
          .distance((d: GraphLink) => 100 / d.strength)
          .strength((d: GraphLink) => d.confidence)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35))
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force('y', d3.forceY(height / 2).strength(0.1));

    simulationRef.current = simulation;

    // 绘制连线
    const link = container
      .append('g')
      .selectAll('line')
      .data(filteredLinks)
      .enter()
      .append('line')
      .attr('stroke', (d: GraphLink) => getRelationColor(d.relationType))
      .attr('stroke-width', (d: GraphLink) => d.strength * 3)
      .attr('stroke-opacity', 0.6);

    // 绘制节点
    const node = container
      .append('g')
      .selectAll('circle')
      .data(filteredNodes)
      .enter()
      .append('circle')
      .attr('r', (d: GraphNode) =>
        d.id === centerNodeId || d.id === hoveredNode?.id ? 18 : 12
      )
      .attr('fill', (d: GraphNode) => getCategoryColor(d.category))
      .attr('stroke', (d: GraphNode) =>
        d.id === selectedNode?.id ? '#3b82f6' : '#fff'
      )
      .attr('stroke-width', (d: GraphNode) =>
        d.id === selectedNode?.id ? 3 : 2
      )
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
        onNodeClick?.(d);
      })
      .on('dblclick', (_event: MouseEvent, d: GraphNode) => {
        onNodeDoubleClick?.(d);
      })
      .on('mouseover', (_event: MouseEvent, d: GraphNode) => {
        setHoveredNode(d);
      })
      .on('mouseout', () => {
        setHoveredNode(null);
      });

    // 添加标签
    const label = container
      .append('g')
      .selectAll('text')
      .data(filteredNodes)
      .enter()
      .append('text')
      .text((d: GraphNode) =>
        `${d.lawName}-${d.articleNumber}`.substring(0, 20)
      )
      .attr('font-size', 10)
      .attr('dx', 14)
      .attr('dy', 4)
      .attr('fill', '#374151')
      .style('pointer-events', 'none');

    // 更新位置
    simulation.on('tick', () => {
      link
        .attr('x1', (d: GraphLink) => {
          const source = typeof d.source === 'string' ? d.source : d.source;
          return (source as GraphNode & { x?: number }).x || 0;
        })
        .attr('y1', (d: GraphLink) => {
          const source = typeof d.source === 'string' ? d.source : d.source;
          return (source as GraphNode & { y?: number }).y || 0;
        })
        .attr('x2', (d: GraphLink) => {
          const target = typeof d.target === 'string' ? d.target : d.target;
          return (target as GraphNode & { x?: number }).x || 0;
        })
        .attr('y2', (d: GraphLink) => {
          const target = typeof d.target === 'string' ? d.target : d.target;
          return (target as GraphNode & { y?: number }).y || 0;
        });

      node
        .attr('cx', (d: GraphNode & { x?: number }) => d.x || 0)
        .attr('cy', (d: GraphNode & { y?: number }) => d.y || 0);

      label
        .attr('x', (d: GraphNode & { x?: number }) => d.x || 0)
        .attr('y', (d: GraphNode & { y?: number }) => d.y || 0);
    });

    // 拖拽函数
    function dragstarted(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>
    ) {
      if (!event.active && simulation) simulation.alphaTarget(0.3).restart();
      const subject = event.subject as GraphNode & {
        fx?: number | null;
        fy?: number | null;
      };
      subject.fx = (event.subject as GraphNode & { x?: number }).x;
      subject.fy = (event.subject as GraphNode & { y?: number }).y;
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
      if (!event.active && simulation) simulation.alphaTarget(0);
      const subject = event.subject as GraphNode & {
        fx?: number | null;
        fy?: number | null;
      };
      subject.fx = null;
      subject.fy = null;
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
    };
  }, [
    filteredNodes,
    filteredLinks,
    centerNodeId,
    selectedNode,
    hoveredNode,
    onNodeClick,
    onNodeDoubleClick,
    width,
    height,
  ]);

  // 重置视图
  const handleResetView = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select<SVGSVGElement, unknown>(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  }, []);

  // 关系类型颜色映射
  const getRelationColor = useCallback((type: string): string => {
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
  }, []);

  // 分类颜色映射
  const getCategoryColor = useCallback((category: string): string => {
    const colors: Record<string, string> = {
      CIVIL: '#3b82f6',
      CRIMINAL: '#ef4444',
      ADMINISTRATIVE: '#22c55e',
      COMMERCIAL: '#f59e0b',
      LABOR: '#a855f7',
    };
    return colors[category] || '#6b7280';
  }, []);

  return (
    <div className='relative w-full h-full'>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className='border rounded-lg bg-white'
        style={{ width: '100%', height: '100%' }}
      />

      {/* 控制按钮 */}
      <div className='absolute top-4 right-4 flex flex-col gap-2'>
        <button
          onClick={handleResetView}
          className='p-2 bg-white rounded shadow hover:bg-gray-50'
          title='重置视图'
        >
          <svg
            className='w-5 h-5'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4'
            />
          </svg>
        </button>
      </div>

      {/* 图例 */}
      <div className='absolute top-4 left-4 bg-white p-4 rounded shadow-lg max-h-64 overflow-y-auto'>
        <h3 className='font-bold mb-2 text-sm'>关系类型</h3>
        <div className='space-y-1 text-xs'>
          <div className='flex items-center gap-2'>
            <span className='inline-block w-4 h-1 bg-blue-500'></span>
            引用
          </div>
          <div className='flex items-center gap-2'>
            <span className='inline-block w-4 h-1 bg-red-500'></span>
            冲突
          </div>
          <div className='flex items-center gap-2'>
            <span className='inline-block w-4 h-1 bg-green-500'></span>
            补全
          </div>
          <div className='flex items-center gap-2'>
            <span className='inline-block w-4 h-1 bg-purple-500'></span>
            替代
          </div>
          <div className='flex items-center gap-2'>
            <span className='inline-block w-4 h-1 bg-orange-500'></span>
            实施
          </div>
        </div>
        <h3 className='font-bold mt-3 mb-2 text-sm'>法律分类</h3>
        <div className='space-y-1 text-xs'>
          <div className='flex items-center gap-2'>
            <span className='inline-block w-3 h-3 rounded-full bg-blue-500'></span>
            民事
          </div>
          <div className='flex items-center gap-2'>
            <span className='inline-block w-3 h-3 rounded-full bg-red-500'></span>
            刑事
          </div>
          <div className='flex items-center gap-2'>
            <span className='inline-block w-3 h-3 rounded-full bg-green-500'></span>
            行政
          </div>
          <div className='flex items-center gap-2'>
            <span className='inline-block w-3 h-3 rounded-full bg-orange-500'></span>
            商事
          </div>
          <div className='flex items-center gap-2'>
            <span className='inline-block w-3 h-3 rounded-full bg-purple-500'></span>
            劳动
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className='absolute bottom-4 left-4 bg-white p-3 rounded shadow text-sm'>
        <div className='flex gap-4'>
          <div>
            节点: <span className='font-bold'>{filteredNodes.length}</span>
          </div>
          <div>
            边: <span className='font-bold'>{filteredLinks.length}</span>
          </div>
        </div>
      </div>

      {/* 节点详情 */}
      {selectedNode && (
        <div className='absolute bottom-4 right-4 bg-white p-4 rounded shadow-lg max-w-xs'>
          <div className='flex justify-between items-start mb-2'>
            <h3 className='font-bold'>{selectedNode.lawName}</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className='text-gray-400 hover:text-gray-600'
            >
              ✕
            </button>
          </div>
          <p className='text-sm text-gray-600'>
            第{selectedNode.articleNumber}条
          </p>
          <p className='text-sm text-gray-500'>{selectedNode.category}</p>
          <div className='mt-2 text-xs text-gray-400'>双击查看更多关系</div>
        </div>
      )}
    </div>
  );
}
