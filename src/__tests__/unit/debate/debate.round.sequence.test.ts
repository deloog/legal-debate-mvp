import { testPrisma } from '../../../test-utils/database';
import { setupTestDatabase, cleanupTestDatabase } from '../../../test-utils/database';

describe('Debate Round Sequence Management', () => {
  let testUser: any;
  let testCase: any;
  let testDebate: any;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: 'test-round-sequence@example.com',
        name: '测试用户',
        role: 'USER',
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: '轮次序列测试案件',
        description: '这是一个用于测试辩论轮次序列管理的案件',
        type: 'CIVIL',
        status: 'ACTIVE',
        plaintiffName: '张三',
        defendantName: '李四',
      },
    });

    // 创建测试辩论
    testDebate = await testPrisma.debate.create({
      data: {
        case: {
          connect: { id: testCase.id }
        },
        user: {
          connect: { id: testUser.id }
        },
        title: '轮次序列测试辩论',
        status: 'IN_PROGRESS' as const,
        currentRound: 0,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Round Sequence Creation', () => {
    it('should create multiple rounds in sequence', async () => {
      const rounds = [];
      
      for (let i = 1; i <= 5; i++) {
        const round = await testPrisma.debateRound.create({
          data: {
            debate: {
              connect: { id: testDebate.id }
            },
            roundNumber: i,
            status: 'PENDING' as const,
          },
        });
        rounds.push(round);
      }

      expect(rounds).toHaveLength(5);
      rounds.forEach((round, index) => {
        expect(round.roundNumber).toBe(index + 1);
      });
    });

    it('should create rounds with gaps in sequence', async () => {
      const rounds = [];
      
      for (let i = 10; i <= 15; i++) {
        const round = await testPrisma.debateRound.create({
          data: {
            debate: {
              connect: { id: testDebate.id }
            },
            roundNumber: i,
            status: 'PENDING' as const,
          },
        });
        rounds.push(round);
      }

      expect(rounds).toHaveLength(6);
      rounds.forEach((round, index) => {
        expect(round.roundNumber).toBe(index + 10);
      });
    });
  });

  describe('Round Sequence Retrieval', () => {
    beforeEach(async () => {
      // 清理现有的轮次数据
      await testPrisma.debateRound.deleteMany({
        where: { debateId: testDebate.id }
      });

      // 创建测试轮次序列
      await testPrisma.debateRound.createMany({
        data: [
          {
            debateId: testDebate.id,
            roundNumber: 1,
            status: 'COMPLETED',
            startedAt: new Date('2023-01-01T10:00:00Z'),
            completedAt: new Date('2023-01-01T10:30:00Z'),
          },
          {
            debateId: testDebate.id,
            roundNumber: 2,
            status: 'COMPLETED',
            startedAt: new Date('2023-01-01T11:00:00Z'),
            completedAt: new Date('2023-01-01T11:45:00Z'),
          },
          {
            debateId: testDebate.id,
            roundNumber: 3,
            status: 'IN_PROGRESS',
            startedAt: new Date('2023-01-01T12:00:00Z'),
          },
          {
            debateId: testDebate.id,
            roundNumber: 4,
            status: 'PENDING',
          },
        ],
      });
    });

    it('should retrieve rounds in ascending order', async () => {
      const rounds = await testPrisma.debateRound.findMany({
        where: { debateId: testDebate.id },
        orderBy: { roundNumber: 'asc' },
      });

      expect(rounds).toHaveLength(4);
      expect(rounds[0].roundNumber).toBe(1);
      expect(rounds[1].roundNumber).toBe(2);
      expect(rounds[2].roundNumber).toBe(3);
      expect(rounds[3].roundNumber).toBe(4);

      // 验证顺序
      for (let i = 1; i < rounds.length; i++) {
        expect(rounds[i].roundNumber).toBeGreaterThan(rounds[i-1].roundNumber);
      }
    });

    it('should retrieve rounds in descending order', async () => {
      const rounds = await testPrisma.debateRound.findMany({
        where: { debateId: testDebate.id },
        orderBy: { roundNumber: 'desc' },
      });

      expect(rounds).toHaveLength(4);
      expect(rounds[0].roundNumber).toBe(4);
      expect(rounds[1].roundNumber).toBe(3);
      expect(rounds[2].roundNumber).toBe(2);
      expect(rounds[3].roundNumber).toBe(1);

      // 验证顺序
      for (let i = 1; i < rounds.length; i++) {
        expect(rounds[i].roundNumber).toBeLessThan(rounds[i-1].roundNumber);
      }
    });

    it('should find specific round in sequence', async () => {
      const round = await testPrisma.debateRound.findFirst({
        where: {
          debateId: testDebate.id,
          roundNumber: 2,
        },
      });

      expect(round).not.toBeNull();
      expect(round?.roundNumber).toBe(2);
      expect(round?.status).toBe('COMPLETED');
    });

    it('should get rounds by status range', async () => {
      const completedRounds = await testPrisma.debateRound.findMany({
        where: {
          debateId: testDebate.id,
          status: 'COMPLETED',
        },
        orderBy: { roundNumber: 'asc' },
      });

      const inProgressRounds = await testPrisma.debateRound.findMany({
        where: {
          debateId: testDebate.id,
          status: 'IN_PROGRESS',
        },
      });

      const pendingRounds = await testPrisma.debateRound.findMany({
        where: {
          debateId: testDebate.id,
          status: 'PENDING',
        },
      });

      expect(completedRounds).toHaveLength(2);
      expect(inProgressRounds).toHaveLength(1);
      expect(pendingRounds).toHaveLength(1);

      completedRounds.forEach(round => {
        expect(round.status).toBe('COMPLETED');
        expect(round.completedAt).toBeDefined();
      });
    });
  });

  describe('Round Sequence Validation', () => {
    it('should prevent duplicate round numbers in same debate', async () => {
      await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: testDebate.id }
          },
          roundNumber: 100,
          status: 'PENDING' as const,
        },
      });

      await expect(
        testPrisma.debateRound.create({
          data: {
            debate: {
              connect: { id: testDebate.id }
            },
            roundNumber: 100, // 重复的轮次编号
            status: 'PENDING' as const,
          },
        })
      ).rejects.toThrow();
    });

    it('should allow same round numbers in different debates', async () => {
      // 创建第二个辩论
      const secondDebate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id }
          },
          user: {
            connect: { id: testUser.id }
          },
          title: '第二个测试辩论',
          status: 'IN_PROGRESS' as const,
          currentRound: 0,
        },
      });

      // 在两个辩论中创建相同编号的轮次
      const round1 = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: testDebate.id }
          },
          roundNumber: 200,
          status: 'PENDING' as const,
        },
      });

      const round2 = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: secondDebate.id }
          },
          roundNumber: 200, // 相同的轮次编号，但不同辩论
          status: 'PENDING' as const,
        },
      });

      expect(round1.roundNumber).toBe(200);
      expect(round2.roundNumber).toBe(200);
      expect(round1.debateId).toBe(testDebate.id);
      expect(round2.debateId).toBe(secondDebate.id);
    });
  });
});
