/**
 * CourtCalendar 组件测试
 * 测试法庭日历组件的渲染、加载、导航和交互功能
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourtCalendar } from '../../../components/court/CourtCalendar';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('CourtCalendar', () => {
  const mockDate = new Date(2026, 0, 15);
  const mockSchedules = [
    {
      id: '1',
      caseId: 'case1',
      title: '张三诉李四案',
      type: 'TRIAL',
      startTime: '2026-01-15T09:00:00.000Z',
      endTime: '2026-01-15T11:00:00.000Z',
      location: '第一法庭',
      status: 'SCHEDULED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('基础渲染', () => {
    it('应该正确渲染日历工具栏', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ schedules: [] }),
      } as Response);

      render(
        <CourtCalendar
          viewMode='month'
          selectedDate={mockDate}
          onViewModeChange={jest.fn()}
          onDateChange={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('2026年1月')).toBeInTheDocument();
        expect(screen.getByText('今天')).toBeInTheDocument();
      });
    });

    it('应该显示视图切换按钮', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ schedules: [] }),
      } as Response);

      render(
        <CourtCalendar
          viewMode='month'
          selectedDate={mockDate}
          onViewModeChange={jest.fn()}
          onDateChange={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('月')).toBeInTheDocument();
        expect(screen.getByText('周')).toBeInTheDocument();
        expect(screen.getByText('日')).toBeInTheDocument();
      });
    });
  });

  describe('数据加载', () => {
    it('应该加载并显示日程', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ schedules: mockSchedules }),
      } as Response);

      render(
        <CourtCalendar
          viewMode='month'
          selectedDate={mockDate}
          onViewModeChange={jest.fn()}
          onDateChange={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('张三诉李四案')).toBeInTheDocument();
      });
    });

    it('应该显示加载状态', () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ schedules: [] }),
              } as Response);
            }, 100);
          })
      );

      render(
        <CourtCalendar
          viewMode='month'
          selectedDate={mockDate}
          onViewModeChange={jest.fn()}
          onDateChange={jest.fn()}
        />
      );

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('应该处理加载失败', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('网络错误'));

      render(
        <CourtCalendar
          viewMode='month'
          selectedDate={mockDate}
          onViewModeChange={jest.fn()}
          onDateChange={jest.fn()}
        />
      );

      // 等待组件完成加载
      await waitFor(() => {
        expect(screen.queryByText(/加载/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('视图切换', () => {
    it('应该切换到周视图', async () => {
      const onViewModeChange = jest.fn();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ schedules: [] }),
      } as Response);

      render(
        <CourtCalendar
          viewMode='month'
          selectedDate={mockDate}
          onViewModeChange={onViewModeChange}
          onDateChange={jest.fn()}
        />
      );

      const weekButton = screen.getByText('周');
      await userEvent.click(weekButton);

      expect(onViewModeChange).toHaveBeenCalledWith('week');
    });

    it('应该切换到日视图', async () => {
      const onViewModeChange = jest.fn();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ schedules: [] }),
      } as Response);

      render(
        <CourtCalendar
          viewMode='month'
          selectedDate={mockDate}
          onViewModeChange={onViewModeChange}
          onDateChange={jest.fn()}
        />
      );

      const dayButton = screen.getByText('日');
      await userEvent.click(dayButton);

      expect(onViewModeChange).toHaveBeenCalledWith('day');
    });
  });

  describe('日期导航', () => {
    it('应该跳转到今天', async () => {
      const onDateChange = jest.fn();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ schedules: [] }),
      } as Response);

      render(
        <CourtCalendar
          viewMode='month'
          selectedDate={mockDate}
          onViewModeChange={jest.fn()}
          onDateChange={onDateChange}
        />
      );

      const todayButton = screen.getByText('今天');
      await userEvent.click(todayButton);

      expect(onDateChange).toHaveBeenCalled();
    });
  });

  describe('日程交互', () => {
    it('应该显示日程详情对话框', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ schedules: mockSchedules }),
      } as Response);

      render(
        <CourtCalendar
          viewMode='month'
          selectedDate={mockDate}
          onViewModeChange={jest.fn()}
          onDateChange={jest.fn()}
        />
      );

      await waitFor(() => {
        const scheduleItem = screen.getByText('张三诉李四案');
        expect(scheduleItem).toBeInTheDocument();
      });

      const scheduleButton = screen.getByText('张三诉李四案');
      await userEvent.click(scheduleButton);

      await waitFor(() => {
        expect(screen.getByText('开庭')).toBeInTheDocument();
        expect(screen.getByText('第一法庭')).toBeInTheDocument();
        expect(screen.getByText('已安排')).toBeInTheDocument();
      });
    });

    it('应该关闭日程详情对话框', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ schedules: mockSchedules }),
      } as Response);

      render(
        <CourtCalendar
          viewMode='month'
          selectedDate={mockDate}
          onViewModeChange={jest.fn()}
          onDateChange={jest.fn()}
        />
      );

      await waitFor(() => {
        const scheduleButton = screen.getByText('张三诉李四案');
        expect(scheduleButton).toBeInTheDocument();
      });

      const scheduleButton = screen.getByText('张三诉李四案');
      await userEvent.click(scheduleButton);

      await waitFor(() => {
        expect(screen.getByText('关闭')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('关闭');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('开庭')).not.toBeInTheDocument();
      });
    });
  });
});
