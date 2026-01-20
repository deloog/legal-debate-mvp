import {
  FollowUpTasks,
  FollowUpTasksProps,
} from '@/components/client/FollowUpTasks';
import {
  CommunicationType,
  FollowUpTask,
  FollowUpTaskPriority,
  FollowUpTaskStatus,
} from '@/types/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

describe('FollowUpTasks', () => {
  const mockCompleteTask = jest.fn().mockResolvedValue(undefined);
  const mockCancelTask = jest.fn().mockResolvedValue(undefined);
  const mockRefresh = jest.fn();

  const mockTask: FollowUpTask = {
    id: '1',
    clientId: 'c1',
    communicationId: 'comm1',
    userId: 'u1',
    type: CommunicationType.PHONE,
    clientName: '张三',
    clientPhone: '13800138000',
    clientEmail: 'zhangsan@example.com',
    summary: '跟进案件进度',
    dueDate: new Date('2024-01-15'),
    status: FollowUpTaskStatus.PENDING,
    priority: FollowUpTaskPriority.HIGH,
    notes: '',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  };

  const defaultProps: FollowUpTasksProps = {
    tasks: [mockTask],
    loading: false,
    onCompleteTask: mockCompleteTask,
    onCancelTask: mockCancelTask,
    onRefresh: mockRefresh,
    pendingCount: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // 重置confirm
    global.confirm = jest.fn(() => true) as unknown as typeof window.confirm;
  });

  afterEach(() => {
    // 恢复confirm
    global.confirm = window.confirm;
  });

  describe('基础渲染', () => {
    it('应显示任务列表', () => {
      render(<FollowUpTasks {...defaultProps} />);

      expect(screen.getByText('跟进任务')).toBeInTheDocument();
      expect(screen.getByText('待处理任务: 1')).toBeInTheDocument();
      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('跟进案件进度')).toBeInTheDocument();
    });

    it('应显示刷新按钮', () => {
      render(<FollowUpTasks {...defaultProps} />);

      expect(screen.getByText('刷新')).toBeInTheDocument();
    });

    it('应显示优先级标签', () => {
      render(<FollowUpTasks {...defaultProps} />);

      expect(screen.getByText('高优先级')).toBeInTheDocument();
    });
  });

  describe('加载状态', () => {
    it('应显示加载骨架', () => {
      render(<FollowUpTasks {...defaultProps} loading={true} />);

      // 检查骨架屏元素
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('加载时不显示任务内容', () => {
      render(<FollowUpTasks {...defaultProps} loading={true} />);

      expect(screen.queryByText('张三')).not.toBeInTheDocument();
    });
  });

  describe('空状态', () => {
    it('无任务且无待处理任务时应显示空状态', () => {
      render(<FollowUpTasks {...defaultProps} tasks={[]} pendingCount={0} />);

      expect(screen.getByText('暂无跟进任务')).toBeInTheDocument();
      expect(
        screen.getByText('跟进任务将从沟通记录自动生成')
      ).toBeInTheDocument();
    });

    it('无任务但有待处理任务时应显示已完成提示', () => {
      render(<FollowUpTasks {...defaultProps} tasks={[]} pendingCount={5} />);

      expect(screen.getByText('无待处理任务')).toBeInTheDocument();
      expect(
        screen.getByText('恭喜！所有待处理任务已完成')
      ).toBeInTheDocument();
    });
  });

  describe('任务操作', () => {
    it('应能完成任务', async () => {
      render(<FollowUpTasks {...defaultProps} />);

      const completeButton = screen.getByText('完成');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(mockCompleteTask).toHaveBeenCalledWith('1', undefined);
      });
    });

    it('应能取消任务', async () => {
      render(<FollowUpTasks {...defaultProps} />);

      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockCancelTask).toHaveBeenCalledWith('1');
      });
    });

    it('应能刷新任务列表', () => {
      render(<FollowUpTasks {...defaultProps} />);

      const refreshButton = screen.getByText('刷新');
      fireEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('应能打开备注对话框', () => {
      render(<FollowUpTasks {...defaultProps} />);

      const notesButton = screen.getByText('完成并备注');
      fireEvent.click(notesButton);

      expect(
        screen.getByPlaceholderText('请输入完成备注（可选）')
      ).toBeInTheDocument();
    });
  });

  describe('已完成任务', () => {
    const completedTask: FollowUpTask = {
      ...mockTask,
      status: FollowUpTaskStatus.COMPLETED,
      completedAt: new Date('2024-01-15'),
      notes: '已完成跟进',
    };

    it('已完成任务不应显示操作按钮', () => {
      render(<FollowUpTasks {...defaultProps} tasks={[completedTask]} />);

      expect(screen.queryByText('完成')).not.toBeInTheDocument();
      expect(screen.queryByText('取消')).not.toBeInTheDocument();
    });

    it('已完成任务应显示完成记录', () => {
      render(<FollowUpTasks {...defaultProps} tasks={[completedTask]} />);

      expect(screen.getByText('完成记录')).toBeInTheDocument();
      expect(screen.getByText('已完成跟进')).toBeInTheDocument();
    });

    it('已完成任务不应显示联系信息', () => {
      render(<FollowUpTasks {...defaultProps} tasks={[completedTask]} />);

      expect(screen.queryByText('电话:')).not.toBeInTheDocument();
      expect(screen.queryByText('邮箱:')).not.toBeInTheDocument();
    });
  });

  describe('多个任务', () => {
    const task2: FollowUpTask = {
      ...mockTask,
      id: '2',
      clientName: '李四',
      clientPhone: '13900139000',
      summary: '了解新需求',
      priority: FollowUpTaskPriority.MEDIUM,
    };

    it('应显示所有任务', () => {
      render(<FollowUpTasks {...defaultProps} tasks={[mockTask, task2]} />);

      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('李四')).toBeInTheDocument();
      expect(screen.getByText('跟进案件进度')).toBeInTheDocument();
      expect(screen.getByText('了解新需求')).toBeInTheDocument();
    });
  });

  describe('禁用状态', () => {
    it('处理中应禁用操作按钮', () => {
      render(<FollowUpTasks {...defaultProps} />);

      // 先点击完成按钮
      const completeButton = screen.getByText('完成');
      fireEvent.click(completeButton);

      // 检查按钮是否禁用（通过检查按钮文本）
      const disabledButton = screen.getByText('完成中...');
      expect(disabledButton).toBeInTheDocument();
    });
  });
});
