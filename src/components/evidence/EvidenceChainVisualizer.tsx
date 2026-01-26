/**
 * EvidenceChainVisualizer - 证据链可视化组件
 *
 * 功能：图形化展示证据链
 */

'use client';

import type {
  EvidenceChainGraph,
  EvidenceChainPath,
  EvidenceChainNode,
  EvidenceChainEdge,
} from '../../types/evidence-chain';

/**
 * 节点位置接口
 */
interface NodePosition {
  x: number;
  y: number;
}

/**
 * 证据链可视化组件
 */
export function EvidenceChainVisualizer({
  chainGraph,
  chains,
  selectedPath,
  onPathSelect,
  onNodeClick,
}: {
  chainGraph: EvidenceChainGraph;
  chains: EvidenceChainPath[];
  selectedPath?: EvidenceChainPath | null;
  onPathSelect?: (path: EvidenceChainPath) => void;
  onNodeClick?: (nodeId: string) => void;
}) {
  const nodePositions = calculateNodePositions(chainGraph);

  return (
    <div className='evidence-chain-visualizer'>
      <div className='visualizer-header'>
        <h3>证据链分析</h3>
        <div className='statistics'>
          <div className='stat-item'>
            <span className='label'>总证据数:</span>
            <span className='value'>{chainGraph.nodes.length}</span>
          </div>
          <div className='stat-item'>
            <span className='label'>证据关系数:</span>
            <span className='value'>{chainGraph.edges.length}</span>
          </div>
          <div className='stat-item'>
            <span className='label'>证据链完整性:</span>
            <span className='value'>
              {chainGraph.statistics.chainCompleteness.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className='visualizer-body'>
        <EvidenceChainGraphComponent
          graph={chainGraph}
          nodePositions={nodePositions}
          selectedPath={selectedPath}
          onNodeClick={onNodeClick}
        />
        <EvidenceChainList
          chains={chains}
          selectedPath={selectedPath}
          onPathSelect={onPathSelect}
        />
      </div>
    </div>
  );
}

/**
 * 计算节点位置（层次布局算法）
 */
function calculateNodePositions(
  graph: EvidenceChainGraph
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const nodesMap = new Map<string, EvidenceChainNode>();

  // 建立节点索引
  graph.nodes.forEach(node => {
    nodesMap.set(node.evidenceId, node);
  });

  // 按入度和出度排序节点
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    const aScore = a.incomingRelations.length * 2 + a.outgoingRelations.length;
    const bScore = b.incomingRelations.length * 2 + b.outgoingRelations.length;
    return bScore - aScore;
  });

  // 计算层次
  const layers: string[][] = [];
  const placedNodes = new Set<string>();
  const maxNodesPerLayer = 5;
  const nodeRadius = 35;
  const horizontalSpacing = nodeRadius * 2.5;
  const verticalSpacing = nodeRadius * 3;

  // 第一层：无入边的节点（根节点）
  const rootNodes = sortedNodes.filter(
    node => node.incomingRelations.length === 0
  );

  // 如果没有根节点，使用第一个节点
  if (rootNodes.length === 0 && sortedNodes.length > 0) {
    rootNodes.push(sortedNodes[0]);
  }

  if (rootNodes.length > 0) {
    layers[0] = rootNodes.map(n => n.evidenceId);
    rootNodes.forEach(node => placedNodes.add(node.evidenceId));
  }

  // 后续层次：BFS遍历
  let currentLayer = 0;
  while (placedNodes.size < graph.nodes.length) {
    currentLayer++;
    const currentLayerNodes = layers[currentLayer - 1] || [];

    // 找出当前层节点指向的未放置节点
    const nextLayerNodeIds = new Set<string>();
    currentLayerNodes.forEach(nodeId => {
      const node = nodesMap.get(nodeId);
      if (!node) return;

      node.outgoingRelations.forEach(edge => {
        const targetId = edge.toEvidenceId;
        if (!placedNodes.has(targetId)) {
          nextLayerNodeIds.add(targetId);
        }
      });
    });

    if (nextLayerNodeIds.size === 0) {
      // 没有新节点，放置剩余节点
      sortedNodes
        .filter(node => !placedNodes.has(node.evidenceId))
        .slice(0, maxNodesPerLayer)
        .forEach(node => nextLayerNodeIds.add(node.evidenceId));
    }

    const nextLayer = Array.from(nextLayerNodeIds).slice(0, maxNodesPerLayer);
    layers[currentLayer] = nextLayer;
    nextLayer.forEach(nodeId => placedNodes.add(nodeId));
  }

  // 计算每层节点的x坐标
  const svgWidth = 800;

  layers.forEach((layer, layerIndex) => {
    const layerY = verticalSpacing + layerIndex * verticalSpacing;
    const layerWidth = layer.length * horizontalSpacing;
    const startX = (svgWidth - layerWidth) / 2;

    layer.forEach((nodeId, nodeIndex) => {
      positions.set(nodeId, {
        x: startX + nodeIndex * horizontalSpacing + nodeRadius,
        y: layerY,
      });
    });
  });

  return positions;
}

