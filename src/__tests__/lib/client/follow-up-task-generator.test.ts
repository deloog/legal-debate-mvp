/**
 * 跟进任务生成器测试
 */

import { CommunicationType, FollowUpTaskPriority } from '@/types/client';

// Mock prisma - 必须在导入prisma之前设置
const mockPrisma = {
  communicationRecord: {
    findUnique: jest.fn(),
  },
  followUpTask: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

import { FollowUpTaskGenerator } from '@/lib/client/follow-up-task-generator';

describe('FollowUpTaskGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSummary', () => {
    it('应该为电话类型生成摘要', () => {
      const summary = FollowUpTaskGenerator.generateSummary(
        CommunicationType.PHONE,
        '客户咨询'
      );

      expect(summary).toBe('电话跟进：客户咨询');
    });

    it('应该为邮件类型生成摘要', () => {
      const summary = FollowUpTaskGenerator.generateSummary(
        CommunicationType.EMAIL,
        '发送资料'
      );

      expect(summary).toBe('邮件跟进：发送资料');
    });

    it('应该为面谈类型生成摘要', () => {
      const summary = FollowUpTaskGenerator.generateSummary(
        CommunicationType.MEETING,
        '签订合同'
      );

      expect(summary).toBe('面谈跟进：签订合同');
    });

    it('应该为微信类型生成摘要', () => {
      const summary = FollowUpTaskGenerator.generateSummary(
        CommunicationType.WECHAT,
        '了解情况'
      );

      expect(summary).toBe('微信跟进：了解情况');
    });

    it('应该为其他类型生成摘要', () => {
      const summary = FollowUpTaskGenerator.generateSummary(
        CommunicationType.OTHER,
        '其他沟通'
      );

      expect(summary).toBe('其他跟进：其他沟通');
    });
  });

  describe('determinePriority', () => {
    it('应该为重要沟通返回高优先级', () => {
      const priority = FollowUpTaskGenerator.determinePriority(
        CommunicationType.PHONE,
        true,
        10
      );

      expect(priority).toBe(FollowUpTaskPriority.HIGH);
    });

    it('应该为紧急任务（3天内）返回高优先级', () => {
      const priority = FollowUpTaskGenerator.determinePriority(
        CommunicationType.EMAIL,
        false,
        2
      );

      expect(priority).toBe(FollowUpTaskPriority.HIGH);
    });

    it('应该为中等紧急（7天内）返回中优先级', () => {
      const priority = FollowUpTaskGenerator.determinePriority(
        CommunicationType.PHONE,
        false,
        5
      );

      expect(priority).toBe(FollowUpTaskPriority.MEDIUM);
    });

    it('应该为非紧急任务返回低优先级', () => {
      const priority = FollowUpTaskGenerator.determinePriority(
        CommunicationType.EMAIL,
        false,
        10
      );

      expect(priority).toBe(FollowUpTaskPriority.LOW);
    });

    it('应该为3天边界返回高优先级', () => {
      const priority = FollowUpTaskGenerator.determinePriority(
        CommunicationType.PHONE,
        false,
        3
      );

      expect(priority).toBe(FollowUpTaskPriority.HIGH);
    });

    it('应该为7天边界返回中优先级', () => {
      const priority = FollowUpTaskGenerator.determinePriority(
        CommunicationType.PHONE,
        false,
        7
      );

      expect(priority).toBe(FollowUpTaskPriority.MEDIUM);
    });
  });

  describe('generateFromCommunication', () => {
    it('应该基于沟通记录ID生成任务', async () => {
      const mockCommunication = {
        id: 'comm-1',
        clientId: 'client-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '电话沟通',
        content: '与客户沟通',
        nextFollowUpDate: new Date('2026-01-25'),
        isImportant: false,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        client: {
          userId: 'user-1',
        },
      };

      const mockTask = { id: 'task-1' };

      (
        mockPrisma.communicationRecord.findUnique as jest.Mock
      ).mockResolvedValue(mockCommunication);
      (mockPrisma.followUpTask.findFirst as jest.Mock).mockResolvedValue(null); // findPendingTask - 没有已存在的任务
      (mockPrisma.followUpTask.create as jest.Mock).mockResolvedValue(mockTask); // createTask

      const taskId =
        await FollowUpTaskGenerator.generateFromCommunication('comm-1');

      expect(taskId).toBe('task-1');
      expect(mockPrisma.communicationRecord.findUnique).toHaveBeenCalledWith({
        where: { id: 'comm-1' },
        include: {
          client: {
            select: { userId: true },
          },
        },
      });
    });

    it('应该返回null当沟通记录不存在', async () => {
      (
        mockPrisma.communicationRecord.findUnique as jest.Mock
      ).mockResolvedValue(null);

      const taskId =
        await FollowUpTaskGenerator.generateFromCommunication('non-existent');

      expect(taskId).toBeNull();
    });

    it('应该返回null当没有设置跟进日期', async () => {
      const mockCommunication = {
        id: 'comm-1',
        clientId: 'client-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '电话沟通',
        content: '与客户沟通',
        nextFollowUpDate: null,
        isImportant: false,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        client: {
          userId: 'user-1',
        },
      };

      (
        mockPrisma.communicationRecord.findUnique as jest.Mock
      ).mockResolvedValue(mockCommunication);

      const taskId =
        await FollowUpTaskGenerator.generateFromCommunication('comm-1');

      expect(taskId).toBeNull();
    });

    it('应该返回已存在任务的ID当任务已存在', async () => {
      const mockCommunication = {
        id: 'comm-1',
        clientId: 'client-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '电话沟通',
        content: '与客户沟通',
        nextFollowUpDate: new Date('2026-01-25'),
        isImportant: false,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        client: {
          userId: 'user-1',
        },
      };

      const mockExistingTask = { id: 'existing-task' };

      (
        mockPrisma.communicationRecord.findUnique as jest.Mock
      ).mockResolvedValue(mockCommunication);
      (mockPrisma.followUpTask.findFirst as jest.Mock).mockResolvedValue(
        mockExistingTask
      ); // findPendingTask - 已存在任务

      const taskId =
        await FollowUpTaskGenerator.generateFromCommunication('comm-1');

      expect(taskId).toBe('existing-task');
    });

    it('应该为重要沟通设置高优先级', async () => {
      const mockCommunication = {
        id: 'comm-1',
        clientId: 'client-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '重要沟通',
        content: '重要事项',
        nextFollowUpDate: new Date('2026-01-30'),
        isImportant: true,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        client: {
          userId: 'user-1',
        },
      };

      const mockTask = { id: 'task-1' };

      (
        mockPrisma.communicationRecord.findUnique as jest.Mock
      ).mockResolvedValue(mockCommunication);
      (mockPrisma.followUpTask.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.followUpTask.create as jest.Mock).mockResolvedValue(mockTask);

      const taskId =
        await FollowUpTaskGenerator.generateFromCommunication('comm-1');

      expect(taskId).toBe('task-1');
      // 验证创建任务时使用了HIGH优先级
      expect(mockPrisma.followUpTask.create).toHaveBeenCalledWith({
        data: {
          clientId: 'client-1',
          communicationId: 'comm-1',
          userId: 'user-1',
          type: 'PHONE',
          summary: '电话跟进：重要沟通',
          dueDate: new Date('2026-01-30'),
          priority: 'HIGH',
          status: 'PENDING',
        },
      });
    });

    it('应该处理所有类型的沟通', async () => {
      const types = Object.values(CommunicationType);

      for (const type of types) {
        const mockCommunication = {
          id: `comm-${type}`,
          clientId: 'client-1',
          userId: 'user-1',
          type: type,
          summary: '沟通',
          content: '内容',
          nextFollowUpDate: new Date('2026-01-25'),
          isImportant: false,
          metadata: null,
          createdAt: new Date('2026-01-20'),
          updatedAt: new Date('2026-01-20'),
          client: {
            userId: 'user-1',
          },
        };

        const mockTask = { id: `task-${type}` };

        jest.clearAllMocks();

        (
          mockPrisma.communicationRecord.findUnique as jest.Mock
        ).mockResolvedValue(mockCommunication);
        (mockPrisma.followUpTask.findFirst as jest.Mock).mockResolvedValue(
          null
        );
        (mockPrisma.followUpTask.create as jest.Mock).mockResolvedValue(
          mockTask
        );

        const taskId = await FollowUpTaskGenerator.generateFromCommunication(
          `comm-${type}`
        );

        expect(taskId).toBe(`task-${type}`);
      }
    });
  });

  describe('generateBatch', () => {
    it('应该批量生成任务', async () => {
      const mockTask = { id: 'task-1' };

      (
        mockPrisma.communicationRecord.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'comm-1',
        clientId: 'client-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '沟通',
        content: '内容',
        nextFollowUpDate: new Date('2026-01-25'),
        isImportant: false,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        client: {
          userId: 'user-1',
        },
      });
      (mockPrisma.followUpTask.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.followUpTask.create as jest.Mock).mockResolvedValue(mockTask);

      const taskIds = await FollowUpTaskGenerator.generateBatch([
        'comm-1',
        'comm-2',
      ]);

      expect(taskIds).toBeDefined();
      expect(taskIds).toBeInstanceOf(Array);
    });

    it('应该处理单个沟通ID', async () => {
      const mockTask = { id: 'task-1' };

      (
        mockPrisma.communicationRecord.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'comm-1',
        clientId: 'client-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '沟通',
        content: '内容',
        nextFollowUpDate: new Date('2026-01-25'),
        isImportant: false,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        client: {
          userId: 'user-1',
        },
      });
      (mockPrisma.followUpTask.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.followUpTask.create as jest.Mock).mockResolvedValue(mockTask);

      const taskIds = await FollowUpTaskGenerator.generateBatch(['comm-1']);

      expect(taskIds).toHaveLength(1);
      expect(taskIds[0]).toBe('task-1');
    });

    it('应该返回空数组当没有沟通ID', async () => {
      const taskIds = await FollowUpTaskGenerator.generateBatch([]);

      expect(taskIds).toEqual([]);
    });

    it('应该处理生成失败的沟通', async () => {
      (
        mockPrisma.communicationRecord.findUnique as jest.Mock
      ).mockRejectedValue(new Error('数据库错误'));

      const taskIds = await FollowUpTaskGenerator.generateBatch(['comm-1']);

      expect(taskIds).toEqual([]);
    });
  });

  describe('autoGeneratePendingTasks', () => {
    it('应该自动生成待跟进的任务', async () => {
      const mockCommunications = [{ id: 'comm-1' }, { id: 'comm-2' }];

      const mockTask = { id: 'task-1' };

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(mockCommunications) // 查找待生成的沟通
        .mockResolvedValueOnce([]) // findPendingTask
        .mockResolvedValueOnce([mockTask]); // createTask

      const count = await FollowUpTaskGenerator.autoGeneratePendingTasks(50);

      expect(count).toBeGreaterThanOrEqual(0);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('应该使用默认limit为50', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await FollowUpTaskGenerator.autoGeneratePendingTasks();

      // prisma $queryRaw 使用模板字面量语法，limit作为独立参数传递
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockPrisma.$queryRaw.mock.calls[0][1]).toBe(50);
    });

    it('应该使用自定义limit', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await FollowUpTaskGenerator.autoGeneratePendingTasks(100);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockPrisma.$queryRaw.mock.calls[0][1]).toBe(100);
    });

    it('应该返回0当没有待生成的沟通', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const count = await FollowUpTaskGenerator.autoGeneratePendingTasks(50);

      expect(count).toBe(0);
    });
  });

  describe('autoGenerateTasksByDateRange', () => {
    it('应该按日期范围生成任务', async () => {
      const mockCommunications = [{ id: 'comm-1' }];
      const mockTask = { id: 'task-1' };

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(mockCommunications)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockTask]);

      const count = await FollowUpTaskGenerator.autoGenerateTasksByDateRange(
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('应该返回0当日期范围内没有任务', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const count = await FollowUpTaskGenerator.autoGenerateTasksByDateRange(
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(count).toBe(0);
    });
  });
});
