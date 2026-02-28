/**
 * 审批工作流可视化设计器
 * 支持节点增删、条件分支、并行审批的可视化编排
 */

'use client';

import { useState, useCallback } from 'react';
import {
  WorkflowNodeType,
  type WorkflowDefinition,
  type WorkflowNode,
} from '@/lib/contract/approval-workflow-service';
import {
  Play,
  Square,
  CheckCircle,
  GitBranch,
  Shuffle,
  Plus,
  Trash2,
  ChevronRight,
} from 'lucide-react';

// ==================== 类型定义 ====================

interface WorkflowDesignerProps {
  definition: WorkflowDefinition;
  onChange: (definition: WorkflowDefinition) => void;
  readOnly?: boolean;
}

// ==================== 辅助函数 ====================

function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getNodeIcon(type: WorkflowNodeType) {
  switch (type) {
    case WorkflowNodeType.START:
      return <Play className='h-4 w-4' />;
    case WorkflowNodeType.END:
      return <Square className='h-4 w-4' />;
    case WorkflowNodeType.APPROVAL:
      return <CheckCircle className='h-4 w-4' />;
    case WorkflowNodeType.CONDITION:
      return <GitBranch className='h-4 w-4' />;
    case WorkflowNodeType.PARALLEL_GATEWAY:
      return <Shuffle className='h-4 w-4' />;
    default:
      return <ChevronRight className='h-4 w-4' />;
  }
}

function getNodeColorClass(type: WorkflowNodeType): string {
  switch (type) {
    case WorkflowNodeType.START:
      return 'bg-green-100 border-green-400 text-green-800';
    case WorkflowNodeType.END:
      return 'bg-gray-100 border-gray-400 text-gray-800';
    case WorkflowNodeType.APPROVAL:
      return 'bg-blue-100 border-blue-400 text-blue-800';
    case WorkflowNodeType.CONDITION:
      return 'bg-yellow-100 border-yellow-400 text-yellow-800';
    case WorkflowNodeType.PARALLEL_GATEWAY:
      return 'bg-purple-100 border-purple-400 text-purple-800';
    default:
      return 'bg-gray-100 border-gray-300 text-gray-700';
  }
}

function getNodeTypeLabel(type: WorkflowNodeType): string {
  switch (type) {
    case WorkflowNodeType.START:
      return '开始';
    case WorkflowNodeType.END:
      return '结束';
    case WorkflowNodeType.APPROVAL:
      return '审批';
    case WorkflowNodeType.CONDITION:
      return '条件';
    case WorkflowNodeType.PARALLEL_GATEWAY:
      return '并行网关';
    default:
      return '未知';
  }
}

// ==================== 子组件 ====================

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  isSelected: boolean;
  onClick: () => void;
  readOnly: boolean;
}

function WorkflowNodeCard({
  node,
  isSelected,
  onClick,
  readOnly,
}: WorkflowNodeCardProps) {
  const colorClass = getNodeColorClass(node.type);

  return (
    <div
      data-testid={`node-${node.id}`}
      data-node-type={node.type}
      data-selected={isSelected ? 'true' : 'false'}
      onClick={onClick}
      role='button'
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className={`
        relative flex flex-col items-center rounded-lg border-2 p-3
        cursor-pointer transition-all duration-150 min-w-[120px]
        ${colorClass}
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' : 'hover:shadow-md'}
        ${readOnly ? 'cursor-default' : 'cursor-pointer'}
      `}
    >
      <div className='flex items-center gap-1 mb-1'>
        {getNodeIcon(node.type)}
        <span className='text-xs font-medium'>
          {getNodeTypeLabel(node.type)}
        </span>
      </div>
      <span className='text-sm font-semibold text-center'>{node.label}</span>
      {node.approverRole && (
        <span className='mt-1 text-xs text-gray-600 bg-white rounded px-1.5 py-0.5'>
          {node.approverRole}
        </span>
      )}
      {node.parallelGroup && (
        <span className='mt-1 text-xs text-purple-600'>
          并行组: {node.parallelGroup}
        </span>
      )}
    </div>
  );
}

interface NodeDetailPanelProps {
  node: WorkflowNode;
  onDelete: () => void;
  readOnly: boolean;
}

