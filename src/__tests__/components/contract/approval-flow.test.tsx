/**
 * 审批流程组件测试
 */

import { render, screen } from '@testing-library/react';
import { ApprovalFlow } from '@/components/contract/ApprovalFlow';
import { ApprovalStatus, StepStatus } from '@prisma/client';

describe('ApprovalFlow', () => {
  const mockApproval = {
    id: 'approval-1',
    status: ApprovalStatus.IN_PROGRESS,
    currentStep: 1,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-29'),
    completedAt: null,
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        approverRole: '部门主管',
        approverId: 'user-2',
        approverName: '张三',
        status: StepStatus.PENDING,
        decision: null,
        comment: null,
        completedAt: null,
        createdAt: new Date('2026-01-29'),
      },
      {
        id: 'step-2',
        stepNumber: 2,
        approverRole: '财务经理',
        approverId: 'user-3',
        approverName: '李四',
        status: StepStatus.PENDING,
        decision: null,
        comment: null,
        completedAt: null,
        createdAt: new Date('2026-01-29'),
      },
    ],
  };

  it('应该渲染审批流程', () => {
    render(<ApprovalFlow approval={mockApproval} />);

    expect(screen.getByText(/审批流程/i)).toBeInTheDocument();
    expect(screen.getByText(/部门主管/i)).toBeInTheDocument();
    expect(screen.getByText(/财务经理/i)).toBeInTheDocument();
  });

  it('应该显示当前步骤', () => {
    render(<ApprovalFlow approval={mockApproval} />);

    expect(screen.getByText(/当前步骤/i)).toBeInTheDocument();
  });

  it('应该显示审批状态', () => {
    render(<ApprovalFlow approval={mockApproval} />);

    expect(screen.getByText(/审批中/i)).toBeInTheDocument();
  });

  it('应该显示审批人信息', () => {
    render(<ApprovalFlow approval={mockApproval} />);

    expect(screen.getByText(/张三/i)).toBeInTheDocument();
    expect(screen.getByText(/李四/i)).toBeInTheDocument();
  });

  it('当前审批人应该看到操作按钮', () => {
    render(
      <ApprovalFlow
        approval={mockApproval}
        currentUserId="user-2"
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /通过/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /拒绝/i })).toBeInTheDocument();
  });
});
