// 轮次管理器单元测试

import { RoundManager } from '@/lib/debate/round/round-manager';
import { prisma } from '@/lib/db/prisma';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  createCase,
  createDebate,
} from '@/test-utils';

describe('RoundManager', () => {
  let manager: RoundManager;
  let debateId: string;
  let testUserId: string;

  beforeEach(async () => {
    manager = new RoundManager();
  });

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  // 辅助函数：创建测试辩论
  async function createTestDebate(): Promise<string> {
    // 创建测试用户
    testUserId = `test-user-round-manager-${Date.now()}-${Math.random()}`;
    const testUser = await prisma.user.create({
      data: {
        id: testUserId,
        email: `round-manager-${Date.now()}@test.com`,
        username: `roundmanager-${Date.now()}`,
        name: 'Round Manager Test',
        role: 'USER',
      },
    });

    const testCase = await prisma.case.create({
      data: {
        ...createCase({ userId: testUser.id, id: undefined }),
        id: undefined,
        userId: testUser.id,
      },
    });

    const debate = await prisma.debate.create({
      data: {
        ...createDebate({ id: undefined }),
        id: undefined,
        caseId: testCase.id,
        userId: testUser.id,
      },
    });

    return debate.id;
  }

  describe('startRound', () => {
    beforeEach(async () => {
      debateId = await createTestDebate();
    });

    it('应该成功开始第一个轮次', async () => {
      const round = await manager.startRound(debateId);

      expect(round).toBeDefined();
      expect(round.debateId).toBe(debateId);
      expect(round.roundNumber).toBe(1);
      expect(round.status).toBe('IN_PROGRESS');
      expect(round.startedAt).toBeInstanceOf(Date);
    });

    it('应该更新辩论的当前轮次', async () => {
      const debate = await prisma.debate.findUnique({
        where: { id: debateId },
      });

      expect(debate).toBeDefined();
      expect(debate?.currentRound).toBe(1);
    });

    it('应该成功开始第二个轮次', async () => {
      debateId = await createTestDebate();

      // 完成第一个轮次
      const round = await prisma.debateRound.findFirst({
        where: { debateId },
      });
      if (round) {
        await prisma.debateRound.update({
          where: { id: round.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      }

      // 开始第二个轮次
      const newRound = await manager.startRound(debateId);

      expect(newRound.roundNumber).toBe(2);
      expect(newRound.status).toBe('IN_PROGRESS');
    });

    it('应该拒绝在不存在的辩论开始轮次', async () => {
      debateId = await createTestDebate();
      await expect(manager.startRound('non-existent-id')).rejects.toThrow(
        '辩论不存在'
      );
    });

    it('应该拒绝在有进行中轮次的辩论开始新轮次', async () => {
      debateId = await createTestDebate();
      // 先完成当前轮次
      const round = await prisma.debateRound.findFirst({
        where: { debateId, status: 'IN_PROGRESS' },
      });
      if (round) {
        await prisma.debateRound.update({
          where: { id: round.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      }

      // 开始新轮次
      await manager.startRound(debateId);

      // 尝试开始另一个轮次
      await expect(manager.startRound(debateId)).rejects.toThrow(
        '存在进行中的轮次'
      );
    });
  });

  describe('completeRound', () => {
    beforeEach(async () => {
      debateId = await createTestDebate();
    });

    it('应该成功完成轮次', async () => {
      // 创建并完成一个轮次
      const round = await manager.startRound(debateId);

      // 添加论点
      await manager.addArgument(
        round.id,
        'PLAINTIFF',
        '原告论点内容',
        'MAIN_POINT',
        { aiProvider: 'zhipu', confidence: 0.85 }
      );

      await manager.addArgument(
        round.id,
        'DEFENDANT',
        '被告论点内容',
        'MAIN_POINT',
        { aiProvider: 'zhipu', confidence: 0.9 }
      );

      // 完成轮次
      const summary = await manager.completeRound(round.id);

      expect(summary).toBeDefined();
      expect(summary.roundId).toBe(round.id);
      expect(summary.roundNumber).toBe(round.roundNumber);
      expect(summary.plaintiffSummary.argumentCount).toBeGreaterThan(0);
      expect(summary.defendantSummary.argumentCount).toBeGreaterThan(0);
    });

    it('应该拒绝在不存在的轮次上操作', async () => {
      debateId = await createTestDebate();
      await expect(
        manager.completeRound('non-existent-round-id')
      ).rejects.toThrow('轮次不存在');
    });

    it('应该拒绝从PENDING状态直接完成', async () => {
      debateId = await createTestDebate();
      // 创建一个PENDING状态的轮次
      const round = await prisma.debateRound.create({
        data: {
          debateId,
          roundNumber: 999,
          status: 'PENDING',
          startedAt: new Date(),
        },
      });

      await expect(manager.completeRound(round.id)).rejects.toThrow(
        '无法从PENDING状态转换为COMPLETED状态'
      );
    });
  });

  describe('failRound', () => {
    beforeEach(async () => {
      debateId = await createTestDebate();
    });

    it('应该成功标记轮次为失败', async () => {
      const round = await prisma.debateRound.create({
        data: {
          debateId,
          roundNumber: 1000,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });

      await expect(
        manager.failRound(round.id, '测试失败')
      ).resolves.not.toThrow();

      const updatedRound = await prisma.debateRound.findUnique({
        where: { id: round.id },
      });

      expect(updatedRound?.status).toBe('FAILED');
      expect(updatedRound?.completedAt).toBeInstanceOf(Date);
    });

    it('应该拒绝在不存在的轮次上操作', async () => {
      debateId = await createTestDebate();
      await expect(manager.failRound('non-existent-round-id')).rejects.toThrow(
        '轮次不存在'
      );
    });
  });

  describe('retryRound', () => {
    beforeEach(async () => {
      debateId = await createTestDebate();
    });

    it('应该成功重试失败的轮次', async () => {
      // 创建一个失败的轮次
      const round = await prisma.debateRound.create({
        data: {
          debateId,
          roundNumber: 1001,
          status: 'FAILED',
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      // 完成所有进行中的轮次
      const inProgressRound = await prisma.debateRound.findFirst({
        where: { debateId, status: 'IN_PROGRESS' },
      });
      if (inProgressRound) {
        await prisma.debateRound.update({
          where: { id: inProgressRound.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }

      const retriedRound = await manager.retryRound(round.id);

      expect(retriedRound.status).toBe('IN_PROGRESS');
      expect(retriedRound.completedAt).toBeNull();
    });

    it('应该拒绝重试非FAILED状态的轮次', async () => {
      debateId = await createTestDebate();
      const round = await prisma.debateRound.create({
        data: {
          debateId,
          roundNumber: 1002,
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await expect(manager.retryRound(round.id)).rejects.toThrow(
        '只能重试失败的轮次'
      );
    });
  });

  describe('getRoundContext', () => {
    beforeEach(async () => {
      debateId = await createTestDebate();
    });

    it('应该返回轮次上下文', async () => {
      // 完成一个轮次以产生历史记录
      const round1 = await manager.startRound(debateId);
      await manager.addArgument(
        round1.id,
        'PLAINTIFF',
        '第一个论点',
        'MAIN_POINT'
      );
      await manager.completeRound(round1.id);

      const round2 = await manager.startRound(debateId);
      const context = await manager.getRoundContext(round2.id);

      expect(context).toBeDefined();
      expect(context.debateId).toBe(debateId);
      expect(context.currentRoundNumber).toBe(round2.roundNumber);
      expect(context.historicalContext.roundCount).toBeGreaterThan(0);
      expect(context.historicalContext.keyPointsPerRound).toHaveLength(
        context.historicalContext.roundCount
      );
    });
  });

  describe('getRoundSummary', () => {
    beforeEach(async () => {
      debateId = await createTestDebate();
    });

    it('应该返回轮次摘要', async () => {
      const round = await manager.startRound(debateId);

      await manager.addArgument(
        round.id,
        'PLAINTIFF',
        '原告主要论点',
        'MAIN_POINT',
        { aiProvider: 'zhipu', confidence: 0.9 }
      );

      const summary = await manager.getRoundSummary(round.id);

      expect(summary).toBeDefined();
      expect(summary.roundId).toBe(round.id);
      expect(summary.roundNumber).toBe(round.roundNumber);
      expect(summary.plaintiffSummary.argumentCount).toBe(1);
      expect(summary.defendantSummary.argumentCount).toBe(0);
    });
  });

  describe('addArgument', () => {
    beforeEach(async () => {
      debateId = await createTestDebate();
    });

    it('应该成功添加论点', async () => {
      const round = await manager.startRound(debateId);

      const result = await manager.addArgument(
        round.id,
        'PLAINTIFF',
        '测试论点内容',
        'MAIN_POINT',
        { aiProvider: 'zhipu', confidence: 0.85 }
      );

      expect(result).toBeDefined();
      expect(result.roundId).toBe(round.id);
      expect(result.argumentId).toBeDefined();

      const argument = await prisma.argument.findUnique({
        where: { id: result.argumentId },
      });

      expect(argument).toBeDefined();
      expect(argument?.roundId).toBe(round.id);
      expect(argument?.side).toBe('PLAINTIFF');
      expect(argument?.content).toBe('测试论点内容');
    });

    it('应该拒绝在非IN_PROGRESS状态添加论点', async () => {
      debateId = await createTestDebate();
      const round = await prisma.debateRound.create({
        data: {
          debateId,
          roundNumber: 2000,
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await expect(
        manager.addArgument(round.id, 'PLAINTIFF', '内容', 'MAIN_POINT')
      ).rejects.toThrow('只能在IN_PROGRESS状态的轮次中添加论点');
    });

    it('应该拒绝在不存在的轮次添加论点', async () => {
      debateId = await createTestDebate();
      await expect(
        manager.addArgument('non-existent', 'PLAINTIFF', '内容', 'MAIN_POINT')
      ).rejects.toThrow('轮次不存在');
    });
  });

  describe('getAllRounds', () => {
    beforeEach(async () => {
      debateId = await createTestDebate();
    });

    it('应该返回辩论的所有轮次', async () => {
      const rounds = await manager.getAllRounds(debateId);

      expect(Array.isArray(rounds)).toBe(true);
      expect(rounds.length).toBeGreaterThan(0);
      // 验证轮次按编号排序
      for (let i = 1; i < rounds.length; i++) {
        expect(rounds[i].roundNumber).toBeGreaterThan(
          rounds[i - 1].roundNumber
        );
      }
    });
  });

  describe('getInProgressRound', () => {
    beforeEach(async () => {
      debateId = await createTestDebate();
    });

    it('应该返回进行中的轮次', async () => {
      // 确保有一个进行中的轮次
      const inProgressRound = await prisma.debateRound.findFirst({
        where: { debateId, status: 'IN_PROGRESS' },
      });

      if (inProgressRound) {
        const round = await manager.getInProgressRound(debateId);

        expect(round).toBeDefined();
        expect(round?.id).toBe(inProgressRound.id);
        expect(round?.status).toBe('IN_PROGRESS');
      }
    });

    it('应该在无进行中轮次时返回null', async () => {
      debateId = await createTestDebate();
      // 完成所有轮次
      await prisma.debateRound.updateMany({
        where: { debateId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      const round = await manager.getInProgressRound(debateId);
      expect(round).toBeNull();
    });
  });
});