function NodeDetailPanel({ node, onDelete, readOnly }: NodeDetailPanelProps) {
  const canDelete =
    node.type !== WorkflowNodeType.START && node.type !== WorkflowNodeType.END;

  return (
    <div
      data-testid='node-detail-panel'
      className='border border-gray-200 rounded-lg p-4 bg-white shadow-sm'
    >
      <div className='flex items-center justify-between mb-3'>
        <h4 className='text-sm font-semibold text-gray-700'>节点详情</h4>
        {!readOnly && canDelete && (
          <button
            data-testid='delete-node-button'
            onClick={onDelete}
            className='flex items-center gap-1 text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50'
            title='删除节点'
          >
            <Trash2 className='h-3.5 w-3.5' />
            删除
          </button>
        )}
      </div>

      <dl className='space-y-2 text-sm'>
        <div>
          <dt className='text-gray-500'>节点ID</dt>
          <dd className='font-mono text-xs text-gray-700'>{node.id}</dd>
        </div>
        <div>
          <dt className='text-gray-500'>节点类型</dt>
          <dd>{getNodeTypeLabel(node.type)}</dd>
        </div>
        <div>
          <dt className='text-gray-500'>标签</dt>
          <dd className='font-medium'>{node.label}</dd>
        </div>
        {node.approverRole && (
          <div>
            <dt className='text-gray-500'>审批角色</dt>
            <dd className='font-medium text-blue-700'>{node.approverRole}</dd>
          </div>
        )}
        {node.approverName && (
          <div>
            <dt className='text-gray-500'>审批人</dt>
            <dd>{node.approverName}</dd>
          </div>
        )}
        {node.parallelGroup && (
          <div>
            <dt className='text-gray-500'>并行分组</dt>
            <dd className='text-purple-700'>{node.parallelGroup}</dd>
          </div>
        )}
        {node.parallelType && (
          <div>
            <dt className='text-gray-500'>网关类型</dt>
            <dd>{node.parallelType === 'fork' ? '并行开始' : '并行结束'}</dd>
          </div>
        )}
        {node.conditions && node.conditions.length > 0 && (
          <div>
            <dt className='text-gray-500'>条件数量</dt>
            <dd>{node.conditions.length} 个条件</dd>
          </div>
        )}
        <div>
          <dt className='text-gray-500'>后继节点</dt>
          <dd className='font-mono text-xs'>
            {node.nextNodeIds.length > 0
              ? node.nextNodeIds.join(', ')
              : '（无后继）'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

interface NodeTypeSelectorProps {
  onSelect: (type: WorkflowNodeType) => void;
  onClose: () => void;
}

function NodeTypeSelector({ onSelect, onClose }: NodeTypeSelectorProps) {
  const nodeTypes = [
    {
      type: WorkflowNodeType.APPROVAL,
      label: '审批节点',
      description: '需要人工审批',
      testId: 'add-node-approval',
    },
    {
      type: WorkflowNodeType.CONDITION,
      label: '条件节点',
      description: '根据条件选择路径',
      testId: 'add-node-condition',
    },
    {
      type: WorkflowNodeType.PARALLEL_GATEWAY,
      label: '并行网关',
      description: '并行开始/结束',
      testId: 'add-node-parallel',
    },
  ];

  return (
    <div
      data-testid='node-type-selector'
      className='absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]'
    >
      <div className='flex items-center justify-between mb-2'>
        <span className='text-sm font-medium text-gray-700'>选择节点类型</span>
        <button
          onClick={onClose}
          className='text-gray-400 hover:text-gray-600 text-xs'
        >
          ✕
        </button>
      </div>
      <div className='space-y-1'>
        {nodeTypes.map(({ type, label, description, testId }) => (
          <button
            key={type}
            data-testid={testId}
            onClick={() => onSelect(type)}
            className={`w-full text-left flex items-center gap-2 p-2 rounded hover:bg-gray-50 ${getNodeColorClass(type)}`}
          >
            {getNodeIcon(type)}
            <div>
              <div className='text-sm font-medium'>{label}</div>
              <div className='text-xs text-gray-500'>{description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== 主组件 ====================

export function WorkflowDesigner({
  definition,
  onChange,
  readOnly = false,
}: WorkflowDesignerProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showNodeTypeSelector, setShowNodeTypeSelector] = useState(false);

  const selectedNode = selectedNodeId
    ? (definition.nodes.find(n => n.id === selectedNodeId) ?? null)
    : null;

  // 计算统计信息
  const approvalNodeCount = definition.nodes.filter(
    n => n.type === WorkflowNodeType.APPROVAL
  ).length;
  const hasParallel = definition.nodes.some(
    n => n.type === WorkflowNodeType.PARALLEL_GATEWAY
  );
  const hasCondition = definition.nodes.some(
    n => n.type === WorkflowNodeType.CONDITION
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (readOnly) return;
      setSelectedNodeId(prev => (prev === nodeId ? null : nodeId));
    },
    [readOnly]
  );

  const handleAddNodeType = useCallback(
    (type: WorkflowNodeType) => {
      setShowNodeTypeSelector(false);

      const newNodeId = generateNodeId();
      let newNode: WorkflowNode;

      switch (type) {
        case WorkflowNodeType.APPROVAL:
          newNode = {
            id: newNodeId,
            type: WorkflowNodeType.APPROVAL,
            label: '新建审批',
            position: { x: 300, y: 200 },
            approverRole: '待配置',
            nextNodeIds: [],
          };
          break;
        case WorkflowNodeType.CONDITION:
          newNode = {
            id: newNodeId,
            type: WorkflowNodeType.CONDITION,
            label: '条件判断',
            position: { x: 300, y: 200 },
            conditions: [],
            nextNodeIds: [],
          };
          break;
        case WorkflowNodeType.PARALLEL_GATEWAY:
          newNode = {
            id: newNodeId,
            type: WorkflowNodeType.PARALLEL_GATEWAY,
            label: '并行网关',
            position: { x: 300, y: 200 },
            parallelType: 'fork',
            nextNodeIds: [],
          };
          break;
        default:
          return;
      }

      onChange({
        ...definition,
        nodes: [...definition.nodes, newNode],
      });
    },
    [definition, onChange]
  );

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;

    const updatedNodes = definition.nodes
      .filter(n => n.id !== selectedNodeId)
      .map(n => ({
        ...n,
        nextNodeIds: n.nextNodeIds.filter(id => id !== selectedNodeId),
      }));

    onChange({
      ...definition,
      nodes: updatedNodes,
    });

    setSelectedNodeId(null);
  }, [selectedNodeId, definition, onChange]);

  // 按线性顺序排列节点（开始节点优先，结束节点最后）
  const orderedNodes = [...definition.nodes].sort((a, b) => {
    if (a.type === WorkflowNodeType.START) return -1;
    if (b.type === WorkflowNodeType.START) return 1;
    if (a.type === WorkflowNodeType.END) return 1;
    if (b.type === WorkflowNodeType.END) return -1;
    return a.position.x - b.position.x;
  });

  return (
    <div
      data-testid='workflow-designer'
      className='flex flex-col gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200'
    >
      {/* 工具栏 */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <h3 className='text-sm font-semibold text-gray-700'>工作流设计器</h3>
          {/* 统计信息 */}
          <div
            data-testid='workflow-stats'
            className='flex items-center gap-2 text-xs text-gray-500'
          >
            <span>{approvalNodeCount} 个审批步骤</span>
            <span>·</span>
            <span>{definition.nodes.length} 个节点</span>
          </div>
          {/* 特性徽章 */}
          <div className='flex items-center gap-1'>
            {hasParallel && (
              <span
                data-testid='has-parallel-badge'
                className='inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700'
              >
                <Shuffle className='h-3 w-3' />
                含并行
              </span>
            )}
            {hasCondition && (
              <span
                data-testid='has-condition-badge'
                className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700'
              >
                <GitBranch className='h-3 w-3' />
                含条件分支
              </span>
            )}
          </div>
        </div>

        {/* 添加节点按钮 */}
        {!readOnly && (
          <div className='relative'>
            <button
              data-testid='add-node-button'
              onClick={() => setShowNodeTypeSelector(prev => !prev)}
              className='flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors'
            >
              <Plus className='h-4 w-4' />
              添加节点
            </button>
            {showNodeTypeSelector && (
              <NodeTypeSelector
                onSelect={handleAddNodeType}
                onClose={() => setShowNodeTypeSelector(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* 主体区域：节点图和详情面板 */}
      <div className='flex gap-4'>
        {/* 节点流程图 */}
        <div className='flex-1 overflow-x-auto'>
          <div className='flex items-center gap-2 p-4 min-w-max'>
            {orderedNodes.map((node, idx) => (
              <div key={node.id} className='flex items-center gap-2'>
                <WorkflowNodeCard
                  node={node}
                  isSelected={selectedNodeId === node.id}
                  onClick={() => handleNodeClick(node.id)}
                  readOnly={readOnly}
                />
                {/* 连接箭头 */}
                {idx < orderedNodes.length - 1 &&
                  node.nextNodeIds.length > 0 && (
                    <ChevronRight className='h-5 w-5 text-gray-400 flex-shrink-0' />
                  )}
              </div>
            ))}
          </div>
        </div>

        {/* 节点详情面板 */}
        {selectedNode && !readOnly && (
          <div className='w-64 flex-shrink-0'>
            <NodeDetailPanel
              node={selectedNode}
              onDelete={handleDeleteNode}
              readOnly={readOnly}
            />
          </div>
        )}
      </div>

      {/* 空状态 */}
      {definition.nodes.length === 0 && (
        <div className='py-12 text-center text-gray-400'>
          <p className='text-sm'>暂无节点，请点击「添加节点」开始编排工作流</p>
        </div>
      )}
    </div>
  );
}
