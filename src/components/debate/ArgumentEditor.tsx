'use client';

import type { Argument } from '@/lib/debate/types';
import { useCallback, useState } from 'react';

interface ArgumentEditorProps {
  argument: Argument;
  onSave: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCancel: () => void;
}

const ARGUMENT_TYPE_LABELS: Record<Argument['type'], string> = {
  main_point: '立论',
  supporting: '支撑',
  rebuttal: '反驳',
  evidence: '证据',
  conclusion: '结论',
};

export function ArgumentEditor({
  argument,
  onSave,
  onDelete,
  onCancel,
}: ArgumentEditorProps) {
  const [content, setContent] = useState(argument.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!content.trim()) {
      setError('论点内容不能为空');
      return;
    }

    if (content.length < 10) {
      setError('论点内容至少需要10个字符');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await onSave(argument.id, content);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [argument.id, content, onSave]);

  const handleDelete = useCallback(async () => {
    if (!confirm('确定要删除此论点吗？此操作不可撤销。')) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await onDelete(argument.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  }, [argument.id, onDelete]);

  return (
    <div className='argument-editor'>
      <div className='editor-header'>
        <span className={`type-badge ${argument.side}`}>
          {ARGUMENT_TYPE_LABELS[argument.type]}
        </span>
        <span className='side-label'>
          {argument.side === 'plaintiff' ? '原告' : '被告'}
        </span>
      </div>

      <div className='editor-content'>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={6}
          placeholder='输入论点内容...'
          disabled={isSaving || isDeleting}
        />
      </div>

      {error && <div className='editor-error'>{error}</div>}

      <div className='editor-reasoning'>
        <label>推理逻辑：</label>
        <p>{argument.reasoning}</p>
      </div>

      {argument.legalBasis.length > 0 && (
        <div className='editor-legal-basis'>
          <label>法律依据：</label>
          <ul>
            {argument.legalBasis.map((basis, index) => (
              <li key={index}>
                《{basis.lawName}》第{basis.articleNumber}条 -{' '}
                {basis.explanation}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className='editor-scores'>
        <span>逻辑评分：{argument.logicScore.toFixed(1)}</span>
        <span>法律评分：{argument.legalAccuracyScore.toFixed(1)}</span>
        <span>综合评分：{argument.overallScore.toFixed(1)}</span>
      </div>

      <div className='editor-actions'>
        <button
          type='button'
          onClick={handleSave}
          disabled={isSaving || isDeleting}
          className='save-button'
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
        <button
          type='button'
          onClick={handleDelete}
          disabled={isSaving || isDeleting}
          className='delete-button'
        >
          {isDeleting ? '删除中...' : '删除'}
        </button>
        <button
          type='button'
          onClick={onCancel}
          disabled={isSaving || isDeleting}
          className='cancel-button'
        >
          取消
        </button>
      </div>

      <style jsx>{`
        .argument-editor {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          background: #fff;
        }

        .editor-header {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }

        .type-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .type-badge.plaintiff {
          background: #e3f2fd;
          color: #1565c0;
        }

        .type-badge.defendant {
          background: #fce4ec;
          color: #c62828;
        }

        .side-label {
          color: #666;
          font-size: 12px;
        }

        .editor-content textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          resize: vertical;
        }

        .editor-error {
          color: #d32f2f;
          font-size: 12px;
          margin-top: 8px;
        }

        .editor-reasoning,
        .editor-legal-basis {
          margin-top: 12px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 4px;
          font-size: 13px;
        }

        .editor-reasoning label,
        .editor-legal-basis label {
          font-weight: 500;
          color: #333;
        }

        .editor-legal-basis ul {
          margin: 8px 0 0;
          padding-left: 20px;
        }

        .editor-legal-basis li {
          margin-top: 4px;
        }

        .editor-scores {
          display: flex;
          gap: 16px;
          margin-top: 12px;
          font-size: 12px;
          color: #666;
        }

        .editor-actions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .editor-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .save-button {
          background: #2196f3;
          color: #fff;
        }

        .save-button:disabled {
          background: #90caf9;
        }

        .delete-button {
          background: #f44336;
          color: #fff;
        }

        .delete-button:disabled {
          background: #ef9a9a;
        }

        .cancel-button {
          background: #e0e0e0;
          color: #333;
        }

        .cancel-button:disabled {
          background: #bdbdbd;
        }
      `}</style>
    </div>
  );
}
