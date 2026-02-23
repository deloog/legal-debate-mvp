/**
 * TaskForm 组件测试
 * 测试任务表单的创建、编辑、验证和提交功能
 */

import { render, screen, _fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { TaskForm } from '@/components/task/TaskForm';
import { TaskDetail, TaskStatus, TaskPriority } from '@/types/task';

// Mock router
jest.mock('next/navigation', () => ({
  useRouter: () => ({}),
}));

describe('TaskForm', () => {
  const defaultProps = {
    onCancel: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('渲染测试', () => {
    it('应该渲染创建任务表单', () => {
      render(<TaskForm {...defaultProps} />);

      expect(screen.getByLabelText(/任务标题/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/任务描述/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/状态/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/优先级/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/关联案件/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/分配给/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/截止日期/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/预估工时/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '创建' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    });

    it('应该渲染编辑任务表单', () => {
      const task: TaskDetail = {
        id: 'task-1',
        title: '测试任务',
        description: '任务描述',
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      render(<TaskForm {...defaultProps} task={task} />);

      expect(screen.getByDisplayValue('测试任务')).toBeInTheDocument();
      expect(screen.getByDisplayValue('任务描述')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
    });
  });

  describe('字段输入测试', () => {
    it('应该允许输入任务描述', async () => {
      const user = userEvent.setup();
      render(<TaskForm {...defaultProps} />);

      const descriptionInput = screen.getByLabelText(/任务描述/i);
      await user.type(descriptionInput, '这是任务描述');

      expect(descriptionInput).toHaveValue('这是任务描述');
    });

    it('应该允许选择状态', async () => {
      const user = userEvent.setup();
      render(<TaskForm {...defaultProps} />);

      const statusSelect = screen.getByLabelText(/状态/i);
      await user.selectOptions(statusSelect, TaskStatus.IN_PROGRESS);

      expect(statusSelect).toHaveValue(TaskStatus.IN_PROGRESS);
    });

    it('应该允许选择优先级', async () => {
      const user = userEvent.setup();
      render(<TaskForm {...defaultProps} />);

      const prioritySelect = screen.getByLabelText(/优先级/i);
      await user.selectOptions(prioritySelect, TaskPriority.HIGH);

      expect(prioritySelect).toHaveValue(TaskPriority.HIGH);
    });

    it('应该允许输入关联案件ID', async () => {
      const user = userEvent.setup();
      render(<TaskForm {...defaultProps} />);

      const caseIdInput = screen.getByLabelText(/关联案件/i);
      await user.type(caseIdInput, 'case-123');

      expect(caseIdInput).toHaveValue('case-123');
    });

    it('应该允许输入分配用户ID', async () => {
      const user = userEvent.setup();
      render(<TaskForm {...defaultProps} />);

      const assignedToInput = screen.getByLabelText(/分配给/i);
      await user.type(assignedToInput, 'user-123');

      expect(assignedToInput).toHaveValue('user-123');
    });

    it('应该允许选择截止日期', async () => {
      const user = userEvent.setup();
      render(<TaskForm {...defaultProps} />);

      const dueDateInput = screen.getByLabelText(/截止日期/i);
      const date = '2026-01-31';
      await user.type(dueDateInput, date);

      expect(dueDateInput).toHaveValue(date);
    });

    it('应该允许输入预估工时', async () => {
      const user = userEvent.setup();
      render(<TaskForm {...defaultProps} />);

      const estimatedHoursInput = screen.getByLabelText(/预估工时/i);
      await user.type(estimatedHoursInput, '8');

      expect(estimatedHoursInput).toHaveValue(8);
    });
  });

  describe('交互测试', () => {
    it('应该调用取消回调', async () => {
      const user = userEvent.setup();
      render(<TaskForm {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: '取消' });
      await user.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });
});
