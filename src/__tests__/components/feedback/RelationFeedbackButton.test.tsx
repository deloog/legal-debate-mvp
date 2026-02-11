// @ts-nocheck
/**
 * 关系反馈组件测试
 *
 * 测试关系反馈按钮和表单的功能
 */

/// <reference types="@testing-library/jest-dom" />

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RelationFeedbackButton } from '../../../components/feedback/RelationFeedbackButton';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('RelationFeedbackButton 组件', () => {
  const mockProps = {
    userId: 'user-1',
    relationId: 'relation-1',
    sourceArticle: {
      id: 'article-1',
      lawName: '民法典',
      articleNumber: '第1条',
    },
    targetArticle: {
      id: 'article-2',
      lawName: '民法典',
      articleNumber: '第2条',
    },
    relationType: 'CITES' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染反馈按钮', () => {
    render(<RelationFeedbackButton {...mockProps} />);

    expect(screen.getByText('准确')).toBeInTheDocument();
    expect(screen.getByText('不准确')).toBeInTheDocument();
    expect(screen.getByText('类型错误')).toBeInTheDocument();
  });

  it('应该在点击"准确"时提交反馈', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<RelationFeedbackButton {...mockProps} />);

    const accurateButton = screen.getByText('准确');
    fireEvent.click(accurateButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/feedbacks/relation',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('ACCURATE'),
        })
      );
    });
  });

  it('应该在点击"不准确"时提交反馈', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<RelationFeedbackButton {...mockProps} />);

    const inaccurateButton = screen.getByText('不准确');
    fireEvent.click(inaccurateButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/feedbacks/relation',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('INACCURATE'),
        })
      );
    });
  });

  it('应该在点击"类型错误"时显示关系类型选择器', async () => {
    render(<RelationFeedbackButton {...mockProps} />);

    const wrongTypeButton = screen.getByText('类型错误');
    fireEvent.click(wrongTypeButton);

    await waitFor(() => {
      expect(screen.getByText(/建议的关系类型/)).toBeInTheDocument();
    });
  });

  it('应该支持选择建议的关系类型', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<RelationFeedbackButton {...mockProps} />);

    const wrongTypeButton = screen.getByText('类型错误');
    fireEvent.click(wrongTypeButton);

    await waitFor(() => {
      expect(screen.getByText(/建议的关系类型/)).toBeInTheDocument();
    });

    // 选择建议的关系类型
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'COMPLETES' } });

    const submitButton = screen.getByText('提交');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/feedbacks/relation',
        expect.objectContaining({
          body: expect.stringContaining('COMPLETES'),
        })
      );
    });
  });

  it('应该显示提交成功的消息', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: '反馈提交成功' }),
    } as Response);

    render(<RelationFeedbackButton {...mockProps} />);

    const accurateButton = screen.getByText('准确');
    fireEvent.click(accurateButton);

    await waitFor(() => {
      expect(screen.getByText('感谢您的反馈！')).toBeInTheDocument();
    });
  });

  it('应该显示提交失败的错误消息', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: '提交失败' }),
    } as Response);

    render(<RelationFeedbackButton {...mockProps} />);

    const accurateButton = screen.getByText('准确');
    fireEvent.click(accurateButton);

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

    render(<RelationFeedbackButton {...mockProps} />);

    const accurateButton = screen.getByText('准确');
    fireEvent.click(accurateButton);

    // 按钮应该被禁用
    (expect(accurateButton) as any).toBeDisabled();

    await waitFor(() => {
      expect(accurateButton).not.toBeDisabled();
    });
  });

  it('应该支持添加评论', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<RelationFeedbackButton {...mockProps} showCommentInput />);

    const accurateButton = screen.getByText('准确');
    fireEvent.click(accurateButton);

    // 应该显示评论输入框
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/请输入您的评论/)).toBeInTheDocument();
    });

    const commentInput = screen.getByPlaceholderText(/请输入您的评论/);
    fireEvent.change(commentInput, { target: { value: '这个关系很准确' } });

    const submitButton = screen.getByText('提交');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/feedbacks/relation',
        expect.objectContaining({
          body: expect.stringContaining('这个关系很准确'),
        })
      );
    });
  });

  it('应该在已提交反馈后显示已选择状态', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<RelationFeedbackButton {...mockProps} />);

    const accurateButton = screen.getByText('准确');
    fireEvent.click(accurateButton);

    await waitFor(() => {
      (expect(accurateButton) as any).toHaveClass('selected');
    });
  });

  it('应该处理网络错误', async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    render(<RelationFeedbackButton {...mockProps} />);

    const accurateButton = screen.getByText('准确');
    fireEvent.click(accurateButton);

    await waitFor(() => {
      expect(screen.getByText(/网络错误/)).toBeInTheDocument();
    });
  });

  it('应该支持自定义样式', () => {
    render(<RelationFeedbackButton {...mockProps} className='custom-class' />);

    const container = screen.getByText('准确').closest('div');
    (expect(container) as any).toHaveClass('custom-class');
  });

  it('应该在禁用状态下不允许提交', () => {
    render(<RelationFeedbackButton {...mockProps} disabled />);

    const accurateButton = screen.getByText('准确');
    (expect(accurateButton) as any).toBeDisabled();

    fireEvent.click(accurateButton);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('应该显示关系信息', () => {
    render(<RelationFeedbackButton {...mockProps} showRelationInfo />);

    expect(screen.getByText(/民法典第1条/)).toBeInTheDocument();
    expect(screen.getByText(/民法典第2条/)).toBeInTheDocument();
    expect(screen.getByText(/引用/)).toBeInTheDocument();
  });
});
