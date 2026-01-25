/**
 * 证词查看器组件测试
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TestimonyViewer } from '@/components/witness/TestimonyViewer';
import { type WitnessDetail, type WitnessStatus } from '@/types/witness';

// Mock witness data
const mockWitness: WitnessDetail = {
  id: '1',
  caseId: 'case1',
  name: '张三',
  phone: '13800138001',
  address: '北京市朝阳区',
  relationship: '同事',
  testimony: '我亲眼看到事件发生',
  courtScheduleId: 'schedule1',
  status: 'CONFIRMED' as WitnessStatus,
  metadata: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockWitnessWithoutTestimony: WitnessDetail = {
  ...mockWitness,
  id: '2',
  name: '李四',
  testimony: null,
};

const defaultProps = {
  witness: mockWitness,
  onClose: jest.fn(),
  canEdit: true,
};

describe('TestimonyViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染证词查看器', () => {
    render(<TestimonyViewer {...defaultProps} />);

    expect(screen.getByText('张三 - 证词')).toBeInTheDocument();
    expect(screen.getByText(/我亲眼看到事件发生/)).toBeInTheDocument();
  });

  it('应该显示证人基本信息', () => {
    render(<TestimonyViewer {...defaultProps} />);

    expect(screen.getByText(/联系电话/)).toBeInTheDocument();
    expect(screen.getByText('13800138001')).toBeInTheDocument();
    expect(screen.getByText(/联系地址/)).toBeInTheDocument();
    expect(screen.getByText('北京市朝阳区')).toBeInTheDocument();
    expect(screen.getByText(/与当事人关系/)).toBeInTheDocument();
    expect(screen.getByText('同事')).toBeInTheDocument();
  });

  it('应该处理没有证词的情况', () => {
    render(
      <TestimonyViewer
        {...defaultProps}
        witness={mockWitnessWithoutTestimony}
      />
    );

    expect(screen.getByText('李四 - 证词')).toBeInTheDocument();
    expect(screen.getByText(/暂无证词内容/)).toBeInTheDocument();
  });

  it('应该在编辑模式下显示编辑按钮', () => {
    render(<TestimonyViewer {...defaultProps} canEdit={true} />);

    expect(screen.getByText(/编辑证词/)).toBeInTheDocument();
  });

  it('应该在只读模式下隐藏编辑按钮', () => {
    render(<TestimonyViewer {...defaultProps} canEdit={false} />);

    expect(screen.queryByText(/编辑证词/)).not.toBeInTheDocument();
  });

  it('应该显示证人状态标签', () => {
    render(<TestimonyViewer {...defaultProps} />);

    expect(screen.getByText('已确认出庭')).toBeInTheDocument();
  });

  it('应该显示创建和更新时间', () => {
    render(<TestimonyViewer {...defaultProps} />);

    expect(screen.getByText(/创建时间/)).toBeInTheDocument();
    expect(screen.getByText(/最后更新/)).toBeInTheDocument();
  });

  it('应该显示证词字符数', () => {
    render(<TestimonyViewer {...defaultProps} />);

    expect(screen.getByText(/9 字符/)).toBeInTheDocument();
  });

  it('应该显示关闭按钮', () => {
    render(<TestimonyViewer {...defaultProps} />);

    expect(screen.getByText('关闭')).toBeInTheDocument();
  });

  it('应该显示证人ID', () => {
    render(<TestimonyViewer {...defaultProps} />);

    expect(screen.getByText('证人ID: 1')).toBeInTheDocument();
  });
});
