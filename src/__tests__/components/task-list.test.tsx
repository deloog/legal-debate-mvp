/**
 * TaskList 组件测试
 * 测试任务列表的渲染和基本功能
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TaskList } from '@/app/tasks/components/task-list';
import { TaskDetail, TaskStatus, TaskPriority } from '@/types/task';

// Mock window.confirm
const mockConfirm = jest.fn();
Object.defineProperty(window, 'confirm', {
  configurable: true,
  value: mockConfirm,
});

const mockTasks: TaskDetail[] = [
  {
    id: 'task-1',
    title: '任务1',
    description: '任务描述1',
    status: TaskStatus.TODO,
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
    case: {
      id: 'case-1',
      title: '案件1',
      type: 'test',
      status: 'active',
    },
    assignedUser: {
      id: 'user-1',
      name: '用户1',
      email: 'user1@test.com',
      avatar: null,
    },
    createdByUser: {
      id: 'user-1',
      name: '用户1',
      email: 'user1@test.com',
      avatar: null,
    },
  },
  {
    id: 'task-2',
    title: '任务2',
    description: '任务描述2',
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.MEDIUM,
    caseId: null,
    assignedTo: 'user-2',
    dueDate: new Date('2026-02-01'),
    completedAt: null,
    tags: [],
    estimatedHours: 16,
    actualHours: null,
    createdBy: 'user-1',
    deletedAt: null,
    metadata: null,
    createdAt: new Date('2026-01-21'),
    updatedAt: new Date('2026-01-21'),
    case: null,
    assignedUser: {
      id: 'user-2',
      name: '用户2',
      email: 'user2@test.com',
      avatar: null,
    },
    createdByUser: {
      id: 'user-1',
      name: '用户1',
      email: 'user1@test.com',
      avatar: null,
    },
  },
  {
    id: 'task-3',
    title: '任务3',
    description: '任务描述3',
    status: TaskStatus.COMPLETED,
    priority: TaskPriority.LOW,
    caseId: null,
    assignedTo: null,
    dueDate: null,
    completedAt: new Date('2026-01-22'),
    tags: [],
    estimatedHours: null,
    actualHours: null,
    createdBy: 'user-1',
    deletedAt: null,
    metadata: null,
    createdAt: new Date('2026-01-19'),
    updatedAt: new Date('2026-01-22'),
    case: null,
    assignedUser: null,
    createdByUser: {
      id: 'user-1',
      name: '用户1',
      email: 'user1@test.com',
      avatar: null,
    },
  },
];

describe('TaskList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    mockConfirm.mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockFetchResponse = (data: unknown) => {
    return jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => data,
    } as never);
  };

  describe('渲染测试', () => {
    it('应该渲染任务列表', async () => {
      mockFetchResponse({
        tasks: mockTasks,
        total: 3,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      render(<TaskList />);

      await waitFor(() => {
        expect(screen.getByText('任务1')).toBeInTheDocument();
      });
      expect(screen.getByText('任务2')).toBeInTheDocument();
      expect(screen.getByText('任务3')).toBeInTheDocument();
    });

    it('应该显示搜索框和筛选器', async () => {
      mockFetchResponse({
        tasks: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      render(<TaskList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('搜索任务标题或描述...')
        ).toBeInTheDocument();
      });
      expect(screen.getByText('所有状态')).toBeInTheDocument();
      expect(screen.getByText('所有优先级')).toBeInTheDocument();
      expect(screen.getByText('创建任务')).toBeInTheDocument();
    });

    it('应该显示空状态', async () => {
      mockFetchResponse({
        tasks: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      render(<TaskList />);

      await waitFor(() => {
        expect(
          screen.getByText('暂无任务，点击上方按钮创建新任务')
        ).toBeInTheDocument();
      });
    });
  });

  describe('任务信息显示测试', () => {
    it('应该显示任务详情', async () => {
      mockFetchResponse({
        tasks: [mockTasks[0]],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      render(<TaskList />);

      await waitFor(() => {
        expect(screen.getByText('任务1')).toBeInTheDocument();
      });
      expect(screen.getByText('任务描述1')).toBeInTheDocument();
      expect(screen.getByText('案件1')).toBeInTheDocument();
      expect(screen.getByText('用户1')).toBeInTheDocument();
      expect(screen.getByText('2026/1/31')).toBeInTheDocument();
      // 验证预估工时相关文本存在
      const hourElements = screen.getAllByText(/小时/);
      expect(hourElements.length).toBeGreaterThan(0);
    });
  });

  describe('交互测试', () => {
    it('应该有编辑按钮', async () => {
      mockFetchResponse({
        tasks: [mockTasks[0]],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      render(<TaskList />);

      await waitFor(() => {
        expect(screen.getByText('编辑')).toBeInTheDocument();
      });
    });

    it('应该有删除按钮', async () => {
      mockFetchResponse({
        tasks: [mockTasks[0]],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      render(<TaskList />);

      await waitFor(() => {
        expect(screen.getByText('删除')).toBeInTheDocument();
      });
    });

    it('应该有完成按钮', async () => {
      mockFetchResponse({
        tasks: [mockTasks[0]],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      render(<TaskList />);

      await waitFor(() => {
        expect(screen.getByText('完成')).toBeInTheDocument();
      });
    });
  });
});
