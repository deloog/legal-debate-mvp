/**
 * 任务类型定义
 * 集中定义任务相关的类型
 */

/**
 * 任务状态（匹配 Prisma Schema）
 */
export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * 任务状态常量（运行时可用）
 */
export const TaskStatusValues = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const TaskStatus = TaskStatusValues;

// 状态标签
export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: '待处理',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

/**
 * 任务优先级
 */
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * 任务优先级常量（运行时可用）
 */
export const TaskPriorityValues = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const TaskPriority = TaskPriorityValues;

// 优先级标签
export const TASK_PRIORITY_LABELS: Record<string, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '紧急',
};

/**
 * 任务详情
 */
export interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
  deletedAt?: Date | null;
  assignedTo?: string | null;
  assignedUser?: {
    id: string;
    name: string | null;
    email: string;
    avatar?: string | null;
  } | null;
  caseId: string | null;
  case?: {
    id: string;
    caseNumber?: string;
    title: string;
    type?: string;
    status?: string;
  } | null;
  tags?: string[];
  estimatedHours?: number | null;
  actualHours?: number | null;
  metadata?: Record<string, unknown> | null;
  createdBy: string;
  createdByUser?: {
    id: string;
    name: string | null;
    email: string;
    avatar?: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 任务列表响应
 */
export interface TaskListResponse {
  tasks: TaskDetail[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 任务查询参数
 */
export interface TaskQueryParams {
  page?: string;
  pageSize?: string;
  status?: string;
  type?: string;
  priority?: string;
  assigneeId?: string;
  caseId?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 任务创建请求
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  type: string;
  priority?: string;
  dueDate?: Date;
  assigneeId?: string;
  caseId?: string;
  relatedItems?: Array<{
    type: string;
    id: string;
  }>;
}

/**
 * 任务更新请求
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: Date;
  assigneeId?: string;
}

/**
 * 任务分配输入
 */
export interface AssignTaskInput {
  taskId: string;
  assigneeId: string;
  note?: string;
}

/**
 * 任务统计
 */
export interface TaskStatistics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
}

// =============================================================================
// 验证函数
// =============================================================================

/**
 * 验证任务状态是否有效
 */
export function isValidTaskStatus(status: string): status is TaskStatus {
  return Object.values(TaskStatusValues).includes(status as TaskStatus);
}

/**
 * 验证任务优先级是否有效
 */
export function isValidTaskPriority(priority: string): priority is TaskPriority {
  return Object.values(TaskPriorityValues).includes(priority as TaskPriority);
}

/**
 * 验证创建任务输入
 */
export function validateCreateTaskInput(input: CreateTaskInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.title || input.title.trim().length === 0) {
    errors.push('标题不能为空');
  }

  if (!input.type || input.type.trim().length === 0) {
    errors.push('任务类型不能为空');
  }

  if (input.priority && !isValidTaskPriority(input.priority)) {
    errors.push('无效的优先级');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证更新任务输入
 */
export function validateUpdateTaskInput(input: UpdateTaskInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (input.title !== undefined && input.title.trim().length === 0) {
    errors.push('标题不能为空');
  }

  if (input.status && !isValidTaskStatus(input.status)) {
    errors.push('无效的任务状态');
  }

  if (input.priority && !isValidTaskPriority(input.priority)) {
    errors.push('无效的优先级');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证分配任务输入
 */
export function validateAssignTaskInput(input: AssignTaskInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.taskId || input.taskId.trim().length === 0) {
    errors.push('任务ID不能为空');
  }

  if (!input.assigneeId || input.assigneeId.trim().length === 0) {
    errors.push('受让人ID不能为空');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 获取任务状态标签
 */
export function getTaskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status] || status;
}

/**
 * 获取任务优先级标签
 */
export function getTaskPriorityLabel(priority: TaskPriority): string {
  return TASK_PRIORITY_LABELS[priority] || priority;
}
