'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { PreviewPane } from '@/components/chat/PreviewPane';
import { DataNotice } from '@/components/chat/DataNotice';
import { useAuth } from '@/app/providers/AuthProvider';

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 240;
const PREVIEW_MIN = 280;
const PREVIEW_MAX = 700;
const PREVIEW_DEFAULT = 380;

export default function ChatConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const { user } = useAuth();
  const userRole = user?.role ?? 'USER';

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [docVersions, setDocVersions] = useState<
    { id: number; content: string; createdAt: Date }[]
  >([]);
  const [crystalForPreview, setCrystalForPreview] = useState<{
    case_type?: string | null;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [previewWidth, setPreviewWidth] = useState(PREVIEW_DEFAULT);
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动端：< 768px 为移动设备，侧边栏默认收起
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── 拖拽调宽逻辑 ──────────────────────────────────────────────────────────
  const drag = useRef<{
    target: 'sidebar' | 'preview';
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      const delta = e.clientX - drag.current.startX;
      if (drag.current.target === 'sidebar') {
        setSidebarWidth(
          Math.max(
            SIDEBAR_MIN,
            Math.min(SIDEBAR_MAX, drag.current.startWidth + delta)
          )
        );
      } else {
        // 预览区：拖拽点在左边，向左拖 = 变宽
        setPreviewWidth(
          Math.max(
            PREVIEW_MIN,
            Math.min(PREVIEW_MAX, drag.current.startWidth - delta)
          )
        );
      }
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startSidebarDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      drag.current = {
        target: 'sidebar',
        startX: e.clientX,
        startWidth: sidebarWidth,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [sidebarWidth]
  );

  const startPreviewDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      drag.current = {
        target: 'preview',
        startX: e.clientX,
        startWidth: previewWidth,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [previewWidth]
  );

  // ── 侧边栏刷新（AI 生成标题后更新列表） ───────────────────────────────────
  const refreshSidebarRef = useRef<(() => void) | null>(null);
  const handleSidebarRefreshReady = useCallback((fn: () => void) => {
    refreshSidebarRef.current = fn;
  }, []);
  const refreshSidebar = useCallback(() => {
    // 延迟 2 秒等待标题生成完毕
    setTimeout(() => refreshSidebarRef.current?.(), 2000);
  }, []);

  // ── 文书填入逻辑 ──────────────────────────────────────────────────────────
  const handleUseInDoc = useCallback((text: string) => {
    setPreviewContent(prev => (prev ? prev + '\n\n' + text : text));
    setPreviewOpen(true);
  }, []);

  const handleDocumentGenerated = useCallback((content: string) => {
    setPreviewContent(content);
    setPreviewOpen(true);
    setDocVersions(prev => [
      ...prev,
      { id: Date.now(), content, createdAt: new Date() },
    ]);
  }, []);

  return (
    <div className='flex h-screen bg-white overflow-hidden select-none'>
      <DataNotice />

      {/* 移动端侧边栏遮罩 */}
      {isMobile && sidebarOpen && (
        <div
          className='fixed inset-0 bg-black/50 z-40'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 左侧边栏 */}
      <div
        style={
          isMobile
            ? { width: '82vw', maxWidth: '320px' }
            : { width: sidebarOpen ? sidebarWidth : 48 }
        }
        className={
          isMobile
            ? `fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : 'shrink-0 flex'
        }
      >
        <ChatSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
          activeConversationId={conversationId}
          onRefresh={handleSidebarRefreshReady}
          userRole={userRole}
          onCrystalChange={setCrystalForPreview}
        />
      </div>

      {/* 侧边栏拖拽手柄（仅桌面展开时显示） */}
      {!isMobile && sidebarOpen && (
        <ResizeHandle onMouseDown={startSidebarDrag} />
      )}

      {/* 对话主区域 */}
      <div className='flex flex-1 min-w-0'>
        <ChatArea
          conversationId={conversationId}
          onUseInDoc={handleUseInDoc}
          onDocumentGenerated={handleDocumentGenerated}
          onTogglePreview={() => !isMobile && setPreviewOpen(o => !o)}
          previewOpen={previewOpen && !isMobile}
          onMessageSent={refreshSidebar}
          onMobileSidebarOpen={
            isMobile ? () => setSidebarOpen(true) : undefined
          }
        />

        {/* 预览区拖拽手柄（仅桌面） */}
        {!isMobile && previewOpen && (
          <ResizeHandle onMouseDown={startPreviewDrag} />
        )}

        {/* 右侧预览区（仅桌面） */}
        {!isMobile && previewOpen && (
          <div style={{ width: previewWidth }} className='shrink-0'>
            <PreviewPane
              content={previewContent}
              versions={docVersions}
              onVersionSelect={setPreviewContent}
              onClose={() => setPreviewOpen(false)}
              userRole={userRole}
              crystal={crystalForPreview}
              hasDocument={docVersions.length > 0 || previewContent.length > 0}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── 拖拽手柄 ──────────────────────────────────────────────────────────────────

function ResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      className='relative w-px shrink-0 bg-gray-200 hover:bg-blue-300 cursor-col-resize transition-colors group'
    >
      {/* 扩大点击区域 */}
      <div className='absolute inset-y-0 -left-1.5 -right-1.5' />
      {/* 拖拽指示点 */}
      <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none'>
        <div className='w-0.5 h-3 bg-blue-400 rounded-full' />
      </div>
    </div>
  );
}
