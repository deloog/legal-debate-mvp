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
  DownloadIcon,
  PrinterIcon,
  ShieldCheckIcon,
  GitBranchIcon,
  Trash2Icon,
  RefreshCwIcon,
  FileTextIcon,
  SearchIcon,
  Edit3Icon,
  ScaleIcon,
  SparklesIcon,
  XIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  MenuIcon,
} from 'lucide-react';
import { AnnotationToolbar } from './AnnotationToolbar';
import type { ChatMessage, AnnotationType } from '@/types/chat';
import { ANNOTATION_META } from '@/types/chat';
import { useAnnotationGuide } from '@/hooks/useAnnotationGuide';
import type { GuidePhase } from '@/hooks/useAnnotationGuide';
import { useAuth } from '@/app/providers/AuthProvider';

interface ChatAreaProps {
  conversationId: string;
  onUseInDoc: (text: string) => void;
  onDocumentGenerated: (content: string) => void;
  onTogglePreview: () => void;
  previewOpen: boolean;
  onMessageSent?: () => void;
  onMobileSidebarOpen?: () => void;
}

const DOC_START = ':::DOCUMENT_START:::';

// AI 提供商显示名
const PROVIDER_LABELS: Record<string, string> = {
  zhipu: '智谱清言',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
};
const DOC_END = ':::DOCUMENT_END:::';

// 提取文书正文
function extractDocument(content: string): string | null {
  const start = content.indexOf(DOC_START);
  const end = content.indexOf(DOC_END);
  if (start === -1 || end === -1 || end <= start) return null;
  return content.slice(start + DOC_START.length, end).trim();
}

// 从文书正文提取标题（第一个 # 行）
function extractDocTitle(doc: string): string {
  const match = doc.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '法律文书';
}

// 获取气泡展示内容：去掉文书块，保留前后文字
function getDisplayContent(content: string): string {
  return content
    .replace(/:::DOCUMENT_START:::[\s\S]*?:::DOCUMENT_END:::/g, '')
    .trim();
}

// 将 AI 回复中的法条引用（《XX法》第N条）替换为 Markdown 链接
const LAW_REF_PATTERN =
  /《([^》]+)》第([一二三四五六七八九十百千零\d]+(?:之\d+)?)条(?:第([一二三四五六七八九十\d]+)款)?(?:第([一二三四五六七八九十\d]+)项)?/g;

function injectLawLinks(text: string): string {
  return text.replace(
    LAW_REF_PATTERN,
    (match, lawName: string, article: string) => {
      const q = encodeURIComponent(`${lawName} 第${article}条`);
      return `[${match}](/law-articles?q=${q})`;
    }
  );
}

interface SelectionState {
  messageId: string;
  text: string;
  x: number; // 视口坐标（fixed 定位用）
  y: number;
}

const SCENARIOS = [
  {
    icon: FileTextIcon,
    title: '卷宗分析',
    desc: '梳理案情脉络，提炼争议焦点',
    prompt: '请帮我分析以下卷宗材料，梳理案情要点和核心争议焦点：\n\n',
  },
  {
    icon: ScaleIcon,
    title: '诉状起草',
    desc: '根据案情要点生成诉状初稿',
    prompt: '请根据以下案情帮我起草一份民事起诉状：\n\n',
  },
  {
    icon: SearchIcon,
    title: '法条检索',
    desc: '精准匹配适用法律法规条文',
    prompt: '请帮我检索并分析适用于以下情形的相关法律条文：\n\n',
  },
  {
    icon: Edit3Icon,
    title: '合同审查',
    desc: '逐条审查，识别风险与不合理约定',
    prompt: '请帮我审查以下合同条款，重点识别风险条款和不合理约定：\n\n',
  },
];

// ─── 输入面板（欢迎态和对话态共用） ───────────────────────────────────────

interface InputPanelProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSend: () => void;
  sending: boolean;
  deepMode: boolean;
  setDeepMode: React.Dispatch<React.SetStateAction<boolean>>;
}

