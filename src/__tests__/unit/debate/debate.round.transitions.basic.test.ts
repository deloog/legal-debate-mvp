import { testPrisma } from '../../../test-utils/database';
import {
  setupTestDatabase,
  cleanupTestDatabase,
} from '../../../test-utils/database';

describe('Debate Round Basic Status Transitions', () => {
  let testUser: any;
  let testCase: any;
  let testDebate: any;

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: 'test-round-basic@example.com',
        name: '测试用户',
        role: 'USER',
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: '轮次基础转换测试案件',
        description: '这是一个用于测试辩论轮次基础状态转换的案件',
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
          connect: { id: testCase.id },
        },
        user: {
          connect: { id: testUser.id },
        },
        title: '轮次基础转换测试辩论',
        status: 'IN_PROGRESS' as const,
        currentRound: 0,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Basic Status Transitions', () => {
    let testRound: any;

    beforeEach(async () => {
      testRound = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: testDebate.id },
          },
          roundNumber: Math.floor(Math.random() * 1000),
          status: 'PENDING' as const,
        },
      });
    });

    it('should support PENDING to IN_PROGRESS transition', async () => {
      const startedAt = new Date();
      const updatedRound = await testPrisma.debateRound.update({
        where: { id: testRound.id },
        data: {
          status: 'IN_PROGRESS' as const,
          startedAt,
        },
      });

      expect(updatedRound.status).toBe('IN_PROGRESS');
      expect(updatedRound.startedAt).toEqual(startedAt);
      expect(updatedRound.updatedAt.getTime()).toBeGreaterThan(
        testRound.updatedAt.getTime()
      );
    });

    it('should support IN_PROGRESS to COMPLETED transition', async () => {
      // 先设置为进行中
      await testPrisma.debateRound.update({
        where: { id: testRound.id },
        data: {
          status: 'IN_PROGRESS' as const,
          startedAt: new Date(),
        },
      });

      const completedAt = new Date();
      const updatedRound = await testPrisma.debateRound.update({
        where: { id: testRound.id },
        data: {
          status: 'COMPLETED' as const,
          completedAt,
        },
      });

      expect(updatedRound.status).toBe('COMPLETED');
      expect(updatedRound.completedAt).toEqual(completedAt);
      expect(updatedRound.startedAt).toBeDefined();
    });

    it('should support direct transition to FAILED', async () => {
      const updatedRound = await testPrisma.debateRound.update({
        where: { id: testRound.id },
        data: { status: 'FAILED' as const },
      });

      expect(updatedRound.status).toBe('FAILED');
      expect(updatedRound.startedAt).toBeNull();
      expect(updatedRound.completedAt).toBeNull();
    });
  });

  describe('Complete Workflow Transitions', () => {
    it('should support full PENDING -> IN_PROGRESS -> COMPLETED workflow', async () => {
      const testRound = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: testDebate.id },
          },
          roundNumber: 1000,
          status: 'PENDING' as const,
        },
      });

      // 初始状态
      expect(testRound.status).toBe('PENDING');
      expect(testRound.startedAt).toBeNull();
      expect(testRound.completedAt).toBeNull();

      // 转换到进行中
      const startedAt = new Date();
      const inProgressRound = await testPrisma.debateRound.update({
        where: { id: testRound.id },
        data: {
          status: 'IN_PROGRESS' as const,
          startedAt,
        },
      });

      expect(inProgressRound.status).toBe('IN_PROGRESS');
      expect(inProgressRound.startedAt).toEqual(startedAt);
      expect(inProgressRound.completedAt).toBeNull();

      // 转换到完成
      const completedAt = new Date();
      const completedRound = await testPrisma.debateRound.update({
        where: { id: testRound.id },
        data: {
          status: 'COMPLETED' as const,
          completedAt,
        },
      });

      expect(completedRound.status).toBe('COMPLETED');
      expect(completedRound.startedAt).toEqual(startedAt);
      expect(completedRound.completedAt).toEqual(completedAt);
    });

    it('should support PENDING -> FAILED workflow', async () => {
      const testRound = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: testDebate.id },
          },
          roundNumber: 2000,
          status: 'PENDING' as const,
        },
      });

      const failedRound = await testPrisma.debateRound.update({
        where: { id: testRound.id },
        data: {
          status: 'FAILED' as const,
        },
      });

      expect(failedRound.status).toBe('FAILED');
      expect(failedRound.startedAt).toBeNull();
      expect(failedRound.completedAt).toBeNull();
    });

    it('should support IN_PROGRESS -> FAILED workflow', async () => {
      const testRound = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: testDebate.id },
          },
          roundNumber: 3000,
          status: 'PENDING' as const,
        },
      });

      // 先设置为进行中
      const startedAt = new Date();
      await testPrisma.debateRound.update({
        where: { id: testRound.id },
        data: {
          status: 'IN_PROGRESS' as const,
          startedAt,
        },
      });

      // 然后设置为失败
      const failedRound = await testPrisma.debateRound.update({
        where: { id: testRound.id },
        data: {
          status: 'FAILED' as const,
        },
      });

      expect(failedRound.status).toBe('FAILED');
      expect(failedRound.startedAt).toEqual(startedAt);
      expect(failedRound.completedAt).toBeNull();
    });
  });
});
