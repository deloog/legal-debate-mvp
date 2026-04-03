'use client';

import { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { XIcon, DownloadIcon } from 'lucide-react';

interface PreviewPaneProps {
  content: string;
  onContentChange: (content: string) => void;
  onClose: () => void;
}

export function PreviewPane({
  content,
  onContentChange,
  onClose,
}: PreviewPaneProps) {
  const handleExportMarkdown = useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `律伴文书_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content]);

  const handleExportDocx = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/chat/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `律伴文书_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // 静默失败，降级到 Markdown 导出
      handleExportMarkdown();
    }
  }, [content, handleExportMarkdown]);

  return (
    <div className='w-96 shrink-0 flex flex-col border-l border-gray-200 bg-white'>
      {/* 标题栏 */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-gray-200'>
        <h3 className='text-sm font-medium text-gray-900'>文书预览</h3>
        <div className='flex items-center gap-2'>
          <button
            onClick={handleExportMarkdown}
            className='text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1'
            title='导出 Markdown'
          >
            <DownloadIcon className='w-3.5 h-3.5' />
            MD
          </button>
          <button
            onClick={handleExportDocx}
            className='text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1'
            title='导出 Word'
          >
            <DownloadIcon className='w-3.5 h-3.5' />
            Word
          </button>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600'
          >
            <XIcon className='w-4 h-4' />
          </button>
        </div>
      </div>

      {/* 内容编辑区：左侧 Markdown 源码，右侧渲染（此处用单窗格，textarea + 渲染切换） */}
      <div className='flex-1 overflow-y-auto'>
        {content ? (
          <div className='prose prose-sm max-w-none px-4 py-4 text-gray-800'>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className='flex items-center justify-center h-full text-gray-400 text-sm'>
            <p>
              从对话中标注&ldquo;入文书&rdquo;内容，或 AI
              起草文书后自动出现在此处
            </p>
          </div>
        )}
      </div>

      {/* 底部编辑区 */}
      {content && (
        <div className='border-t border-gray-200 p-3'>
          <textarea
            value={content}
            onChange={e => onContentChange(e.target.value)}
            className='w-full text-xs text-gray-600 resize-none border border-gray-200 rounded p-2 focus:outline-none focus:border-blue-400 h-24'
            placeholder='可直接编辑 Markdown 源码...'
          />
        </div>
      )}
    </div>
  );
}
