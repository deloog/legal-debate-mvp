/**
 * 关系反馈按钮组件
 *
 * 用于收集用户对法条关系的反馈
 */

'use client';

import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';

interface LawArticleInfo {
  id: string;
  lawName: string;
  articleNumber: string;
}

interface RelationFeedbackButtonProps {
  userId: string;
  relationId: string;
  sourceArticle: LawArticleInfo;
  targetArticle: LawArticleInfo;
  relationType: string;
  showCommentInput?: boolean;
  showRelationInfo?: boolean;
  disabled?: boolean;
  className?: string;
  onFeedbackSubmitted?: (feedbackType: string) => void;
}

type FeedbackType =
  | 'ACCURATE'
  | 'INACCURATE'
  | 'MISSING'
  | 'SHOULD_REMOVE'
  | 'WRONG_TYPE';
type RelationType =
  | 'CITES'
  | 'CITED_BY'
  | 'CONFLICTS'
  | 'COMPLETES'
  | 'COMPLETED_BY'
  | 'SUPERSEDES'
  | 'SUPERSEDED_BY'
  | 'IMPLEMENTS'
  | 'IMPLEMENTED_BY'
  | 'RELATED';

const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  CITES: '引用',
  CITED_BY: '被引用',
  CONFLICTS: '冲突',
  COMPLETES: '补全',
  COMPLETED_BY: '被补全',
  SUPERSEDES: '替代',
  SUPERSEDED_BY: '被替代',
  IMPLEMENTS: '实施',
  IMPLEMENTED_BY: '被实施',
  RELATED: '相关',
};

export function RelationFeedbackButton({
  userId,
  relationId,
  sourceArticle,
  targetArticle,
  relationType,
  showCommentInput = false,
  showRelationInfo = false,
  disabled = false,
  className = '',
  onFeedbackSubmitted,
}: RelationFeedbackButtonProps) {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackType | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [comment, setComment] = useState('');
  const [suggestedType, setSuggestedType] = useState<RelationType | ''>('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleFeedbackClick = async (feedbackType: FeedbackType) => {
    if (disabled || isSubmitting) return;

    if (feedbackType === 'WRONG_TYPE') {
      setSelectedFeedback(feedbackType);
      setShowTypeSelector(true);
      return;
    }

    if (showCommentInput) {
      setSelectedFeedback(feedbackType);
      setShowComment(true);
      return;
    }

    await submitFeedback(feedbackType);
  };

  const submitFeedback = async (
    feedbackType: FeedbackType,
    feedbackComment?: string,
    suggestedRelationType?: string
  ) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/feedbacks/relation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          relationId,
          feedbackType,
          suggestedRelationType:
            suggestedRelationType || suggestedType || undefined,
          comment: feedbackComment || comment,
          metadata: {
            sourceArticle,
            targetArticle,
            currentRelationType: relationType,
          },
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSelectedFeedback(feedbackType);
        setMessage({ type: 'success', text: '感谢您的反馈！' });
        setShowComment(false);
        setShowTypeSelector(false);
        setComment('');
        setSuggestedType('');
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

  const handleTypeSelectorSubmit = async () => {
    if (!selectedFeedback || !suggestedType) return;
    await submitFeedback(selectedFeedback, comment, suggestedType);
  };

  return (
    <div className={`relation-feedback ${className}`}>
      {showRelationInfo && (
        <div className='mb-3 p-3 bg-gray-50 rounded-md text-sm'>
          <div className='flex items-center gap-2'>
            <span className='font-medium'>
              {sourceArticle.lawName}
              {sourceArticle.articleNumber}
            </span>
            <span className='text-gray-500'>
              {RELATION_TYPE_LABELS[relationType as RelationType] ||
                relationType}
            </span>
            <span className='font-medium'>
              {targetArticle.lawName}
              {targetArticle.articleNumber}
            </span>
          </div>
        </div>
      )}

      <div className='flex items-center gap-2'>
        <button
          onClick={() => handleFeedbackClick('ACCURATE')}
          disabled={disabled || isSubmitting}
          className={`feedback-button ${selectedFeedback === 'ACCURATE' ? 'selected' : ''}`}
          title='这个关系很准确'
        >
          <CheckCircle className='w-4 h-4' />
          <span>准确</span>
        </button>

        <button
          onClick={() => handleFeedbackClick('INACCURATE')}
          disabled={disabled || isSubmitting}
          className={`feedback-button ${selectedFeedback === 'INACCURATE' ? 'selected' : ''}`}
          title='这个关系不准确'
        >
          <XCircle className='w-4 h-4' />
          <span>不准确</span>
        </button>

        <button
          onClick={() => handleFeedbackClick('WRONG_TYPE')}
          disabled={disabled || isSubmitting}
          className={`feedback-button ${selectedFeedback === 'WRONG_TYPE' ? 'selected' : ''}`}
          title='关系类型错误'
        >
          <AlertTriangle className='w-4 h-4' />
          <span>类型错误</span>
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

      {showTypeSelector && (
        <div className='mt-3 space-y-2'>
          <label className='block text-sm font-medium text-gray-700'>
            建议的关系类型
          </label>
          <select
            value={suggestedType}
            onChange={e => setSuggestedType(e.target.value as RelationType)}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            disabled={isSubmitting}
          >
            <option value=''>请选择关系类型</option>
            {Object.entries(RELATION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
              onClick={handleTypeSelectorSubmit}
              disabled={isSubmitting || !suggestedType}
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isSubmitting ? '提交中...' : '提交'}
            </button>
            <button
              onClick={() => {
                setShowTypeSelector(false);
                setComment('');
                setSuggestedType('');
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

      {showComment && !showTypeSelector && (
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
