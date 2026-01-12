'use client';

import { memo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  DollarSign,
  FileText,
  MessageCircle,
  Trash2,
} from 'lucide-react';
import { CaseWithMetadata } from '@/types/case';

/**
 * 案件状态颜色映射
 */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  COMPLETED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ARCHIVED: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
  DELETED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

/**
 * 案件类型标签映射
 */
const TYPE_LABELS: Record<string, string> = {
  CIVIL: '民事',
  CRIMINAL: '刑事',
  ADMINISTRATIVE: '行政',
  COMMERCIAL: '商事',
  LABOR: '劳动',
  INTELLECTUAL: '知识产权',
  OTHER: '其他',
};

/**
 * 单个案件卡片组件
 * 功能：显示单个案件信息和快速操作
 */
interface CaseListItemProps {
  case: CaseWithMetadata;
  onStartDebate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function CaseListItem({
  case: caseItem,
  onStartDebate,
  onDelete,
}: CaseListItemProps) {
  const statusColor = STATUS_COLORS[caseItem.status] || STATUS_COLORS.PENDING;
  const typeLabel = TYPE_LABELS[caseItem.type] || caseItem.type;

  /**
   * 格式化日期
   */
  const formatDate = (dateString: Date | string) => {
    if (!dateString) return '未知日期';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '无效日期';
    }
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  /**
   * 获取当事人信息
   */
  const getPartiesInfo = () => {
    if (caseItem.metadata?.parties) {
      const { plaintiff, defendant } = caseItem.metadata.parties;
      if (plaintiff && defendant) {
        return `原告：${plaintiff.name} vs 被告：${defendant.name}`;
      }
      if (plaintiff) return `原告：${plaintiff.name}`;
      if (defendant) return `被告：${defendant.name}`;
    }
    return '';
  };

  /**
   * 获取案件金额
   */
  const getAmount = () => {
    const amount = caseItem.metadata?.caseDetails?.amount;
    if (amount) {
      return `¥${amount.toLocaleString()}`;
    }
    return null;
  };

  return (
    <div className='group rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950'>
      {/* 头部：标题和状态 */}
      <div className='mb-3 flex items-start justify-between'>
        <div className='flex-1'>
          <Link
            href={`/cases/${caseItem.id}`}
            className='text-lg font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-50 dark:hover:text-blue-400'
          >
            {caseItem.title}
          </Link>
          <div className='mt-2 flex flex-wrap gap-2'>
            <span className='rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'>
              {typeLabel}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}
            >
              {caseItem.status}
            </span>
          </div>
        </div>
      </div>

      {/* 描述 */}
      {caseItem.description && (
        <p className='mb-3 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400'>
          {caseItem.description}
        </p>
      )}

      {/* 当事人信息 */}
      {getPartiesInfo() && (
        <div className='mb-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300'>
          <FileText className='h-4 w-4 shrink-0' />
          <span className='truncate'>{getPartiesInfo()}</span>
        </div>
      )}

      {/* 元信息 */}
      <div className='flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400'>
        {/* 创建日期 */}
        <div className='flex items-center gap-1'>
          <Calendar className='h-4 w-4' />
          <span>{formatDate(caseItem.createdAt)}</span>
        </div>

        {/* 案件金额 */}
        {getAmount() && (
          <div className='flex items-center gap-1'>
            <DollarSign className='h-4 w-4' />
            <span>{getAmount()}</span>
          </div>
        )}
      </div>

      {/* 快速操作按钮 */}
      <div className='mt-4 flex items-center justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800'>
        {onStartDebate && (
          <button
            onClick={() => onStartDebate(caseItem.id)}
            className='flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40'
          >
            <MessageCircle className='h-4 w-4' />
            开始辩论
          </button>
        )}
        <Link
          href={`/cases/${caseItem.id}`}
          className='rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
        >
          查看详情
        </Link>
        {onDelete && (
          <button
            onClick={() => onDelete(caseItem.id)}
            className='flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
          >
            <Trash2 className='h-4 w-4' />
            删除
          </button>
        )}
      </div>
    </div>
  );
}

// 使用React.memo避免不必要的重渲染
export default memo(CaseListItem);
