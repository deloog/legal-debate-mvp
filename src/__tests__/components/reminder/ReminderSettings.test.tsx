/**
 * ReminderSettings 组件单元测试
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReminderSettings } from '@/components/reminder/ReminderSettings';
import {
  NotificationChannel,
  type ReminderPreferences,
} from '@/types/notification';

const mockPreferences: ReminderPreferences = {
  channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  quietHours: null,
  disabledTypes: [],
  courtSchedule: {
    enabled: true,
    advanceDays: [1],
    hoursBefore: [24, 1],
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  },
  deadline: {
    enabled: true,
    advanceDays: [7, 3, 1],
    daysBefore: [7, 3, 1],
    channels: [NotificationChannel.IN_APP],
  },
  followUp: {
    enabled: true,
    autoRemind: true,
    hoursBefore: [24],
    channels: [NotificationChannel.IN_APP],
  },
  task: {
    enabled: true,
    priorities: ['HIGH', 'URGENT'],
    hoursBefore: [24, 1],
    channels: [NotificationChannel.IN_APP],
  },
};

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ReminderSettings', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockPreferences,
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('组件渲染', () => {
    it('应该在加载时显示加载状态', () => {
      render(<ReminderSettings userId='user-1' />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('应该正确渲染提醒设置', async () => {
      render(<ReminderSettings userId='user-1' />);

      await waitFor(() => {
        expect(screen.getByText('提醒设置')).toBeInTheDocument();
      });
    });

    it('应该显示所有提醒类型设置', async () => {
      render(<ReminderSettings userId='user-1' />);

      await waitFor(() => {
        expect(screen.getByText('法庭日程提醒')).toBeInTheDocument();
        expect(screen.getByText('截止日期提醒')).toBeInTheDocument();
        expect(screen.getByText('跟进提醒')).toBeInTheDocument();
      });
    });
  });

  describe('通知渠道', () => {
    it('应该支持多个通知渠道', async () => {
      render(<ReminderSettings userId='user-1' />);

      await waitFor(() => {
        expect(screen.getByText('法庭日程提醒')).toBeInTheDocument();
      });

      // 使用 getAllByText 因为每个提醒类型都有相同的渠道选项
      expect(screen.getAllByText('站内消息').length).toBeGreaterThan(0);
      expect(screen.getAllByText('邮件').length).toBeGreaterThan(0);
      expect(screen.getAllByText('短信').length).toBeGreaterThan(0);
    });
  });
});
