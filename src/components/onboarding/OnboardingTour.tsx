'use client';

/**
 * 新手引导组件
 *
 * 为新用户提供功能介绍和使用教程
 */

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from 'react';

/**
 * 引导步骤接口
 */
export interface TourStep {
  /** 步骤ID */
  id: string;
  /** 目标元素选择器 */
  target?: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 位置 */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** 是否高亮目标元素 */
  spotlight?: boolean;
  /** 自定义操作按钮 */
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

/**
 * 引导上下文
 */
interface TourContextType {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentStepData: TourStep | null;
  startTour: (steps: TourStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  endTour: () => void;
  goToStep: (index: number) => void;
}

const TourContext = createContext<TourContextType | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

/**
 * 引导提供者
 */
export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const startTour = useCallback((tourSteps: TourStep[]) => {
    setSteps(tourSteps);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsActive(false);
    }
  }, [currentStep, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    // 保存到 localStorage 标记已跳过
    localStorage.setItem('tour_skipped', 'true');
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    // 保存到 localStorage 标记已完成
    localStorage.setItem('tour_completed', 'true');
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) {
        setCurrentStep(index);
      }
    },
    [steps.length]
  );

  const value: TourContextType = {
    isActive,
    currentStep,
    totalSteps: steps.length,
    currentStepData: steps[currentStep] || null,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    endTour,
    goToStep,
  };

  return (
    <TourContext.Provider value={value}>
      {children}
      {isActive && <TourOverlay />}
    </TourContext.Provider>
  );
}

/**
 * 引导遮罩层
 */
