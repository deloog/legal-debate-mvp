'use client';

/**
 * AI思考中指示器组件
 *
 * 展示AI正在处理请求的动画状态
 */

import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';

export interface AIThinkingIndicatorProps {
  /** 是否正在思考 */
  isThinking: boolean;
  /** 思考阶段描述 */
  stage?: 'analyzing' | 'searching' | 'generating' | 'reviewing';
  /** 自定义消息 */
  message?: string;
  /** 大小变体 */
  variant?: 'sm' | 'md' | 'lg';
  /** 是否显示进度 */
  showProgress?: boolean;
  /** 预估完成百分比（0-100） */
  progress?: number;
}

/**
 * 阶段配置
 */
const stageConfig = {
  analyzing: {
    label: '分析案件...',
    icon: '🔍',
    color: 'text-blue-600',
  },
  searching: {
    label: '检索法条...',
    icon: '📚',
    color: 'text-amber-600',
  },
  generating: {
    label: '生成论点...',
    icon: '✍️',
    color: 'text-green-600',
  },
  reviewing: {
    label: '审查结果...',
    icon: '✅',
    color: 'text-purple-600',
  },
};

/**
 * 大小配置
 */
const sizeConfig = {
  sm: {
    container: 'px-3 py-2',
    icon: 'text-sm',
    text: 'text-xs',
    brain: 'h-4 w-4',
    dots: 'h-1 w-1',
  },
  md: {
    container: 'px-4 py-3',
    icon: 'text-base',
    text: 'text-sm',
    brain: 'h-6 w-6',
    dots: 'h-1.5 w-1.5',
  },
  lg: {
    container: 'px-6 py-4',
    icon: 'text-lg',
    text: 'text-base',
    brain: 'h-8 w-8',
    dots: 'h-2 w-2',
  },
};

/**
 * 思考文本动画
 */
function ThinkingDots({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const dotSize = sizeConfig[size].dots;
  return (
    <span className='inline-flex items-center gap-0.5 ml-1'>
      <span
        className={`${dotSize} rounded-full bg-current animate-bounce`}
        style={{ animationDelay: '0ms' }}
      />
      <span
        className={`${dotSize} rounded-full bg-current animate-bounce`}
        style={{ animationDelay: '150ms' }}
      />
      <span
        className={`${dotSize} rounded-full bg-current animate-bounce`}
        style={{ animationDelay: '300ms' }}
      />
    </span>
  );
}

/**
 * 大脑动画图标
 */
function BrainIcon({
  size,
  isAnimating,
}: {
  size: 'sm' | 'md' | 'lg';
  isAnimating: boolean;
}) {
  const iconSize = sizeConfig[size].brain;
  return (
    <div className={`relative ${iconSize}`}>
      <svg
        className={`${iconSize} text-blue-500 ${isAnimating ? 'animate-pulse' : ''}`}
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
        />
      </svg>
      {isAnimating && (
        <>
          <span className='absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-400 animate-ping' />
          <span className='absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500' />
        </>
      )}
    </div>
  );
}

/**
 * 神经网络动画背景
 */
function NeuralBackground({ isAnimating }: { isAnimating: boolean }) {
  if (!isAnimating) return null;

  return (
    <div className='absolute inset-0 overflow-hidden rounded-lg'>
      {/* 连接线 */}
      <svg
        className='absolute inset-0 h-full w-full opacity-20'
        xmlns='http://www.w3.org/2000/svg'
      >
        <defs>
          <linearGradient id='neuralGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
            <stop offset='0%' stopColor='#3B82F6' />
            <stop offset='100%' stopColor='#8B5CF6' />
          </linearGradient>
        </defs>
        {/* 动态连接线 */}
        {[...Array(6)].map((_, i) => (
          <line
            key={i}
            x1={`${10 + i * 15}%`}
            y1='0%'
            x2={`${20 + i * 12}%`}
            y2='100%'
            stroke='url(#neuralGrad)'
            strokeWidth='1'
            className='animate-pulse'
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </svg>
      {/* 神经元节点 */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className='absolute h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 animate-pulse'
          style={{
            left: `${15 + i * 10}%`,
            top: `${20 + (i % 3) * 25}%`,
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function AIThinkingIndicator({
  isThinking,
  stage = 'generating',
  message,
  variant = 'md',
  showProgress = false,
  progress = 0,
}: AIThinkingIndicatorProps) {
  const [thinkingText, setThinkingText] = useState('');
  const sizes = sizeConfig[variant];
  const stageInfo = stageConfig[stage];

  // 思考文本动画
  useEffect(() => {
    if (!isThinking) {
      flushSync(() => setThinkingText(''));
      return;
    }

    const texts = [
      '正在理解问题上下文',
      '分析案件关键信息',
      '检索相关法律条文',
      '综合分析法律依据',
      '构建论证逻辑',
      '生成专业观点',
    ];

    let index = 0;
    const interval = setInterval(() => {
      setThinkingText(texts[index]);
      index = (index + 1) % texts.length;
    }, 2500);

    return () => clearInterval(interval);
  }, [isThinking]);

  if (!isThinking) return null;

  return (
    <div
      className={`relative rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:border-blue-800 dark:from-blue-950/30 dark:to-purple-950/30 ${sizes.container}`}
    >
      <NeuralBackground isAnimating={isThinking} />

      <div className='relative z-10 flex items-center gap-3'>
        {/* 大脑图标 */}
        <BrainIcon size={variant} isAnimating={isThinking} />

        {/* 内容区域 */}
        <div className='flex-1 min-w-0'>
          {/* 主要消息 */}
          <div className='flex items-center gap-2'>
            <span className={sizes.icon}>{stageInfo.icon}</span>
            <span
              className={`font-medium text-zinc-700 dark:text-zinc-300 ${sizes.text}`}
            >
              {message || stageInfo.label}
            </span>
            <ThinkingDots size={variant} />
          </div>

          {/* 次要描述 */}
          {thinkingText && (
            <p
              className={`mt-1 text-zinc-500 dark:text-zinc-400 truncate ${sizes.text}`}
            >
              {thinkingText}
            </p>
          )}

          {/* 进度条 */}
          {showProgress && (
            <div className='mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700'>
              <div
                className='h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500'
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* 阶段指示器 */}
        <div className='flex items-center gap-1'>
          {Object.keys(stageConfig).map((key, index) => (
            <div
              key={key}
              className={`h-1.5 w-1.5 rounded-full transition-all ${
                key === stage
                  ? 'bg-blue-500 scale-125'
                  : Object.keys(stageConfig).indexOf(stage) > index
                    ? 'bg-green-400'
                    : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 简单版本的思考指示器（内联使用）
 */
export function AIThinkingInline({
  message = 'AI思考中',
}: {
  message?: string;
}) {
  return (
    <span className='inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400'>
      <span className='h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
      <span className='text-sm'>{message}</span>
      <ThinkingDots size='sm' />
    </span>
  );
}

export default AIThinkingIndicator;
