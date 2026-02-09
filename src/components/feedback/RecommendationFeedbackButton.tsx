/**
 * 推荐反馈按钮组件
 *
 * 用于收集用户对法条推荐的反馈
 */

'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, XCircle, MessageSquare } from 'lucide-react';

interface RecommendationFeedbackButtonProps {
  userId: string;
  lawArticleId: string;
  lawArticleName: string;
  contextType: 'DEBATE' | 'CONTRACT' | 'GENERAL' | 'SEARCH';
  contextId?: string;
  showCommentInput?: boolean;
  disabled?: boolean;
  className?: string;
  onFeedbackSubmitted?: (feedbackType: string) => void;
}

type FeedbackType = 'HELPFUL' | 'NOT_HELPFUL' | 'IRRELEVANT' | 'EXCELLENT';

export function RecommendationFeedbackButton({
  userId,
  lawArticleId,
  lawArticleName,
  contextType,
  contextId,
  showCommentInput = false,
  disabled = false,
  className = '',
  onFeedbackSubmitted,
}: RecommendationFeedbackButtonProps) {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackType | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleFeedbackClick = async (feedbackType: FeedbackType) => {
    if (disabled || isSubmitting) return;

    if (showCommentInput) {
      setSelectedFeedback(feedbackType);
      setShowComment(true);
      return;
    }

    await submitFeedback(feedbackType);
  };

  const submitFeedback = async (
    feedbackType: FeedbackType,
    feedbackComment?: string
  ) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/feedbacks/recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          lawArticleId,
          contextType,
          contextId,
          feedbackType,
          comment: feedbackComment || comment,
          metadata: {
            lawArticleName,
          },
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSelectedFeedback(feedbackType);
        setMessage({ type: 'success', text: '感谢您的反馈！' });
        setShowComment(false);
        setComment('');
        onFeedbackSubmitted?.(feedbackType);
      } else {
        setMessage({ type: 'error', text: data.error || '提交失败，请重试' });
      }
    } catch (error) {
      console.error('提交反馈失败:', error);
      setMessage({ type: 'error', text: '网络错误，请检查您的连接' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!selectedFeedback) return;
    await submitFeedback(selectedFeedback, comment);
  };

  return (
    <div className={`recommendation-feedback ${className}`}>
      <div className='flex items-center gap-2'>
        <button
          onClick={() => handleFeedbackClick('HELPFUL')}
          disabled={disabled || isSubmitting}
          className={`feedback-button ${selectedFeedback === 'HELPFUL' ? 'selected' : ''}`}
          title='这个推荐很有用'
        >
          <ThumbsUp className='w-4 h-4' />
          <span>有用</span>
        </button>

        <button
          onClick={() => handleFeedbackClick('NOT_HELPFUL')}
          disabled={disabled || isSubmitting}
          className={`feedback-button ${selectedFeedback === 'NOT_HELPFUL' ? 'selected' : ''}`}
          title='这个推荐没有帮助'
        >
          <ThumbsDown className='w-4 h-4' />
          <span>无用</span>
        </button>

        <button
          onClick={() => handleFeedbackClick('IRRELEVANT')}
          disabled={disabled || isSubmitting}
          className={`feedback-button ${selectedFeedback === 'IRRELEVANT' ? 'selected' : ''}`}
          title='这个推荐不相关'
        >
          <XCircle className='w-4 h-4' />
          <span>不相关</span>
        </button>

        {showCommentInput && (
          <button
            onClick={() => {
              setShowComment(!showComment);
              setSelectedFeedback(null);
            }}
            disabled={disabled || isSubmitting}
            className='feedback-button'
            title='添加评论'
          >
            <MessageSquare className='w-4 h-4' />
          </button>
        )}
      </div>

      {showComment && (
        <div className='mt-3 space-y-2'>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder='请输入您的评论（可选）'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            rows={3}
            disabled={isSubmitting}
          />
          <div className='flex gap-2'>
            <button
              onClick={handleCommentSubmit}
              disabled={isSubmitting || !selectedFeedback}
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isSubmitting ? '提交中...' : '提交'}
            </button>
            <button
              onClick={() => {
                setShowComment(false);
                setComment('');
                setSelectedFeedback(null);
              }}
              disabled={isSubmitting}
              className='px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50'
            >
              取消
            </button>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`mt-2 p-2 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <style jsx>{`
        .feedback-button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          background-color: white;
          color: #6b7280;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .feedback-button:hover:not(:disabled) {
          background-color: #f9fafb;
          border-color: #d1d5db;
        }

        .feedback-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .feedback-button.selected {
          background-color: #dbeafe;
          border-color: #3b82f6;
          color: #1e40af;
        }
      `}</style>
    </div>
  );
}
