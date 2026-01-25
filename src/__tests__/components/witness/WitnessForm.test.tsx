/**
 * 证人表单组件测试
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WitnessForm } from '@/components/witness/WitnessForm';
import { type WitnessDetail, type WitnessStatus } from '@/types/witness';

// Mock witness data
const mockWitness: WitnessDetail = {
  id: '1',
  caseId: 'case1',
  name: '张三',
  phone: '13800138001',
  address: '北京市朝阳区',
  relationship: '同事',
  testimony: '证词内容',
  courtScheduleId: 'schedule1',
  status: 'CONFIRMED' as WitnessStatus,
  metadata: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const defaultProps = {
  caseId: 'case1',
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
  canManage: true,
};

describe('WitnessForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染创建证人表单', () => {
    render(<WitnessForm {...defaultProps} />);

    expect(screen.getByText('添加证人')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入证人姓名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入联系电话')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入联系地址')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('例如：朋友、同事、亲属等')
    ).toBeInTheDocument();
  });

  it('应该渲染编辑证人表单', () => {
    render(<WitnessForm {...defaultProps} witness={mockWitness} />);

    expect(screen.getByText('编辑证人')).toBeInTheDocument();
    expect(screen.getByDisplayValue('张三')).toBeInTheDocument();
    expect(screen.getByDisplayValue('13800138001')).toBeInTheDocument();
  });

  it('应该显示必填字段验证', () => {
    render(<WitnessForm {...defaultProps} />);

    expect(screen.getByText('创建')).toBeInTheDocument();
  });

  it('应该显示证人状态选项', () => {
    render(<WitnessForm {...defaultProps} />);

    expect(screen.getByText('待联系')).toBeInTheDocument();
    expect(screen.getByText('已联系')).toBeInTheDocument();
    expect(screen.getByText('已确认出庭')).toBeInTheDocument();
    expect(screen.getByText('拒绝出庭')).toBeInTheDocument();
    expect(screen.getByText('已取消')).toBeInTheDocument();
  });

  it('应该显示证词字符计数', () => {
    render(<WitnessForm {...defaultProps} />);

    expect(screen.getByText(/字符/)).toBeInTheDocument();
  });

  it('应该在没有权限时显示权限提示', () => {
    render(<WitnessForm {...defaultProps} canManage={false} />);

    expect(screen.getByText('您没有权限管理证人信息')).toBeInTheDocument();
  });

  it('应该显示提交和取消按钮', () => {
    render(<WitnessForm {...defaultProps} />);

    expect(screen.getByText('取消')).toBeInTheDocument();
    expect(screen.getByText('创建')).toBeInTheDocument();
  });

  it('应该显示证词内容输入框', () => {
    render(<WitnessForm {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('请输入证词内容...');
    expect(textarea).toBeInTheDocument();
  });
});
