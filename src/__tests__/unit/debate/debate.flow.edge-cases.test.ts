import { testPrisma } from '../../../test-utils/database';
import { setupTestDatabase, cleanupTestDatabase } from '../../../test-utils/database';

describe('Debate Flow Edge Cases', () => {
  let testUser: any;
  let testCase: any;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: 'test-edge@example.com',
        name: '边界测试用户',
        role: 'USER',
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: '边界情况测试案件',
        description: '这是一个用于测试辩论边界情况的案件',
        type: 'CIVIL',
        status: 'ACTIVE',
        plaintiffName: '张三',
        defendantName: '李四',
      },
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Debate Interruption and Resumption', () => {
    it('should handle debate interruption and resumption', async () => {
      // 创建辩论
      const debate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id }
          },
          user: {
            connect: { id: testUser.id }
          },
          title: '中断恢复测试辩论',
          status: 'IN_PROGRESS' as const,
          currentRound: 1,
        },
      });

      // 创建第一轮
      const round = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: debate.id }
          },
          roundNumber: 1,
          status: 'IN_PROGRESS' as const,
          startedAt: new Date(),
        },
      });

      // 创建部分论点
      await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round.id }
          },
          side: 'PLAINTIFF' as const,
          content: '中断前的论点',
          type: 'MAIN_POINT' as const,
        },
      });

      // 模拟中断 - 将轮次设置为FAILED
      await testPrisma.debateRound.update({
        where: { id: round.id },
        data: { 
          status: 'FAILED' as const,
          completedAt: new Date(),
        },
      });

      // 暂停辩论
      await testPrisma.debate.update({
        where: { id: debate.id },
        data: { status: 'PAUSED' as const },
      });

      // 验证中断状态
      const pausedDebate = await testPrisma.debate.findUnique({
        where: { id: debate.id },
        include: { rounds: true },
      });

      expect(pausedDebate?.status).toBe('PAUSED');
      expect(pausedDebate?.rounds[0]?.status).toBe('FAILED');

      // 恢复辩论 - 创建新轮次
      await testPrisma.debate.update({
        where: { id: debate.id },
        data: { 
          status: 'IN_PROGRESS' as const,
          currentRound: 2, // 继续下一轮
        },
      });

      const resumedRound = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: debate.id }
          },
          roundNumber: 2,
          status: 'IN_PROGRESS' as const,
          startedAt: new Date(),
        },
      });

      // 恢复后的论点
      await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: resumedRound.id }
          },
          side: 'DEFENDANT' as const,
          content: '恢复后的论点',
          type: 'MAIN_POINT' as const,
        },
      });

      // 验证恢复状态
      const resumedDebate = await testPrisma.debate.findUnique({
        where: { id: debate.id },
        include: { 
          rounds: {
            include: { arguments: true },
            orderBy: { roundNumber: 'asc' },
          },
        },
      });

      expect(resumedDebate?.status).toBe('IN_PROGRESS');
      expect(resumedDebate?.rounds).toHaveLength(2);
      expect(resumedDebate?.rounds[0]?.status).toBe('FAILED');
      expect(resumedDebate?.rounds[1]?.status).toBe('IN_PROGRESS');
      expect(resumedDebate?.rounds[1]?.arguments).toHaveLength(1);
    });
  });

  describe('Single Round Debate', () => {
    it('should handle debate with single round', async () => {
      const debate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id }
          },
          user: {
            connect: { id: testUser.id }
          },
          title: '单轮辩论',
          status: 'IN_PROGRESS' as const,
          currentRound: 1,
          debateConfig: {
            mode: 'adversarial',
            maxRounds: 1, // 只进行一轮
          },
        },
      });

      const round = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: debate.id }
          },
          roundNumber: 1,
          status: 'IN_PROGRESS' as const,
          startedAt: new Date(),
        },
      });

      // 创建基本论点
      await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round.id }
          },
          side: 'PLAINTIFF' as const,
          content: '单轮辩论的原告论点',
          type: 'MAIN_POINT' as const,
        },
      });

      await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round.id }
          },
          side: 'DEFENDANT' as const,
          content: '单轮辩论的被告论点',
          type: 'MAIN_POINT' as const,
        },
      });

      // 完成轮次和辩论
      await testPrisma.debateRound.update({
        where: { id: round.id },
        data: { 
          status: 'COMPLETED' as const,
          completedAt: new Date(),
        },
      });

      await testPrisma.debate.update({
        where: { id: debate.id },
        data: { 
          status: 'COMPLETED' as const,
        },
      });

      // 验证单轮辩论结果
      const finalDebate = await testPrisma.debate.findUnique({
        where: { id: debate.id },
        include: { rounds: true },
      });

      expect(finalDebate?.status).toBe('COMPLETED');
      expect(finalDebate?.rounds).toHaveLength(1);
      expect(finalDebate?.currentRound).toBe(1);
    });
  });

  describe('Collaborative Mode Debate', () => {
    it('should handle debate with collaborative mode', async () => {
      const debate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id }
          },
          user: {
            connect: { id: testUser.id }
          },
          title: '协作模式辩论',
          status: 'IN_PROGRESS' as const,
          currentRound: 1,
          debateConfig: {
            mode: 'collaborative', // 协作模式
            maxRounds: 2,
          },
        },
      });

      const round = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: debate.id }
          },
          roundNumber: 1,
          status: 'IN_PROGRESS' as const,
          startedAt: new Date(),
        },
      });

      // 协作模式更多中立论点
      await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round.id }
          },
          side: 'NEUTRAL' as const,
          content: '协作模式下的分析性论点',
          type: 'MAIN_POINT' as const,
        },
      });

      await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round.id }
          },
          side: 'PLAINTIFF' as const,
          content: '协作模式下的建设性建议',
          type: 'SUPPORTING' as const,
        },
      });

      // 验证协作模式配置
      const collaborativeDebate = await testPrisma.debate.findUnique({
        where: { id: debate.id },
        include: { rounds: { include: { arguments: true } } },
      });

      expect((collaborativeDebate?.debateConfig as any)?.mode).toBe('collaborative');
      expect(collaborativeDebate?.rounds[0]?.arguments.length).toBeGreaterThanOrEqual(2);
    });
  });
});
