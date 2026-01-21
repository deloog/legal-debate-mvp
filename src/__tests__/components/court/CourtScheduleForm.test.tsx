/**
 * CourtScheduleForm 组件测试
 * 测试法庭日程表单组件的渲染、表单提交和验证
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourtScheduleForm } from '../../../components/court/CourtScheduleForm';
import {
  CourtScheduleDetail,
  CourtScheduleType,
} from '../../../types/court-schedule';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('CourtScheduleForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  describe('基础渲染', () => {
    it('应该正确渲染创建日程表单', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cases: [] }),
      } as Response);

      render(
        <CourtScheduleForm onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      await waitFor(() => {
        expect(screen.getByText('创建日程')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/关联案件/)).toBeInTheDocument();
      expect(screen.getByLabelText(/日程标题/)).toBeInTheDocument();
      expect(screen.getByLabelText(/开始时间/)).toBeInTheDocument();
      expect(screen.getByLabelText(/结束时间/)).toBeInTheDocument();
    });

    it('应该正确渲染编辑日程表单', async () => {
      const mockSchedule: CourtScheduleDetail = {
        id: '1',
        caseId: 'case1',
        title: '张三诉李四案',
        type: 'TRIAL' as CourtScheduleType,
        startTime: new Date('2026-01-15T09:00:00.000Z'),
        endTime: new Date('2026-01-15T11:00:00.000Z'),
        location: '第一法庭',
        judge: '王法官',
        notes: '备注信息',
        status: 'SCHEDULED',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cases: [] }),
      } as Response);

      render(
        <CourtScheduleForm
          schedule={mockSchedule}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('编辑日程')).toBeInTheDocument();
        expect(screen.getByDisplayValue('张三诉李四案')).toBeInTheDocument();
      });
    });

    it('应该加载案件列表', async () => {
      const mockCases = [
        { id: 'case1', title: '张三诉李四案' },
        { id: 'case2', title: '王五诉赵六案' },
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cases: mockCases }),
      } as Response);

      render(
        <CourtScheduleForm onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      await waitFor(() => {
        expect(screen.getByText('张三诉李四案')).toBeInTheDocument();
        expect(screen.getByText('王五诉赵六案')).toBeInTheDocument();
      });
    });
  });

  describe('表单交互', () => {
    it('应该允许用户输入表单数据', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cases: [] }),
      } as Response);

      render(
        <CourtScheduleForm onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      await waitFor(() => {
        expect(screen.getByText('创建日程')).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/日程标题/);
      await userEvent.type(titleInput, '张三诉李四案开庭');

      expect(screen.getByDisplayValue('张三诉李四案开庭')).toBeInTheDocument();
    });

    it('应该显示所有日程类型选项', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cases: [] }),
      } as Response);

      render(
        <CourtScheduleForm onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      await waitFor(() => {
        expect(screen.getByText('创建日程')).toBeInTheDocument();
      });

      const typeSelect = screen.getByLabelText(/日程类型/);
      await userEvent.click(typeSelect);

      expect(screen.getByText('开庭')).toBeInTheDocument();
      expect(screen.getByText('调解')).toBeInTheDocument();
      expect(screen.getByText('仲裁')).toBeInTheDocument();
      expect(screen.getByText('会谈')).toBeInTheDocument();
    });
  });

  describe('表单提交', () => {
    it('应该成功创建日程', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cases: [{ id: 'case1', title: '测试案件' }] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conflicts: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1' }),
        } as Response);

      render(
        <CourtScheduleForm onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      await waitFor(() => {
        expect(screen.getByText('创建日程')).toBeInTheDocument();
        expect(screen.getByText('测试案件')).toBeInTheDocument();
      });

      const caseIdSelect = screen.getByLabelText(/关联案件/);
      await userEvent.selectOptions(caseIdSelect, 'case1');

      const titleInput = screen.getByLabelText(/日程标题/);
      await userEvent.type(titleInput, '张三诉李四案开庭');

      const typeSelect = screen.getByLabelText(/日程类型/);
      await userEvent.selectOptions(typeSelect, 'TRIAL');

      const startDateInput = screen.getByLabelText(/开始时间/);
      await userEvent.type(startDateInput, '2026-01-15T09:00');

      const endDateInput = screen.getByLabelText(/结束时间/);
      await userEvent.type(endDateInput, '2026-01-15T11:00');

      const locationInput = screen.getByLabelText(/地点/);
      await userEvent.type(locationInput, '第一法庭');

      const submitButton = screen.getByText('创建');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('应该成功更新日程', async () => {
      const mockSchedule: CourtScheduleDetail = {
        id: '1',
        caseId: 'case1',
        title: '张三诉李四案',
        type: 'TRIAL' as CourtScheduleType,
        startTime: new Date('2026-01-15T09:00:00.000Z'),
        endTime: new Date('2026-01-15T11:00:00.000Z'),
        location: '第一法庭',
        judge: '王法官',
        notes: '备注信息',
        status: 'SCHEDULED',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cases: [{ id: 'case1', title: '测试案件' }] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conflicts: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1' }),
        } as Response);

      render(
        <CourtScheduleForm
          schedule={mockSchedule}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('编辑日程')).toBeInTheDocument();
      });

      const submitButton = screen.getByText('更新');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('应该显示冲突警告', async () => {
      const mockConflicts = [
        {
          id: '2',
          caseId: 'case1',
          title: '王五诉赵六案',
          type: 'TRIAL',
          startTime: '2026-01-15T10:00:00.000Z',
          endTime: '2026-01-15T12:00:00.000Z',
          location: '第一法庭',
          status: 'SCHEDULED',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cases: [{ id: 'case1', title: '测试案件' }] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conflicts: mockConflicts }),
        } as Response);

      render(
        <CourtScheduleForm onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      await waitFor(() => {
        expect(screen.getByText('创建日程')).toBeInTheDocument();
        expect(screen.getByText('测试案件')).toBeInTheDocument();
      });

      const caseIdSelect = screen.getByLabelText(/关联案件/);
      await userEvent.selectOptions(caseIdSelect, 'case1');

      const titleInput = screen.getByLabelText(/日程标题/);
      await userEvent.type(titleInput, '张三诉李四案开庭');

      const typeSelect = screen.getByLabelText(/日程类型/);
      await userEvent.selectOptions(typeSelect, 'TRIAL');

      const startDateInput = screen.getByLabelText(/开始时间/);
      await userEvent.type(startDateInput, '2026-01-15T09:00');

      const endDateInput = screen.getByLabelText(/结束时间/);
      await userEvent.type(endDateInput, '2026-01-15T11:00');

      const locationInput = screen.getByLabelText(/地点/);
      await userEvent.type(locationInput, '第一法庭');

      const submitButton = screen.getByText('创建');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('检测到日程冲突，请确认后继续')
        ).toBeInTheDocument();
        expect(screen.getByText(/王五诉赵六案/)).toBeInTheDocument();
      });
    });

    it('应该显示提交错误', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cases: [{ id: 'case1', title: '测试案件' }] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conflicts: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: '创建失败' }),
        } as Response);

      render(
        <CourtScheduleForm onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      await waitFor(() => {
        expect(screen.getByText('创建日程')).toBeInTheDocument();
        expect(screen.getByText('测试案件')).toBeInTheDocument();
      });

      const caseIdSelect = screen.getByLabelText(/关联案件/);
      await userEvent.selectOptions(caseIdSelect, 'case1');

      const titleInput = screen.getByLabelText(/日程标题/);
      await userEvent.type(titleInput, '张三诉李四案开庭');

      const typeSelect = screen.getByLabelText(/日程类型/);
      await userEvent.selectOptions(typeSelect, 'TRIAL');

      const startDateInput = screen.getByLabelText(/开始时间/);
      await userEvent.type(startDateInput, '2026-01-15T09:00');

      const endDateInput = screen.getByLabelText(/结束时间/);
      await userEvent.type(endDateInput, '2026-01-15T11:00');

      const locationInput = screen.getByLabelText(/地点/);
      await userEvent.type(locationInput, '第一法庭');

      const submitButton = screen.getByText('创建');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('创建失败')).toBeInTheDocument();
      });
    });
  });

  describe('取消操作', () => {
    it('应该取消并关闭表单', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cases: [] }),
      } as Response);

      render(
        <CourtScheduleForm onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      await waitFor(() => {
        expect(screen.getByText('创建日程')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('取消');
      await userEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('应该通过关闭按钮取消', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cases: [] }),
      } as Response);

      render(
        <CourtScheduleForm onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      await waitFor(() => {
        expect(screen.getByText('创建日程')).toBeInTheDocument();
      });

      const closeButtons = screen.getAllByText('✕');
      await userEvent.click(closeButtons[0]);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