function InputPanel({
  files,
  setFiles,
  fileInputRef,
  input,
  setInput,
  textareaRef,
  handleKeyDown,
  handleSend,
  sending,
  deepMode,
  setDeepMode,
}: InputPanelProps) {
  return (
    <div>
      {files.length > 0 && (
        <div className='flex flex-wrap gap-2 mb-2'>
          {files.map((f, i) => (
            <div
              key={i}
              className='flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg'
            >
              <PaperclipIcon className='w-3 h-3' />
              <span className='max-w-32 truncate'>{f.name}</span>
              <button
                onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                className='text-slate-400 hover:text-slate-600 ml-0.5'
              >
                <XIcon className='w-3 h-3' />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className='border border-gray-200 rounded-2xl bg-white shadow-sm hover:border-slate-300 focus-within:border-slate-400 focus-within:shadow-md transition-all duration-150'>
        <div className='flex items-end gap-2 px-4 pt-3 pb-2'>
          <button
            onClick={() => fileInputRef.current?.click()}
            className='shrink-0 text-gray-400 hover:text-gray-600 mb-0.5 transition-colors'
            title='上传文件（卷宗/合同/PDF）'
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
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='输入法律问题，或上传文件开始分析…'
            rows={1}
            style={{ fontSize: '16px' }}
            className='flex-1 bg-transparent text-gray-800 resize-none focus:outline-none placeholder:text-gray-400 min-h-[24px] leading-relaxed'
          />
          <button
            onClick={handleSend}
            disabled={sending || (!input.trim() && files.length === 0)}
            className='shrink-0 mb-0.5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 text-white disabled:bg-gray-200 disabled:text-gray-400 transition-colors'
          >
            {sending ? (
              <div className='w-3.5 h-3.5 border-2 border-white border-r-transparent rounded-full animate-spin' />
            ) : (
              <SendIcon className='w-3.5 h-3.5' />
            )}
          </button>
        </div>

        <div className='flex items-center gap-2 px-4 pb-2.5 border-t border-gray-100 pt-2'>
          <button
            onClick={() => setDeepMode(o => !o)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-all ${
              deepMode
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <SparklesIcon className='w-3 h-3' />
            深度分析
          </button>
          <span className='text-xs text-gray-300 select-none'>·</span>
          <span className='text-xs text-gray-400'>
            {deepMode ? '将逐层拆解，援引法条，综合论证' : '普通咨询模式'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── 欢迎页（空对话） ──────────────────────────────────────────────────────

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return '上午';
  if (h < 18) return '下午';
  return '晚上';
}

function WelcomeState({
  userName,
  onSelectScenario,
  inputPanel,
}: {
  userName: string;
  onSelectScenario: (prompt: string) => void;
  inputPanel: React.ReactNode;
}) {
  const timeOfDay = getTimeOfDay();
  return (
    <div className='flex flex-col min-h-full pt-14 pb-10 px-4 sm:px-8'>
      <div className='w-full max-w-2xl mx-auto'>
        {/* 个性化问候，左对齐 */}
        <div className='mb-5'>
          {userName && (
            <p className='text-sm text-gray-400 mb-1'>
              {userName} 律师，{timeOfDay}好
            </p>
          )}
          <h2 className='text-2xl font-medium text-gray-900 tracking-tight'>
            今天有什么法律问题？
          </h2>
        </div>

        {/* 输入框置顶 */}
        {inputPanel}

        {/* 快速开始：辅助入口 */}
        <div className='mt-6'>
          <p className='text-xs text-gray-400 mb-3'>快速开始</p>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
            {SCENARIOS.map(s => (
              <button
                key={s.title}
                onClick={() => onSelectScenario(s.prompt)}
                className='text-left p-3 rounded-xl border border-gray-200 hover:border-slate-300 hover:shadow-sm bg-gray-50 hover:bg-white transition-all duration-150 group'
              >
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-lg bg-white border border-gray-200 group-hover:border-slate-300 flex items-center justify-center shrink-0 transition-colors'>
                    <s.icon className='w-4 h-4 text-slate-600' />
                  </div>
                  <div>
                    <div className='text-sm font-medium text-gray-900'>
                      {s.title}
                    </div>
                    <div className='text-xs text-gray-500 mt-0.5 leading-relaxed'>
                      {s.desc}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className='text-xs text-gray-400 text-center mt-6'>
          AI 回复仅供参考，重要法律决策请结合专业判断
        </p>
      </div>
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────────────

export function ChatArea({
  conversationId,
  onUseInDoc,
  onDocumentGenerated,
  onTogglePreview,
  previewOpen,
  onMessageSent,
  onMobileSidebarOpen,
}: ChatAreaProps) {
  const { user } = useAuth();
  const userName =
    user?.username ?? user?.name ?? user?.email?.split('@')[0] ?? '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [deepMode, setDeepMode] = useState(false);
  // 批注反馈：null=无提示，'followup'=追问已填入，'saved'=仅保存
  const [annotationHint, setAnnotationHint] = useState<
    'followup' | 'saved' | null
  >(null);
  // PII 脱敏通知（发送成功后展示）
  const [piiNotice, setPiiNotice] = useState<{
    count: number;
    types: string[];
  } | null>(null);
  // 当前 AI 提供商（从 API 响应获取）
  const [aiProvider, setAiProvider] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const guide = useAnnotationGuide();

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/chat/conversations/${conversationId}/messages`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { data?: ChatMessage[] };
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleMouseUp = useCallback(
    (messageId: string, e: React.MouseEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection(null);
        return;
      }
      // 用视口坐标，工具条用 fixed 定位，不受滚动影响
      setSelection({
        messageId,
        text: sel.toString().trim(),
        x: e.clientX,
        y: e.clientY,
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
        const res = await fetch(
          `/api/v1/chat/messages/${selection.messageId}/annotations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              selectedText: selection.text,
              startOffset: 0,
              endOffset: selection.text.length,
              type,
              note: note ?? null,
            }),
          }
        );
        if (res.ok) {
          const data = (await res.json()) as { followUp?: string };
          if (data.followUp) {
            // 追问文本填入输入框，提示用户
            setInput(data.followUp);
            setAnnotationHint('followup');
            setTimeout(() => textareaRef.current?.focus(), 50);
          } else {
            // 认可/入文书：仅提示已保存
            setAnnotationHint('saved');
            setTimeout(() => setAnnotationHint(null), 2500);
          }
        }
        loadMessages();
      } catch {
        // 静默失败
      } finally {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }
    },
    [selection, onUseInDoc, loadMessages, textareaRef]
  );

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content && files.length === 0) return;
    setSending(true);
    setInput('');
    setAnnotationHint(null);
    const pendingFiles = [...files];
    setFiles([]);

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: tempId,
        conversationId,
        role: 'user' as const,
        content,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        attachments: pendingFiles.map((f, i) => ({
          id: `temp-file-${i}`,
          messageId: tempId,
          fileName: f.name,
          fileUrl: '',
          fileType: f.type,
          fileSize: f.size,
          extractedText: null,
        })),
        annotations: [],
      },
    ]);

    try {
      const msgContent = deepMode
        ? `请进行深度分析，要求：逐层拆解问题，援引相关法律条文，分析各方论点，最终给出有理有据的综合意见。\n\n${content}`
        : content;

      // 有文件：用 FormData 一次提交（文件 + 文本），服务端提取并保存
      let apiRes: Response;
      if (pendingFiles.length > 0) {
        const fd = new FormData();
        fd.append('content', msgContent);
        for (const f of pendingFiles) fd.append('files', f);
        apiRes = await fetch(
          `/api/v1/chat/conversations/${conversationId}/messages`,
          { method: 'POST', credentials: 'include', body: fd }
        );
      } else {
        // 纯文本：JSON 路径
        apiRes = await fetch(
          `/api/v1/chat/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content: msgContent }),
          }
        );
      }
      if (!apiRes.ok) throw new Error('发送失败');

      // 读取脱敏统计和 provider 信息
      const apiData = (await apiRes.json()) as {
        piiRedacted?: { count: number; types: string[] } | null;
        provider?: string;
      };
      if (apiData.piiRedacted?.count) {
        setPiiNotice(apiData.piiRedacted);
        // 5 秒后自动消失
        setTimeout(() => setPiiNotice(null), 5000);
      }
      if (apiData.provider) setAiProvider(apiData.provider);

      await loadMessages();
      onMessageSent?.();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }, [input, files, conversationId, loadMessages, deepMode, onMessageSent]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleDelete = useCallback(
    async (messageId: string, withSubsequent: boolean) => {
      try {
        await fetch(`/api/v1/chat/messages/${messageId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ withSubsequent }),
        });
        loadMessages();
      } catch {
        // 静默失败
      }
    },
    [loadMessages]
  );

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      setSending(true);
      try {
        await fetch(`/api/v1/chat/messages/${messageId}/regenerate`, {
          method: 'POST',
          credentials: 'include',
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

  const handleBranch = useCallback(
    async (messageId: string) => {
      try {
        const res = await fetch(
          `/api/v1/chat/conversations/${conversationId}/branch`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fromMessageId: messageId }),
          }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { id: string } };
        if (data.data?.id) window.location.href = `/chat/${data.data.id}`;
      } catch {
        // 静默失败
      }
    },
    [conversationId]
  );

  const handleExportAnnotations = useCallback(async () => {
    const res = await fetch(
      `/api/v1/chat/conversations/${conversationId}/export`,
      { credentials: 'include' }
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename\*=UTF-8''(.+)/);
    a.download = match ? decodeURIComponent(match[1]) : '批注报告.docx';
    a.click();
    URL.revokeObjectURL(url);
  }, [conversationId]);

  const handleContinue = useCallback(async () => {
    setSending(true);
    setInput('');
    try {
      const res = await fetch(
        `/api/v1/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: '请继续' }),
        }
      );
      if (!res.ok) throw new Error('发送失败');
      await loadMessages();
      onMessageSent?.();
    } catch {
      // 静默失败
    } finally {
      setSending(false);
    }
  }, [conversationId, loadMessages, onMessageSent]);

  const visibleMessages = messages.filter(m => !m.isDeleted);
  const isWelcome = !loading && visibleMessages.length === 0;

  // 跨对话知识复用：消息列表有 AI 回复后拉取相关对话
  const [relatedConvs, setRelatedConvs] = useState<
    { id: string; title: string; reason: string }[]
  >([]);
  const hasAiMessages = visibleMessages.some(m => m.role === 'assistant');
  useEffect(() => {
    if (!hasAiMessages) return;
    let cancelled = false;
    fetch(`/api/v1/chat/conversations/${conversationId}/related`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(
        (data: { data?: { id: string; title: string; reason: string }[] }) => {
          if (!cancelled) setRelatedConvs(data.data ?? []);
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversationId, hasAiMessages]);

  const sharedInputPanel = (
    <InputPanel
      files={files}
      setFiles={setFiles}
      fileInputRef={fileInputRef}
      input={input}
      setInput={setInput}
      textareaRef={textareaRef}
      handleKeyDown={handleKeyDown}
      handleSend={handleSend}
      sending={sending}
      deepMode={deepMode}
      setDeepMode={setDeepMode}
    />
  );

  return (
    <div className='flex-1 flex flex-col min-w-0 relative bg-white'>
      {/* 顶部工具栏 */}
      <div className='absolute top-3 left-3 right-3 z-10 flex items-center gap-2'>
        {/* 移动端：汉堡菜单打开侧边栏 */}
        {onMobileSidebarOpen && (
          <button
            onClick={onMobileSidebarOpen}
            className='flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 shadow-sm shrink-0'
            title='打开侧边栏'
          >
            <MenuIcon className='w-4 h-4' />
          </button>
        )}
        <div className='flex-1' />
        <button
          onClick={() => window.open(`/chat/${conversationId}/print`, '_blank')}
          title='导出为 PDF（打印）'
          className='flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-white border-gray-200 text-gray-600 hover:border-slate-400 hover:text-slate-800 hover:shadow-sm transition-all font-medium'
        >
          <PrinterIcon className='w-3.5 h-3.5 shrink-0' />
          <span className='hidden sm:inline'>导出 PDF</span>
        </button>
        <button
          onClick={handleExportAnnotations}
          title='导出批注报告'
          className='flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-white border-gray-200 text-gray-600 hover:border-slate-400 hover:text-slate-800 hover:shadow-sm transition-all font-medium'
        >
          <DownloadIcon className='w-3.5 h-3.5 shrink-0' />
          <span className='hidden sm:inline'>批注报告</span>
        </button>
        <button
          onClick={onTogglePreview}
          title={previewOpen ? '关闭文书预览' : '打开文书预览'}
          className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
            previewOpen
              ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
              : 'bg-white border-gray-200 text-gray-600 hover:border-slate-400 hover:text-slate-800 hover:shadow-sm'
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

      {/* 消息区 */}
      <div className='flex-1 overflow-y-auto'>
        {loading ? (
          <div className='flex items-center justify-center h-full'>
            <div className='w-6 h-6 border-2 border-slate-900 border-r-transparent rounded-full animate-spin' />
          </div>
        ) : isWelcome ? (
          // 欢迎态：输入框内嵌在页面中央，卡片正下方
          <WelcomeState
            userName={userName}
            onSelectScenario={prompt => {
              setInput(prompt);
              setTimeout(() => textareaRef.current?.focus(), 0);
            }}
            inputPanel={sharedInputPanel}
          />
        ) : (
          <div className='max-w-3xl mx-auto px-3 sm:px-6 pt-14 pb-4 space-y-10'>
            {visibleMessages.map((msg, idx) => (
              <MessageRow
                key={msg.id}
                message={msg}
                onMouseUp={handleMouseUp}
                onDelete={handleDelete}
                onRegenerate={handleRegenerate}
                onBranch={handleBranch}
                onOpenDocument={onDocumentGenerated}
                onContinue={handleContinue}
                sending={sending}
                isLast={idx === visibleMessages.length - 1}
                guidePhase={guide.phase}
                showGuideBubble={
                  guide.showBubble &&
                  msg.role === 'assistant' &&
                  // 只在第一条 AI 消息上显示气泡
                  visibleMessages.findIndex(m => m.role === 'assistant') === idx
                }
                onDismissGuideBubble={guide.dismissBubble}
              />
            ))}
            {sending && <TypingIndicator />}
            {/* 跨对话知识复用提示 */}
            {relatedConvs.length > 0 && !sending && (
              <div className='max-w-3xl mx-auto px-6 pb-4'>
                <div className='rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3'>
                  <p className='text-[11px] font-medium text-violet-500 mb-2'>
                    ✨ 相关历史对话 — 可能对您有参考价值
                  </p>
                  <div className='space-y-1.5'>
                    {relatedConvs.map(conv => (
                      <a
                        key={conv.id}
                        href={`/chat/${conv.id}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex items-start justify-between gap-3 group'
                      >
                        <div>
                          <p className='text-xs text-slate-700 group-hover:text-violet-700 font-medium transition-colors'>
                            {conv.title}
                          </p>
                          <p className='text-[10px] text-slate-400'>
                            {conv.reason}
                          </p>
                        </div>
                        <ExternalLinkIcon className='w-3 h-3 text-slate-300 group-hover:text-violet-400 shrink-0 mt-0.5 transition-colors' />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* 标注工具条 */}
      {selection && (
        <AnnotationToolbar
          x={selection.x}
          y={selection.y}
          onAnnotate={handleAnnotate}
          onBranch={() => {
            handleBranch(selection.messageId);
            setSelection(null);
          }}
          onDismiss={() => setSelection(null)}
        />
      )}

      {/* 底部输入区 — 仅对话模式 */}
      {!isWelcome && (
        <div className='px-4 pb-4 pt-2'>
          <div className='max-w-3xl mx-auto'>
            {/* 批注追问提示条 */}
            {annotationHint === 'followup' && (
              <div className='flex items-center justify-between mb-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl'>
                <div className='flex items-center gap-2'>
                  <span className='text-blue-500 text-sm'>💬</span>
                  <span className='text-xs text-blue-700'>
                    已根据你的标注生成追问，确认后发送，或直接修改
                  </span>
                </div>
                <button
                  onClick={() => {
                    setAnnotationHint(null);
                    setInput('');
                  }}
                  className='text-xs text-blue-400 hover:text-blue-600 ml-3 shrink-0'
                >
                  取消
                </button>
              </div>
            )}

            {/* 批注保存提示（认可/入文书，短暂出现后消失） */}
            {annotationHint === 'saved' && (
              <div className='flex items-center gap-2 mb-2 px-3 py-2 bg-green-50 border border-green-100 rounded-xl'>
                <span className='text-green-500 text-sm'>✓</span>
                <span className='text-xs text-green-700'>
                  标注已保存，已更新案情分析上下文
                </span>
              </div>
            )}

            {/* PII 脱敏通知（发送后短暂显示） */}
            {piiNotice && (
              <div className='flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl'>
                <EyeOffIcon className='w-3.5 h-3.5 text-blue-500 shrink-0' />
                <span className='text-xs text-blue-700'>
                  已检测并脱敏以下类型的敏感信息：
                  <strong>{piiNotice.types.join('、')}</strong>
                  ，原始内容仍保存在您的记录中
                </span>
              </div>
            )}

            {sharedInputPanel}

            {/* 底部状态栏：AI 提供商 + 免责 */}
            <div className='flex items-center justify-between mt-2 px-1 gap-2'>
              <span className='text-[11px] text-gray-400 flex items-center gap-1.5 shrink-0'>
                <ShieldCheckIcon className='w-3 h-3 text-gray-300' />
                <span className='hidden sm:inline'>{`发往 ${PROVIDER_LABELS[aiProvider] ?? (aiProvider || '云端 AI')} · 传输加密 · `}</span>
                脱敏保护
              </span>
              <span className='text-[11px] text-gray-400 text-right'>
                AI 回复仅供参考
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 打字指示器 ────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className='flex gap-4'>
      <div className='w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 mt-0.5'>
        <span className='text-white text-xs font-bold'>律</span>
      </div>
      <div className='flex items-center gap-1 pt-1.5'>
        <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]' />
        <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]' />
        <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce' />
      </div>
    </div>
  );
}

// ─── 消息行 ────────────────────────────────────────────────────────────────

const COLLAPSE_THRESHOLD = 600; // 超过此字符数才折叠

// 检测 AI 回复是否可能被截断（末尾没有正常结束标志，或有明显截断标记）
const TRUNCATION_MARKERS = [
  '……',
  '...',
  '（未完待续）',
  '(to be continued)',
  '（接下文）',
];
const ENDING_PUNCT = /[。？！…」』"'）\]\.!\?]$/;

function isTruncated(content: string): boolean {
  const trimmed = content.trimEnd();
  if (TRUNCATION_MARKERS.some(m => trimmed.endsWith(m))) return true;
  // 内容较长但没有正常结束标点，可能被截断
  if (trimmed.length > 800 && !ENDING_PUNCT.test(trimmed)) return true;
  return false;
}

function MessageRow({
  message,
  onMouseUp,
  onDelete,
  onRegenerate,
  onBranch,
  onOpenDocument,
  onContinue,
  sending,
  isLast,
  guidePhase,
  showGuideBubble,
  onDismissGuideBubble,
}: {
  message: ChatMessage;
  onMouseUp: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, withSubsequent: boolean) => void;
  onRegenerate: (id: string) => void;
  onBranch: (id: string) => void;
  onOpenDocument: (content: string) => void;
  onContinue: () => void;
  sending: boolean;
  isLast: boolean;
  guidePhase: GuidePhase;
  showGuideBubble: boolean;
  onDismissGuideBubble: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const isUser = message.role === 'user';

  // 提取文书块（AI 消息）
  const docContent = !isUser ? extractDocument(message.content) : null;
  const displayContent = docContent
    ? getDisplayContent(message.content)
    : message.content;

  const isLongAI = !isUser && displayContent.length > COLLAPSE_THRESHOLD;
  const collapsed = isLongAI && !expanded;

  if (isUser) {
    return (
      <div
        className='flex justify-end'
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className='max-w-[75%] space-y-1'>
          <div className='bg-slate-100 rounded-2xl rounded-tr-sm px-4 py-3 space-y-2'>
            {(message.attachments?.length ?? 0) > 0 && (
              <div className='flex flex-wrap gap-1.5'>
                {(message.attachments ?? []).map(att => (
                  <div
                    key={att.id}
                    className='flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-xs px-2.5 py-1.5 rounded-lg shadow-sm'
                  >
                    <FileTextIcon className='w-3.5 h-3.5 shrink-0 text-slate-400' />
                    <span className='max-w-[140px] truncate'>
                      {att.fileName}
                    </span>
                    {att.fileSize > 0 && (
                      <span className='text-slate-400 shrink-0 text-[10px]'>
                        {formatFileSize(att.fileSize)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {message.content && (
              <p className='text-sm text-gray-800 whitespace-pre-wrap leading-relaxed'>
                {message.content}
              </p>
            )}
          </div>
          {showActions && (
            <div className='flex items-center gap-1 justify-end'>
              <ActionButton
                icon={<GitBranchIcon className='w-3 h-3' />}
                label='分叉'
                onClick={() => onBranch(message.id)}
              />
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

  return (
    <div
      className='flex gap-4'
      onMouseEnter={() => {
        setShowActions(true);
        setShowHint(true);
      }}
      onMouseLeave={() => {
        setShowActions(false);
        setShowHint(false);
      }}
    >
      <div className='w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 mt-0.5'>
        <span className='text-white text-xs font-bold'>律</span>
      </div>

      <div
        data-message-id={message.id}
        className='flex-1 min-w-0'
        onMouseUp={e => onMouseUp(message.id, e)}
      >
        {(message.annotations?.length ?? 0) > 0 && (
          <div className='flex flex-col gap-1.5 mb-3'>
            {(message.annotations ?? []).map(ann => {
              const meta = ANNOTATION_META[ann.type as AnnotationType];
              return (
                <div
                  key={ann.id}
                  className={`flex items-start gap-2 text-xs rounded-lg px-2.5 py-1.5 ${meta?.bg ?? 'bg-gray-100'}`}
                >
                  <span
                    className={`shrink-0 font-medium mt-0.5 ${meta?.color ?? 'text-gray-600'}`}
                  >
                    {meta?.label ?? ann.type}
                  </span>
                  <span className='text-gray-600 leading-relaxed line-clamp-2'>
                    「{ann.selectedText}」
                    {ann.note && (
                      <span className='ml-1 text-gray-500'>— {ann.note}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className='relative'>
          {/* 新手期：脉冲引导点 + 气泡 */}
          {showGuideBubble && (
            <div className='absolute -top-1 -right-1 z-10'>
              <span className='flex h-3 w-3'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75' />
                <span className='relative inline-flex rounded-full h-3 w-3 bg-blue-500' />
              </span>
              <div className='absolute right-4 -top-1 w-56 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-lg'>
                <div className='font-medium mb-1'>💡 标注功能</div>
                <div className='text-gray-300 leading-relaxed'>
                  拖选 AI
                  回复中的任意文字，可标注认可、存疑、重点等，或直接提取到文书。
                </div>
                <button
                  onClick={onDismissGuideBubble}
                  className='mt-2 text-blue-400 hover:text-blue-300 transition-colors'
                >
                  知道了 →
                </button>
                {/* 小三角 */}
                <div className='absolute -right-1.5 top-3 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-900' />
              </div>
            </div>
          )}

          <div
            className={`ai-markdown select-text overflow-hidden transition-[max-height] duration-300
              rounded-lg -mx-2 px-2 py-0.5
              ${showHint ? 'bg-slate-50/80' : ''}
              ${collapsed ? 'max-h-64' : 'max-h-none'}`}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  const isLawRef = href?.startsWith('/law-articles');
                  return (
                    <a
                      href={href}
                      onClick={
                        isLawRef
                          ? e => {
                              e.preventDefault();
                              window.location.href = href ?? '';
                            }
                          : undefined
                      }
                      className={
                        isLawRef
                          ? 'text-blue-600 hover:text-blue-800 underline decoration-dotted cursor-pointer font-medium'
                          : 'text-blue-600 hover:underline'
                      }
                      target={isLawRef ? undefined : '_blank'}
                      rel={isLawRef ? undefined : 'noopener noreferrer'}
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {injectLawLinks(displayContent)}
            </ReactMarkdown>
          </div>
          {collapsed && (
            <div className='absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none' />
          )}
          {/* 新手期+适应期：悬停时显示底部提示 */}
          {showHint && !collapsed && guidePhase !== 'expert' && (
            <div className='absolute -bottom-5 left-0 flex items-center gap-1 text-[10px] text-slate-400 select-none pointer-events-none'>
              <span className='inline-block w-1 h-1 rounded-full bg-slate-300' />
              拖选文字可添加标注
            </div>
          )}
        </div>

        {isLongAI && (
          <button
            onClick={() => setExpanded(o => !o)}
            className='mt-1 mb-1 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors'
          >
            <ChevronDownIcon
              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
            {expanded ? '收起' : '展开全文'}
          </button>
        )}

        {/* 文书预览卡片 */}
        {docContent && (
          <DocumentCard
            title={extractDocTitle(docContent)}
            onClick={() => onOpenDocument(docContent)}
          />
        )}

        {/* 继续生成按钮：仅最后一条 AI 消息且疑似截断时显示 */}
        {isLast && isTruncated(displayContent) && !sending && (
          <button
            onClick={onContinue}
            className='mt-1 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 rounded-md px-2.5 py-1 transition-colors'
          >
            <SparklesIcon className='w-3 h-3' />
            继续生成
          </button>
        )}

        {showActions && (
          <div className='flex items-center gap-1 mt-2'>
            <ActionButton
              icon={<GitBranchIcon className='w-3 h-3' />}
              label='分叉'
              onClick={() => onBranch(message.id)}
            />
            <ActionButton
              icon={<RefreshCwIcon className='w-3 h-3' />}
              label='重新生成'
              onClick={() => onRegenerate(message.id)}
              disabled={sending}
            />
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

// ─── 文书预览卡片（Claude artifact 风格） ────────────────────────────────────

function DocumentCard({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className='mt-3 flex items-center gap-3 w-full max-w-xs border border-gray-200 rounded-xl px-3.5 py-2.5 hover:border-slate-400 hover:shadow-sm bg-white transition-all group text-left'
    >
      <div className='w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors'>
        <FileTextIcon className='w-4 h-4 text-slate-600' />
      </div>
      <div className='flex-1 min-w-0'>
        <div className='text-[10px] text-slate-400 mb-0.5 uppercase tracking-wide'>
          法律文书
        </div>
        <div className='text-sm font-medium text-gray-800 truncate'>
          {title}
        </div>
      </div>
      <ExternalLinkIcon className='w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 transition-colors' />
    </button>
  );
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
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
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors disabled:opacity-40 ${
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