function TourOverlay() {
  const {
    currentStepData,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
    endTour,
  } = useTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!currentStepData?.target) {
      setTargetRect(null);
      return;
    }

    const target = document.querySelector(currentStepData.target);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);

      // 滚动到目标元素
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStepData]);

  if (!currentStepData) return null;

  const isLastStep = currentStep === totalSteps - 1;
  const isCentered =
    currentStepData.placement === 'center' || !currentStepData.target;

  // 计算弹出框位置
  const getPopoverStyle = (): React.CSSProperties => {
    if (isCentered || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    const popoverWidth = 320;
    const popoverHeight = 200;

    switch (currentStepData.placement) {
      case 'top':
        return {
          position: 'fixed',
          top: targetRect.top - popoverHeight - padding,
          left: targetRect.left + targetRect.width / 2 - popoverWidth / 2,
        };
      case 'bottom':
        return {
          position: 'fixed',
          top: targetRect.bottom + padding,
          left: targetRect.left + targetRect.width / 2 - popoverWidth / 2,
        };
      case 'left':
        return {
          position: 'fixed',
          top: targetRect.top + targetRect.height / 2 - popoverHeight / 2,
          left: targetRect.left - popoverWidth - padding,
        };
      case 'right':
        return {
          position: 'fixed',
          top: targetRect.top + targetRect.height / 2 - popoverHeight / 2,
          left: targetRect.right + padding,
        };
      default:
        return {
          position: 'fixed',
          top: targetRect.bottom + padding,
          left: targetRect.left + targetRect.width / 2 - popoverWidth / 2,
        };
    }
  };

  return (
    <div className='fixed inset-0 z-[9999]'>
      {/* 遮罩背景 */}
      <div className='absolute inset-0 bg-black/50' onClick={skipTour} />

      {/* 高亮区域 */}
      {targetRect && currentStepData.spotlight !== false && (
        <div
          className='absolute border-2 border-blue-500 rounded-lg bg-transparent pointer-events-none'
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
        />
      )}

      {/* 引导弹窗 */}
      <div
        className='bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-5 w-80 z-10'
        style={getPopoverStyle()}
      >
        {/* 步骤指示器 */}
        <div className='flex items-center justify-between mb-3'>
          <div className='flex gap-1'>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i === currentStep
                    ? 'bg-blue-500'
                    : i < currentStep
                      ? 'bg-blue-300'
                      : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            ))}
          </div>
          <button
            onClick={skipTour}
            className='text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
          >
            跳过
          </button>
        </div>

        {/* 标题 */}
        <h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2'>
          {currentStepData.title}
        </h3>

        {/* 描述 */}
        <p className='text-sm text-zinc-600 dark:text-zinc-400 mb-4'>
          {currentStepData.description}
        </p>

        {/* 操作按钮 */}
        <div className='flex gap-2'>
          {currentStep > 0 && (
            <button
              onClick={prevStep}
              className='flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors'
            >
              上一步
            </button>
          )}
          <button
            onClick={isLastStep ? endTour : nextStep}
            className='flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
          >
            {isLastStep ? '完成' : '下一步'}
          </button>
        </div>

        {/* 自定义操作 */}
        {currentStepData.actions && currentStepData.actions.length > 0 && (
          <div className='mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 flex gap-2'>
            {currentStepData.actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className='flex-1 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 欢迎引导组件
 */
export interface WelcomeTourProps {
  /** 用户名 */
  userName?: string;
  /** 完成回调 */
  onComplete?: () => void;
  /** 跳过回调 */
  onSkip?: () => void;
}

export function WelcomeTour({
  userName,
  onComplete,
  onSkip,
}: WelcomeTourProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    // 检查是否已完成或跳过引导
    const completed = localStorage.getItem('welcome_tour_completed');
    const skipped = localStorage.getItem('welcome_tour_skipped');
    if (!completed && !skipped) {
      setIsVisible(true);
    }
  }, []);

  const slides = [
    {
      title: `欢迎使用律伴助手${userName ? `，${userName}` : ''}！`,
      description:
        '律伴助手是一款专为法律从业者设计的AI辅助工具，帮助您更高效地处理案件、分析法律问题。',
      icon: '👋',
    },
    {
      title: '智能案件管理',
      description: '轻松创建和管理案件，上传文档自动分析，关键信息一目了然。',
      icon: '📁',
    },
    {
      title: 'AI辩论模拟',
      description: 'AI模拟正反双方辩论，帮助您预判对方观点，完善诉讼策略。',
      icon: '⚖️',
    },
    {
      title: '法条智能推荐',
      description: '基于案情自动推荐相关法条，引用来源清晰可查，提高工作效率。',
      icon: '📚',
    },
    {
      title: '开始使用',
      description: '一切准备就绪！点击下方按钮开始您的智能法律之旅。',
      icon: '🚀',
    },
  ];

  const handleComplete = () => {
    localStorage.setItem('welcome_tour_completed', 'true');
    setIsVisible(false);
    onComplete?.();
  };

  const handleSkip = () => {
    localStorage.setItem('welcome_tour_skipped', 'true');
    setIsVisible(false);
    onSkip?.();
  };

  if (!isVisible) return null;

  const isLastSlide = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-indigo-900/90 backdrop-blur-sm'>
      <div className='w-full max-w-lg mx-4'>
        {/* 卡片 */}
        <div className='bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden'>
          {/* 顶部装饰 */}
          <div className='h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500' />

          <div className='p-8'>
            {/* 图标 */}
            <div className='text-5xl text-center mb-6'>{slide.icon}</div>

            {/* 标题 */}
            <h2 className='text-2xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-4'>
              {slide.title}
            </h2>

            {/* 描述 */}
            <p className='text-center text-zinc-600 dark:text-zinc-400 mb-8'>
              {slide.description}
            </p>

            {/* 步骤指示器 */}
            <div className='flex justify-center gap-2 mb-6'>
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === currentSlide
                      ? 'w-8 bg-blue-500'
                      : 'w-2 bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400'
                  }`}
                />
              ))}
            </div>

            {/* 操作按钮 */}
            <div className='flex gap-3'>
              {currentSlide > 0 && (
                <button
                  onClick={() => setCurrentSlide(prev => prev - 1)}
                  className='flex-1 px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors'
                >
                  上一步
                </button>
              )}
              <button
                onClick={
                  isLastSlide
                    ? handleComplete
                    : () => setCurrentSlide(prev => prev + 1)
                }
                className='flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25'
              >
                {isLastSlide ? '开始使用' : '下一步'}
              </button>
            </div>

            {/* 跳过链接 */}
            <button
              onClick={handleSkip}
              className='w-full mt-4 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'
            >
              跳过引导
            </button>
          </div>
        </div>

        {/* 底部提示 */}
        <p className='mt-4 text-center text-sm text-white/60'>
          您随时可以在设置中重新查看引导
        </p>
      </div>
    </div>
  );
}

/**
 * 功能提示组件
 */
export function FeatureTip({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const storageKey = `feature_tip_${id}_dismissed`;

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
  };

  return (
    <div className='relative'>
      {children}
      {isVisible && (
        <div className='absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50'>
          <div className='bg-blue-600 text-white rounded-lg px-4 py-3 shadow-lg w-64'>
            {/* 箭头 */}
            <div className='absolute -top-2 left-1/2 -translate-x-1/2 border-8 border-transparent border-b-blue-600' />

            <div className='flex items-start gap-3'>
              <div className='text-xl'>💡</div>
              <div className='flex-1'>
                <h4 className='font-medium text-sm mb-1'>{title}</h4>
                <p className='text-xs text-blue-100'>{description}</p>
              </div>
              <button
                onClick={dismiss}
                className='text-blue-200 hover:text-white'
              >
                <svg
                  className='h-4 w-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WelcomeTour;
