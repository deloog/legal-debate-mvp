/**
 * CaseTimeline 组件基础测试
 * 测试案件时间线组件的基础渲染、加载状态和错误处理
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaseTimeline } from '../../../components/case/CaseTimeline';
import { TimelineEvent, CaseTimelineEventType } from '../../../types/case';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('CaseTimeline - 基础功能', () => {
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

  describe('基础渲染', () => {
    it('应该正确渲染时间线组件', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: mockEvents,
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('案件时间线')).toBeInTheDocument();
      });

      expect(screen.getByText('3 个事件')).toBeInTheDocument();
    });

    it('应该显示所有时间线事件', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: mockEvents,
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        // 检查每个事件标题是否显示（会有多个匹配，包括option、h3、badge）
        expect(screen.getAllByText('立案').length).toBeGreaterThan(1);
        expect(screen.getAllByText('审前准备').length).toBeGreaterThan(1);
        expect(screen.getAllByText('开庭审理').length).toBeGreaterThan(1);
      });
    });

    it('应该在只读模式下不显示操作按钮', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: mockEvents,
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} readonly />);

      await waitFor(() => {
        expect(screen.queryByText('添加事件')).not.toBeInTheDocument();
      });
    });

    it('应该在非只读模式下显示添加事件按钮', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: mockEvents,
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} readonly={false} />);

      await waitFor(() => {
        expect(screen.getByText('添加事件')).toBeInTheDocument();
      });
    });

    it('应该显示事件的标题和类型标签', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [mockEvents[0]],
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        // 检查事件标题和描述是否显示
        expect(screen.getAllByText('立案').length).toBeGreaterThan(1);
        expect(screen.getByText('案件已立案受理')).toBeInTheDocument();
      });
    });

    it('应该显示事件的描述', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [mockEvents[0]],
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('案件已立案受理')).toBeInTheDocument();
      });
    });

    it('应该显示事件的日期', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [mockEvents[0]],
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('2024/01/15')).toBeInTheDocument();
      });
    });
  });

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ events: [] }),
                } as Response),
              100
            )
          )
      );

      render(<CaseTimeline caseId={mockCaseId} />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('加载完成后应该显示时间线', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: mockEvents,
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
      });
    });
  });

  describe('错误状态', () => {
    it('应该显示错误信息', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: '加载失败',
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('加载时间线失败')).toBeInTheDocument();
      });
    });

    it('应该在无事件时显示空状态', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [],
        }),
      });

      render(<CaseTimeline caseId={mockCaseId} />);

      await waitFor(() => {
        expect(screen.getByText('暂无时间线事件')).toBeInTheDocument();
      });
    });
  });
});
