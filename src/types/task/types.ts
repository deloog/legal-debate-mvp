/**
 * 任务管理类型定义
 * 用于任务管理功能
 */

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  TODO = 'TODO', // 待办
  IN_PROGRESS = 'IN_PROGRESS', // 进行中
  COMPLETED = 'COMPLETED', // 已完成
  CANCELLED = 'CANCELLED', // 已取消
}

/**
 * 任务优先级枚举
 */
export enum TaskPriority {
  LOW = 'LOW', // 低
  MEDIUM = 'MEDIUM', // 中
  HIGH = 'HIGH', // 高
  URGENT = 'URGENT', // 紧急
}

/**
 * 创建任务输入接口
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  caseId?: string;
  assignedTo?: string;
  dueDate?: Date;
  tags?: string[];
  estimatedHours?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 更新任务输入接口
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  caseId?: string;
  assignedTo?: string;
  dueDate?: Date;
  completedAt?: Date | null;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 任务查询参数接口
 */
export interface TaskQueryParams {
  userId?: string;
  caseId?: string;
  assignedTo?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 任务详情接口
 */
export interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  caseId: string | null;
  assignedTo: string | null;
  createdBy: string;
  dueDate: Date | null;
  completedAt: Date | null;
  deletedAt: Date | null;
  tags: string[];
  estimatedHours: number | null;
  actualHours: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  case?: {
    id: string;
    title: string;
    type: string;
    status: string;
  };
  assignedUser?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
  createdByUser?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

/**
 * 任务列表响应接口
 */
export interface TaskListResponse {
  tasks: TaskDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 任务统计信息接口
 */
export interface TaskStatistics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  cancelledTasks: number;
  overdueTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  tasksByCase: Record<string, number>;
  averageCompletionTime: number;
}

/**
 * 分配任务输入接口
 */
export interface AssignTaskInput {
  assignedTo: string;
  dueDate?: Date;
  priority?: TaskPriority;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 标记任务完成输入接口
 */
export interface CompleteTaskInput {
  actualHours?: number;
  notes?: string;
}

/**
 * 任务验证错误接口
 */
export interface TaskValidationError {
  field: string;
  message: string;
}

/**
 * 任务验证结果接口
 */
export interface TaskValidationResult {
  isValid: boolean;
  errors: TaskValidationError[];
}
