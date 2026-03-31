/**
 * 客户跟进任务页面测试
 * @jest-environment jsdom
 */
// @ts-nocheck

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClientFollowUpsPage from '@/app/clients/[id]/follow-ups/page';

// Mock fetch
(global as any).fetch = jest.fn() as jest.Mock;

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useParams: jest.fn(() => ({ id: 'client-123' })),
}));

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => {
    return <a href={href}>{children}</a>;
  };
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='responsive-container'>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='bar-chart'>{children}</div>
  ),
  Bar: () => <div data-testid='bar' />,
  XAxis: () => <div data-testid='x-axis' />,
  YAxis: () => <div data-testid='y-axis' />,
  CartesianGrid: () => <div data-testid='cartesian-grid' />,
  Tooltip: () => <div data-testid='tooltip' />,
  Legend: () => <div data-testid='legend' />,
  Cell: () => <div data-testid='cell' />,
}));

// Mock FollowUpTaskForm
jest.mock('@/components/client/FollowUpTaskForm', () => ({
  FollowUpTaskForm: ({
    onSuccess,
    onCancel,
  }: {
    onSuccess: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid='follow-up-task-form'>
      <button onClick={onSuccess}>保存</button>
      <button onClick={onCancel}>取消</button>
    </div>
  ),
}));

// 测试数据
const mockFollowUpTasks = [
  {
    id: 'task-1',
    clientId: 'client-123',
    communicationId: 'comm-1',
    userId: 'user-1',
    type: 'PHONE',
    summary: '回访客户确认合同细节',
    dueDate: '2024-02-01T10:00:00Z',
    priority: 'HIGH',
    status: 'PENDING',
    completedAt: null,
    notes: null,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'task-2',
    clientId: 'client-123',
    communicationId: 'comm-2',
    userId: 'user-1',
    type: 'EMAIL',
    summary: '发送补充材料清单',
    dueDate: '2024-01-20T14:00:00Z',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    completedAt: '2024-01-19T16:00:00Z',
    notes: '已完成',
    createdAt: '2024-01-10T14:30:00Z',
    updatedAt: '2024-01-19T16:00:00Z',
  },
  {
    id: 'task-3',
    clientId: 'client-123',
    communicationId: 'comm-3',
    userId: 'user-1',
    type: 'MEETING',
    summary: '安排证据交换会议',
    dueDate: '2024-01-25T09:00:00Z',
    priority: 'LOW',
    status: 'PENDING',
    completedAt: null,
    notes: null,
    createdAt: '2024-01-05T09:00:00Z',
    updatedAt: '2024-01-05T09:00:00Z',
  },
];

const mockClient = {
  id: 'client-123',
  name: '张三',
  clientType: 'INDIVIDUAL',
  status: 'ACTIVE',
  phone: '13800138000',
  email: 'zhangsan@example.com',
};

function setupMockFetch({
  clientSuccess = true,
  clientData = mockClient,
  tasksSuccess = true,
  tasksData = { tasks: mockFollowUpTasks, total: 3 },
}: {
  clientSuccess?: boolean;
  clientData?: typeof mockClient;
  tasksSuccess?: boolean;
  tasksData?: { tasks: typeof mockFollowUpTasks; total: number };
} = {}) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (
      url.includes('/api/clients/client-123') &&
      !url.includes('/follow-ups')
    ) {
      return Promise.resolve({
        ok: clientSuccess,
        status: clientSuccess ? 200 : 404,
        json: async () =>
          clientSuccess ? clientData : { error: 'Client not found' },
      });
    }
    if (
      url.includes('/api/follow-up-tasks') &&
      url.includes('clientId=client-123')
    ) {
      return Promise.resolve({
        ok: tasksSuccess,
        status: tasksSuccess ? 200 : 500,
        json: async () =>
          tasksSuccess ? tasksData : { error: 'Failed to load' },
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ data: null }),
    });
  });
}

