/**
 * 任务管理类型统一导出
 * 用于任务管理功能
 */

// 导出类型
export type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskQueryParams,
  TaskDetail,
  TaskListResponse,
  TaskStatistics,
  AssignTaskInput,
  CompleteTaskInput,
  TaskValidationError,
  TaskValidationResult,
} from './types';
export { TaskStatus, TaskPriority } from './types';

// 导出常量
export { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from './constants';

// 导出验证函数
export {
  isValidTaskStatus,
  isValidTaskPriority,
  validateCreateTaskInput,
  validateUpdateTaskInput,
  validateAssignTaskInput,
} from './validators';

// 导出辅助函数
import { TaskStatus, TaskPriority } from './types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from './constants';

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
