/**
 * TaskForm 组件测试
 * 测试任务表单的渲染和基本功能
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TaskForm } from '@/components/task/TaskForm';
import { TaskDetail, TaskStatus, TaskPriority } from '@/types/task';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}));

const mockTask: TaskDetail = {
  id: 'task-1',
  title: '测试任务',
  description: '这是一个测试任务描述',
  status: TaskStatus.IN_PROGRESS,
  priority: TaskPriority.HIGH,
  caseId: 'case-1',
  assignedTo: 'user-1',
  dueDate: new Date('2026-01-31'),
  completedAt: null,
  tags: [],
  estimatedHours: 8,
  actualHours: null,
  createdBy: 'user-1',
  deletedAt: null,
  metadata: null,
  createdAt: new Date('2026-01-20'),
  updatedAt: new Date('2026-01-20'),
};

describe('TaskForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockFetchSuccess = () => {
    return jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-task-id' }),
    } as never);
  };

  describe('渲染测试', () => {
    it('应该渲染创建任务表单', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      expect(screen.getByText(/任务标题/)).toBeInTheDocument();
      expect(screen.getByText(/任务描述/)).toBeInTheDocument();
      expect(screen.getByText(/状态/)).toBeInTheDocument();
      expect(screen.getByText(/优先级/)).toBeInTheDocument();
      expect(screen.getByText(/关联案件/)).toBeInTheDocument();
      expect(screen.getByText(/分配给/)).toBeInTheDocument();
      expect(screen.getByText(/截止日期/)).toBeInTheDocument();
      expect(screen.getByText(/预估工时/)).toBeInTheDocument();
      expect(screen.getByText('创建')).toBeInTheDocument();
      expect(screen.getByText('取消')).toBeInTheDocument();
    });

    it('应该渲染编辑任务表单', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(
        <TaskForm task={mockTask} onCancel={onCancel} onSuccess={onSuccess} />
      );

      expect(screen.getByDisplayValue('测试任务')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('这是一个测试任务描述')
      ).toBeInTheDocument();
      expect(screen.getByText('保存')).toBeInTheDocument();
      expect(screen.queryByText('创建')).not.toBeInTheDocument();
    });

    it('应该显示必填标记', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const requiredLabels = screen.getAllByText('*');
      expect(requiredLabels.length).toBe(3); // 标题、状态和优先级是必填的
    });
  });

  describe('表单验证测试', () => {
    it('应该显示标题不能为空的错误', async () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('任务标题不能为空')).toBeInTheDocument();
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('应该显示标题长度超过限制的错误', async () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const titleInput = screen.getByPlaceholderText('请输入任务标题');
      fireEvent.change(titleInput, {
        target: { value: 'a'.repeat(201) },
      });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('任务标题不能超过200个字符')
        ).toBeInTheDocument();
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('应该显示描述长度超过限制的错误', async () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const titleInput = screen.getByPlaceholderText('请输入任务标题');
      fireEvent.change(titleInput, { target: { value: '测试标题' } });

      const descriptionInput =
        screen.getByPlaceholderText('请输入任务描述（可选）');
      fireEvent.change(descriptionInput, {
        target: { value: 'a'.repeat(2001) },
      });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('任务描述不能超过2000个字符')
        ).toBeInTheDocument();
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('表单提交测试', () => {
    it('应该成功创建任务', async () => {
      const mockFetch = mockFetchSuccess();
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const titleInput = screen.getByPlaceholderText('请输入任务标题');
      fireEvent.change(titleInput, { target: { value: '新任务' } });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/tasks',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('新任务'),
          })
        );
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('应该成功更新任务', async () => {
      const mockFetch = mockFetchSuccess();
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(
        <TaskForm task={mockTask} onCancel={onCancel} onSuccess={onSuccess} />
      );

      const submitButton = screen.getByText('保存');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/tasks/${mockTask.id}`,
          expect.objectContaining({
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('应该在创建任务时显示保存中状态', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ id: 'new-task-id' }),
              } as never);
            }, 100);
          })
      );
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const titleInput = screen.getByPlaceholderText('请输入任务标题');
      fireEvent.change(titleInput, { target: { value: '新任务' } });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      expect(screen.getByText('保存中...')).toBeInTheDocument();
    });

    it('应该处理创建任务失败', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        json: async () => ({ message: '服务器错误' }),
      } as never);
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const titleInput = screen.getByPlaceholderText('请输入任务标题');
      fireEvent.change(titleInput, { target: { value: '新任务' } });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('服务器错误')).toBeInTheDocument();
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('表单输入测试', () => {
    it('应该显示标题字符计数', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const titleInput = screen.getByPlaceholderText('请输入任务标题');
      fireEvent.change(titleInput, { target: { value: '测试' } });

      // 字符计数可能是分开的元素，使用getAllByText找到所有匹配的元素
      const allMatches = screen.getAllByText(/\/200/);
      expect(allMatches.length).toBeGreaterThan(0);
    });

    it('应该显示描述字符计数', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const descriptionInput =
        screen.getByPlaceholderText('请输入任务描述（可选）');
      fireEvent.change(descriptionInput, { target: { value: '测试描述' } });

      expect(screen.getByText('4/2000')).toBeInTheDocument();
    });

    it('应该更新状态选择', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const statusSelect = screen.getByRole('combobox', {
        name: /状态/,
      });
      expect(statusSelect).toHaveValue('TODO');

      fireEvent.change(statusSelect, {
        target: { value: TaskStatus.IN_PROGRESS },
      });
      expect(statusSelect).toHaveValue(TaskStatus.IN_PROGRESS);
    });

    it('应该更新优先级选择', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const prioritySelect = screen.getByRole('combobox', {
        name: /优先级/,
      });
      expect(prioritySelect).toHaveValue('MEDIUM');

      fireEvent.change(prioritySelect, {
        target: { value: TaskPriority.HIGH },
      });
      expect(prioritySelect).toHaveValue(TaskPriority.HIGH);
    });

    it('应该更新案件ID', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const caseIdInput = screen.getByPlaceholderText('请输入案件ID（可选）');
      fireEvent.change(caseIdInput, { target: { value: 'case-123' } });

      expect(caseIdInput).toHaveValue('case-123');
    });

    it('应该更新分配用户ID', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const assignedToInput =
        screen.getByPlaceholderText('请输入用户ID（可选）');
      fireEvent.change(assignedToInput, { target: { value: 'user-123' } });

      expect(assignedToInput).toHaveValue('user-123');
    });

    it('应该更新截止日期', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const dueDateInput = screen.getByLabelText(/截止日期/);
      fireEvent.change(dueDateInput, { target: { value: '2026-01-31' } });

      expect(dueDateInput).toHaveValue('2026-01-31');
    });

    it('应该更新预估工时', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const estimatedHoursInput = screen.getByLabelText(/预估工时/);
      fireEvent.change(estimatedHoursInput, { target: { value: 8.5 } });

      expect(estimatedHoursInput).toHaveValue(8.5);
    });
  });

  describe('取消按钮测试', () => {
    it('应该调用取消回调', () => {
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空描述', async () => {
      const mockFetch = mockFetchSuccess();
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const titleInput = screen.getByPlaceholderText('请输入任务标题');
      fireEvent.change(titleInput, { target: { value: '测试任务' } });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('应该处理空案件ID', async () => {
      const mockFetch = mockFetchSuccess();
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const titleInput = screen.getByPlaceholderText('请输入任务标题');
      fireEvent.change(titleInput, { target: { value: '测试任务' } });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('应该处理无效的预估工时', async () => {
      const mockFetch = mockFetchSuccess();
      const onCancel = jest.fn();
      const onSuccess = jest.fn();

      render(<TaskForm onCancel={onCancel} onSuccess={onSuccess} />);

      const titleInput = screen.getByPlaceholderText('请输入任务标题');
      fireEvent.change(titleInput, { target: { value: '测试任务' } });

      const estimatedHoursInput = screen.getByLabelText(/预估工时/);
      fireEvent.change(estimatedHoursInput, { target: { value: 'invalid' } });

      const submitButton = screen.getByText('创建');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });
});
