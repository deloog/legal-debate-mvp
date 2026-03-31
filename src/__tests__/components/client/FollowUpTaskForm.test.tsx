/**
 * 跟进任务表单组件测试
 * @jest-environment jsdom
 */
// @ts-nocheck

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FollowUpTaskForm } from '@/components/client/FollowUpTaskForm';

// Mock fetch
(global as any).fetch = jest.fn() as jest.Mock;

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { toast } from 'sonner';

describe('FollowUpTaskForm 组件', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();
  const clientId = 'client-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'task-1' } }),
    });
  });

  describe('表单渲染', () => {
    it('应该渲染表单标题', () => {
      render(
        <FollowUpTaskForm
          clientId={clientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('任务摘要')).toBeInTheDocument();
      expect(screen.getByText('任务类型')).toBeInTheDocument();
      expect(screen.getByText('优先级')).toBeInTheDocument();
      expect(screen.getByText('到期时间')).toBeInTheDocument();
    });

    it('应该渲染提交和取消按钮', () => {
      render(
        <FollowUpTaskForm
          clientId={clientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('取消')).toBeInTheDocument();
      expect(screen.getByText('保存')).toBeInTheDocument();
    });
  });

  describe('表单验证', () => {
    it('摘要不能为空', async () => {
      render(
        <FollowUpTaskForm
          clientId={clientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByText(/保存|更新/);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('请输入任务摘要')).toBeInTheDocument();
      });
    });

    it('摘要长度不能少于2个字符', async () => {
      render(
        <FollowUpTaskForm
          clientId={clientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const summaryInput = screen.getByPlaceholderText('请输入任务摘要');
      fireEvent.change(summaryInput, { target: { value: 'a' } });

      const submitButton = screen.getByText(/保存|更新/);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('摘要至少需要2个字符')).toBeInTheDocument();
      });
    });

    it('到期时间不能为空', async () => {
      render(
        <FollowUpTaskForm
          clientId={clientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const summaryInput = screen.getByPlaceholderText('请输入任务摘要');
      fireEvent.change(summaryInput, { target: { value: '测试任务' } });

      const submitButton = screen.getByText(/保存|更新/);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('请选择到期时间')).toBeInTheDocument();
      });
    });
  });

  describe('表单提交', () => {
    it('成功提交应该调用 onSuccess', async () => {
      render(
        <FollowUpTaskForm
          clientId={clientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // 填写表单
      const summaryInput = screen.getByPlaceholderText('请输入任务摘要');
      fireEvent.change(summaryInput, { target: { value: '回访客户' } });

      const dueDateInput = screen.getByLabelText(/到期时间/);
      fireEvent.change(dueDateInput, { target: { value: '2024-12-31T10:00' } });

      const submitButton = screen.getByText(/保存|更新/);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/follow-up-tasks',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String),
          })
        );
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('任务创建成功');
      });
    });

    it('提交失败应该显示错误', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: '创建失败' }),
      });

      render(
        <FollowUpTaskForm
          clientId={clientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const summaryInput = screen.getByPlaceholderText('请输入任务摘要');
      fireEvent.change(summaryInput, { target: { value: '回访客户' } });

      const dueDateInput = screen.getByLabelText(/到期时间/);
      fireEvent.change(dueDateInput, { target: { value: '2024-12-31T10:00' } });

      const submitButton = screen.getByText(/保存|更新/);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('创建失败', {
          description: '创建失败',
        });
      });
    });
  });

  describe('取消操作', () => {
    it('点击取消应该调用 onCancel', () => {
      render(
        <FollowUpTaskForm
          clientId={clientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('编辑模式', () => {
    const editingTask = {
      id: 'task-1',
      summary: '现有任务',
      type: 'EMAIL',
      priority: 'HIGH',
      dueDate: '2024-12-31T10:00:00Z',
      notes: '备注信息',
    };

    it('应该显示编辑标题', () => {
      render(
        <FollowUpTaskForm
          clientId={clientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
          editingTask={editingTask}
        />
      );

      expect(screen.getByDisplayValue('现有任务')).toBeInTheDocument();
      expect(screen.getByDisplayValue('备注信息')).toBeInTheDocument();
    });

    it('编辑应该调用 PUT 接口', async () => {
      render(
        <FollowUpTaskForm
          clientId={clientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
          editingTask={editingTask}
        />
      );

      const submitButton = screen.getByText(/保存|更新/);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/follow-up-tasks/task-1',
          expect.objectContaining({
            method: 'PUT',
          })
        );
        expect(toast.success).toHaveBeenCalledWith('任务更新成功');
      });
    });
  });
});
