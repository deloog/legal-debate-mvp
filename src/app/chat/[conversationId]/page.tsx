'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { PreviewPane } from '@/components/chat/PreviewPane';

export default function ChatConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleUseInDoc = useCallback((text: string) => {
    setPreviewContent(prev => (prev ? prev + '\n\n' + text : text));
    setPreviewOpen(true);
  }, []);

  return (
    <div className='flex h-screen bg-white overflow-hidden'>
      {/* 左侧边栏 */}
      <ChatSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        activeConversationId={conversationId}
      />

      {/* 对话主区域 */}
      <div className='flex flex-1 min-w-0'>
        <ChatArea
          conversationId={conversationId}
          onUseInDoc={handleUseInDoc}
          onTogglePreview={() => setPreviewOpen(o => !o)}
          previewOpen={previewOpen}
        />

        {/* 右侧预览区 */}
        {previewOpen && (
          <PreviewPane
            content={previewContent}
            onContentChange={setPreviewContent}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