/**
 * 证据链图组件
 */
function EvidenceChainGraphComponent({
  graph,
  nodePositions,
  selectedPath,
  onNodeClick,
}: {
  graph: EvidenceChainGraph;
  nodePositions: Map<string, NodePosition>;
  selectedPath?: EvidenceChainPath | null;
  onNodeClick?: (nodeId: string) => void;
}) {
  return (
    <div className='evidence-chain-graph'>
      <h4>证据链图</h4>
      <div className='graph-container'>
        <svg
          width='100%'
          height='500'
          viewBox='0 0 800 500'
          className='evidence-graph-svg'
        >
          <defs>
            <marker
              id='arrowhead'
              markerWidth='10'
              markerHeight='7'
              refX='28'
              refY='3.5'
              orient='auto'
            >
              <polygon
                points='0 0, 10 3.5, 0 7'
                fill={getEdgeColor('SUPPORTS')}
              />
            </marker>
          </defs>
          <EvidenceChainGraphEdges
            edges={graph.edges}
            nodePositions={nodePositions}
          />
          <EvidenceChainGraphNodes
            nodes={graph.nodes}
            nodePositions={nodePositions}
            selectedPath={selectedPath}
            onNodeClick={onNodeClick}
          />
        </svg>
      </div>
      <div className='legend'>
        <div className='legend-item'>
          <div className='legend-color support' />
          <span>支撑关系</span>
        </div>
        <div className='legend-item'>
          <div className='legend-color refute' />
          <span>反驳关系</span>
        </div>
        <div className='legend-item'>
          <div className='legend-color supplement' />
          <span>补充关系</span>
        </div>
        <div className='legend-item'>
          <div className='legend-color contradict' />
          <span>矛盾关系</span>
        </div>
        <div className='legend-item'>
          <div className='legend-color independent' />
          <span>独立</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 证据链边组件
 */
function EvidenceChainGraphEdges({
  edges,
  nodePositions,
}: {
  edges: EvidenceChainEdge[];
  nodePositions: Map<string, NodePosition>;
}) {
  return (
    <g className='edges'>
      {edges.map(edge => (
        <EvidenceChainEdge
          key={edge.id}
          edge={edge}
          nodePositions={nodePositions}
        />
      ))}
    </g>
  );
}

/**
 * 单个证据链边
 */
function EvidenceChainEdge({
  edge,
  nodePositions,
}: {
  edge: EvidenceChainEdge;
  nodePositions: Map<string, NodePosition>;
}) {
  const fromPosition = nodePositions.get(edge.fromEvidenceId);
  const toPosition = nodePositions.get(edge.toEvidenceId);

  if (!fromPosition || !toPosition) {
    return null;
  }

  const strokeColor = getEdgeColor(edge.relationType);
  const strokeWidth = Math.max(1, Math.min(5, edge.strength));

  return (
    <g>
      <line
        x1={fromPosition.x}
        y1={fromPosition.y}
        x2={toPosition.x}
        y2={toPosition.y}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={edge.confidence}
        markerEnd='url(#arrowhead)'
        className='evidence-edge'
      />
    </g>
  );
}

/**
 * 证据链节点组件
 */
function EvidenceChainGraphNodes({
  nodes,
  nodePositions,
  selectedPath,
  onNodeClick,
}: {
  nodes: EvidenceChainNode[];
  nodePositions: Map<string, NodePosition>;
  selectedPath?: EvidenceChainPath | null;
  onNodeClick?: (nodeId: string) => void;
}) {
  return (
    <g className='nodes'>
      {nodes.map(node => (
        <EvidenceChainNode
          key={node.evidenceId}
          node={node}
          position={nodePositions.get(node.evidenceId) || { x: 0, y: 0 }}
          isSelected={
            selectedPath?.evidenceIds.includes(node.evidenceId) ?? false
          }
          onClick={() => onNodeClick?.(node.evidenceId)}
        />
      ))}
    </g>
  );
}

/**
 * 单个证据节点
 */
function EvidenceChainNode({
  node,
  position,
  isSelected,
  onClick,
}: {
  node: EvidenceChainNode;
  position: NodePosition;
  isSelected: boolean;
  onClick?: () => void;
}) {
  const radius = isSelected ? 35 : 28;
  const color = getNodeColor(node);
  const isCore = node.metadata?.coreEvidence === true;

  return (
    <g
      className={`evidence-node ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {isCore && (
        <circle
          cx={position.x}
          cy={position.y}
          r={radius + 5}
          fill='none'
          stroke='#fbbf24'
          strokeWidth='2'
          strokeDasharray='4,2'
        />
      )}
      <circle
        cx={position.x}
        cy={position.y}
        r={radius}
        fill={color}
        stroke={isSelected ? '#fff' : 'none'}
        strokeWidth='2'
      />
      <text
        x={position.x}
        y={position.y}
        textAnchor='middle'
        dy='5'
        fill='#fff'
        fontSize='12'
        className='node-label'
      >
        {node.evidenceName.substring(0, 4)}
      </text>
    </g>
  );
}

/**
 * 证据链列表组件
 */
function EvidenceChainList({
  chains,
  selectedPath,
  onPathSelect,
}: {
  chains: EvidenceChainPath[];
  selectedPath?: EvidenceChainPath | null;
  onPathSelect?: (path: EvidenceChainPath) => void;
}) {
  return (
    <div className='evidence-chain-list'>
      <h4>证据链列表</h4>
      <div className='chain-list'>
        {chains.map((chain, index) => (
          <EvidenceChainListItem
            key={index}
            chain={chain}
            isSelected={selectedPath === chain}
            onClick={() => onPathSelect?.(chain)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 证据链列表项
 */
function EvidenceChainListItem({
  chain,
  isSelected,
  onClick,
}: {
  chain: EvidenceChainPath;
  isSelected: boolean;
  onClick?: () => void;
}) {
  const pathTypeLabel = getPathTypeLabel(chain.pathType);

  return (
    <div
      className={`chain-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className='chain-info'>
        <div className='chain-type'>{pathTypeLabel}</div>
        <div className='chain-stats'>
          <span>长度: {chain.length}</span>
          <span>强度: {chain.totalStrength.toFixed(1)}</span>
          <span>置信度: {chain.averageConfidence.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 获取边颜色
 */
function getEdgeColor(relationType: string): string {
  const colorMap: Record<string, string> = {
    SUPPORTS: '#22c55e', // green
    REFUTES: '#ef4444', // red
    SUPPLEMENTS: '#3b82f6', // blue
    CONTRADICTS: '#f59e0b', // orange
    INDEPENDENT: '#9ca3af', // gray
  };
  return colorMap[relationType] || '#9ca3af';
}

/**
 * 获取节点颜色
 */
function getNodeColor(node: EvidenceChainNode): string {
  const typeColorMap: Record<string, string> = {
    DOCUMENTARY_EVIDENCE: '#3b82f6', // blue
    PHYSICAL_EVIDENCE: '#22c55e', // green
    WITNESS_TESTIMONY: '#f59e0b', // orange
    EXPERT_OPINION: '#8b5cf6', // purple
    AUDIO_VIDEO_EVIDENCE: '#ec4899', // pink
    ELECTRONIC_EVIDENCE: '#06b6d4', // cyan
  };
  return typeColorMap[node.evidenceType] || '#6b7280';
}

/**
 * 获取路径类型标签
 */
function getPathTypeLabel(
  pathType: 'supporting' | 'refuting' | 'mixed'
): string {
  const labelMap: Record<string, string> = {
    supporting: '支撑链',
    refuting: '反驳链',
    mixed: '混合链',
  };
  return labelMap[pathType] || '未知';
}
