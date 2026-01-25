/**
 * 任务管理类型验证函数
 * 用于任务管理功能
 */

import type {
  CreateTaskInput,
  UpdateTaskInput,
  AssignTaskInput,
  TaskValidationResult,
  TaskValidationError,
} from './types';
import { TaskPriority, TaskStatus } from './types';

/**
 * 类型守卫：验证是否为有效的 TaskStatus
 */
export function isValidTaskStatus(value: string): value is TaskStatus {
  return Object.values(TaskStatus).includes(value as TaskStatus);
}

/**
 * 类型守卫：验证是否为有效的 TaskPriority
 */
export function isValidTaskPriority(value: string): value is TaskPriority {
  return Object.values(TaskPriority).includes(value as TaskPriority);
}

/**
 * 验证创建任务输入
 */
export function validateCreateTaskInput(
  input: CreateTaskInput
): TaskValidationResult {
  const errors: TaskValidationError[] = [];

  if (
    !input.title ||
    typeof input.title !== 'string' ||
    input.title.trim().length === 0
  ) {
    errors.push({ field: 'title', message: '任务标题是必填项' });
  }

  if (input.title && input.title.length > 200) {
    errors.push({ field: 'title', message: '任务标题不能超过200个字符' });
  }

  if (input.description && input.description.length > 2000) {
    errors.push({
      field: 'description',
      message: '任务描述不能超过2000个字符',
    });
  }

  if (input.status !== undefined && !isValidTaskStatus(input.status)) {
    errors.push({
      field: 'status',
      message:
        '任务状态必须是有效的值（TODO、IN_PROGRESS、COMPLETED、CANCELLED）',
    });
  }

  if (input.priority !== undefined && !isValidTaskPriority(input.priority)) {
    errors.push({
      field: 'priority',
      message: '任务优先级必须是有效的值（LOW、MEDIUM、HIGH、URGENT）',
    });
  }

  if (input.estimatedHours !== undefined) {
    if (typeof input.estimatedHours !== 'number' || input.estimatedHours < 0) {
      errors.push({
        field: 'estimatedHours',
        message: '预估工时必须是非负数',
      });
    }
    if (input.estimatedHours > 1000) {
      errors.push({
        field: 'estimatedHours',
        message: '预估工时不能超过1000小时',
      });
    }
  }

  if (input.dueDate && !(input.dueDate instanceof Date)) {
    errors.push({
      field: 'dueDate',
      message: '截止日期必须是有效的日期对象',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 验证更新任务输入
 */
export function validateUpdateTaskInput(
  input: UpdateTaskInput
): TaskValidationResult {
  const errors: TaskValidationError[] = [];

  if (input.title !== undefined) {
    if (input.title.trim().length === 0) {
      errors.push({ field: 'title', message: '任务标题不能为空' });
    }
    if (input.title.length > 200) {
      errors.push({ field: 'title', message: '任务标题不能超过200个字符' });
    }
  }

  if (input.description !== undefined && input.description.length > 2000) {
    errors.push({
      field: 'description',
      message: '任务描述不能超过2000个字符',
    });
  }

  if (input.status !== undefined && !isValidTaskStatus(input.status)) {
    errors.push({
      field: 'status',
      message:
        '任务状态必须是有效的值（TODO、IN_PROGRESS、COMPLETED、CANCELLED）',
    });
  }

  if (input.priority !== undefined && !isValidTaskPriority(input.priority)) {
    errors.push({
      field: 'priority',
      message: '任务优先级必须是有效的值（LOW、MEDIUM、HIGH、URGENT）',
    });
  }

  if (input.estimatedHours !== undefined) {
    if (typeof input.estimatedHours !== 'number' || input.estimatedHours < 0) {
      errors.push({
        field: 'estimatedHours',
        message: '预估工时必须是非负数',
      });
    }
    if (input.estimatedHours > 1000) {
      errors.push({
        field: 'estimatedHours',
        message: '预估工时不能超过1000小时',
      });
    }
  }

  if (input.actualHours !== undefined) {
    if (typeof input.actualHours !== 'number' || input.actualHours < 0) {
      errors.push({
        field: 'actualHours',
        message: '实际工时必须是非负数',
      });
    }
    if (input.actualHours > 1000) {
      errors.push({
        field: 'actualHours',
        message: '实际工时不能超过1000小时',
      });
    }
  }

  if (input.dueDate !== undefined && !(input.dueDate instanceof Date)) {
    errors.push({
      field: 'dueDate',
      message: '截止日期必须是有效的日期对象',
    });
  }

  if (
    input.completedAt !== undefined &&
    input.completedAt !== null &&
    !(input.completedAt instanceof Date)
  ) {
    errors.push({
      field: 'completedAt',
      message: '完成时间必须是有效的日期对象',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 验证分配任务输入
 */
export function validateAssignTaskInput(
  input: AssignTaskInput
): TaskValidationResult {
  const errors: TaskValidationError[] = [];

  if (!input.assignedTo || typeof input.assignedTo !== 'string') {
    errors.push({ field: 'assignedTo', message: '分配人是必填项' });
  }

  if (input.dueDate && !(input.dueDate instanceof Date)) {
    errors.push({
      field: 'dueDate',
      message: '截止日期必须是有效的日期对象',
    });
  }

  if (input.priority !== undefined && !isValidTaskPriority(input.priority)) {
    errors.push({
      field: 'priority',
      message: '任务优先级必须是有效的值（LOW、MEDIUM、HIGH、URGENT）',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
