'use client';

import { useEffect, useRef, useState } from 'react';
import { GitBranchIcon, XIcon } from 'lucide-react';
import type { AnnotationType } from '@/types/chat';

interface AnnotationToolbarProps {
  // 视口坐标（fixed 定位）
  x: number;
  y: number;
  onAnnotate: (type: AnnotationType, note?: string) => void;
  onBranch: () => void;
  onDismiss: () => void;
}

const BUTTONS: {
  type: AnnotationType;
  icon: string;
  label: string;
  hasNote?: boolean;
}[] = [
  { type: 'CONFIRM', icon: '✓', label: '认可' },
  { type: 'QUESTION', icon: '?', label: '存疑', hasNote: true },
  { type: 'REJECT', icon: '✗', label: '有误', hasNote: true },
  { type: 'IMPORTANT', icon: '★', label: '重点' },
  { type: 'USE_IN_DOC', icon: '📋', label: '入文书' },
];

export function AnnotationToolbar({
  x,
  y,
  onAnnotate,
  onBranch,
  onDismiss,
}: AnnotationToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [noteFor, setNoteFor] = useState<AnnotationType | null>(null);
  const [note, setNote] = useState('');

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

  // 防止工具条超出视口右侧
  const left = Math.min(x, window.innerWidth - 260);
  const top = y - 52;

  const handleClick = (type: AnnotationType, hasNote?: boolean) => {
    if (hasNote) {
      setNoteFor(type);
      setNote('');
    } else {
      onAnnotate(type);
    }
  };

  const submitNote = () => {
    if (noteFor) onAnnotate(noteFor, note.trim() || undefined);
  };

  return (
    <div ref={ref} className='fixed z-50 shadow-xl' style={{ left, top }}>
      {noteFor ? (
        /* 备注输入框 */
        <div className='bg-gray-900 rounded-xl p-3 w-56'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-xs text-gray-300'>
              {BUTTONS.find(b => b.type === noteFor)?.label} — 添加备注
            </span>
            <button
              onClick={() => setNoteFor(null)}
              className='text-gray-500 hover:text-gray-300'
            >
              <XIcon className='w-3.5 h-3.5' />
            </button>
          </div>
          <textarea
            autoFocus
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitNote();
              }
              if (e.key === 'Escape') setNoteFor(null);
            }}
            placeholder='输入备注（可选，Enter 确认）'
            className='w-full bg-gray-800 text-white text-xs rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-500'
            rows={2}
          />
          <div className='flex justify-end gap-1.5 mt-2'>
            <button
              onClick={() => setNoteFor(null)}
              className='text-xs text-gray-400 hover:text-white px-2 py-1 rounded'
            >
              取消
            </button>
            <button
              onClick={submitNote}
              className='text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg'
            >
              确认
            </button>
          </div>
        </div>
      ) : (
        /* 主工具条 */
        <div className='flex items-center gap-0.5 bg-gray-900 rounded-xl px-2 py-1.5'>
          {BUTTONS.map(btn => (
            <button
              key={btn.type}
              onClick={() => handleClick(btn.type, btn.hasNote)}
              title={btn.label}
              className='text-sm px-2 py-1 rounded-lg text-white hover:bg-gray-700 transition-colors'
            >
              {btn.icon}
            </button>
          ))}
          <div className='w-px h-4 bg-gray-700 mx-1' />
          <button
            onClick={onBranch}
            title='从此处分叉对话'
            className='flex items-center gap-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 px-2 py-1 rounded-lg transition-colors'
          >
            <GitBranchIcon className='w-3 h-3' />
            分叉
          </button>
        </div>
      )}
    </div>
  );
}
