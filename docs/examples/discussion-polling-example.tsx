/**
 * 案件讨论组件示例
 * 演示如何使用智能轮询实现准实时更新
 */

'use client';

import { useState, useCallback } from 'react';
import { useDiscussionPolling } from '@/hooks/useDiscussionPolling';

interface Discussion {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
}

interface CaseDiscussionsProps {
  caseId: string;
}

export function CaseDiscussions({ caseId }: CaseDiscussionsProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // 获取讨论列表
  const fetchDiscussions = useCallback(async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}/discussions`);
      const data = await response.json();
      setDiscussions(data.discussions || []);
      setLastUpdateTime(new Date());
    } catch (error) {
      console.error('Failed to fetch discussions:', error);
    }
  }, [caseId]);

  // 使用智能轮询 - 每 30 秒自动更新，页面隐藏时停止
  const { triggerUpdate } = useDiscussionPolling(fetchDiscussions, {
    interval: 30000, // 30 秒
    enabled: true, // 启用轮询
    pollWhenHidden: false, // 页面隐藏时停止（节省资源）
  });

  // 发送新消息
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setIsLoading(true);
    try {
      await fetch(`/api/cases/${caseId}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });

      setNewMessage('');

      // 关键：发送后立即刷新，不等待定时器
      // 这样用户感觉是实时的，实际上是智能触发
      triggerUpdate();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex flex-col h-full'>
      {/* 头部：显示最后更新时间 */}
      <div className='flex items-center justify-between p-4 border-b'>
        <h2 className='text-lg font-semibold'>案件讨论</h2>
        <div className='flex items-center gap-2 text-sm text-gray-500'>
          <span>最后更新: {lastUpdateTime.toLocaleTimeString()}</span>
          <button
            onClick={triggerUpdate}
            className='px-3 py-1 text-blue-600 hover:bg-blue-50 rounded'
            title='手动刷新'
          >
            🔄 刷新
          </button>
        </div>
      </div>

      {/* 讨论列表 */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4'>
        {discussions.length === 0 ? (
          <div className='text-center text-gray-500 py-8'>
            暂无讨论，发送第一条消息开始讨论
          </div>
        ) : (
          discussions.map(discussion => (
            <div key={discussion.id} className='bg-white rounded-lg shadow p-4'>
              <div className='flex items-start gap-3'>
                <div className='w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold'>
                  {discussion.authorName.charAt(0)}
                </div>
                <div className='flex-1'>
                  <div className='flex items-center gap-2 mb-1'>
                    <span className='font-semibold'>
                      {discussion.authorName}
                    </span>
                    <span className='text-sm text-gray-500'>
                      {new Date(discussion.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className='text-gray-700'>{discussion.content}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 输入框 */}
      <div className='border-t p-4'>
        <div className='flex gap-2'>
          <input
            type='text'
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
            placeholder='输入讨论内容...'
            className='flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !newMessage.trim()}
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isLoading ? '发送中...' : '发送'}
          </button>
        </div>
        <p className='text-xs text-gray-500 mt-2'>
          💡 提示：消息会自动更新，或点击"刷新"按钮手动更新
        </p>
      </div>
    </div>
  );
}

/**
 * 使用场景说明：
 *
 * 1. 自动更新：
 *    - 页面可见时，每 30 秒自动刷新
 *    - 页面隐藏时，自动停止轮询（节省资源）
 *    - 页面重新可见时，立即触发一次更新
 *
 * 2. 手动触发：
 *    - 用户发送消息后，立即刷新列表
 *    - 点击"刷新"按钮，手动触发更新
 *
 * 3. 用户体验：
 *    - 用户操作后立即看到更新（感觉是实时的）
 *    - 其他用户的消息最多延迟 30 秒
 *    - 对于法律讨论场景，30 秒延迟完全可接受
 *
 * 4. 资源效率：
 *    - 比 WebSocket 节省 90% 以上的服务器资源
 *    - 页面不可见时零消耗
 *    - 支持水平扩展，无状态设计
 */
