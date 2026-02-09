'use client';

import React, { useState, useRef, DragEvent } from 'react';

interface DragDropZoneProps {
  onDrop: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  children?: React.ReactNode;
  accept?: string;
  capture?: boolean;
}

interface DragDropState {
  isDragging: boolean;
  isHovering: boolean;
}

export const DragDropZone: React.FC<DragDropZoneProps> = props => {
  const {
    onDrop,
    disabled = false,
    maxFiles = 10,
    children,
    accept,
    capture = false,
  } = props;
  const [state, setState] = useState<DragDropState>({
    isDragging: false,
    isHovering: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setState({ isDragging: true, isHovering: true });
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setState({ isDragging: false, isHovering: false });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setState({ isDragging: false, isHovering: false });

    if (disabled) {
      return;
    }

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const limitedFiles = maxFiles > 0 ? files.slice(0, maxFiles) : files;
      onDrop(limitedFiles);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const limitedFiles = maxFiles > 0 ? files.slice(0, maxFiles) : files;
      onDrop(limitedFiles);
    }
    // 重置input，允许重复选择同一文件
    e.target.value = '';
  };

  const handleClick = (): void => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const zoneStyles = {
    border: state.isDragging ? '2px dashed #3b82f6' : '2px dashed #d1d5db',
    backgroundColor: state.isHovering ? '#eff6ff' : 'transparent',
    transition: 'all 0.2s ease-in-out',
  };

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center 
        p-8 rounded-lg cursor-pointer
        hover:bg-gray-50
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      style={zoneStyles}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role='button'
      tabIndex={disabled ? -1 : 0}
      aria-label='上传文件区域'
    >
      <input
        ref={inputRef}
        type='file'
        multiple
        className='hidden'
        onChange={handleInputChange}
        disabled={disabled}
        accept={accept}
        capture={capture ? 'environment' : undefined}
      />
      {children || (
        <div className='flex flex-col items-center space-y-4 text-gray-600'>
          <svg
            className='w-16 h-16 text-gray-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
            />
          </svg>
          <p className='text-lg font-medium'>拖拽文件到此处</p>
          <p className='text-sm text-gray-500'>或点击选择文件</p>
        </div>
      )}
    </div>
  );
};
