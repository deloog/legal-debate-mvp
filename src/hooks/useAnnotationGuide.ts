'use client';

import { useEffect, useState, startTransition } from 'react';

const STORAGE_KEY = 'luban_chat_first_visit';
const NEWBIE_DAYS = 14;
const ADAPTING_DAYS = 30;
const BUBBLE_DISMISSED_KEY = 'luban_annotation_bubble_dismissed';

export type GuidePhase = 'newbie' | 'adapting' | 'expert';

interface AnnotationGuide {
  phase: GuidePhase;
  /** 新手期：是否显示首条消息的脉冲引导气泡 */
  showBubble: boolean;
  /** 手动关闭气泡 */
  dismissBubble: () => void;
}

export function useAnnotationGuide(): AnnotationGuide {
  const [phase, setPhase] = useState<GuidePhase>('expert');
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    // 记录首次访问时间
    let firstVisit = localStorage.getItem(STORAGE_KEY);
    if (!firstVisit) {
      firstVisit = Date.now().toString();
      localStorage.setItem(STORAGE_KEY, firstVisit);
    }

    const daysSince = (Date.now() - Number(firstVisit)) / (1000 * 60 * 60 * 24);
    let currentPhase: GuidePhase;
    if (daysSince <= NEWBIE_DAYS) {
      currentPhase = 'newbie';
    } else if (daysSince <= ADAPTING_DAYS) {
      currentPhase = 'adapting';
    } else {
      currentPhase = 'expert';
    }
    startTransition(() => {
      setPhase(currentPhase);
      // 新手期气泡：未手动关闭过才显示
      if (currentPhase === 'newbie') {
        const dismissed = localStorage.getItem(BUBBLE_DISMISSED_KEY);
        if (!dismissed) setShowBubble(true);
      }
    });
  }, []);

  const dismissBubble = () => {
    setShowBubble(false);
    localStorage.setItem(BUBBLE_DISMISSED_KEY, '1');
  };

  return { phase, showBubble, dismissBubble };
}
