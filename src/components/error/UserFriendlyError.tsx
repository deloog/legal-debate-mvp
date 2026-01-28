'use client';

/**
 * 用户友好的错误显示组件
 *
 * 将技术错误转换为用户可理解的友好提示
 */

import { useState } from 'react';

/**
 * 错误类型
 */
export type ErrorType =
  | 'network' // 网络错误
  | 'auth' // 认证错误
  | 'permission' // 权限错误
  | 'notFound' // 未找到
  | 'validation' // 验证错误
  | 'server' // 服务器错误
  | 'quota' // 配额超限
  | 'timeout' // 超时
  | 'unknown'; // 未知错误

/**
 * 错误配置
 */
interface ErrorConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  suggestions: string[];
}

/**
 * 错误类型配置映射
 */
const errorConfigs: Record<ErrorType, ErrorConfig> = {
  network: {
    icon: (
      <svg
        className='h-8 w-8'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0'
        />
      </svg>
    ),
    title: '网络连接异常',
    description: '无法连接到服务器，请检查您的网络连接',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    suggestions: ['检查网络是否正常连接', '尝试刷新页面', '稍后再试'],
  },
  auth: {
    icon: (
      <svg
        className='h-8 w-8'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
        />
      </svg>
    ),
    title: '登录状态已失效',
    description: '您的登录已过期，请重新登录',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    suggestions: ['请重新登录您的账号', '登录后刷新页面'],
  },
  permission: {
    icon: (
      <svg
        className='h-8 w-8'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
        />
      </svg>
    ),
    title: '无访问权限',
    description: '您没有权限访问此内容',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    suggestions: ['确认您是否有相应权限', '联系管理员获取权限'],
  },
  notFound: {
    icon: (
      <svg
        className='h-8 w-8'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        />
      </svg>
    ),
    title: '内容不存在',
    description: '您查找的内容不存在或已被删除',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    suggestions: ['检查链接是否正确', '返回上一页重试', '联系技术支持'],
  },
  validation: {
    icon: (
      <svg
        className='h-8 w-8'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
        />
      </svg>
    ),
    title: '输入有误',
    description: '请检查您的输入信息',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    suggestions: ['检查必填项是否填写完整', '确认格式是否正确'],
  },
  server: {
    icon: (
      <svg
        className='h-8 w-8'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01'
        />
      </svg>
    ),
    title: '服务器繁忙',
    description: '服务器暂时无法响应，请稍后再试',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    suggestions: ['稍等片刻后重试', '如问题持续请联系客服'],
  },
  quota: {
    icon: (
      <svg
        className='h-8 w-8'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M13 10V3L4 14h7v7l9-11h-7z'
        />
      </svg>
    ),
    title: '使用额度不足',
    description: '您的使用额度已用完',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    suggestions: ['升级会员获取更多额度', '等待额度自动恢复'],
  },
  timeout: {
    icon: (
      <svg
        className='h-8 w-8'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
        />
      </svg>
    ),
    title: '请求超时',
    description: '服务器响应时间过长',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    suggestions: ['检查网络连接', '稍后再试', '尝试减少请求数据量'],
  },
  unknown: {
    icon: (
      <svg
        className='h-8 w-8'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        />
      </svg>
    ),
    title: '出现了一些问题',
    description: '发生了未知错误',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    suggestions: ['刷新页面重试', '清除浏览器缓存', '联系技术支持'],
  },
};

/**
 * 根据错误信息自动判断错误类型
 */
export function detectErrorType(error: Error | string): ErrorType {
  const message =
    typeof error === 'string'
      ? error.toLowerCase()
      : error.message.toLowerCase();

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection')
  ) {
    return 'network';
  }
  if (
    message.includes('401') ||
    message.includes('unauthorized') ||
    message.includes('未登录') ||
    message.includes('token')
  ) {
    return 'auth';
  }
  if (
    message.includes('403') ||
    message.includes('forbidden') ||
    message.includes('权限') ||
    message.includes('permission')
  ) {
    return 'permission';
  }
  if (
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('不存在')
  ) {
    return 'notFound';
  }
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('缺少')
  ) {
    return 'validation';
  }
  if (
    message.includes('500') ||
    message.includes('server') ||
    message.includes('服务器')
  ) {
    return 'server';
  }
  if (
    message.includes('quota') ||
    message.includes('limit') ||
    message.includes('额度')
  ) {
    return 'quota';
  }
  if (message.includes('timeout') || message.includes('超时')) {
    return 'timeout';
  }
  return 'unknown';
}

/**
 * 将技术错误消息转换为用户友好的消息
 */
