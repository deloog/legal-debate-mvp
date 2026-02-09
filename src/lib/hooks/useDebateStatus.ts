/**
 * 辩论状态管理 Hook
 */

import { useCallback, useState } from 'react';

type DebateStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ARCHIVED';

interface UseDebateStatusOptions {
  onSuccess?: (newStatus: DebateStatus) => void;
  onError?: (error: Error) => void;
}

export function useDebateStatus(options: UseDebateStatusOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateStatus = useCallback(
    async (debateId: string, newStatus: DebateStatus) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/debates/${debateId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '状态更新失败');
        }

        options.onSuccess?.(newStatus);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('状态更新失败');
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  return {
    updateStatus,
    isLoading,
    error,
  };
}
