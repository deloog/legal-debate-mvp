// @ts-nocheck
/**
 * 推荐反馈组件测试
 *
 * 测试推荐反馈按钮和表单的功能
 */

/// <reference types="@testing-library/jest-dom" />

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecommendationFeedbackButton } from '../../../components/feedback/RecommendationFeedbackButton';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('RecommendationFeedbackButton 组件', () => {
  const mockProps = {
    userId: 'user-1',
    lawArticleId: 'article-1',
    lawArticleName: '民法典第1条',
    contextType: 'DEBATE' as const,
    contextId: 'debate-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染反馈按钮', () => {
    render(<RecommendationFeedbackButton {...mockProps} />);

    expect(screen.getByText('有用')).toBeInTheDocument();
    expect(screen.getByText('无用')).toBeInTheDocument();
    expect(screen.getByText('不相关')).toBeInTheDocument();
  });

  it('应该在点击"有用"时提交反馈', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<RecommendationFeedbackButton {...mockProps} />);

    const helpfulButton = screen.getByText('有用');
    fireEvent.click(helpfulButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/feedbacks/recommendation',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('HELPFUL'),
        })
      );
    });
  });

  it('应该在点击"无用"时提交反馈', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<RecommendationFeedbackButton {...mockProps} />);

    const notHelpfulButton = screen.getByText('无用');
    fireEvent.click(notHelpfulButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/feedbacks/recommendation',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('NOT_HELPFUL'),
        })
      );
    });
  });

  it('应该在点击"不相关"时提交反馈', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<RecommendationFeedbackButton {...mockProps} />);

    const irrelevantButton = screen.getByText('不相关');
    fireEvent.click(irrelevantButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/feedbacks/recommendation',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('IRRELEVANT'),
        })
      );
    });
  });

  it('应该显示提交成功的消息', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: '反馈提交成功' }),
    } as Response);

    render(<RecommendationFeedbackButton {...mockProps} />);

    const helpfulButton = screen.getByText('有用');
    fireEvent.click(helpfulButton);

    await waitFor(() => {
      expect(screen.getByText('感谢您的反馈！')).toBeInTheDocument();
    });
  });

  it('应该显示提交失败的错误消息', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: '提交失败' }),
    } as Response);

    render(<RecommendationFeedbackButton {...mockProps} />);

    const helpfulButton = screen.getByText('有用');
    fireEvent.click(helpfulButton);

    await waitFor(() => {
      expect(screen.getByText(/提交失败/)).toBeInTheDocument();
    });
  });

  it('应该在提交时禁用按钮', async () => {
    jest.mocked(fetch).mockImplementation(
      (): Promise<Response> =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ success: true }),
              } as Response),
            100
          )
        )
    );

    render(<RecommendationFeedbackButton {...mockProps} />);

    const helpfulButton = screen.getByText('有用');
    fireEvent.click(helpfulButton);

    // 按钮应该被禁用
    (expect(helpfulButton) as any).toBeDisabled();

    await waitFor(() => {
      expect(helpfulButton).not.toBeDisabled();
    });
  });

  it('应该支持添加评论', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<RecommendationFeedbackButton {...mockProps} showCommentInput />);

    const helpfulButton = screen.getByText('有用');
    fireEvent.click(helpfulButton);

    // 应该显示评论输入框
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/请输入您的评论/)).toBeInTheDocument();
    });

    const commentInput = screen.getByPlaceholderText(/请输入您的评论/);
    fireEvent.change(commentInput, { target: { value: '这个推荐很有帮助' } });

    const submitButton = screen.getByText('提交');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/feedbacks/recommendation',
        expect.objectContaining({
          body: expect.stringContaining('这个推荐很有帮助'),
        })
      );
    });
  });

  it('应该在已提交反馈后显示已选择状态', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<RecommendationFeedbackButton {...mockProps} />);

    const helpfulButton = screen.getByText('有用');
    fireEvent.click(helpfulButton);

    await waitFor(() => {
      (expect(helpfulButton) as any).toHaveClass('selected');
    });
  });

  it('应该处理网络错误', async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    render(<RecommendationFeedbackButton {...mockProps} />);

    const helpfulButton = screen.getByText('有用');
    fireEvent.click(helpfulButton);

    await waitFor(() => {
      expect(screen.getByText(/网络错误/)).toBeInTheDocument();
    });
  });

  it('应该支持自定义样式', () => {
    render(
      <RecommendationFeedbackButton {...mockProps} className='custom-class' />
    );

    const container = screen.getByText('有用').closest('div');
    (expect(container) as any).toHaveClass('custom-class');
  });

  it('应该在禁用状态下不允许提交', () => {
    render(<RecommendationFeedbackButton {...mockProps} disabled />);

    const helpfulButton = screen.getByText('有用');
    (expect(helpfulButton) as any).toBeDisabled();

    fireEvent.click(helpfulButton);

    expect(fetch).not.toHaveBeenCalled();
  });
});
