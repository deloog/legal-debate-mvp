'use client';

import React, { useState } from 'react';
import {
  DragDropZone,
  FileList,
  UploadProgress,
  type UploadedFile,
} from './index';
import { useDocumentUpload } from '@/lib/hooks/use-document-upload';
import { FileValidator } from './index';

interface DocumentUploadProps {
  caseId: string;
  uploadedFiles?: UploadedFile[];
  onFilesUploaded?: (documents: UploadedFile[]) => void;
  onFileDeleted?: (fileId: string) => void;
  disabled?: boolean;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = props => {
  const {
    caseId,
    uploadedFiles: initialFiles = [],
    onFilesUploaded,
    onFileDeleted,
    disabled = false,
  } = props;

  const [uploadedFiles, setUploadedFiles] =
    useState<UploadedFile[]>(initialFiles);
  const [error, setError] = useState<string | null>(null);

  const {
    uploadFiles,
    uploadProgress,
    isUploading,
    cancelUpload,
    retryUpload,
  } = useDocumentUpload({
    caseId,
    onUploadSuccess: documents => {
      setUploadedFiles(prev => [...prev, ...documents]);
      onFilesUploaded?.(documents);
      setError(null);
    },
    onUploadError: err => {
      setError(err.message);
    },
    maxRetries: 3,
  });

  /**
   * 处理文件拖放
   */
  const handleFilesDrop = (files: File[]): void => {
    // 验证文件
    const errors = FileValidator.validateFiles(files);
    if (errors.length > 0) {
      setError(errors.map(e => e.message).join('; '));
      return;
    }

    setError(null);
    uploadFiles(files);
  };

  /**
   * 处理文件删除
   */
  const handleFileDelete = async (fileId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/v1/documents/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      onFileDeleted?.(fileId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  /**
   * 处理文件预览
   */
  const handleFilePreview = (file: UploadedFile): void => {
    if (file.mimeType === 'application/pdf') {
      window.open(file.filePath, '_blank');
    } else if (file.mimeType.includes('word')) {
      window.open(file.filePath, '_blank');
    } else {
      alert('预览功能暂不支持此文件类型');
    }
  };

  /**
   * 获取上传中的文件列表
   */
  const uploadingFiles = Array.from(uploadProgress.values()).filter(
    p => p.status !== 'completed' && p.status !== 'cancelled'
  );

  return (
    <div className='space-y-6'>
      {/* 拖拽上传区域 */}
      <div className='border-2 border-dashed border-gray-300 rounded-lg p-6'>
        <DragDropZone
          onDrop={handleFilesDrop}
          disabled={disabled || isUploading}
          maxFiles={10}
        >
          <div className='text-center'>
            <p className='text-lg font-medium text-gray-700 mb-2'>
              {isUploading ? '上传中...' : '上传文档'}
            </p>
            <p className='text-sm text-gray-500'>
              支持 PDF、Word、TXT 格式，单个文件最大 20MB
            </p>
            <p className='mt-2 text-xs text-blue-600'>
              上传成功后系统会自动开始分析，无需再次手动点击“分析”
            </p>
          </div>
        </DragDropZone>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className='bg-red-50 border border-red-200 rounded-md p-4'>
          <div className='flex items-center'>
            <svg
              className='w-5 h-5 text-red-500 mr-2 shrink-0'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M10 14l2-2m0 0l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <p className='text-sm text-red-700 flex-1'>{error}</p>
            <button
              onClick={() => setError(null)}
              className='ml-2 text-red-500 hover:text-red-700'
              aria-label='关闭错误'
            >
              <svg
                className='w-4 h-4'
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
      )}

      {/* 上传进度 */}
      {uploadingFiles.length > 0 && (
        <div className='space-y-3'>
          <h3 className='text-sm font-medium text-gray-700 mb-3'>上传进度</h3>
          {Array.from(uploadProgress.values()).map(progress => (
            <UploadProgress
              key={progress.fileId}
              progress={progress}
              onCancel={cancelUpload}
              onRetry={retryUpload}
            />
          ))}
        </div>
      )}

      {/* 已上传文件列表 */}
      <div>
        <h3 className='text-sm font-medium text-gray-700 mb-3'>
          已上传文件 ({uploadedFiles.length})
        </h3>
        <FileList
          files={uploadedFiles}
          onDelete={handleFileDelete}
          onPreview={handleFilePreview}
        />
      </div>

      {/* 上传提示 */}
      {isUploading && (
        <div className='text-sm text-gray-500 text-center mt-4'>
          <p>请勿关闭页面，上传完成后将自动刷新</p>
        </div>
      )}
    </div>
  );
};
