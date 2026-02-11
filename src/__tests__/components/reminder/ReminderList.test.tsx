/**
 * ReminderList 组件单元测试
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReminderList } from '@/components/reminder/ReminderList';
import {
  ReminderType,
  ReminderStatus,
  NotificationChannel,
  type Reminder,
} from '@/types/notification';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ReminderList', () => {
  const mockUserId = 'user-123';

  const mockReminders: Reminder[] = [
    {
      id: 'reminder-1',
      userId: mockUserId,
      type: ReminderType.COURT_SCHEDULE,
      title: '法庭日程提醒',
      content: '请准时出庭',
      message: '请准时出庭',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      reminderTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      channel: NotificationChannel.IN_APP,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      status: ReminderStatus.PENDING,
      sentAt: null,
      relatedType: 'CourtSchedule',
      relatedId: 'schedule-1',
      metadata: { caseTitle: '测试案件' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'reminder-2',
      userId: mockUserId,
      type: ReminderType.CASE_DEADLINE,
      title: '截止日期提醒',
      content: '文档提交截止',
      message: '文档提交截止',
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      reminderTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      channel: NotificationChannel.IN_APP,
      channels: [NotificationChannel.IN_APP],
      status: ReminderStatus.READ,
      sentAt: null,
      relatedType: null,
      relatedId: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockSuccessResponse = {
    success: true,
    data: {
      reminders: mockReminders,
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    },
  };

  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('组件渲染', () => {
    it('应该正确渲染提醒列表', async () => {
      render(<ReminderList userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('法庭日程提醒')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('截止日期提醒')).toBeInTheDocument();
      });
    });

    it('应该正确显示筛选器', () => {
      render(<ReminderList userId={mockUserId} />);

      expect(screen.getByText('筛选提醒')).toBeInTheDocument();
      expect(screen.getByText('类型')).toBeInTheDocument();
      expect(screen.getByText('状态')).toBeInTheDocument();
      expect(screen.getByText('开始时间')).toBeInTheDocument();
      expect(screen.getByText('结束时间')).toBeInTheDocument();
    });

    it('应该在空列表时显示提示', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            reminders: [],
            pagination: {
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrevious: false,
            },
          },
        }),
      });

      render(<ReminderList userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('暂无提醒')).toBeInTheDocument();
      });
    });

    it('应该在加载时显示加载状态', () => {
      render(<ReminderList userId={mockUserId} />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('提醒操作', () => {
    it('应该支持标记为已读', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              reminders: [],
              pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrevious: false,
              },
            },
          }),
        });

      render(<ReminderList userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('法庭日程提醒')).toBeInTheDocument();
      });

      const markReadButton = screen.getByText('标记已读');
      fireEvent.click(markReadButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/reminders/reminder-1',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('READ'),
          })
        );
      });
    });

    it('应该支持忽略提醒', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
          }),
        });

      render(<ReminderList userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('法庭日程提醒')).toBeInTheDocument();
      });

      const dismissButton = screen.getByText('忽略');
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/reminders/reminder-1',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('DISMISSED'),
          })
        );
      });
    });

    it('应该支持删除提醒', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
          }),
        });

      render(<ReminderList userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('法庭日程提醒')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/reminders/reminder-1',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });
  });
});
