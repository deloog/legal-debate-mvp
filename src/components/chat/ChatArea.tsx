'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  PaperclipIcon,
  SendIcon,
  EyeIcon,
  EyeOffIcon,
  GitBranchIcon,
  Trash2Icon,
  RefreshCwIcon,
} from 'lucide-react';
import { AnnotationToolbar } from './AnnotationToolbar';
import type { ChatMessage, AnnotationType } from '@/types/chat';
import { ANNOTATION_META } from '@/types/chat';

interface ChatAreaProps {
  conversationId: string;
  onUseInDoc: (text: string) => void;
  onTogglePreview: () => void;
  previewOpen: boolean;
}

interface SelectionState {
  messageId: string;
  text: string;
  x: number;
  y: number;
}

export function ChatArea({
  conversationId,
  onUseInDoc,
  onTogglePreview,
  previewOpen,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 加载消息
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/chat/conversations/${conversationId}/messages`
      );
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.data ?? []);
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    loadMessages();
  }, [loadMessages]);

  // 滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // 文字选中 → 标注工具条
  const handleMouseUp = useCallback(
    (messageId: string, e: React.MouseEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection(null);
        return;
      }
      const rect = (e.target as HTMLElement)
        .closest('[data-message-id]')
        ?.getBoundingClientRect();
      if (!rect) return;
      setSelection({
        messageId,
        text: sel.toString().trim(),
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    []
  );

  const handleAnnotate = useCallback(
    async (type: AnnotationType, note?: string) => {
      if (!selection) return;
      if (type === 'USE_IN_DOC') {
        onUseInDoc(selection.text);
      }
      try {
        await fetch(
          `/api/v1/chat/messages/${selection.messageId}/annotations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              selectedText: selection.text,
              startOffset: 0,
              endOffset: selection.text.length,
              type,
              note: note ?? null,
            }),
          }
        );
        loadMessages();
      } catch {
        // 静默失败
      } finally {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }
    },
    [selection, onUseInDoc, loadMessages]
  );

  // 发送消息
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content && files.length === 0) return;
    setSending(true);
    setInput('');
    setFiles([]);

    // 乐观 UI：先展示用户消息
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId,
      role: 'user',
      content,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      attachments: [],
      annotations: [],
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await fetch(
        `/api/v1/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      );
      if (!res.ok) throw new Error('发送失败');
      await loadMessages();
    } catch {
      // 移除乐观消息
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }, [input, files, conversationId, loadMessages]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // 删除消息
  const handleDelete = useCallback(
    async (messageId: string, withSubsequent: boolean) => {
      try {
        await fetch(`/api/v1/chat/messages/${messageId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ withSubsequent }),
        });
        loadMessages();
      } catch {
        // 静默失败
      }
    },
    [loadMessages]
  );

  // 重新生成
  const handleRegenerate = useCallback(
    async (messageId: string) => {
      setSending(true);
      try {
        await fetch(`/api/v1/chat/messages/${messageId}/regenerate`, {
          method: 'POST',
        });
        loadMessages();
      } catch {
        // 静默失败
      } finally {
        setSending(false);
      }
    },
    [loadMessages]
  );

  // 分叉
  const handleBranch = useCallback(
    async (messageId: string) => {
      try {
        const res = await fetch(
          `/api/v1/chat/conversations/${conversationId}/branch`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromMessageId: messageId }),
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        window.location.href = `/chat/${data.data.id}`;
      } catch {
        // 静默失败
      }
    },
    [conversationId]
  );

  if (loading) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <div className='h-7 w-7 animate-spin rounded-full border-4 border-blue-600 border-r-transparent' />
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col min-w-0 relative'>
      {/* 顶部工具栏 */}
      <div className='flex items-center justify-end px-4 py-2 border-b border-gray-100'>
        <button
          onClick={onTogglePreview}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
            previewOpen
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          {previewOpen ? (
            <EyeOffIcon className='w-3.5 h-3.5' />
          ) : (
            <EyeIcon className='w-3.5 h-3.5' />
          )}
          文书预览
        </button>
      </div>

      {/* 消息列表 */}
      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-4'>
        {messages.length === 0 && (
          <div className='flex flex-col items-center justify-center h-full text-center py-16'>
            <p className='text-2xl font-light text-gray-300 mb-3'>律伴</p>
            <p className='text-sm text-gray-400 max-w-xs'>
              上传卷宗或合同，开始分析。或直接输入法律问题。
            </p>
          </div>
        )}

        {messages
          .filter(m => !m.isDeleted)
          .map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onMouseUp={handleMouseUp}
              onDelete={handleDelete}
              onRegenerate={handleRegenerate}
              onBranch={handleBranch}
              sending={sending}
            />
          ))}

        {sending && (
          <div className='flex gap-3'>
            <div className='w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5'>
              <span className='text-xs text-blue-600 font-bold'>AI</span>
            </div>
            <div className='bg-gray-50 rounded-xl px-4 py-3'>
              <div className='flex gap-1 items-center h-5'>
                <span className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]' />
                <span className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]' />
                <span className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce' />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 标注工具条（浮动，相对消息区定位） */}
      {selection && (
        <AnnotationToolbar
          x={selection.x}
          y={selection.y}
          onAnnotate={handleAnnotate}
          onDismiss={() => setSelection(null)}
        />
      )}

      {/* 底部输入区 */}
      <div className='border-t border-gray-100 px-4 py-3'>
        {/* 已选文件展示 */}
        {files.length > 0 && (
          <div className='flex flex-wrap gap-2 mb-2'>
            {files.map((f, i) => (
              <div
                key={i}
                className='flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded'
              >
                <PaperclipIcon className='w-3 h-3' />
                <span className='max-w-32 truncate'>{f.name}</span>
                <button
                  onClick={() =>
                    setFiles(prev => prev.filter((_, j) => j !== i))
                  }
                  className='ml-1 text-blue-400 hover:text-blue-600'
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className='flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2'>
          {/* 上传按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className='shrink-0 text-gray-400 hover:text-gray-600 mb-0.5'
            title='上传文件（卷宗/合同）'
          >
            <PaperclipIcon className='w-5 h-5' />
          </button>
          <input
            ref={fileInputRef}
            type='file'
            multiple
            accept='.pdf,.doc,.docx,.txt'
            className='hidden'
            onChange={e => setFiles(Array.from(e.target.files ?? []))}
          />

          {/* 输入框 */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='输入法律问题，或上传卷宗/合同开始分析…（Shift+Enter 换行）'
            rows={1}
            className='flex-1 bg-transparent text-sm text-gray-800 resize-none focus:outline-none placeholder:text-gray-400 min-h-[24px]'
          />

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={sending || (!input.trim() && files.length === 0)}
            className='shrink-0 mb-0.5 text-blue-600 hover:text-blue-700 disabled:text-gray-300 transition-colors'
          >
            <SendIcon className='w-5 h-5' />
          </button>
        </div>

        <p className='text-xs text-gray-400 text-center mt-1.5'>
          AI 回复仅供参考，重要法律问题请结合专业判断
        </p>
      </div>
    </div>
  );
}

// 单条消息气泡
function MessageBubble({
  message,
  onMouseUp,
  onDelete,
  onRegenerate,
  onBranch,
  sending,
}: {
  message: ChatMessage;
  onMouseUp: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, withSubsequent: boolean) => void;
  onRegenerate: (id: string) => void;
  onBranch: (id: string) => void;
  sending: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* 头像 */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold
          ${isUser ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-600'}`}
      >
        {isUser ? '我' : 'AI'}
      </div>

      {/* 内容区 */}
      <div className='flex-1 min-w-0'>
        <div
          data-message-id={message.id}
          className={`relative rounded-xl px-4 py-3 text-sm leading-relaxed select-text
            ${
              isUser
                ? 'bg-blue-600 text-white ml-12'
                : 'bg-gray-50 text-gray-800 mr-12'
            }`}
          onMouseUp={isUser ? undefined : e => onMouseUp(message.id, e)}
        >
          {/* 标注高亮标签 */}
          {message.annotations.length > 0 && !isUser && (
            <div className='flex flex-wrap gap-1 mb-2'>
              {message.annotations.map(ann => (
                <span
                  key={ann.id}
                  className={`text-xs px-1.5 py-0.5 rounded ${ANNOTATION_META[ann.type as AnnotationType]?.bg ?? 'bg-gray-100'} ${ANNOTATION_META[ann.type as AnnotationType]?.color ?? 'text-gray-600'}`}
                >
                  {ANNOTATION_META[ann.type as AnnotationType]?.label ??
                    ann.type}
                  {ann.note && `：${ann.note}`}
                </span>
              ))}
            </div>
          )}

          {isUser ? (
            <p className='whitespace-pre-wrap'>{message.content}</p>
          ) : (
            <div className='prose prose-sm max-w-none prose-p:my-1 prose-headings:mt-3'>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* 操作按钮（悬停显示） */}
        {showActions && (
          <div
            className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <ActionButton
              icon={<GitBranchIcon className='w-3 h-3' />}
              label='分叉'
              onClick={() => onBranch(message.id)}
            />
            {!isUser && (
              <ActionButton
                icon={<RefreshCwIcon className='w-3 h-3' />}
                label='重新生成'
                onClick={() => onRegenerate(message.id)}
                disabled={sending}
              />
            )}
            <ActionButton
              icon={<Trash2Icon className='w-3 h-3' />}
              label='删除'
              onClick={() => onDelete(message.id, true)}
              danger
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors disabled:opacity-40
        ${
          danger
            ? 'text-red-400 hover:text-red-600 hover:bg-red-50'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
    >
      {icon}
      {label}
    </button>
  );
}