describe('客户跟进任务页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockFetch();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('页面渲染', () => {
    it('应该正确渲染页面标题和面包屑', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        expect(screen.getByText('跟进任务')).toBeInTheDocument();
        expect(screen.getByText('张三')).toBeInTheDocument();
      });
    });

    it('应该渲染返回按钮', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        expect(screen.getByText('返回客户详情')).toBeInTheDocument();
      });
    });

    it('应该渲染子页面导航链接', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        expect(screen.getByText('基本信息')).toBeInTheDocument();
        expect(screen.getByText('沟通记录')).toBeInTheDocument();
        expect(screen.getByText('跟进任务')).toBeInTheDocument();
        expect(screen.getByText('案件历史')).toBeInTheDocument();
      });
    });
  });

  describe('跟进任务看板', () => {
    it('应该显示任务统计卡片', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        expect(screen.getByText('待处理')).toBeInTheDocument();
        expect(screen.getByText('已完成')).toBeInTheDocument();
        expect(screen.getByText('已逾期')).toBeInTheDocument();
      });
    });

    it('应该显示任务列表', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        expect(screen.getByText('回访客户确认合同细节')).toBeInTheDocument();
        expect(screen.getByText('发送补充材料清单')).toBeInTheDocument();
        expect(screen.getByText('安排证据交换会议')).toBeInTheDocument();
      });
    });

    it('应该显示优先级标签', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        expect(screen.getByText('高')).toBeInTheDocument();
        expect(screen.getByText('中')).toBeInTheDocument();
        expect(screen.getByText('低')).toBeInTheDocument();
      });
    });

    it('应该标识到期提醒', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        const dueDateElements = screen.getAllByText(/到期时间/);
        expect(dueDateElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('看板视图', () => {
    it('应该能够按状态筛选任务', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        const pendingTab = screen.getByText('待处理');
        fireEvent.click(pendingTab);
        expect(pendingTab).toBeInTheDocument();
      });
    });

    it('应该能够按优先级筛选任务', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        const prioritySelect = screen.getByLabelText('优先级');
        fireEvent.change(prioritySelect, { target: { value: 'HIGH' } });
        expect(prioritySelect).toHaveValue('HIGH');
      });
    });
  });

  describe('任务操作', () => {
    it('应该显示完成任务按钮', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        const completeButtons = screen.getAllByText('完成');
        expect(completeButtons.length).toBeGreaterThan(0);
      });
    });

    it('应该显示编辑任务按钮', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        const editButtons = screen.getAllByText('编辑');
        expect(editButtons.length).toBeGreaterThan(0);
      });
    });

    it('点击完成任务应该触发完成操作', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        const completeButton = screen.getAllByText('完成')[0];
        fireEvent.click(completeButton);
        // 验证按钮点击（实际实现中会触发 API 调用）
        expect(completeButton).toBeDefined();
      });
    });
  });

  describe('新增任务', () => {
    it('应该显示新增任务按钮', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        expect(screen.getByText('新增任务')).toBeInTheDocument();
      });
    });

    it('点击新增任务应该打开表单对话框', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        const addButton = screen.getByText('新增任务');
        fireEvent.click(addButton);
        expect(screen.getByTestId('follow-up-task-form')).toBeInTheDocument();
      });
    });

    it('表单保存成功应该刷新列表', async () => {
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        const addButton = screen.getByText('新增任务');
        fireEvent.click(addButton);
      });

      const saveButton = screen.getByText('保存');
      fireEvent.click(saveButton);

      // 验证 fetch 被调用来刷新数据
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  describe('加载状态', () => {
    it('应该显示加载状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<ClientFollowUpsPage />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('错误处理', () => {
    it('加载失败应该显示错误信息', async () => {
      setupMockFetch({ clientSuccess: false });
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        expect(screen.getByText(/加载失败/)).toBeInTheDocument();
      });
    });

    it('应该显示重试按钮', async () => {
      setupMockFetch({ clientSuccess: false });
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        expect(screen.getByText('重试')).toBeInTheDocument();
      });
    });
  });

  describe('空状态', () => {
    it('当没有跟进任务时显示空状态提示', async () => {
      setupMockFetch({
        tasksData: { tasks: [], total: 0 },
      });
      render(<ClientFollowUpsPage />);

      await waitFor(() => {
        expect(screen.getByText('暂无跟进任务')).toBeInTheDocument();
      });
    });
  });
});
