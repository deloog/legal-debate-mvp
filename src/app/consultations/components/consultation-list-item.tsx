/**
 * 单个咨询记录卡片组件
 * 功能：显示单个咨询记录信息和快速操作
 */
'use client';

import { memo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Phone,
  Mail,
  FileText,
  Eye,
  Edit,
  ArrowRight,
} from 'lucide-react';
import { ConsultationData } from '@/lib/hooks/use-consultations';

/**
 * 咨询状态颜色映射
 */
const STATUS_COLORS: Record<string, string> = {
  PENDING:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  FOLLOW_UP: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CONVERTED:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  LOST: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

/**
 * 咨询类型标签映射
 */
const TYPE_LABELS: Record<string, string> = {
  PHONE: '电话咨询',
  VISIT: '来访咨询',
  ONLINE: '在线咨询',
  REFERRAL: '转介绍',
};

/**
 * 单个咨询记录卡片组件
 */
interface ConsultationListItemProps {
  consultation: ConsultationData;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onConvert?: (id: string) => void;
}

export function ConsultationListItem({
  consultation,
  onView,
  onEdit,
  onConvert,
}: ConsultationListItemProps) {
  const statusColor =
    STATUS_COLORS[consultation.status] || STATUS_COLORS.PENDING;
  const typeLabel =
    TYPE_LABELS[consultation.consultType] || consultation.consultType;

  /**
   * 格式化日期
   */
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '未知日期';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '无效日期';
    }
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 格式化跟进日期（仅显示日期）
   */
  const formatFollowUpDate = (dateString: string | null) => {
    if (!dateString) return '未设置';
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
   * 格式化成功率
   */
  const formatWinRate = (rate: number | null) => {
    if (rate === null) return '未评估';
    return `${rate}%`;
  };

  /**
   * 格式化费用
   */
  const formatFee = (fee: number | null) => {
    if (fee === null) return '未报价';
    return `¥${fee.toLocaleString()}`;
  };

  /**
   * 获取状态标签文本
   */
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: '待跟进',
      FOLLOW_UP: '跟进中',
      CONVERTED: '已转化',
      LOST: '已流失',
    };
    return labels[status] || status;
  };

  return (
    <div className='group rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950'>
      {/* 头部：咨询编号和状态 */}
      <div className='mb-3 flex items-start justify-between'>
        <div className='flex-1'>
          <Link
            href={`/consultations/${consultation.id}`}
            className='text-lg font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-50 dark:hover:text-blue-400'
          >
            {consultation.consultNumber}
          </Link>
          <div className='mt-2 flex flex-wrap gap-2'>
            <span className='rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'>
              {typeLabel}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}
            >
              {getStatusLabel(consultation.status)}
            </span>
            {consultation.caseType && (
              <span className='rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'>
                {consultation.caseType}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 客户信息 */}
      <div className='mb-3 space-y-1.5'>
        <div className='flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300'>
          <FileText className='h-4 w-4 shrink-0' />
          <span className='font-medium'>{consultation.clientName}</span>
        </div>
        {consultation.clientPhone && (
          <div className='flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400'>
            <Phone className='h-4 w-4 shrink-0' />
            <span>{consultation.clientPhone}</span>
          </div>
        )}
        {consultation.clientEmail && (
          <div className='flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400'>
            <Mail className='h-4 w-4 shrink-0' />
            <span className='truncate'>{consultation.clientEmail}</span>
          </div>
        )}
      </div>

      {/* 评估信息 */}
      <div className='mb-3 flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400'>
        <div className='flex items-center gap-1'>
          <FileText className='h-4 w-4' />
          <span>成功率：{formatWinRate(consultation.winRate)}</span>
        </div>
        {consultation.suggestedFee && (
          <div className='flex items-center gap-1'>
            <FileText className='h-4 w-4' />
            <span>预估：{formatFee(consultation.suggestedFee)}</span>
          </div>
        )}
      </div>

      {/* 元信息 */}
      <div className='flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400'>
        {/* 咨询时间 */}
        <div className='flex items-center gap-1'>
          <Calendar className='h-4 w-4' />
          <span>{formatDate(consultation.consultTime)}</span>
        </div>

        {/* 跟进日期 */}
        {consultation.followUpDate && (
          <div className='flex items-center gap-1'>
            <Calendar className='h-4 w-4' />
            <span>跟进：{formatFollowUpDate(consultation.followUpDate)}</span>
          </div>
        )}
      </div>

      {/* 快速操作按钮 */}
      <div className='mt-4 flex items-center justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800'>
        {onConvert && consultation.status !== 'CONVERTED' && (
          <button
            onClick={() => onConvert(consultation.id)}
            className='flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-1.5 text-sm font-medium text-green-600 transition-colors hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40'
          >
            <ArrowRight className='h-4 w-4' />
            转化案件
          </button>
        )}
        {onView && (
          <button
            onClick={() => onView(consultation.id)}
            className='flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
          >
            <Eye className='h-4 w-4' />
            查看
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(consultation.id)}
            className='flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20'
          >
            <Edit className='h-4 w-4' />
            编辑
          </button>
        )}
        <Link
          href={`/consultations/${consultation.id}`}
          className='rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
        >
          详情
        </Link>
      </div>
    </div>
  );
}

// 使用React.memo避免不必要的重渲染
export default memo(ConsultationListItem);