export function getFriendlyErrorMessage(error: Error | string): string {
  const message = typeof error === 'string' ? error : error.message;

  // 常见错误消息映射
  const messageMap: Record<string, string> = {
    'Failed to fetch': '网络连接失败，请检查网络',
    'Network request failed': '网络请求失败，请稍后再试',
    'JSON Parse error': '数据解析失败，请刷新页面',
    Unauthorized: '请先登录后再操作',
    Forbidden: '您没有权限执行此操作',
    'Not Found': '未找到相关内容',
    'Internal Server Error': '服务器出现问题，请稍后再试',
    'Service Unavailable': '服务暂时不可用，请稍后再试',
    'Request Timeout': '请求超时，请检查网络后重试',
  };

  // 查找匹配的友好消息
  for (const [key, value] of Object.entries(messageMap)) {
    if (message.includes(key)) {
      return value;
    }
  }

  // 如果消息较短且为中文，直接使用
  if (message.length < 50 && /[\u4e00-\u9fa5]/.test(message)) {
    return message;
  }

  return '操作失败，请稍后再试';
}

export interface UserFriendlyErrorProps {
  /** 错误对象或消息 */
  error: Error | string;
  /** 错误类型（可选，默认自动检测） */
  type?: ErrorType;
  /** 重试回调 */
  onRetry?: () => void;
  /** 返回回调 */
  onBack?: () => void;
  /** 自定义标题 */
  title?: string;
  /** 自定义描述 */
  description?: string;
  /** 显示技术详情（开发环境） */
  showDetails?: boolean;
  /** 大小变体 */
  variant?: 'sm' | 'md' | 'lg';
  /** 是否内联显示（不显示卡片背景） */
  inline?: boolean;
}

export function UserFriendlyError({
  error,
  type,
  onRetry,
  onBack,
  title,
  description,
  showDetails = process.env.NODE_ENV === 'development',
  variant = 'md',
  inline = false,
}: UserFriendlyErrorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const errorType = type || detectErrorType(error);
  const config = errorConfigs[errorType];
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'object' ? error.stack : undefined;

  const sizeClasses = {
    sm: {
      container: 'p-3',
      icon: 'h-10 w-10',
      title: 'text-sm',
      description: 'text-xs',
    },
    md: {
      container: 'p-5',
      icon: 'h-14 w-14',
      title: 'text-base',
      description: 'text-sm',
    },
    lg: {
      container: 'p-8',
      icon: 'h-20 w-20',
      title: 'text-xl',
      description: 'text-base',
    },
  };

  const sizes = sizeClasses[variant];

  const content = (
    <>
      {/* 图标 */}
      <div
        className={`mx-auto mb-4 flex ${sizes.icon} items-center justify-center rounded-full ${config.bgColor} ${config.color}`}
      >
        {config.icon}
      </div>

      {/* 标题 */}
      <h3
        className={`mb-2 font-semibold text-zinc-900 dark:text-zinc-100 ${sizes.title}`}
      >
        {title || config.title}
      </h3>

      {/* 描述 */}
      <p
        className={`mb-4 text-zinc-600 dark:text-zinc-400 ${sizes.description}`}
      >
        {description || getFriendlyErrorMessage(error)}
      </p>

      {/* 建议列表 */}
      {config.suggestions.length > 0 && (
        <ul
          className={`mb-4 space-y-1 text-left ${sizes.description} text-zinc-500 dark:text-zinc-400`}
        >
          {config.suggestions.map((suggestion, index) => (
            <li key={index} className='flex items-center gap-2'>
              <span className='h-1 w-1 rounded-full bg-zinc-400' />
              {suggestion}
            </li>
          ))}
        </ul>
      )}

      {/* 技术详情 */}
      {showDetails && errorStack && (
        <details
          open={detailsOpen}
          onToggle={e => setDetailsOpen(e.currentTarget.open)}
          className='mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left dark:border-zinc-700 dark:bg-zinc-800'
        >
          <summary className='cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400'>
            技术详情
          </summary>
          <pre className='mt-2 overflow-auto text-xs text-zinc-500 dark:text-zinc-500'>
            {errorMessage}
            {'\n\n'}
            {errorStack}
          </pre>
        </details>
      )}

      {/* 操作按钮 */}
      <div className='flex gap-2'>
        {onRetry && (
          <button
            onClick={onRetry}
            className='flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors'
          >
            重试
          </button>
        )}
        {onBack && (
          <button
            onClick={onBack}
            className='flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
          >
            返回
          </button>
        )}
      </div>
    </>
  );

  if (inline) {
    return <div className='text-center'>{content}</div>;
  }

  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${sizes.container}`}
    >
      {content}
    </div>
  );
}

/**
 * 简单的内联错误提示
 */
export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className='flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'>
      <svg
        className='h-4 w-4 flex-shrink-0'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        />
      </svg>
      <span className='flex-1'>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className='text-red-800 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200'
        >
          重试
        </button>
      )}
    </div>
  );
}

export default UserFriendlyError;
