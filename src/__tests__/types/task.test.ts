/**
 * 任务类型系统测试
 */

import {
  TaskStatus,
  TaskPriority,
  CreateTaskInput,
  UpdateTaskInput,
  AssignTaskInput,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  isValidTaskStatus,
  isValidTaskPriority,
  validateCreateTaskInput,
  validateUpdateTaskInput,
  validateAssignTaskInput,
  getTaskStatusLabel,
  getTaskPriorityLabel,
} from '../../types/task/index';

describe('Task Types', () => {
  describe('TaskStatus Enum', () => {
    it('应该包含所有状态', () => {
      expect(TaskStatus.TODO).toBe('TODO');
      expect(TaskStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(TaskStatus.COMPLETED).toBe('COMPLETED');
      expect(TaskStatus.CANCELLED).toBe('CANCELLED');
    });
  });

  describe('TaskPriority Enum', () => {
    it('应该包含所有优先级', () => {
      expect(TaskPriority.LOW).toBe('LOW');
      expect(TaskPriority.MEDIUM).toBe('MEDIUM');
      expect(TaskPriority.HIGH).toBe('HIGH');
      expect(TaskPriority.URGENT).toBe('URGENT');
    });
  });

  describe('Type Guards', () => {
    describe('isValidTaskStatus', () => {
      it('应该识别有效的状态', () => {
        expect(isValidTaskStatus('TODO')).toBe(true);
        expect(isValidTaskStatus('IN_PROGRESS')).toBe(true);
        expect(isValidTaskStatus('COMPLETED')).toBe(true);
        expect(isValidTaskStatus('CANCELLED')).toBe(true);
      });

      it('应该拒绝无效的状态', () => {
        expect(isValidTaskStatus('INVALID')).toBe(false);
        expect(isValidTaskStatus('')).toBe(false);
        expect(isValidTaskStatus('pending')).toBe(false);
      });
    });

    describe('isValidTaskPriority', () => {
      it('应该识别有效的优先级', () => {
        expect(isValidTaskPriority('LOW')).toBe(true);
        expect(isValidTaskPriority('MEDIUM')).toBe(true);
        expect(isValidTaskPriority('HIGH')).toBe(true);
        expect(isValidTaskPriority('URGENT')).toBe(true);
      });

      it('应该拒绝无效的优先级', () => {
        expect(isValidTaskPriority('INVALID')).toBe(false);
        expect(isValidTaskPriority('')).toBe(false);
        expect(isValidTaskPriority('high')).toBe(false);
      });
    });
  });

  describe('Label Functions', () => {
    describe('getTaskStatusLabel', () => {
      it('应该返回正确的状态标签', () => {
        expect(getTaskStatusLabel(TaskStatus.TODO)).toBe('待办');
        expect(getTaskStatusLabel(TaskStatus.IN_PROGRESS)).toBe('进行中');
        expect(getTaskStatusLabel(TaskStatus.COMPLETED)).toBe('已完成');
        expect(getTaskStatusLabel(TaskStatus.CANCELLED)).toBe('已取消');
      });
    });

    describe('getTaskPriorityLabel', () => {
      it('应该返回正确的优先级标签', () => {
        expect(getTaskPriorityLabel(TaskPriority.LOW)).toBe('低');
        expect(getTaskPriorityLabel(TaskPriority.MEDIUM)).toBe('中');
        expect(getTaskPriorityLabel(TaskPriority.HIGH)).toBe('高');
        expect(getTaskPriorityLabel(TaskPriority.URGENT)).toBe('紧急');
      });
    });
  });

  describe('Constants', () => {
    it('TASK_STATUS_LABELS 应该包含所有状态', () => {
      expect(Object.keys(TASK_STATUS_LABELS)).toHaveLength(4);
      expect(TASK_STATUS_LABELS[TaskStatus.TODO]).toBe('待办');
      expect(TASK_STATUS_LABELS[TaskStatus.IN_PROGRESS]).toBe('进行中');
      expect(TASK_STATUS_LABELS[TaskStatus.COMPLETED]).toBe('已完成');
      expect(TASK_STATUS_LABELS[TaskStatus.CANCELLED]).toBe('已取消');
    });

    it('TASK_PRIORITY_LABELS 应该包含所有优先级', () => {
      expect(Object.keys(TASK_PRIORITY_LABELS)).toHaveLength(4);
      expect(TASK_PRIORITY_LABELS[TaskPriority.LOW]).toBe('低');
      expect(TASK_PRIORITY_LABELS[TaskPriority.MEDIUM]).toBe('中');
      expect(TASK_PRIORITY_LABELS[TaskPriority.HIGH]).toBe('高');
      expect(TASK_PRIORITY_LABELS[TaskPriority.URGENT]).toBe('紧急');
    });
  });

  describe('Validators', () => {
    describe('validateCreateTaskInput', () => {
      it('应该验证有效的创建任务输入', () => {
        const input: CreateTaskInput = {
          title: '测试任务',
          description: '测试任务描述',
          type: 'GENERAL',
          priority: TaskPriority.MEDIUM,
        };

        const result = validateCreateTaskInput(input);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('应该拒绝缺少标题的输入', () => {
        const input = {} as CreateTaskInput;

        const result = validateCreateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'title',
          message: '任务标题是必填项',
        });
      });

      it('应该拒绝过长的标题', () => {
        const input = {
          title: 'a'.repeat(201),
        } as any;

        const result = validateCreateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'title',
          message: '任务标题不能超过200个字符',
        });
      });

      it('应该拒绝过长的描述', () => {
        const input = {
          title: '测试任务',
          description: 'a'.repeat(2001),
        } as any;

        const result = validateCreateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'description',
          message: '任务描述不能超过2000个字符',
        });
      });

      it('应该拒绝无效的状态', () => {
        const input = {
          title: '测试任务',
          status: 'INVALID' as unknown as TaskStatus,
        } as any;

        const result = validateCreateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'status',
          message:
            '任务状态必须是有效的值（TODO、IN_PROGRESS、COMPLETED、CANCELLED）',
        });
      });

      it('应该拒绝无效的优先级', () => {
        const input = {
          title: '测试任务',
          priority: 'INVALID' as unknown as TaskPriority,
        } as any;

        const result = validateCreateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'priority',
          message: '任务优先级必须是有效的值（LOW、MEDIUM、HIGH、URGENT）',
        });
      });

      it('应该拒绝负数的预估工时', () => {
        const input = {
          title: '测试任务',
          estimatedHours: -1,
        } as any;

        const result = validateCreateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'estimatedHours',
          message: '预估工时必须是非负数',
        });
      });

      it('应该拒绝过大的预估工时', () => {
        const input = {
          title: '测试任务',
          estimatedHours: 1001,
        } as any;

        const result = validateCreateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'estimatedHours',
          message: '预估工时不能超过1000小时',
        });
      });

      it('应该接受有效的预估工时', () => {
        const input = {
          title: '测试任务',
          estimatedHours: 8,
        } as any;

        const result = validateCreateTaskInput(input);
        expect(result.isValid).toBe(true);
      });
    });

    describe('validateUpdateTaskInput', () => {
      it('应该验证有效的更新任务输入', () => {
        const input: UpdateTaskInput = {
          title: '更新后的任务',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
        };

        const result = validateUpdateTaskInput(input);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('应该拒绝空标题', () => {
        const input: UpdateTaskInput = {
          title: '   ',
        };

        const result = validateUpdateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'title',
          message: '任务标题不能为空',
        });
      });

      it('应该拒绝过长的描述', () => {
        const input: UpdateTaskInput = {
          description: 'a'.repeat(2001),
        };

        const result = validateUpdateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'description',
          message: '任务描述不能超过2000个字符',
        });
      });

      it('应该拒绝负数的实际工时', () => {
        const input = {
          actualHours: -1,
        } as any;

        const result = validateUpdateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'actualHours',
          message: '实际工时必须是非负数',
        });
      });

      it('应该接受将完成时间设置为 null', () => {
        const input = {
          completedAt: null,
        } as any;

        const result = validateUpdateTaskInput(input);
        expect(result.isValid).toBe(true);
      });

      it('应该拒绝无效的完成时间对象', () => {
        const input = {
          completedAt: 'invalid' as unknown as Date,
        } as any;

        const result = validateUpdateTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'completedAt',
          message: '完成时间必须是有效的日期对象',
        });
      });
    });

    describe('validateAssignTaskInput', () => {
      it('应该验证有效的分配任务输入', () => {
        const input: AssignTaskInput = {
          taskId: 'task-123',
          assignedTo: 'user-123',
        };

        const result = validateAssignTaskInput(input);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('应该拒绝缺少分配人', () => {
        const input = {} as AssignTaskInput;

        const result = validateAssignTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'assignedTo',
          message: '分配人是必填项',
        });
      });

      it('应该拒绝无效的截止日期', () => {
        const input = {
          taskId: 'task-123',
          assignedTo: 'user-123',
          dueDate: 'invalid' as unknown as Date,
        } as any;

        const result = validateAssignTaskInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'dueDate',
          message: '截止日期必须是有效的日期对象',
        });
      });

      it('应该接受有效的截止日期', () => {
        const input = {
          taskId: 'task-123',
          assignedTo: 'user-123',
          dueDate: new Date('2024-12-31'),
        } as any;

        const result = validateAssignTaskInput(input);
        expect(result.isValid).toBe(true);
      });
    });
  });
});
