// 跟进任务工具函数
import {
  FollowUpTaskStatus,
  FollowUpTaskPriority,
  CommunicationType,
} from '@/types/client';

/**
 * 获取状态名称
 */
export function getStatusName(status: FollowUpTaskStatus): string {
  const names = {
    [FollowUpTaskStatus.PENDING]: '待处理',
    [FollowUpTaskStatus.COMPLETED]: '已完成',
    [FollowUpTaskStatus.CANCELLED]: '已取消',
  };
  return names[status] || status;
}

/**
 * 获取状态颜色
 */
export function getStatusColor(status: FollowUpTaskStatus): string {
  const colors = {
    [FollowUpTaskStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
    [FollowUpTaskStatus.COMPLETED]: 'bg-green-100 text-green-800',
    [FollowUpTaskStatus.CANCELLED]: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * 获取优先级名称
 */
export function getPriorityName(priority: FollowUpTaskPriority): string {
  const names = {
    [FollowUpTaskPriority.HIGH]: '高优先级',
    [FollowUpTaskPriority.MEDIUM]: '中优先级',
    [FollowUpTaskPriority.LOW]: '低优先级',
  };
  return names[priority] || priority;
}

/**
 * 获取优先级颜色
 */
export function getPriorityColor(priority: FollowUpTaskPriority): string {
  const colors = {
    [FollowUpTaskPriority.HIGH]: 'bg-red-100 text-red-800',
    [FollowUpTaskPriority.MEDIUM]: 'bg-orange-100 text-orange-800',
    [FollowUpTaskPriority.LOW]: 'bg-blue-100 text-blue-800',
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
}

/**
 * 获取日期文本
 */
export function getDueDateText(dueDate: Date): string {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return `已逾期 ${Math.abs(diffDays)} 天`;
  } else if (diffDays === 0) {
    return '今天到期';
  } else if (diffDays === 1) {
    return '明天到期';
  } else if (diffDays <= 7) {
    return `${diffDays} 天后到期`;
  } else {
    return due.toLocaleDateString('zh-CN');
  }
}

/**
 * 获取日期颜色
 */
export function getDueDateColor(dueDate: Date): string {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return 'text-red-600 font-semibold';
  } else if (diffDays <= 1) {
    return 'text-orange-600 font-semibold';
  } else if (diffDays <= 7) {
    return 'text-yellow-600';
  } else {
    return 'text-gray-600';
  }
}

/**
 * 获取沟通类型名称
 */
export function getCommunicationTypeName(type: CommunicationType): string {
  const names = {
    [CommunicationType.PHONE]: '电话',
    [CommunicationType.EMAIL]: '邮件',
    [CommunicationType.MEETING]: '面谈',
    [CommunicationType.WECHAT]: '微信',
    [CommunicationType.OTHER]: '其他',
  };
  return names[type] || type;
}

/**
 * 判断任务是否逾期
 */
export function isTaskOverdue(dueDate: Date): boolean {
  const now = new Date();
  const due = new Date(dueDate);
  return due.getTime() < now.getTime();
}

/**
 * 判断任务是否即将到期（1天内）
 */
export function isTaskExpiringSoon(dueDate: Date): boolean {
  const now = new Date();
  const due = new Date(dueDate);
  const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  return diffHours > 0 && diffHours <= 24;
}
