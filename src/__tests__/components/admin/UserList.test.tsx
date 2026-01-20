/**
 * UserList组件测试
 * @jest-environment jsdom
 */
// @ts-nocheck - 禁用此文件的 TypeScript 类型检查

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserList } from '@/components/admin/UserList';

// Mock fetch API
global.fetch = jest.fn();

// 在setup.ts之后重新mock next/navigation，覆盖默认实现
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock window.confirm
window.confirm = jest.fn(() => true);

describe('UserList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          users: [
            {
              id: '1',
              email: 'user1@example.com',
              username: 'user1',
              name: '用户1',
              role: 'USER',
              status: 'ACTIVE',
              createdAt: '2024-01-01T00:00:00.000Z',
              lastLoginAt: '2024-01-15T00:00:00.000Z',
            },
            {
              id: '2',
              email: 'user2@example.com',
              username: 'user2',
              name: '用户2',
              role: 'LAWYER',
              status: 'ACTIVE',
              createdAt: '2024-01-02T00:00:00.000Z',
              lastLoginAt: null,
            },
          ],
          pagination: {
            total: 2,
            page: 1,
            limit: 20,
            totalPages: 1,
          },
        },
      }),
    });
  });

  describe('用户列表显示', () => {
    it('应该显示用户列表', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    });

    it('应该显示用户信息', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      expect(screen.getByText('用户1')).toBeInTheDocument();
      expect(screen.getByText('user1')).toBeInTheDocument();
    });

    it('应该显示分页信息', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      // 分页信息被分成多个文本节点，使用更精确的匹配
      const paginationContainer = screen
        .getByText('共', { exact: false })
        .closest('.text-gray-700');
      expect(paginationContainer).toBeInTheDocument();
      expect(paginationContainer).toHaveTextContent(/共.*条记录.*第.*页/);
    });
  });

  describe('页面跳转链接', () => {
    it('应该包含查看详情链接', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      const viewLinks = screen.getAllByText('查看');
      expect(viewLinks.length).toBeGreaterThan(0);

      const viewLink = viewLinks[0].closest('a');
      expect(viewLink).toHaveAttribute('href', '/admin/users/1');
    });

    it('应该包含编辑链接', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      const editLinks = screen.getAllByText('编辑');
      expect(editLinks.length).toBeGreaterThan(0);

      const editLink = editLinks[0].closest('a');
      expect(editLink).toHaveAttribute('href', '/admin/users/1/edit');
    });

    it('应该为每个用户生成正确的编辑链接', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user2@example.com')).toBeInTheDocument();
      });

      const editLinks = screen.getAllByText('编辑');
      expect(editLinks.length).toBe(2);

      // 第一个用户的编辑链接
      const firstEditLink = editLinks[0].closest('a');
      expect(firstEditLink).toHaveAttribute('href', '/admin/users/1/edit');

      // 第二个用户的编辑链接
      const secondEditLink = editLinks[1].closest('a');
      expect(secondEditLink).toHaveAttribute('href', '/admin/users/2/edit');
    });

    it('编辑链接应该使用正确的URL格式', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      const editLinks = screen.getAllByText('编辑');
      const editLink = editLinks[0].closest('a');

      // 验证URL格式：/admin/users/{id}/edit
      const href = editLink.getAttribute('href');
      expect(href).toMatch(/^\/admin\/users\/\d+\/edit$/);
    });

    it('查看链接应该使用正确的URL格式', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      const viewLinks = screen.getAllByText('查看');
      const viewLink = viewLinks[0].closest('a');

      // 验证URL格式：/admin/users/{id}
      const href = viewLink.getAttribute('href');
      expect(href).toMatch(/^\/admin\/users\/\d+$/);
    });
  });

  describe('筛选功能', () => {
    it('应该显示角色筛选下拉框', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      expect(screen.getByText('全部角色')).toBeInTheDocument();
    });

    it('应该显示状态筛选下拉框', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      expect(screen.getByText('全部状态')).toBeInTheDocument();
    });

    it('应该显示搜索输入框', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      expect(
        screen.getByPlaceholderText('搜索邮箱、用户名或姓名')
      ).toBeInTheDocument();
    });
  });

  describe('删除功能', () => {
    it('应该显示删除按钮', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('删除');
      expect(deleteButtons.length).toBe(2);
    });

    it('点击删除按钮应该弹出确认对话框', async () => {
      (window.confirm as jest.Mock).mockReturnValueOnce(false);

      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalledWith('确定要删除用户"用户1"吗？');
    });

    it('确认删除后应该调用删除API', async () => {
      (window.confirm as jest.Mock).mockReturnValueOnce(true);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              users: [
                {
                  id: '1',
                  email: 'user1@example.com',
                  username: 'user1',
                  name: '用户1',
                  role: 'USER',
                  status: 'ACTIVE',
                  createdAt: '2024-01-01T00:00:00.000Z',
                  lastLoginAt: '2024-01-15T00:00:00.000Z',
                },
              ],
              pagination: {
                total: 1,
                page: 1,
                limit: 20,
                totalPages: 1,
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/users/1',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });
  });

  describe('加载状态', () => {
    it('应该显示加载状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    data: {
                      users: [],
                      pagination: {
                        total: 0,
                        page: 1,
                        limit: 20,
                        totalPages: 0,
                      },
                    },
                  }),
                }),
              100
            )
          )
      );

      render(<UserList />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('错误处理', () => {
    it('应该显示错误信息', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('网络错误'));

      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('网络错误')).toBeInTheDocument();
      });
    });
  });

  describe('空数据状态', () => {
    it('应该显示空数据提示', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            users: [],
            pagination: {
              total: 0,
              page: 1,
              limit: 20,
              totalPages: 0,
            },
          },
        }),
      });

      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('暂无用户数据')).toBeInTheDocument();
      });
    });
  });
});
