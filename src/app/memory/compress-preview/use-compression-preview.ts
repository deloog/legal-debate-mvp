/**
 * useCompressionPreview - 压缩预览Hook
 */

"use client";

import { useState, useCallback } from "react";

export interface CompressionPreviewInput {
  content?: string;
  memoryId?: string;
  importance?: number;
}

export interface CompressionPreviewOutput {
  original: {
    content: string;
    length: number;
  };
  compressed: {
    summary: string;
    keyInfo: Array<{ field: string; value: string; importance: number }>;
    length: number;
  };
  metrics: {
    compressionRatio: number;
    spaceSaved: number;
    keyInfoCount: number;
  };
}

export interface CompressionPreviewResult {
  preview: CompressionPreviewOutput | null;
  loading: boolean;
  error: string | null;
  handlePreview: (input: CompressionPreviewInput) => Promise<void>;
  reset: () => void;
}

/**
 * 压缩预览Hook
 */
export function useCompressionPreview(): CompressionPreviewResult {
  const [preview, setPreview] = useState<CompressionPreviewOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 处理压缩预览
   */
  const handlePreview = useCallback(async (input: CompressionPreviewInput) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/memory/compress-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "压缩预览失败");
      }

      const data = await response.json();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "压缩预览失败");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return {
    preview,
    loading,
    error,
    handlePreview,
    reset,
  };
}
