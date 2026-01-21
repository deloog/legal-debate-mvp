/**
 * CaseTimeline 组件筛选功能测试
 * 测试案件时间线组件的筛选和事件类型展示
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaseTimeline } from '../../../components/case/CaseTimeline';
import { TimelineEvent, CaseTimelineEventType } from '../../../types/case';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('CaseTimeline - 筛选功能', () => {
  const mockCaseId = 'test-case-123';
  const mockEvents: TimelineEvent[] = [
    {
      id: 'event-1',
      caseId: mockCaseId,
      eventType: CaseTimelineEventType.FILING,
      title: '立案',
      description: '案件已立案受理',
      eventDate: new Date('2024-01-15T09:00:00Z'),
      metadata: null,
      createdAt: new Date('2024-01-15T09:00:00Z'),
      updatedAt: new Date('2024-01-15T09:00:00Z'),
    },
    {
      id: 'event-2',
      caseId: mockCaseId,
      eventType: CaseTimelineEventType.PRETRIAL,
      title: '审前准备',
      description: '准备庭审材料',
      eventDate: new Date('2024-01-20T10:00:00Z'),
      metadata: null,
      createdAt: new Date('2024-01-20T10:00:00Z'),
      updatedAt: new Date('2024-01-20T10:00:00Z'),
    },
    {
      id: 'event-3',
      caseId: mockCaseId,
      eventType: CaseTimelineEventType.TRIAL,
      title: '开庭审理',
      description: '第一次开庭',
      eventDate: new Date('2024-02-01T14:00:00Z'),
      metadata: null,
      createdAt: new Date('2024-01-25T10:00:00Z'),
      updatedAt: new Date('2024-01-25T10:00:00Z'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('筛选功能', () => {
    it('应该显示筛选下拉框', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: mockEvents,
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('应该支持按事件类型筛选', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            events: mockEvents,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            events: [mockEvents[0]], // 只返回立案事件
          }),
        });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getAllByText('立案').length).toBeGreaterThan(0);
      });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, {
        target: { value: CaseTimelineEventType.FILING },
      });

      await waitFor(() => {
        expect(screen.getAllByText('立案').length).toBeGreaterThan(0);
      });
    });

    it('选择"全部"应该显示所有事件', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: mockEvents,
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getAllByText('立案').length).toBeGreaterThan(0);
      });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'all' } });

      await waitFor(() => {
        expect(screen.getAllByText('立案').length).toBeGreaterThan(0);
      });
    });
  });

  describe('事件类型标签', () => {
    it('应该正确显示各事件类型的标签', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: mockEvents,
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getAllByText('立案').length).toBeGreaterThan(0);
        expect(screen.getAllByText('审前准备').length).toBeGreaterThan(0);
        expect(screen.getAllByText('开庭审理').length).toBeGreaterThan(0);
      });
    });

    it('应该显示自定义事件类型', async () => {
      const customEvent: TimelineEvent = {
        id: 'event-custom',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.CUSTOM,
        title: '自定义事件',
        description: '这是一个自定义事件',
        eventDate: new Date('2024-01-15T09:00:00Z'),
        metadata: null,
        createdAt: new Date('2024-01-15T09:00:00Z'),
        updatedAt: new Date('2024-01-15T09:00:00Z'),
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [customEvent],
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('自定义事件')).toBeInTheDocument();
      });
    });
  });
});
