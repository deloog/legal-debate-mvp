/**
 * DiscussionForm 组件测试
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscussionForm } from '@/components/discussion/DiscussionForm';
import {
  createTestDiscussion,
  createTestProps,
} from '../discussion/test-utils';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Send: () => <div data-testid='send-icon'>Send</div>,
  X: () => <div data-testid='x-icon'>X</div>,
  AtSign: () => <div data-testid='at-icon'>At</div>,
  AlertCircle: () => <div data-testid='alert-icon'>Alert</div>,
}));

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('DiscussionForm 组件测试', () => {
  const defaultProps = {
    caseId: 'test-case-id-1',
    editingDiscussion: null,
    onCancelEdit: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('应该正确渲染创建表单', () => {
      render(<DiscussionForm {...defaultProps} />);

      expect(screen.getByText('发表讨论')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('输入讨论内容，使用@提及团队成员...')
      ).toBeInTheDocument();
      expect(screen.getByText('讨论内容')).toBeInTheDocument();
      expect(screen.getByText('0/10000')).toBeInTheDocument();
    });

    it('应该正确渲染编辑表单', () => {
      const editingDiscussion = createTestDiscussion({ content: '编辑内容' });
      const props = {
        ...defaultProps,
        editingDiscussion,
      };
      render(<DiscussionForm {...props} />);

      expect(screen.getByText('编辑讨论')).toBeInTheDocument();
      expect(screen.getByDisplayValue('编辑内容')).toBeInTheDocument();
    });

    it('不应该显示提及提示', () => {
      render(<DiscussionForm {...defaultProps} />);

      expect(screen.queryByText('使用@提及')).not.toBeInTheDocument();
    });

    it('点击@按钮应该显示提及提示', async () => {
      const user = userEvent.setup();
      render(<DiscussionForm {...defaultProps} />);

      const atButton = screen.getByText('插入@');
      await user.click(atButton);

      expect(screen.getByText('使用@提及')).toBeInTheDocument();
      expect(screen.getByText(/输入@后输入用户名/)).toBeInTheDocument();
    });
  });

  describe('表单验证测试', () => {
    it('空内容应该显示错误提示', async () => {
      const user = userEvent.setup();
      render(<DiscussionForm {...defaultProps} />);

      const submitButton = screen.getByText('发送');
      await user.click(submitButton);

      expect(screen.getByText('讨论内容不能为空')).toBeInTheDocument();
    });

    it('内容超长应该显示错误提示', async () => {
      const user = userEvent.setup();
      render(<DiscussionForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      const longContent = 'a'.repeat(10001);
      await user.type(textarea, longContent);

      const submitButton = screen.getByText('发送');
      await user.click(submitButton);

      expect(
        screen.getByText('讨论内容不能超过10000个字符')
      ).toBeInTheDocument();
    });

    it('应该显示字符计数', async () => {
      const user = userEvent.setup();
      render(<DiscussionForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'hello');

      expect(screen.getByText('5/10000')).toBeInTheDocument();
    });

    it('超出限制时应显示"超限"标记', async () => {
      const _user = userEvent.setup();
      render(<DiscussionForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      // 使用fireEvent代替userEvent来快速输入大量文本
      fireEvent.change(textarea, { target: { value: 'a'.repeat(10001) } });

      expect(screen.getByText('超限')).toBeInTheDocument();
    });
  });

  describe('表单提交测试', () => {
    it('成功提交应该调用onSuccess', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 'new-discussion-id',
              content: '新讨论',
            },
          }),
      });

      render(<DiscussionForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '新讨论');

      const submitButton = screen.getByText('发送');
      await user.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it('成功编辑应该调用onSuccess', async () => {
      const user = userEvent.setup();
      const editingDiscussion = createTestDiscussion({ id: 'edit-id' });
      const props = {
        ...defaultProps,
        editingDiscussion,
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 'edit-id',
              content: '更新后的内容',
            },
          }),
      });

      render(<DiscussionForm {...props} />);

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, '更新后的内容');

      const submitButton = screen.getByText('更新');
      await user.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it('提交失败应该显示错误信息', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            message: '服务器错误',
          }),
      });

      render(<DiscussionForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '测试内容');

      const submitButton = screen.getByText('发送');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('服务器错误')).toBeInTheDocument();
      });
    });

    it('提交时应该禁用按钮', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => {
              resolve({
                ok: true,
                json: () => Promise.resolve({ success: true }),
              } as Response);
            }, 100)
          )
      );

      render(<DiscussionForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '测试内容');

      const submitButton = screen.getByText('发送');
      await user.click(submitButton);

      expect(submitButton).toBeDisabled();
      expect(screen.getByText('提交中...')).toBeInTheDocument();
    });
  });

  describe('取消编辑测试', () => {
    it('点击取消按钮应该调用onCancelEdit', async () => {
      const user = userEvent.setup();
      const editingDiscussion = createTestDiscussion();
      const props = {
        ...defaultProps,
        editingDiscussion,
      };
      render(<DiscussionForm {...props} />);

      const cancelButton = screen.getByText('取消');
      await user.click(cancelButton);

      expect(defaultProps.onCancelEdit).toHaveBeenCalled();
    });
  });

  describe('@提及功能测试', () => {
    it('输入@应该显示提及提示', async () => {
      const user = userEvent.setup();
      render(<DiscussionForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'test@');

      expect(screen.getByText('使用@提及')).toBeInTheDocument();
    });

    it('点击关闭按钮应该隐藏提及提示', async () => {
      const user = userEvent.setup();
      render(<DiscussionForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@test');

      const closeButton = screen.getByTestId('x-icon').closest('button');
      if (closeButton) {
        await user.click(closeButton);
      }

      expect(screen.queryByText('使用@提及')).not.toBeInTheDocument();
    });
  });

  describe('边界情况测试', () => {
    it('最大内容长度应该可以提交', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'test-id' },
          }),
      });

      render(<DiscussionForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      // 使用fireEvent代替userEvent来快速设置值
      fireEvent.change(textarea, { target: { value: 'a'.repeat(10000) } });

      const submitButton = screen.getByText('发送');
      await userEvent.setup().click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it('切换编辑讨论应该更新表单内容', () => {
      const { rerender } = render(
        <DiscussionForm {...defaultProps} editingDiscussion={null} />
      );

      expect(screen.getByText('发表讨论')).toBeInTheDocument();

      const editingDiscussion = createTestDiscussion({
        content: '编辑后的内容',
      });
      rerender(
        <DiscussionForm
          {...defaultProps}
          editingDiscussion={editingDiscussion}
        />
      );

      expect(screen.getByText('编辑讨论')).toBeInTheDocument();
      expect(screen.getByDisplayValue('编辑后的内容')).toBeInTheDocument();
    });
  });
});
