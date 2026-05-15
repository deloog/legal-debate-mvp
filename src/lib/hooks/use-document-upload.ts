'use client';

import { useState, useCallback, useRef } from 'react';
import { FileValidator } from '@/app/documents/components/file-validator';
import type {
  UploadProgressState,
  UploadStatus,
} from '@/app/documents/components/upload-progress';

import type { UploadedFile } from '@/app/documents/components/file-list';

interface UploadOptions {
  caseId: string;
  onUploadSuccess?: (documents: UploadedFile[]) => void;
  onUploadError?: (error: Error) => void;
  maxRetries?: number;
}

interface UploadApiResponse {
  success: boolean;
  data?: UploadedFile;
  error?: string;
  message?: string;
}

interface UploadFileContext {
  file: File;
  fileId: string;
  retryCount: number;
  lastProgressTime: number;
  lastUploadedBytes: number;
  abortController: AbortController;
}

export const useDocumentUpload = (options: UploadOptions) => {
  const { caseId, onUploadSuccess, onUploadError, maxRetries = 3 } = options;

  const [uploadProgress, setUploadProgress] = useState<
    Map<string, UploadProgressState>
  >(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [, setUploadQueue] = useState<UploadFileContext[]>([]);
  const uploadContextRef = useRef<Map<string, UploadFileContext>>(new Map());

  /**
   * 生成唯一的文件ID
   */
  const generateFileId = useCallback((file: File): string => {
    return `${file.name}-${file.size}-${Date.now()}`;
  }, []);

  /**
   * 更新上传进度
   */
  const updateProgress = useCallback(
    (fileId: string, uploaded: number, total: number): void => {
      const context = uploadContextRef.current.get(fileId);
      if (!context) {
        return;
      }

      const now = Date.now();

      let speed = 0;
      let remainingTime = 0;

      if (context.lastProgressTime > 0) {
        const timeDiff = (now - context.lastProgressTime) / 1000;
        const bytesDiff = uploaded - context.lastUploadedBytes;

        if (timeDiff > 0) {
          speed = bytesDiff / timeDiff;
        }
      }

      if (speed > 0) {
        remainingTime = (total - uploaded) / speed;
      }

      context.lastProgressTime = now;
      context.lastUploadedBytes = uploaded;

      const progress: UploadProgressState = {
        fileId,
        fileName: context.file.name,
        progress: Math.round((uploaded / total) * 100),
        uploaded,
        total,
        speed: Math.round(speed),
        remainingTime: Math.round(remainingTime),
        status: 'uploading',
      };

      setUploadProgress(prev => new Map(prev).set(fileId, progress));
    },
    []
  );

  /**
   * 创建FormData
   */
  const createFormData = useCallback(
    (file: File, fileId: string): FormData => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileId', fileId);
      formData.append('caseId', caseId);
      return formData;
    },
    [caseId]
  );

  /**
   * 上传单个文件
   */
  const uploadFile = useCallback(
    async (context: UploadFileContext): Promise<UploadedFile> => {
      const { file, fileId } = context;

      setUploadProgress(prev =>
        new Map(prev).set(fileId, {
          fileId,
          fileName: file.name,
          progress: 0,
          uploaded: 0,
          total: file.size,
          speed: 0,
          remainingTime: 0,
          status: 'uploading',
        })
      );

      const startTime = Date.now();
      context.lastProgressTime = startTime;
      context.lastUploadedBytes = 0;

      try {
        const formData = createFormData(file, fileId);

        const response = await new Promise<UploadedFile>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', event => {
            if (event.lengthComputable) {
              updateProgress(fileId, event.loaded, event.total);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const result = JSON.parse(
                  xhr.responseText
                ) as UploadApiResponse;
                if (!result?.success) {
                  reject(
                    new Error(
                      result?.error || result?.message || '上传失败，请稍后重试'
                    )
                  );
                  return;
                }
                if (!result.data) {
                  reject(new Error('上传成功，但服务端未返回文档信息'));
                  return;
                }
                resolve(result.data);
              } catch {
                reject(new Error('解析响应失败'));
              }
            } else {
              try {
                const result = JSON.parse(
                  xhr.responseText
                ) as UploadApiResponse;
                reject(
                  new Error(
                    result?.error ||
                      result?.message ||
                      `上传失败: ${xhr.status}`
                  )
                );
              } catch {
                reject(new Error(`上传失败: ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('网络错误，上传失败'));
          });

          xhr.addEventListener('abort', () => {
            reject(new Error('上传已取消'));
          });

          xhr.addEventListener('timeout', () => {
            reject(new Error('上传超时'));
          });

          xhr.timeout = 30000;

          xhr.open('POST', '/api/v1/documents/upload');
          xhr.send(formData);
        });

        setUploadProgress(prev => {
          const updated = new Map(prev);
          const current = updated.get(fileId);
          if (current) {
            updated.set(fileId, {
              ...current,
              status: 'completed' as UploadStatus,
            });
          }
          return updated;
        });

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '上传失败';
        setUploadProgress(prev => {
          const updated = new Map(prev);
          const current = updated.get(fileId);
          if (current) {
            updated.set(fileId, {
              ...current,
              status: 'error' as UploadStatus,
              error: errorMessage,
            });
          }
          return updated;
        });

        throw error;
      }
    },
    [createFormData, updateProgress]
  );

  /**
   * 重试上传
   */
  const retryUpload = useCallback(
    async (fileId: string): Promise<void> => {
      const context = uploadContextRef.current.get(fileId);
      if (!context) {
        return;
      }

      context.abortController = new AbortController();
      context.retryCount = 0;

      await uploadFile(context);
    },
    [uploadFile]
  );

  /**
   * 取消上传
   */
  const cancelUpload = useCallback((fileId: string): void => {
    const context = uploadContextRef.current.get(fileId);
    if (context) {
      context.abortController.abort();

      setUploadProgress(prev => {
        const updated = new Map(prev);
        const current = updated.get(fileId);
        if (current) {
          updated.set(fileId, {
            ...current,
            status: 'cancelled' as UploadStatus,
          });
        }
        return updated;
      });
    }
  }, []);

  /**
   * 上传多个文件
   */
  const uploadFiles = useCallback(
    async (files: File[]): Promise<void> => {
      const errors = FileValidator.validateFiles(files);
      if (errors.length > 0) {
        onUploadError?.(new Error(errors.map(e => e.message).join('; ')));
        return;
      }

      setIsUploading(true);

      const contexts: UploadFileContext[] = files.map(file => ({
        file,
        fileId: generateFileId(file),
        retryCount: 0,
        lastProgressTime: 0,
        lastUploadedBytes: 0,
        abortController: new AbortController(),
      }));

      setUploadQueue(contexts);

      uploadContextRef.current.clear();
      contexts.forEach(ctx => {
        uploadContextRef.current.set(ctx.fileId, ctx);
      });

      const results: UploadedFile[] = [];
      const failedFiles: string[] = [];

      for (const ctx of contexts) {
        let retryCount = 0;
        let success = false;

        while (!success && retryCount < maxRetries) {
          try {
            const result = await uploadFile(ctx);
            results.push(result);
            success = true;
          } catch {
            retryCount++;
            ctx.retryCount = retryCount;

            if (retryCount >= maxRetries) {
              failedFiles.push(ctx.file.name);
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        setUploadQueue(prev => prev.filter(c => c.fileId !== ctx.fileId));
        uploadContextRef.current.delete(ctx.fileId);
      }

      setIsUploading(false);

      if (failedFiles.length > 0) {
        onUploadError?.(
          new Error(`以下文件上传失败: ${failedFiles.join(', ')}`)
        );
      } else {
        onUploadSuccess?.(results);
      }
    },
    [generateFileId, uploadFile, onUploadError, onUploadSuccess, maxRetries]
  );

  return {
    uploadFiles,
    uploadProgress,
    isUploading,
    cancelUpload,
    retryUpload,
  };
};
