import {
  getStatusName,
  getStatusColor,
  getPriorityName,
  getPriorityColor,
  getDueDateText,
  getDueDateColor,
  getCommunicationTypeName,
  isTaskOverdue,
  isTaskExpiringSoon,
} from '@/components/client/FollowUpTaskUtils';
import {
  FollowUpTaskStatus,
  FollowUpTaskPriority,
  CommunicationType,
} from '@/types/client';

describe('FollowUpTaskUtils', () => {
  describe('getStatusName', () => {
    it('应返回正确的状态名称', () => {
      expect(getStatusName(FollowUpTaskStatus.PENDING)).toBe('待处理');
      expect(getStatusName(FollowUpTaskStatus.COMPLETED)).toBe('已完成');
      expect(getStatusName(FollowUpTaskStatus.CANCELLED)).toBe('已取消');
    });

    it('应返回未知状态本身', () => {
      const unknownStatus = 'UNKNOWN' as FollowUpTaskStatus;
      expect(getStatusName(unknownStatus)).toBe(unknownStatus);
    });
  });

  describe('getStatusColor', () => {
    it('应返回正确的状态颜色', () => {
      expect(getStatusColor(FollowUpTaskStatus.PENDING)).toBe(
        'bg-yellow-100 text-yellow-800'
      );
      expect(getStatusColor(FollowUpTaskStatus.COMPLETED)).toBe(
        'bg-green-100 text-green-800'
      );
      expect(getStatusColor(FollowUpTaskStatus.CANCELLED)).toBe(
        'bg-gray-100 text-gray-800'
      );
    });

    it('应返回默认颜色', () => {
      const unknownStatus = 'UNKNOWN' as FollowUpTaskStatus;
      expect(getStatusColor(unknownStatus)).toBe('bg-gray-100 text-gray-800');
    });
  });

  describe('getPriorityName', () => {
    it('应返回正确的优先级名称', () => {
      expect(getPriorityName(FollowUpTaskPriority.HIGH)).toBe('高优先级');
      expect(getPriorityName(FollowUpTaskPriority.MEDIUM)).toBe('中优先级');
      expect(getPriorityName(FollowUpTaskPriority.LOW)).toBe('低优先级');
    });

    it('应返回未知优先级本身', () => {
      const unknownPriority = 'UNKNOWN' as FollowUpTaskPriority;
      expect(getPriorityName(unknownPriority)).toBe(unknownPriority);
    });
  });

  describe('getPriorityColor', () => {
    it('应返回正确的优先级颜色', () => {
      expect(getPriorityColor(FollowUpTaskPriority.HIGH)).toBe(
        'bg-red-100 text-red-800'
      );
      expect(getPriorityColor(FollowUpTaskPriority.MEDIUM)).toBe(
        'bg-orange-100 text-orange-800'
      );
      expect(getPriorityColor(FollowUpTaskPriority.LOW)).toBe(
        'bg-blue-100 text-blue-800'
      );
    });

    it('应返回默认颜色', () => {
      const unknownPriority = 'UNKNOWN' as FollowUpTaskPriority;
      expect(getPriorityColor(unknownPriority)).toBe(
        'bg-gray-100 text-gray-800'
      );
    });
  });

  describe('getCommunicationTypeName', () => {
    it('应返回正确的沟通类型名称', () => {
      expect(getCommunicationTypeName(CommunicationType.PHONE)).toBe('电话');
      expect(getCommunicationTypeName(CommunicationType.EMAIL)).toBe('邮件');
      expect(getCommunicationTypeName(CommunicationType.MEETING)).toBe('面谈');
      expect(getCommunicationTypeName(CommunicationType.WECHAT)).toBe('微信');
      expect(getCommunicationTypeName(CommunicationType.OTHER)).toBe('其他');
    });

    it('应返回未知类型本身', () => {
      const unknownType = 'UNKNOWN' as CommunicationType;
      expect(getCommunicationTypeName(unknownType)).toBe(unknownType);
    });
  });

  describe('getDueDateText', () => {
    const now = new Date('2024-01-01T12:00:00');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now.getTime());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('应显示已逾期天数', () => {
      const dueDate = new Date('2023-12-28T12:00:00');
      expect(getDueDateText(dueDate)).toBe('已逾期 4 天');
    });

    it('应显示今天到期', () => {
      const dueDate = new Date('2024-01-01T12:00:00');
      expect(getDueDateText(dueDate)).toBe('今天到期');
    });

    it('应显示明天到期', () => {
      const dueDate = new Date('2024-01-02T12:00:00');
      expect(getDueDateText(dueDate)).toBe('明天到期');
    });

    it('应显示X天后到期（7天内）', () => {
      const dueDate = new Date('2024-01-03T12:00:00');
      expect(getDueDateText(dueDate)).toBe('2 天后到期');
    });

    it('应显示具体日期（超过7天）', () => {
      const dueDate = new Date('2024-01-15T12:00:00');
      expect(getDueDateText(dueDate)).toBe('2024/1/15');
    });
  });

  describe('getDueDateColor', () => {
    const now = new Date('2024-01-01T12:00:00');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now.getTime());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('逾期任务应为红色加粗', () => {
      const dueDate = new Date('2023-12-28T12:00:00');
      expect(getDueDateColor(dueDate)).toBe('text-red-600 font-semibold');
    });

    it('今天到期应为橙色加粗', () => {
      const dueDate = new Date('2024-01-01T12:00:00');
      expect(getDueDateColor(dueDate)).toBe('text-orange-600 font-semibold');
    });

    it('1天内到期应为黄色', () => {
      const dueDate = new Date('2024-01-02T12:00:00');
      expect(getDueDateColor(dueDate)).toBe('text-orange-600 font-semibold');
    });

    it('7天内到期应为黄色', () => {
      const dueDate = new Date('2024-01-03T12:00:00');
      expect(getDueDateColor(dueDate)).toBe('text-yellow-600');
    });

    it('超过7天应为灰色', () => {
      const dueDate = new Date('2024-01-15T12:00:00');
      expect(getDueDateColor(dueDate)).toBe('text-gray-600');
    });
  });

  describe('isTaskOverdue', () => {
    const now = new Date('2024-01-01T12:00:00');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now.getTime());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('应判断逾期任务', () => {
      const overdueDate = new Date('2023-12-28T12:00:00');
      expect(isTaskOverdue(overdueDate)).toBe(true);
    });

    it('应判断未逾期任务', () => {
      const futureDate = new Date('2024-01-02T12:00:00');
      expect(isTaskOverdue(futureDate)).toBe(false);
    });

    it('应判断今天到期任务为未逾期', () => {
      const todayDate = new Date('2024-01-01T12:00:00');
      expect(isTaskOverdue(todayDate)).toBe(false);
    });
  });

  describe('isTaskExpiringSoon', () => {
    const now = new Date('2024-01-01T12:00:00');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now.getTime());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('应判断即将到期任务（1小时内）', () => {
      const soonDate = new Date('2024-01-01T12:30:00');
      expect(isTaskExpiringSoon(soonDate)).toBe(true);
    });

    it('应判断即将到期任务（24小时内）', () => {
      const soonDate = new Date('2024-01-02T11:59:59');
      expect(isTaskExpiringSoon(soonDate)).toBe(true);
    });

    it('应判断未即将到期任务（超过24小时）', () => {
      const futureDate = new Date('2024-01-02T13:00:00');
      expect(isTaskExpiringSoon(futureDate)).toBe(false);
    });

    it('应判断逾期任务为未即将到期', () => {
      const overdueDate = new Date('2023-12-28T12:00:00');
      expect(isTaskExpiringSoon(overdueDate)).toBe(false);
    });
  });
});
