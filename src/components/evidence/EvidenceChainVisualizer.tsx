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
 * 证据链图组件
 */
function EvidenceChainGraphComponent({
  graph,
  selectedPath,
  onNodeClick,
}: {
  graph: EvidenceChainGraph;
  selectedPath?: EvidenceChainPath | null;
  onNodeClick?: (nodeId: string) => void;
}) {
  return (
    <div className='evidence-chain-graph'>
      <h4>证据链图</h4>
      <div className='graph-container'>
        <svg width='100%' height='400' className='evidence-graph-svg'>
          <EvidenceChainGraphEdges edges={graph.edges} />
          <EvidenceChainGraphNodes
            nodes={graph.nodes}
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
          <div className='legend-color core' />
          <span>核心证据</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 证据链边组件
 */
function EvidenceChainGraphEdges({ edges }: { edges: EvidenceChainEdge[] }) {
  return (
    <g className='edges'>
      {edges.map(edge => (
        <EvidenceChainEdge key={edge.id} edge={edge} />
      ))}
    </g>
  );
}

/**
 * 单个证据链边
 */
function EvidenceChainEdge({ edge }: { edge: EvidenceChainEdge }) {
  const strokeColor = getEdgeColor(edge.relationType);
  const strokeWidth = edge.strength;

  return (
    <line
      x1='100'
      y1='200'
      x2='300'
      y2='200'
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeOpacity={edge.confidence}
      className='evidence-edge'
    />
  );
}

/**
 * 证据链节点组件
 */
function EvidenceChainGraphNodes({
  nodes,
  selectedPath,
  onNodeClick,
}: {
  nodes: EvidenceChainNode[];
  selectedPath?: EvidenceChainPath | null;
  onNodeClick?: (nodeId: string) => void;
}) {
  return (
    <g className='nodes'>
      {nodes.map((node, index) => (
        <EvidenceChainNode
          key={node.evidenceId}
          node={node}
          index={index}
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
  index,
  isSelected,
  onClick,
}: {
  node: EvidenceChainNode;
  index: number;
  isSelected: boolean;
  onClick?: () => void;
}) {
  const x = 100 + index * 80;
  const y = 200;
  const radius = isSelected ? 35 : 25;
  const color = getNodeColor(node);

  return (
    <g
      className={`evidence-node ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={color}
        stroke={isSelected ? '#fff' : 'none'}
        strokeWidth='2'
      />
      <text
        x={x}
        y={y}
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
  // 根据证据类型设置不同颜色
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
