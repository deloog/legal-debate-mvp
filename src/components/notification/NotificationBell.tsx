'use client';

/**
 * 通知铃铛组件
 *
 * 显示未读通知数量，点击展示通知列表
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  link: string | null;
  createdAt: string;
  status: string;
}

interface NotificationData {
  notifications: Notification[];
  unreadCount: number;
  total: number;
}

export function NotificationBell() {
  const [data, setData] = useState<NotificationData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 获取通知数据
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        '/api/notifications?pageSize=5&status=UNREAD'
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setData(result.data);
        }
      }
    } catch (error) {
      console.error('获取通知失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 标记为已读
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });

      if (response.ok) {
        // 刷新通知列表
        fetchNotifications();
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 全部标记为已读
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });

      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('全部标记已读失败:', error);
    }
  };

  // 初始加载和轮询
  useEffect(() => {
    fetchNotifications();

    // 每分钟轮询一次
    const interval = setInterval(fetchNotifications, 60000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = data?.unreadCount || 0;

  return (
    <div className='relative' ref={dropdownRef}>
      {/* 铃铛按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors'
        aria-label='通知'
      >
        <svg
          className='h-6 w-6'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
          />
        </svg>

        {/* 未读数量徽章 */}
        {unreadCount > 0 && (
          <span className='absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white'>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 下拉通知列表 */}
      {isOpen && (
        <div className='absolute right-0 mt-2 w-80 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50'>
          {/* 头部 */}
          <div className='flex items-center justify-between border-b border-gray-100 px-4 py-3'>
            <h3 className='text-sm font-semibold text-gray-900'>通知</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className='text-xs text-blue-600 hover:text-blue-800'
              >
                全部标为已读
              </button>
            )}
          </div>

          {/* 通知列表 */}
          <div className='max-h-80 overflow-y-auto'>
            {loading ? (
              <div className='flex items-center justify-center py-8'>
                <div className='h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
              </div>
            ) : data?.notifications.length === 0 ? (
              <div className='py-8 text-center text-sm text-gray-500'>
                暂无通知
              </div>
            ) : (
              <div className='divide-y divide-gray-100'>
                {data?.notifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => markAsRead(notification.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 底部链接 */}
          <div className='border-t border-gray-100 px-4 py-3'>
            <Link
              href='/notifications'
              className='block text-center text-sm text-blue-600 hover:text-blue-800'
              onClick={() => setIsOpen(false)}
            >
              查看全部通知
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onRead: () => void;
}

function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const isUnread = notification.status === 'UNREAD';

  const handleClick = () => {
    if (isUnread) {
      onRead();
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SYSTEM':
        return (
          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600'>
            <svg
              className='h-4 w-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
          </div>
        );
      case 'CASE':
        return (
          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600'>
            <svg
              className='h-4 w-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
              />
            </svg>
          </div>
        );
      case 'PAYMENT':
        return (
          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 text-yellow-600'>
            <svg
              className='h-4 w-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
          </div>
        );
      case 'ALERT':
        return (
          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600'>
            <svg
              className='h-4 w-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600'>
            <svg
              className='h-4 w-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
              />
            </svg>
          </div>
        );
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const content = (
    <div
      className={`flex gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer ${
        isUnread ? 'bg-blue-50/50' : ''
      }`}
      onClick={handleClick}
    >
      {getTypeIcon(notification.type)}
      <div className='flex-1 min-w-0'>
        <div className='flex items-start justify-between gap-2'>
          <p
            className={`text-sm ${isUnread ? 'font-medium text-gray-900' : 'text-gray-700'}`}
          >
            {notification.title}
          </p>
          {isUnread && (
            <span className='flex-shrink-0 h-2 w-2 rounded-full bg-blue-500' />
          )}
        </div>
        <p className='text-xs text-gray-500 mt-0.5 truncate'>
          {notification.content}
        </p>
        <p className='text-xs text-gray-400 mt-1'>
          {formatTime(notification.createdAt)}
        </p>
      </div>
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} className='block'>
        {content}
      </Link>
    );
  }

  return content;
}

export default NotificationBell;
