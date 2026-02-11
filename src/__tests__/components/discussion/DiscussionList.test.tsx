/**
 * DiscussionList 组件测试
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscussionList } from '@/components/discussion/DiscussionList';
import {
  createTestDiscussion,
  createTestDiscussions,
  createTestProps,
} from '../discussion/test-utils';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ChevronLeft: () => <div data-testid='chevron-left-icon'>Left</div>,
  ChevronRight: () => <div data-testid='chevron-right-icon'>Right</div>,
  MessageCircle: () => <div data-testid='message-icon'>Message</div>,
  Filter: () => <div data-testid='filter-icon'>Filter</div>,
  ArrowUpDown: () => <div data-testid='sort-icon'>Sort</div>,
  Pin: () => <div data-testid='pin-icon'>Pin</div>,
  RefreshCw: () => <div data-testid='refresh-icon'>Refresh</div>,
  AlertCircle: () => <div data-testid='alert-icon'>Alert</div>,
}));

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('DiscussionList 组件测试', () => {
  const defaultProps = createTestProps();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('应该正确渲染讨论列表', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              discussions: [createTestDiscussion()],
              total: 1,
              caseId: 'test-case-id-1',
              page: 1,
              limit: 20,
            },
            meta: {
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false,
              },
            },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('案件讨论')).toBeInTheDocument();
        expect(screen.getByText('(1条讨论)')).toBeInTheDocument();
      });
    });

    it('应该显示空状态', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              discussions: [],
              total: 0,
              caseId: 'test-case-id-1',
              page: 1,
              limit: 20,
            },
            meta: {
              pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false,
              },
            },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('暂无讨论')).toBeInTheDocument();
      });
    });

    it('应该显示加载状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(() => {
            // 永不解析
          })
      );

      render(<DiscussionList {...defaultProps} />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('无权限时应该显示提示', () => {
      const props = {
        ...defaultProps,
        canViewDiscussions: false,
      };

      render(<DiscussionList {...props} />);

      expect(screen.getByText('您无权查看此案件的讨论')).toBeInTheDocument();
    });
  });

  describe('操作按钮测试', () => {
    it('应该显示筛选按钮', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { discussions: [], total: 0 },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-icon')).toBeInTheDocument();
      });
    });

    it('应该显示排序按钮', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { discussions: [], total: 0 },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('sort-icon')).toBeInTheDocument();
      });
    });

    it('应该显示刷新按钮', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { discussions: [], total: 0 },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
      });
    });

    it('有创建权限时应该显示创建按钮', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { discussions: [], total: 0 },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('发表讨论')).toBeInTheDocument();
      });
    });

    it('无创建权限时应该隐藏创建按钮', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { discussions: [], total: 0 },
          }),
      });

      const props = {
        ...defaultProps,
        canCreateDiscussions: false,
      };
      render(<DiscussionList {...props} />);

      await waitFor(() => {
        expect(screen.queryByText('发表讨论')).not.toBeInTheDocument();
      });
    });
  });

  describe('交互测试', () => {
    it('点击筛选按钮应该切换筛选状态', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { discussions: [], total: 0 },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('置顶')).toBeInTheDocument();
      });

      const filterButton = screen.getByText('置顶');
      await user.click(filterButton);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('isPinned=true')
      );
    });

    it('点击刷新按钮应该重新加载数据', async () => {
      const user = userEvent.setup();
      const mockFetch = (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { discussions: [], total: 0 },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
      });

      mockFetch.mockClear();
      const refreshButton = screen
        .getByTestId('refresh-icon')
        .closest('button');
      if (refreshButton) {
        await user.click(refreshButton);
      }

      expect(mockFetch).toHaveBeenCalled();
    });

    it('点击发表讨论按钮应该显示表单', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { discussions: [], total: 0 },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('发表讨论')).toBeInTheDocument();
      });

      const createButton = screen.getByText('发表讨论');
      await user.click(createButton);

      expect(screen.getByText('讨论内容')).toBeInTheDocument();
    });
  });

  describe('分页测试', () => {
    it('应该显示分页信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              discussions: [createTestDiscussion()],
              total: 21,
              caseId: 'test-case-id-1',
              page: 1,
              limit: 20,
            },
            meta: {
              pagination: {
                page: 1,
                limit: 20,
                total: 21,
                totalPages: 2,
                hasNext: true,
                hasPrevious: false,
              },
            },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('第1页 / 共2页')).toBeInTheDocument();
        expect(screen.getByText('下一页')).toBeInTheDocument();
      });
    });

    it('点击下一页应该加载第二页', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              discussions: [createTestDiscussion()],
              total: 21,
              caseId: 'test-case-id-1',
              page: 1,
              limit: 20,
            },
            meta: {
              pagination: {
                page: 1,
                limit: 20,
                total: 21,
                totalPages: 2,
                hasNext: true,
                hasPrevious: false,
              },
            },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('下一页')).toBeInTheDocument();
      });

      const nextPageButton = screen.getByText('下一页');
      await user.click(nextPageButton);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      );
    });

    it('上一页按钮应该禁用', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              discussions: [createTestDiscussion()],
              total: 21,
              caseId: 'test-case-id-1',
              page: 1,
              limit: 20,
            },
            meta: {
              pagination: {
                page: 1,
                limit: 20,
                total: 21,
                totalPages: 2,
                hasNext: true,
                hasPrevious: false,
              },
            },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('上一页')).toBeInTheDocument();
      });

      const prevPageButton = screen.getByText('上一页').closest('button');
      expect(prevPageButton).toBeDisabled();
    });
  });

  describe('错误处理测试', () => {
    it('加载失败应该显示错误信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('加载失败')).toBeInTheDocument();
      });
    });

    it('点击重试按钮应该重新加载', async () => {
      const user = userEvent.setup();
      const mockFetch = (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { discussions: [], total: 0 },
            }),
        });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('加载失败')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('重试');
      await user.click(retryButton);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('排序功能测试', () => {
    it('点击排序按钮应该切换排序字段', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { discussions: [], total: 0 },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('创建')).toBeInTheDocument();
      });

      const sortButton = screen.getByText('创建');
      await user.click(sortButton);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=updatedAt')
      );
    });

    it('点击排序顺序按钮应该切换顺序', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { discussions: [], total: 0 },
          }),
      });

      render(<DiscussionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('↓')).toBeInTheDocument();
      });

      const sortOrderButton = screen.getByText('↓');
      await user.click(sortOrderButton);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sortOrder=asc')
      );
    });
  });
});
