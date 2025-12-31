"use client";

import React from "react";
import { FileValidator } from "./file-validator";

export interface UploadedFile {
  id: string;
  filename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  analysisStatus: string;
  createdAt: string;
}

interface FileListProps {
  files: UploadedFile[];
  onDelete?: (fileId: string) => void;
  onPreview?: (file: UploadedFile) => void;
}

export const FileList: React.FC<FileListProps> = (props) => {
  const { files, onDelete, onPreview } = props;

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">暂无上传文件</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* 文件类型图标 */}
            <div className="shrink-0">
              <FileIcon file={file} />
            </div>

            {/* 文件信息 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.filename}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-gray-500">
                  {FileValidator.formatFileSize(file.fileSize)}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">
                  {new Date(file.createdAt).toLocaleString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <StatusBadge status={file.analysisStatus} />
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-2">
            {onPreview && (
              <button
                onClick={() => onPreview(file)}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                aria-label="预览文件"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3 9v-3a3 3 0 00-3-3H6a3 3 0 00-3 3v3m18 0v-3a3 3 0 00-3-3H6a3 3 0 00-3 3v3m18 0V6a3 3 0 00-3-3H6a3 3 0 00-3 3v3"
                  />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(file.id)}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                aria-label="删除文件"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

interface FileIconProps {
  file: UploadedFile;
}

const FileIcon: React.FC<FileIconProps> = ({ file }) => {
  const getIcon = (): React.ReactElement => {
    const type = file.mimeType;

    if (type === "application/pdf") {
      return (
        <svg
          className="w-10 h-10 text-red-500"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
      );
    }

    if (type.includes("word") || type.includes("document")) {
      return (
        <svg
          className="w-10 h-10 text-blue-500"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M13,9V3.5L18.5,9M13,13H8V11H13V13M13,15H8V17H13V15Z" />
        </svg>
      );
    }

    if (type === "text/plain") {
      return (
        <svg
          className="w-10 h-10 text-gray-500"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M13,9V3.5L18.5,9M13,13H8V11H13V13M13,15H8V17H13V15Z" />
        </svg>
      );
    }

    return (
      <svg
        className="w-10 h-10 text-gray-400"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M13,9V3.5L18.5,9M13,13H8V11H13V13M13,15H8V17H13V15Z" />
      </svg>
    );
  };

  return getIcon();
};

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusStyle = (): { color: string; label: string } => {
    switch (status) {
      case "PENDING":
        return { color: "bg-yellow-100 text-yellow-800", label: "待解析" };
      case "PROCESSING":
        return { color: "bg-blue-100 text-blue-800", label: "解析中" };
      case "COMPLETED":
        return { color: "bg-green-100 text-green-800", label: "已完成" };
      case "FAILED":
        return { color: "bg-red-100 text-red-800", label: "失败" };
      default:
        return { color: "bg-gray-100 text-gray-800", label: status };
    }
  };

  const { color, label } = getStatusStyle();

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${color}`}>{label}</span>
  );
};
