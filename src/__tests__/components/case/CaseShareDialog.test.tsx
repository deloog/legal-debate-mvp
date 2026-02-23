/**
 * CaseShareDialog 组件测试
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { CaseShareDialog } from '@/components/case/CaseShareDialog';

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch> as jest.Mock;

describe('CaseShareDialog', () => {
  const defaultProps = {
    caseId: 'case-123',
    caseTitle: '测试案件',
    isOwner: true,
    sharedWithTeam: false,
    onShared: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('应该渲染共享案件按钮', () => {
      render(<CaseShareDialog {...defaultProps} />);
      const button = screen.getByRole('button', { name: '共享案件' });
      expect(button).toBeInTheDocument();
    });

    it('点击按钮后应该打开对话框', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} />);

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        const title = screen.getByRole('heading', { name: '共享案件' });
        expect(title).toBeInTheDocument();
      });
    });

    it('对话框中应该显示案件标题', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} />);

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/测试案件/)).toBeInTheDocument();
      });
    });

    it('应该显示共享给团队的开关', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} />);

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        const toggle = screen.getByRole('switch');
        expect(toggle).toBeInTheDocument();
      });
    });

    it('应该显示权限说明', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('权限说明：')).toBeInTheDocument();
        expect(
          screen.getByText('共享后，团队成员可以根据其在团队中的角色访问此案件')
        ).toBeInTheDocument();
      });
    });
  });

  describe('权限控制测试', () => {
    it('非所有者时应该显示提示', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} isOwner={false} />);

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        expect(
          screen.getByText('只有案件所有者可以修改共享设置')
        ).toBeInTheDocument();
      });
    });

    it('非所有者时开关应该被禁用', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} isOwner={false} />);

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        const toggle = screen.getByRole('switch');
        expect(toggle).toBeDisabled();
      });
    });

    it('非所有者时文本框应该被禁用', async () => {
      const user = userEvent.setup();
      render(
        <CaseShareDialog
          {...defaultProps}
          isOwner={false}
          sharedWithTeam={true}
        />
      );

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeDisabled();
      });
    });
  });

  describe('交互测试', () => {
    it('应该能够切换共享开关', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} />);

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        const toggle = screen.getByRole('switch');
        expect(toggle).not.toBeChecked();
      });

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      await waitFor(() => {
        expect(toggle).toBeChecked();
      });
    });

    it('共享时应该显示说明文本框', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/添加共享说明/)).toBeInTheDocument();
      });
    });

    it('应该能够输入共享说明', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/添加共享说明/);
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/添加共享说明/);
      await user.type(textarea, '需要团队协作完成此案件');

      await waitFor(() => {
        expect(textarea).toHaveValue('需要团队协作完成此案件');
      });
    });

    it('应该显示字符计数', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const button = screen.getByRole('button', { name: '共享案件' });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('0/500')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/添加共享说明/);
      await user.type(textarea, '测试');

      await waitFor(() => {
        expect(screen.getByText('2/500')).toBeInTheDocument();
      });
    });
  });

  describe('API调用测试', () => {
    it('应该调用共享API', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            message: '案件已共享给团队',
          },
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const openButton = screen.getByRole('button', { name: '共享案件' });
      await user.click(openButton);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: '共享' });
        expect(saveButton).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: '共享' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/cases/case-123/share',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sharedWithTeam: true,
              notes: '',
            }),
          })
        );
      });
    });

    it('共享成功后应该显示成功提示', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            message: '案件已共享给团队',
          },
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const openButton = screen.getByRole('button', { name: '共享案件' });
      await user.click(openButton);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: '共享' });
        expect(saveButton).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: '共享' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('案件已共享给团队');
      });
    });

    it('共享成功后应该调用onShared回调', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            message: '案件已共享给团队',
          },
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const openButton = screen.getByRole('button', { name: '共享案件' });
      await user.click(openButton);

      const saveButton = await screen.findByRole('button', { name: '共享' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(defaultProps.onShared).toHaveBeenCalledWith(true);
      });
    });

    it('API失败时应该显示错误提示', async () => {
      const mockResponse = {
        ok: false,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const openButton = screen.getByRole('button', { name: '共享案件' });
      await user.click(openButton);

      const saveButton = await screen.findByRole('button', { name: '共享' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('共享案件失败');
      });
    });

    it('网络错误时应该显示错误提示', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('网络错误'));

      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const openButton = screen.getByRole('button', { name: '共享案件' });
      await user.click(openButton);

      const saveButton = await screen.findByRole('button', { name: '共享' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('网络错误');
      });
    });
  });

  describe('状态管理测试', () => {
    it('关闭对话框后重新打开应该重置状态', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} />);

      // 第一次打开
      const openButton = screen.getByRole('button', { name: '共享案件' });
      await user.click(openButton);

      await waitFor(() => {
        const toggle = screen.getByRole('switch');
        expect(toggle).not.toBeChecked();
      });

      // 切换开关
      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      // 关闭对话框
      const cancelButton = screen.getByRole('button', { name: '取消' });
      await user.click(cancelButton);

      // 重新打开
      const openButton2 = screen.getByRole('button', { name: '共享案件' });
      await user.click(openButton2);

      await waitFor(() => {
        const toggle2 = screen.getByRole('switch');
        expect(toggle2).not.toBeChecked();
      });
    });
  });

  describe('加载状态测试', () => {
    it('保存时应该显示保存中状态', async () => {
      let __resolvePromise: (value: unknown) => void;
      const mockResponse = new Promise(resolve => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValueOnce(mockResponse);

      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const openButton = screen.getByRole('button', { name: '共享案件' });
      await user.click(openButton);

      const saveButton = await screen.findByRole('button', { name: '共享' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(saveButton).toHaveTextContent('保存中...');
        expect(saveButton).toBeDisabled();
      });
    });
  });

  describe('取消按钮测试', () => {
    it('应该能够取消操作', async () => {
      const user = userEvent.setup();
      render(<CaseShareDialog {...defaultProps} sharedWithTeam={true} />);

      const openButton = screen.getByRole('button', { name: '共享案件' });
      await user.click(openButton);

      await waitFor(() => {
        const title = screen.getByRole('heading', { name: '共享案件' });
        expect(title).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: '取消' });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: '共享案件' })
        ).not.toBeInTheDocument();
      });
    });
  });
});
