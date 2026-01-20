/**
 * 跟进提醒API测试
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/follow-up-tasks/send-reminders/route';
import {
  sendFollowUpReminders,
  getFollowUpRemindersStats,
  getTasksExpiringSoon,
  markExpiredFollowUpTasks,
} from '@/lib/cron/send-follow-up-reminders';

// Mock dependencies
jest.mock('@/lib/cron/send-follow-up-reminders', () => ({
  sendFollowUpReminders: jest.fn(),
  getFollowUpRemindersStats: jest.fn(),
  getTasksExpiringSoon: jest.fn(),
  markExpiredFollowUpTasks: jest.fn(),
}));

jest.mock('@/lib/agent/security/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GET /api/follow-up-tasks/send-reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该返回统计信息', async () => {
    const mockStats = {
      pendingTasksCount: 10,
      urgentTasksCount: 5,
      highPriorityTasksCount: 2,
      mediumPriorityTasksCount: 3,
      lowPriorityTasksCount: 5,
      tasksExpiringNext24h: [],
    };

    (getFollowUpRemindersStats as jest.Mock).mockResolvedValue(
      mockStats as never
    );

    const request = new NextRequest(
      'http://localhost:3000/api/follow-up-tasks/send-reminders',
      {
        method: 'GET',
      }
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockStats);
    expect(getFollowUpRemindersStats).toHaveBeenCalled();
  });

  it('应该返回即将到期的任务列表', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        clientId: 'client-1',
        clientName: '客户1',
        summary: '任务1',
        dueDate: new Date(),
        priority: 'HIGH' as const,
        hoursUntilDue: 12,
      },
    ];

    (getTasksExpiringSoon as jest.Mock).mockResolvedValue(mockTasks as never);

    const request = new NextRequest(
      'http://localhost:3000/api/follow-up-tasks/send-reminders?action=expiring-soon&hours=24&limit=20',
      {
        method: 'GET',
      }
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.tasks).toHaveLength(1);
    expect(data.data.tasks[0].id).toBe('task-1');
    expect(data.data.count).toBe(1);
    expect(data.data.hours).toBe(24);
    expect(data.data.limit).toBe(20);
    expect(getTasksExpiringSoon).toHaveBeenCalledWith(24, 20);
  });

  it('应该使用默认参数获取即将到期任务', async () => {
    (getTasksExpiringSoon as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/follow-up-tasks/send-reminders?action=expiring-soon',
      {
        method: 'GET',
      }
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(getTasksExpiringSoon).toHaveBeenCalledWith(24, 20);
  });

  it('应该处理获取统计信息的错误', async () => {
    const error = new Error('数据库错误');
    (getFollowUpRemindersStats as jest.Mock).mockRejectedValue(error);

    const request = new NextRequest(
      'http://localhost:3000/api/follow-up-tasks/send-reminders',
      {
        method: 'GET',
      }
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('数据库错误');
  });
});

describe('POST /api/follow-up-tasks/send-reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该发送跟进提醒', async () => {
    const mockResult = {
      totalTasksChecked: 5,
      tasksWithRemindersSent: 3,
      tasksFailedToSend: 1,
      results: [],
      errors: [],
    };

    (sendFollowUpReminders as jest.Mock).mockResolvedValue(mockResult as never);

    const request = new NextRequest(
      'http://localhost:3000/api/follow-up-tasks/send-reminders',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('检查了 5 个跟进任务');
    expect(data.message).toContain('发送 3 个提醒');
    expect(data.message).toContain('失败 1 个');
    expect(data.data).toEqual(mockResult);
    expect(sendFollowUpReminders).toHaveBeenCalled();
  });

  it('应该标记已过期的任务', async () => {
    const mockResult = {
      cancelledCount: 5,
    };

    (markExpiredFollowUpTasks as jest.Mock).mockResolvedValue(
      mockResult as never
    );

    const request = new NextRequest(
      'http://localhost:3000/api/follow-up-tasks/send-reminders',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'mark-expired' }),
      }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('已标记 5 个过期任务');
    expect(data.data).toEqual(mockResult);
    expect(markExpiredFollowUpTasks).toHaveBeenCalled();
  });

  it('应该处理发送提醒的错误', async () => {
    const error = new Error('发送失败');
    (sendFollowUpReminders as jest.Mock).mockRejectedValue(error);

    const request = new NextRequest(
      'http://localhost:3000/api/follow-up-tasks/send-reminders',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('发送失败');
  });

  it('应该处理标记过期任务的错误', async () => {
    const error = new Error('标记失败');
    (markExpiredFollowUpTasks as jest.Mock).mockRejectedValue(error);

    const request = new NextRequest(
      'http://localhost:3000/api/follow-up-tasks/send-reminders',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'mark-expired' }),
      }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('标记失败');
  });
});
