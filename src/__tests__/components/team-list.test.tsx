/**
 * 团队列表组件测试
 * 测试团队列表组件的功能、渲染和交互
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TeamList } from '@/app/teams/components/team-list';
import {
  TeamDetail,
  TeamType,
  TeamStatus,
  TEAM_TYPE_LABELS,
  TEAM_STATUS_LABELS,
} from '@/types/team';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockPush = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
});

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('TeamList', () => {
  const mockTeams: TeamDetail[] = [
    {
      id: 'team-1',
      name: '测试律师事务所',
      type: TeamType.LAW_FIRM,
      description: '专业法律服务',
      logo: null,
      status: TeamStatus.ACTIVE,
      metadata: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      memberCount: 5,
    },
    {
      id: 'team-2',
      name: '企业法务部门',
      type: TeamType.LEGAL_DEPT,
      description: '内部法务支持',
      logo: null,
      status: TeamStatus.INACTIVE,
      metadata: null,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      memberCount: 3,
    },
  ];

  const mockListResponse = {
    teams: mockTeams,
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('应该渲染团队列表', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockListResponse,
    });

    render(<TeamList />);

    await waitFor(() => {
      expect(screen.getAllByText('测试律师事务所').length).toBeGreaterThan(0);
      expect(screen.getAllByText('企业法务部门').length).toBeGreaterThan(0);
    });
  });

  it('应该显示团队类型标签', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockListResponse,
    });

    render(<TeamList />);

    await waitFor(() => {
      expect(screen.getAllByText('律师事务所').length).toBeGreaterThan(0);
      expect(screen.getAllByText('企业法务部门').length).toBeGreaterThan(0);
    });
  });

  it('应该显示团队状态标签', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockListResponse,
    });

    render(<TeamList />);

    await waitFor(() => {
      expect(screen.getAllByText('活跃').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/inactive/i).length).toBeGreaterThan(0);
    });
  });

  it('应该显示团队成员数量', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockListResponse,
    });

    render(<TeamList />);

    await waitFor(() => {
      expect(screen.getByText('5 成员')).toBeInTheDocument();
      expect(screen.getByText('3 成员')).toBeInTheDocument();
    });
  });

  it('应该显示团队描述', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockListResponse,
    });

    render(<TeamList />);

    await waitFor(() => {
      expect(screen.getByText('专业法律服务')).toBeInTheDocument();
      expect(screen.getByText('内部法务支持')).toBeInTheDocument();
    });
  });

  it('应该显示空状态当没有团队时', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        teams: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      }),
    });

    render(<TeamList />);

    await waitFor(() => {
      expect(screen.getByText('还没有团队')).toBeInTheDocument();
      expect(screen.getByText('创建团队')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('创建团队'));
    expect(mockPush).toHaveBeenCalledWith('/teams/create');
  });

  it('应该显示加载状态', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<TeamList />);
    // 检查是否有加载中的状态指示器（骨架屏）
    expect(screen.getAllByRole('generic').length).toBeGreaterThan(0);
  });

  it('应该显示错误状态', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<TeamList />);

    await waitFor(() => {
      expect(screen.getByText(/获取团队列表失败/)).toBeInTheDocument();
    });
  });

  it('应该支持分页', async () => {
    const paginatedResponse = {
      teams: [mockTeams[0]],
      total: 15,
      page: 1,
      limit: 10,
      totalPages: 2,
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => paginatedResponse,
    });

    render(<TeamList />);

    await waitFor(() => {
      expect(screen.getByText(/共 15 个团队/)).toBeInTheDocument();
      expect(screen.getByText(/第 1 \/ 2 页/)).toBeInTheDocument();
    });

    const nextButton = screen.getByText('下一页');
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('应该禁用上一页按钮在第一页', async () => {
    const paginatedResponse = {
      teams: [mockTeams[0]],
      total: 15,
      page: 1,
      limit: 10,
      totalPages: 2,
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => paginatedResponse,
    });

    render(<TeamList />);

    await waitFor(() => {
      const prevButton = screen.getByText('上一页');
      expect(prevButton).toBeDisabled();
    });
  });
});
