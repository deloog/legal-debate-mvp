'use client';

import { useCallback, useState } from 'react';

/**
 * 前端辩论状态类型（小写）
 */
type FrontendDebateStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

/**
 * 后端辩论状态类型（大写）
 */
type BackendDebateStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ARCHIVED';

/**
 * 状态映射（后端大写到前端小写）
 */
const BACKEND_TO_FRONTEND: Record<BackendDebateStatus, FrontendDebateStatus> = {
  DRAFT: 'draft',
  IN_PROGRESS: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

/**
 * 状态映射（前端小写到后端大写）
 */
const FRONTEND_TO_BACKEND: Record<FrontendDebateStatus, BackendDebateStatus> = {
  draft: 'DRAFT',
  active: 'IN_PROGRESS',
  paused: 'PAUSED',
  completed: 'COMPLETED',
  archived: 'ARCHIVED',
};

interface DebateStatusManagerProps {
  debateId: string;
  currentBackendStatus: BackendDebateStatus;
  onStatusChange: (
    debateId: string,
    newBackendStatus: BackendDebateStatus
  ) => Promise<void>;
}

const STATUS_CONFIG: Record<
  FrontendDebateStatus,
  { label: string; color: string; actions: FrontendDebateStatus[] }
> = {
  draft: {
    label: '草稿',
    color: '#9e9e9e',
    actions: ['active', 'archived'],
  },
  active: {
    label: '进行中',
    color: '#4caf50',
    actions: ['paused', 'completed'],
  },
  paused: {
    label: '已暂停',
    color: '#ff9800',
    actions: ['active', 'completed'],
  },
  completed: {
    label: '已完成',
    color: '#2196f3',
    actions: ['archived', 'active'],
  },
  archived: {
    label: '已归档',
    color: '#607d8b',
    actions: ['active'],
  },
};

const ACTION_LABELS: Record<FrontendDebateStatus, string> = {
  draft: '开始辩论',
  active: '继续辩论',
  paused: '继续辩论',
  completed: '重新开启',
  archived: '重新激活',
};

export function DebateStatusManager({
  debateId,
  currentBackendStatus,
  onStatusChange,
}: DebateStatusManagerProps) {
  const currentStatus = BACKEND_TO_FRONTEND[currentBackendStatus];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] =
    useState<FrontendDebateStatus | null>(null);

  const config = STATUS_CONFIG[currentStatus];
  const availableActions = config.actions;

  const handleAction = useCallback(
    async (newFrontendStatus: FrontendDebateStatus) => {
      if (newFrontendStatus === currentStatus) return;

      const newBackendStatus = FRONTEND_TO_BACKEND[newFrontendStatus];
      setPendingAction(newFrontendStatus);
      setError(null);
      setIsLoading(true);

      try {
        await onStatusChange(debateId, newBackendStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : '状态更新失败');
      } finally {
        setIsLoading(false);
        setPendingAction(null);
      }
    },
    [debateId, currentStatus, onStatusChange]
  );

  const confirmPause = useCallback(() => {
    if (confirm('确定要暂停辩论吗？暂停后可以随时继续。')) {
      handleAction('paused');
    }
  }, [handleAction]);

  const confirmComplete = useCallback(() => {
    if (confirm('确定要完成辩论吗？完成后将无法继续添加论点。')) {
      handleAction('completed');
    }
  }, [handleAction]);

  const confirmArchive = useCallback(() => {
    if (confirm('确定要归档辩论吗？归档后可随时重新激活。')) {
      handleAction('archived');
    }
  }, [handleAction]);

  const renderActionButton = (action: FrontendDebateStatus) => {
    const loadingAction = pendingAction;
    const label = ACTION_LABELS[action];

    switch (action) {
      case 'paused':
        return (
          <button
            key='pause'
            onClick={confirmPause}
            disabled={isLoading && pendingAction === 'paused'}
            className='action-button pause'
          >
            {isLoading && loadingAction === 'paused' ? '暂停中...' : '暂停辩论'}
          </button>
        );
      case 'completed':
        return (
          <button
            key='complete'
            onClick={confirmComplete}
            disabled={isLoading && pendingAction === 'completed'}
            className='action-button complete'
          >
            {isLoading && loadingAction === 'completed'
              ? '完成中...'
              : '完成辩论'}
          </button>
        );
      case 'archived':
        return (
          <button
            key='archive'
            onClick={confirmArchive}
            disabled={isLoading && pendingAction === 'archived'}
            className='action-button archive'
          >
            {isLoading && loadingAction === 'archived'
              ? '归档中...'
              : '归档辩论'}
          </button>
        );
      default:
        return (
          <button
            key={action}
            onClick={() => handleAction(action)}
            disabled={isLoading && pendingAction === action}
            className='action-button activate'
          >
            {isLoading && loadingAction === action ? '处理中...' : label}
          </button>
        );
    }
  };

  return (
    <div className='debate-status-manager'>
      <div className='status-header'>
        <span
          className='status-badge'
          style={{ backgroundColor: config.color }}
        >
          {config.label}
        </span>
      </div>

      {error && <div className='status-error'>{error}</div>}

      <div className='status-actions'>
        {availableActions.map(action => renderActionButton(action))}
      </div>

      <div className='status-info'>
        <p>辩论ID: {debateId}</p>
        <p className='hint'>
          {currentStatus === 'draft' && '辩论尚未开始，可以进行设置和准备。'}
          {currentStatus === 'active' && '辩论正在进行中，双方可以提交论点。'}
          {currentStatus === 'paused' && '辩论已暂停，双方暂时无法提交论点。'}
          {currentStatus === 'completed' && '辩论已完成，所有论点已冻结。'}
          {currentStatus === 'archived' && '辩论已归档，如需查看可以重新激活。'}
        </p>
      </div>

      <style jsx>{`
        .debate-status-manager {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          background: #fff;
        }

        .status-header {
          margin-bottom: 12px;
        }

        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 16px;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
        }

        .status-error {
          color: #d32f2f;
          font-size: 13px;
          margin-bottom: 12px;
          padding: 8px;
          background: #ffebee;
          border-radius: 4px;
        }

        .status-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .action-button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: opacity 0.2s;
        }

        .action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .action-button.pause {
          background: #ff9800;
          color: #fff;
        }

        .action-button.complete {
          background: #4caf50;
          color: #fff;
        }

        .action-button.archive {
          background: #607d8b;
          color: #fff;
        }

        .action-button.activate {
          background: #2196f3;
          color: #fff;
        }

        .status-info {
          font-size: 12px;
          color: #666;
        }

        .status-info p {
          margin: 4px 0;
        }

        .status-info .hint {
          margin-top: 8px;
          padding: 8px;
          background: #f5f5f5;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
