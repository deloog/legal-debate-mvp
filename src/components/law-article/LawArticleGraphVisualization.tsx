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

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';

interface Props {
  centerArticleId: string;
  depth?: number;
}

/**
 * 法条关系图谱可视化组件
 */
export function LawArticleGraphVisualization({
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

  // 加载图谱数据
  useEffect(() => {
    async function loadGraph() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/v1/law-articles/${centerArticleId}/graph?depth=${depth}`
        );
        const data = await response.json();
        setGraphData(data);
      } catch (error) {
        console.error('加载图谱失败:', error);
      } finally {
        setLoading(false);
      }
    }
    loadGraph();
  }, [centerArticleId, depth]);

  // 渲染图谱
  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const width = 1200;
    const height = 800;

    // 清空SVG
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // 创建力导向图
    const simulation = d3
      .forceSimulation(graphData.nodes as d3.SimulationNodeDatum[])
      .force(
        'link',
        d3
          .forceLink(graphData.links as d3.SimulationLinkDatum<GraphNode>[])
          .id((d: d3.SimulationNodeDatum) => (d as GraphNode).id)
          .distance((d: d3.SimulationLinkDatum<GraphNode>) => {
            const link = d as unknown as GraphLink;
            return 100 / link.strength;
          })
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // 绘制连线
    const link = svg
      .append('g')
      .selectAll('line')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('stroke', (d: GraphLink) => getRelationColor(d.relationType))
      .attr('stroke-width', (d: GraphLink) => d.strength * 3)
      .attr('stroke-opacity', 0.6);

    // 绘制节点
    const node = svg
      .append('g')
      .selectAll('circle')
      .data(graphData.nodes)
      .enter()
      .append('circle')
      .attr('r', (d: GraphNode) => (d.id === centerArticleId ? 15 : 10))
      .attr('fill', (d: GraphNode) => getCategoryColor(d.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
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

    // 添加标签
    const label = svg
      .append('g')
      .selectAll('text')
      .data(graphData.nodes)
      .enter()
      .append('text')
      .text((d: GraphNode) => `${d.lawName}-${d.articleNumber}`)
      .attr('font-size', 10)
      .attr('dx', 12)
      .attr('dy', 4)
      .style('pointer-events', 'none');

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
        .attr('cx', (d: GraphNode & { x: number }) => d.x)
        .attr('cy', (d: GraphNode & { y: number }) => d.y);

      label
        .attr('x', (d: GraphNode & { x: number }) => d.x)
        .attr('y', (d: GraphNode & { y: number }) => d.y);
    });

    // 拖拽函数
    function dragstarted(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>
    ) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      const subject = event.subject as GraphNode & { fx?: number; fy?: number };
      subject.fx = (event.subject as GraphNode & { x: number }).x;
      subject.fy = (event.subject as GraphNode & { y: number }).y;
    }

    function dragged(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>
    ) {
      const subject = event.subject as GraphNode & { fx?: number; fy?: number };
      subject.fx = event.x;
      subject.fy = event.y;
    }

    function dragended(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>
    ) {
      if (!event.active) simulation.alphaTarget(0);
      const subject = event.subject as GraphNode & { fx?: number; fy?: number };
      subject.fx = null;
      subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [graphData, centerArticleId]);

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

  return (
    <div className='relative'>
      <svg ref={svgRef} className='border rounded-lg w-full' role='img' />

      {/* 图例 */}
      <div className='absolute top-4 right-4 bg-white p-4 rounded shadow-lg'>
        <h3 className='font-bold mb-2'>关系类型</h3>
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
