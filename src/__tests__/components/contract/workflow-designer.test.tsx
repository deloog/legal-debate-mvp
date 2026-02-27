/**
 * WorkflowDesigner 组件测试
 * TDD: 先写测试，后写实现
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { WorkflowDesigner } from '@/components/contract/WorkflowDesigner';
import { WorkflowNodeType } from '@/lib/contract/approval-workflow-service';
import type { WorkflowDefinition } from '@/lib/contract/approval-workflow-service';

describe('WorkflowDesigner', () => {
  const simpleDefinition: WorkflowDefinition = {
    startNodeId: 'node-start',
    nodes: [
      {
        id: 'node-start',
        type: WorkflowNodeType.START,
        label: '开始',
        position: { x: 0, y: 0 },
        nextNodeIds: ['node-approval'],
      },
      {
        id: 'node-approval',
        type: WorkflowNodeType.APPROVAL,
        label: '部门审批',
        position: { x: 200, y: 0 },
        approverRole: '部门主管',
        nextNodeIds: ['node-end'],
      },
      {
        id: 'node-end',
        type: WorkflowNodeType.END,
        label: '结束',
        position: { x: 400, y: 0 },
        nextNodeIds: [],
      },
    ],
  };

  const parallelDefinition: WorkflowDefinition = {
    startNodeId: 'node-start',
    nodes: [
      {
        id: 'node-start',
        type: WorkflowNodeType.START,
        label: '开始',
        position: { x: 0, y: 0 },
        nextNodeIds: ['node-fork'],
      },
      {
        id: 'node-fork',
        type: WorkflowNodeType.PARALLEL_GATEWAY,
        label: '并行开始',
        position: { x: 200, y: 0 },
        parallelType: 'fork',
        nextNodeIds: ['node-finance', 'node-legal'],
      },
      {
        id: 'node-finance',
        type: WorkflowNodeType.APPROVAL,
        label: '财务审批',
        position: { x: 400, y: -80 },
        approverRole: '财务部',
        parallelGroup: 'pg-1',
        nextNodeIds: ['node-join'],
      },
      {
        id: 'node-legal',
        type: WorkflowNodeType.APPROVAL,
        label: '法务审批',
        position: { x: 400, y: 80 },
        approverRole: '法务部',
        parallelGroup: 'pg-1',
        nextNodeIds: ['node-join'],
      },
      {
        id: 'node-join',
        type: WorkflowNodeType.PARALLEL_GATEWAY,
        label: '并行结束',
        position: { x: 600, y: 0 },
        parallelType: 'join',
        nextNodeIds: ['node-end'],
      },
      {
        id: 'node-end',
        type: WorkflowNodeType.END,
        label: '结束',
        position: { x: 800, y: 0 },
        nextNodeIds: [],
      },
    ],
  };

  // ==================== 基本渲染 ====================

  describe('基本渲染', () => {
    it('应该渲染工作流设计器容器', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      expect(
        screen.getByTestId('workflow-designer')
      ).toBeInTheDocument();
    });

    it('应该渲染所有节点', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      // 通过 data-testid 确认节点渲染（避免节点标签与类型标签文字相同时的歧义）
      expect(screen.getByTestId('node-node-start')).toBeInTheDocument();
      expect(screen.getByTestId('node-node-approval')).toBeInTheDocument();
      expect(screen.getByTestId('node-node-end')).toBeInTheDocument();
    });

    it('应该渲染并行工作流节点', () => {
      render(
        <WorkflowDesigner
          definition={parallelDefinition}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByText('财务审批')).toBeInTheDocument();
      expect(screen.getByText('法务审批')).toBeInTheDocument();
      expect(screen.getByText('并行开始')).toBeInTheDocument();
    });

    it('应该显示审批节点的审批人角色', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByText('部门主管')).toBeInTheDocument();
    });

    it('只读模式下不应显示编辑控件', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
          readOnly={true}
        />
      );

      expect(screen.queryByTestId('add-node-button')).not.toBeInTheDocument();
    });
  });

  // ==================== 节点类型显示 ====================

  describe('节点类型显示', () => {
    it('应该用不同样式标识开始节点', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      const startNode = screen.getByTestId('node-node-start');
      expect(startNode).toHaveAttribute(
        'data-node-type',
        WorkflowNodeType.START
      );
    });

    it('应该用不同样式标识结束节点', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      const endNode = screen.getByTestId('node-node-end');
      expect(endNode).toHaveAttribute('data-node-type', WorkflowNodeType.END);
    });

    it('应该用不同样式标识审批节点', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      const approvalNode = screen.getByTestId('node-node-approval');
      expect(approvalNode).toHaveAttribute(
        'data-node-type',
        WorkflowNodeType.APPROVAL
      );
    });

    it('应该标识并行网关节点', () => {
      render(
        <WorkflowDesigner
          definition={parallelDefinition}
          onChange={jest.fn()}
        />
      );

      const forkNode = screen.getByTestId('node-node-fork');
      expect(forkNode).toHaveAttribute(
        'data-node-type',
        WorkflowNodeType.PARALLEL_GATEWAY
      );
    });
  });

  // ==================== 节点编辑 ====================

  describe('节点编辑', () => {
    it('应该在非只读模式下显示添加节点按钮', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
          readOnly={false}
        />
      );

      expect(screen.getByTestId('add-node-button')).toBeInTheDocument();
    });

    it('点击节点应该选中该节点', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      const approvalNode = screen.getByTestId('node-node-approval');
      fireEvent.click(approvalNode);

      expect(approvalNode).toHaveAttribute('data-selected', 'true');
    });

    it('点击选中节点后应该显示节点详情面板', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      const approvalNode = screen.getByTestId('node-node-approval');
      fireEvent.click(approvalNode);

      expect(screen.getByTestId('node-detail-panel')).toBeInTheDocument();
    });
  });

  // ==================== 添加节点 ====================

  describe('添加节点', () => {
    it('点击添加节点按钮应该弹出节点类型选择', () => {
      const onChange = jest.fn();
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={onChange}
        />
      );

      const addButton = screen.getByTestId('add-node-button');
      fireEvent.click(addButton);

      expect(screen.getByTestId('node-type-selector')).toBeInTheDocument();
    });

    it('选择审批节点类型后应该添加新节点并触发onChange', () => {
      const onChange = jest.fn();
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={onChange}
        />
      );

      const addButton = screen.getByTestId('add-node-button');
      fireEvent.click(addButton);

      const approvalOption = screen.getByTestId('add-node-approval');
      fireEvent.click(approvalOption);

      expect(onChange).toHaveBeenCalledTimes(1);
      const newDefinition = onChange.mock.calls[0][0] as WorkflowDefinition;
      expect(
        newDefinition.nodes.some(n => n.type === WorkflowNodeType.APPROVAL)
      ).toBe(true);
    });
  });

  // ==================== 删除节点 ====================

  describe('删除节点', () => {
    it('选中非开始/结束节点后应该显示删除按钮', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      const approvalNode = screen.getByTestId('node-node-approval');
      fireEvent.click(approvalNode);

      expect(screen.getByTestId('delete-node-button')).toBeInTheDocument();
    });

    it('不应该允许删除开始节点', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      const startNode = screen.getByTestId('node-node-start');
      fireEvent.click(startNode);

      // 开始节点被选中后不应该有删除按钮
      expect(screen.queryByTestId('delete-node-button')).not.toBeInTheDocument();
    });

    it('删除节点后应该触发onChange', () => {
      const onChange = jest.fn();
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={onChange}
        />
      );

      const approvalNode = screen.getByTestId('node-node-approval');
      fireEvent.click(approvalNode);

      const deleteButton = screen.getByTestId('delete-node-button');
      fireEvent.click(deleteButton);

      expect(onChange).toHaveBeenCalledTimes(1);
      const newDefinition = onChange.mock.calls[0][0] as WorkflowDefinition;
      expect(
        newDefinition.nodes.find(n => n.id === 'node-approval')
      ).toBeUndefined();
    });
  });

  // ==================== 工作流统计信息 ====================

  describe('工作流统计信息', () => {
    it('应该显示工作流节点数量统计', () => {
      render(
        <WorkflowDesigner
          definition={simpleDefinition}
          onChange={jest.fn()}
        />
      );

      // 显示审批步骤数（不含开始/结束节点）
      expect(screen.getByTestId('workflow-stats')).toBeInTheDocument();
    });

    it('应该显示是否包含并行审批的标识', () => {
      render(
        <WorkflowDesigner
          definition={parallelDefinition}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('has-parallel-badge')).toBeInTheDocument();
    });
  });
});
