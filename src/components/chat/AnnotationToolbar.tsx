'use client';

import { useEffect, useRef } from 'react';
import { GitBranchIcon } from 'lucide-react';
import type { AnnotationType } from '@/types/chat';

interface AnnotationToolbarProps {
  x: number;
  y: number;
  onAnnotate: (type: AnnotationType, note?: string) => void;
  onDismiss: () => void;
}

const BUTTONS: { type: AnnotationType; icon: string; label: string }[] = [
  { type: 'CONFIRM', icon: '✓', label: '认可' },
  { type: 'QUESTION', icon: '?', label: '存疑' },
  { type: 'REJECT', icon: '✗', label: '有误' },
  { type: 'IMPORTANT', icon: '★', label: '重点' },
  { type: 'USE_IN_DOC', icon: '📋', label: '入文书' },
];

export function AnnotationToolbar({
  x,
  y,
  onAnnotate,
  onDismiss,
}: AnnotationToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onDismiss]);

  return (
    <div
      ref={ref}
      className='absolute z-50 flex items-center gap-1 bg-gray-900 rounded-lg px-2 py-1.5 shadow-lg'
      style={{ left: x, top: y - 44 }}
    >
      {BUTTONS.map(btn => (
        <button
          key={btn.type}
          onClick={() => onAnnotate(btn.type)}
          title={btn.label}
          className='text-sm px-1.5 py-0.5 rounded text-white hover:bg-gray-700 transition-colors'
        >
          {btn.icon}
        </button>
      ))}
      <div className='w-px h-4 bg-gray-600 mx-0.5' />
      <button
        onClick={() => onAnnotate('QUESTION')}
        title='从此处分叉'
        className='flex items-center gap-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 px-1.5 py-0.5 rounded transition-colors'
      >
        <GitBranchIcon className='w-3 h-3' />
        分叉
      </button>
    </div>
  );
}
