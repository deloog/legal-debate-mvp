"use client";

import React from "react";

export type UploadStatus = "uploading" | "completed" | "error" | "cancelled";

export interface UploadProgressState {
  fileId: string;
  fileName: string;
  progress: number; // 0-100
  uploaded: number; // bytes
  total: number; // bytes
  speed: number; // bytes/s
  remainingTime: number; // seconds
  status: UploadStatus;
  error?: string;
}

interface UploadProgressProps {
  progress: UploadProgressState;
  onCancel?: (fileId: string) => void;
  onRetry?: (fileId: string) => void;
}

export const UploadProgress: React.FC<UploadProgressProps> = (props) => {
  const { progress, onCancel, onRetry } = props;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)} 秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes} 分 ${remainingSeconds} 秒`;
  };

  const getStatusIcon = (): React.ReactElement => {
    switch (progress.status) {
      case "uploading":
        return (
          <div className="animate-spin w-4 h-4 text-blue-500">
            <svg className="animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-0V8a8 8 0 00-16 0v4a8 8 0 018 0zm-2 0a6 6 0 00-12 0v4a6 6 0 0012 0v-4z"
              />
            </svg>
          </div>
        );
      case "completed":
        return (
          <svg
            className="w-5 h-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "error":
        return (
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l-2-2m2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "cancelled":
        return (
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18 6L6 18M6 6l12 12"
            />
          </svg>
        );
      default:
        return <></>;
    }
  };

  const getProgressColor = (): string => {
    switch (progress.status) {
      case "uploading":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-400";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
      <div className="shrink-0">{getStatusIcon()}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {progress.fileName}
          </p>
          <span className="text-xs text-gray-500 ml-2 shrink-0">
            {progress.progress}%
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${progress.progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {progress.uploaded > 0 && progress.total > 0
              ? `${Math.round((progress.uploaded / progress.total) * 100)}%`
              : "0%"}
          </span>
          {progress.status === "uploading" && progress.speed > 0 && (
            <span className="flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7m0 0v4h7v-7m-7 0l-7 7"
                />
              </svg>
              {formatTime(progress.remainingTime)}
            </span>
          )}
        </div>

        {progress.status === "error" && progress.error && (
          <p className="text-xs text-red-600 mt-1">{progress.error}</p>
        )}
      </div>

      <div className="flex flex-col space-y-1">
        {progress.status === "uploading" && onCancel && (
          <button
            onClick={() => onCancel(progress.fileId)}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors"
            aria-label="取消上传"
          >
            取消
          </button>
        )}
        {progress.status === "error" && onRetry && (
          <button
            onClick={() => onRetry(progress.fileId)}
            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            aria-label="重试"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
};
