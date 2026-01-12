import { testPrisma } from '../../../test-utils/database';
import {
  setupTestDatabase,
  cleanupTestDatabase,
} from '../../../test-utils/database';

describe('Argument Content Update and Versioning', () => {
  let testUser: any;
  let testCase: any;
  let testDebate: any;
  let testRound: any;

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: 'test-argument-update@example.com',
        name: '测试用户',
        role: 'USER',
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: '论点更新测试案件',
        description: '这是一个用于测试论点更新和版本控制的案件',
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
        title: '论点更新测试辩论',
        status: 'IN_PROGRESS' as const,
        currentRound: 1,
      },
    });

    // 创建测试轮次
    testRound = await testPrisma.debateRound.create({
      data: {
        debate: {
          connect: { id: testDebate.id },
        },
        roundNumber: 1,
        status: 'IN_PROGRESS' as const,
        startedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Content Update', () => {
    let testArgument: any;

    beforeEach(async () => {
      testArgument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'PLAINTIFF' as const,
          content: '原始论点内容',
          aiProvider: 'original-ai',
          generationTime: 1000,
          confidence: 0.8,
        },
      });
    });

    it('should update content while preserving metadata', async () => {
      const updatedArgument = await testPrisma.argument.update({
        where: { id: testArgument.id },
        data: { content: '更新后的论点内容' },
      });

      expect(updatedArgument.content).toBe('更新后的论点内容');
      expect(updatedArgument.aiProvider).toBe('original-ai'); // 保持不变
      expect(updatedArgument.generationTime).toBe(1000); // 保持不变
      expect(updatedArgument.confidence).toBe(0.8); // 保持不变
      expect(updatedArgument.updatedAt.getTime()).toBeGreaterThan(
        testArgument.updatedAt.getTime()
      );
    });

    it('should update AI metadata', async () => {
      const newMetadata = {
        aiProvider: 'updated-ai',
        generationTime: 2500,
        confidence: 0.9,
      };

      const updatedArgument = await testPrisma.argument.update({
        where: { id: testArgument.id },
        data: newMetadata,
      });

      expect(updatedArgument.aiProvider).toBe(newMetadata.aiProvider);
      expect(updatedArgument.generationTime).toBe(newMetadata.generationTime);
      expect(updatedArgument.confidence).toBe(newMetadata.confidence);
      expect(updatedArgument.content).toBe('原始论点内容'); // 保持不变
    });

    it('should update content and metadata simultaneously', async () => {
      const updateData = {
        content: '完全更新的论点内容',
        aiProvider: 'completely-new-ai',
        generationTime: 3000,
        confidence: 0.95,
      };

      const updatedArgument = await testPrisma.argument.update({
        where: { id: testArgument.id },
        data: updateData,
      });

      expect(updatedArgument.content).toBe(updateData.content);
      expect(updatedArgument.aiProvider).toBe(updateData.aiProvider);
      expect(updatedArgument.generationTime).toBe(updateData.generationTime);
      expect(updatedArgument.confidence).toBe(updateData.confidence);
    });
  });

  describe('Timestamp Updates', () => {
    it('should update updatedAt timestamp on content change', async () => {
      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'DEFENDANT' as const,
          content: '原始内容',
        },
      });

      const originalUpdatedAt = argument.updatedAt;

      // 等待一毫秒确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 1));

      const updatedArgument = await testPrisma.argument.update({
        where: { id: argument.id },
        data: { content: '更新内容' },
      });

      expect(updatedArgument.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });

    it('should update updatedAt timestamp on metadata change', async () => {
      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'NEUTRAL' as const,
          content: '测试内容',
        },
      });

      const originalUpdatedAt = argument.updatedAt;

      // 等待一毫秒确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 1));

      const updatedArgument = await testPrisma.argument.update({
        where: { id: argument.id },
        data: { confidence: 0.99 },
      });

      expect(updatedArgument.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });
  });
});
