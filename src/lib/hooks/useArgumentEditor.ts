/**
 * 论点编辑器 Hook
 */

import type { Argument } from '@/lib/debate/types';
import { useCallback, useState } from 'react';

interface UseArgumentEditorOptions {
  onSaveSuccess?: (argument: Argument) => void;
  onDeleteSuccess?: (argumentId: string) => void;
  onError?: (error: Error) => void;
}

export function useArgumentEditor(options: UseArgumentEditorOptions = {}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const saveArgument = useCallback(
    async (debateId: string, argumentId: string, content: string) => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/v1/debates/${debateId}/arguments/${argumentId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '保存失败');
        }

        const updatedArgument = await response.json();
        options.onSaveSuccess?.(updatedArgument);
        return updatedArgument;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('保存失败');
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [options]
  );

  const deleteArgument = useCallback(
    async (debateId: string, argumentId: string) => {
      setIsDeleting(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/v1/debates/${debateId}/arguments/${argumentId}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '删除失败');
        }

        options.onDeleteSuccess?.(argumentId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('删除失败');
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsDeleting(false);
      }
    },
    [options]
  );

  return {
    saveArgument,
    deleteArgument,
    isSaving,
    isDeleting,
    error,
  };
}
