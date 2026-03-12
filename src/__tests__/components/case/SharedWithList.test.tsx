/**
 * SharedWithList 组件测试
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SharedWithList } from '@/components/case/SharedWithList';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch> as jest.Mock;

// Mock window.confirm
global.confirm = jest.fn(() => true);

describe('SharedWithList', () => {
  const defaultProps = {
    caseId: 'case-123',
  };

  const mockShareInfo = {
    id: 'case-123',
    title: '测试案件',
    ownerType: 'USER' as const,
    sharedWithTeam: true,
    sharedAt: new Date('2024-01-15T10:00:00.000Z'),
    sharedBy: {
      id: 'user-123',
      name: '张三',
      email: 'zhangsan@example.com',
      avatar: '/avatar.jpg',
    },
    sharedNotes: '需要团队协作完成此案件',
  };

  const mockSuccessResponse = {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        case: mockShareInfo,
        isOwner: true,
      },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.confirm = jest.fn(() => true);
  });

  describe('渲染测试', () => {
    it('应该显示加载状态', () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}));

      render(<SharedWithList {...defaultProps} />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('应该显示共享状态标题', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('共享状态')).toBeInTheDocument();
      });
    });

    it('应该显示所有权类型', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('所有权类型:')).toBeInTheDocument();
        expect(screen.getByText('个人案件')).toBeInTheDocument();
      });
    });

    it('应该显示共享状态为已共享', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('共享状态:')).toBeInTheDocument();
        expect(screen.getByText('已共享')).toBeInTheDocument();
      });
    });

    it('应该显示共享时间', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('共享时间:')).toBeInTheDocument();
      });
    });

    it('应该显示共享者', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('共享者:')).toBeInTheDocument();
        expect(screen.getByText('张三')).toBeInTheDocument();
      });
    });

    it('应该显示共享说明', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('共享说明:')).toBeInTheDocument();
        expect(screen.getByText('需要团队协作完成此案件')).toBeInTheDocument();
      });
    });

    it('未共享时不应该显示共享信息', async () => {
      const mockNotSharedResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            case: {
              ...mockShareInfo,
              sharedWithTeam: false,
              sharedAt: null,
              sharedBy: null,
              sharedNotes: undefined,
            },
            isOwner: true,
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockNotSharedResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('共享状态:')).toBeInTheDocument();
        expect(screen.getByText('未共享')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.queryByText('共享时间:')).not.toBeInTheDocument();
        expect(screen.queryByText('共享者:')).not.toBeInTheDocument();
        expect(screen.queryByText('共享说明:')).not.toBeInTheDocument();
      });
    });

    it('团队案件应该显示正确的类型', async () => {
      const mockTeamCaseResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            case: {
              ...mockShareInfo,
              ownerType: 'TEAM' as const,
            },
            isOwner: true,
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockTeamCaseResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('团队案件')).toBeInTheDocument();
      });
    });
  });

  describe('取消共享测试', () => {
    it('应该显示取消共享按钮', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: '取消共享' });
        expect(cancelButton).toBeInTheDocument();
      });
    });

    it('点击取消共享应该显示确认对话框', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: '取消共享' });
        expect(cancelButton).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: '取消共享' });
      cancelButton.click();

      expect(global.confirm).toHaveBeenCalledWith('确定要取消共享此案件吗？');
    });

    it('取消确认时应该调用API', async () => {
      const mockUnshareResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            case: {
              ...mockShareInfo,
              sharedWithTeam: false,
              sharedAt: null,
              sharedBy: null,
              sharedNotes: undefined,
            },
          },
        }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockSuccessResponse)
        .mockResolvedValueOnce(mockUnshareResponse);

      render(<SharedWithList {...defaultProps} />);

      const cancelButton = await screen.findByRole('button', {
        name: '取消共享',
      });
      cancelButton.click();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/cases/case-123/share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sharedWithTeam: false,
            notes: '',
          }),
        });
      });
    });

    it('取消共享成功后应该更新UI', async () => {
      const mockUnshareResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            case: {
              ...mockShareInfo,
              sharedWithTeam: false,
              sharedAt: null,
              sharedBy: null,
              sharedNotes: undefined,
            },
          },
        }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockSuccessResponse)
        .mockResolvedValueOnce(mockUnshareResponse);

      render(<SharedWithList {...defaultProps} />);

      const cancelButton = await screen.findByRole('button', {
        name: '取消共享',
      });
      cancelButton.click();

      await waitFor(() => {
        expect(screen.getByText('未共享')).toBeInTheDocument();
        expect(
          screen.queryByText('需要团队协作完成此案件')
        ).not.toBeInTheDocument();
      });
    });

    it('取消确认对话框时不应调用API', async () => {
      global.confirm = jest.fn(() => false);

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);

      render(<SharedWithList {...defaultProps} />);

      const cancelButton = await screen.findByRole('button', {
        name: '取消共享',
      });
      cancelButton.click();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('错误处理测试', () => {
    it('API失败时应该显示错误信息', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('获取共享信息失败')
      );

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('获取共享信息失败')).toBeInTheDocument();
      });
    });

    it('取消共享失败时应该显示错误信息', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockSuccessResponse)
        .mockRejectedValueOnce(new Error('取消共享失败'));

      render(<SharedWithList {...defaultProps} />);

      const cancelButton = await screen.findByRole('button', {
        name: '取消共享',
      });
      cancelButton.click();

      await waitFor(() => {
        expect(screen.getByText('取消共享失败')).toBeInTheDocument();
      });
    });

    it('取消共享API返回失败时应该显示错误信息', async () => {
      const mockFailedResponse = {
        ok: false,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockSuccessResponse)
        .mockResolvedValueOnce(mockFailedResponse);

      render(<SharedWithList {...defaultProps} />);

      const cancelButton = await screen.findByRole('button', {
        name: '取消共享',
      });
      cancelButton.click();

      await waitFor(() => {
        expect(screen.getByText('取消共享失败')).toBeInTheDocument();
      });
    });
  });

  describe('权限测试', () => {
    it('非所有者时不应该显示取消共享按钮', async () => {
      const mockNotOwnerResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            case: mockShareInfo,
            isOwner: false,
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockNotOwnerResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: '取消共享' })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('加载状态测试', () => {
    it('取消共享时应该显示取消中状态', async () => {
      const mockUnshareResponse = new Promise(() => {});

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockSuccessResponse)
        .mockReturnValueOnce(mockUnshareResponse);

      render(<SharedWithList {...defaultProps} />);

      const cancelButton = await screen.findByRole('button', {
        name: '取消共享',
      });
      cancelButton.click();

      await waitFor(() => {
        expect(cancelButton).toHaveTextContent('取消中...');
        expect(cancelButton).toBeDisabled();
      });
    });
  });

  describe('空数据测试', () => {
    it('没有共享信息时应该显示暂无信息', async () => {
      const mockEmptyResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            case: null,
            isOwner: true,
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockEmptyResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('暂无共享信息')).toBeInTheDocument();
      });
    });

    it('共享者为null时应该显示邮箱', async () => {
      const mockNoNameResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            case: {
              ...mockShareInfo,
              sharedBy: {
                ...mockShareInfo.sharedBy,
                name: null,
              },
            },
            isOwner: true,
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockNoNameResponse);

      render(<SharedWithList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('zhangsan@example.com')).toBeInTheDocument();
      });
    });
  });
});
