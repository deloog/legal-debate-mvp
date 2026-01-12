import { testPrisma } from '../../../test-utils/database';
import {
  setupTestDatabase,
  cleanupTestDatabase,
} from '../../../test-utils/database';

describe('Argument CRUD Operations', () => {
  let testUser: any;
  let testCase: any;
  let testDebate: any;
  let testRound: any;

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: 'test-argument-crud@example.com',
        name: '测试用户',
        role: 'USER',
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: '论点CRUD测试案件',
        description: '这是一个用于测试论点CRUD操作的案件',
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
        title: '论点CRUD测试辩论',
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

  describe('Create Argument', () => {
    it('should create a plaintiff argument successfully', async () => {
      const argumentData = {
        round: {
          connect: { id: testRound.id },
        },
        side: 'PLAINTIFF' as const,
        content: '根据合同约定，被告应在约定时间内支付货款。',
        type: 'MAIN_POINT' as const,
        aiProvider: 'deepseek',
        generationTime: 1500,
        confidence: 0.85,
      };

      const argument = await testPrisma.argument.create({
        data: argumentData,
      });

      expect(argument.id).toBeDefined();
      expect(argument.side).toBe('PLAINTIFF');
      expect(argument.content).toBe(
        '根据合同约定，被告应在约定时间内支付货款。'
      );
      expect(argument.type).toBe('MAIN_POINT');
      expect(argument.roundId).toBe(testRound.id);
      expect(argument.aiProvider).toBe('deepseek');
      expect(argument.generationTime).toBe(1500);
      expect(argument.confidence).toBe(0.85);
      expect(argument.createdAt).toBeInstanceOf(Date);
      expect(argument.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a defendant argument successfully', async () => {
      const argumentData = {
        round: {
          connect: { id: testRound.id },
        },
        side: 'DEFENDANT' as const,
        content: '由于货物质量问题，原告拒绝支付货款是合理的。',
        type: 'MAIN_POINT' as const,
        aiProvider: 'zhipu',
        generationTime: 1200,
        confidence: 0.78,
      };

      const argument = await testPrisma.argument.create({
        data: argumentData,
      });

      expect(argument.side).toBe('DEFENDANT');
      expect(argument.content).toBe(
        '由于货物质量问题，原告拒绝支付货款是合理的。'
      );
      expect(argument.aiProvider).toBe('zhipu');
    });

    it('should create a neutral argument successfully', async () => {
      const argumentData = {
        round: {
          connect: { id: testRound.id },
        },
        side: 'NEUTRAL' as const,
        content: '根据相关法律条文，双方都应履行合同义务。',
        type: 'LEGAL_BASIS' as const,
      };

      const argument = await testPrisma.argument.create({
        data: argumentData,
      });

      expect(argument.side).toBe('NEUTRAL');
      expect(argument.type).toBe('LEGAL_BASIS');
    });

    it('should create argument with minimal required fields', async () => {
      const argumentData = {
        round: {
          connect: { id: testRound.id },
        },
        side: 'PLAINTIFF' as const,
        content: '最简单的论点内容',
      };

      const argument = await testPrisma.argument.create({
        data: argumentData,
      });

      expect(argument.id).toBeDefined();
      expect(argument.content).toBe('最简单的论点内容');
      expect(argument.type).toBe('MAIN_POINT'); // 默认值
      expect(argument.aiProvider).toBeNull(); // 默认值
      expect(argument.generationTime).toBeNull(); // 默认值
      expect(argument.confidence).toBeNull(); // 默认值
    });

    it('should fail when required fields are missing', async () => {
      const invalidData = {
        content: '缺少必要字段的论点',
        // 缺少 roundId 和 side - 真正缺少必需字段
      };

      await expect(
        testPrisma.argument.create({ data: invalidData as any })
      ).rejects.toThrow();
    });
  });

  describe('Read Argument', () => {
    let testArgument: any;

    beforeAll(async () => {
      testArgument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'PLAINTIFF' as const,
          content: '这是一个测试论点',
          type: 'MAIN_POINT' as const,
        },
      });
    });

    it('should retrieve argument by id', async () => {
      const argument = await testPrisma.argument.findUnique({
        where: { id: testArgument.id },
      });

      expect(argument).not.toBeNull();
      expect(argument?.id).toBe(testArgument.id);
      expect(argument?.side).toBe('PLAINTIFF');
      expect(argument?.content).toBe('这是一个测试论点');
    });

    it('should retrieve argument with relations', async () => {
      const argument = await testPrisma.argument.findUnique({
        where: { id: testArgument.id },
        include: {
          round: {
            include: {
              debate: true,
            },
          },
        },
      });

      expect(argument).not.toBeNull();
      expect(argument?.round).toBeDefined();
      expect(argument?.round.debate).toBeDefined();
      expect(argument?.round.debate.id).toBe(testDebate.id);
    });

    it('should filter arguments by round', async () => {
      const argumentList = await testPrisma.argument.findMany({
        where: { roundId: testRound.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(argumentList.length).toBeGreaterThan(0);
      argumentList.forEach(argument => {
        expect(argument.roundId).toBe(testRound.id);
      });
    });

    it('should return null for non-existent argument', async () => {
      const argument = await testPrisma.argument.findUnique({
        where: { id: 'non-existent-id' },
      });

      expect(argument).toBeNull();
    });
  });

  describe('Update Argument', () => {
    let testArgument: any;

    beforeEach(async () => {
      testArgument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'PLAINTIFF' as const,
          content: '原始论点内容',
          type: 'MAIN_POINT' as const,
        },
      });
    });

    it('should update argument content', async () => {
      const updatedArgument = await testPrisma.argument.update({
        where: { id: testArgument.id },
        data: { content: '更新后的论点内容' },
      });

      expect(updatedArgument.content).toBe('更新后的论点内容');
      expect(updatedArgument.updatedAt.getTime()).toBeGreaterThan(
        testArgument.updatedAt.getTime()
      );
    });

    it('should update argument type', async () => {
      const updatedArgument = await testPrisma.argument.update({
        where: { id: testArgument.id },
        data: { type: 'SUPPORTING' as const },
      });

      expect(updatedArgument.type).toBe('SUPPORTING');
    });

    it('should update AI metadata', async () => {
      const aiData = {
        aiProvider: 'deepseek',
        generationTime: 2000,
        confidence: 0.92,
      };

      const updatedArgument = await testPrisma.argument.update({
        where: { id: testArgument.id },
        data: aiData,
      });

      expect(updatedArgument.aiProvider).toBe(aiData.aiProvider);
      expect(updatedArgument.generationTime).toBe(aiData.generationTime);
      expect(updatedArgument.confidence).toBe(aiData.confidence);
    });

    it('should update multiple fields simultaneously', async () => {
      const updateData = {
        content: '完全更新的论点内容',
        type: 'REBUTTAL' as const,
        aiProvider: 'zhipu',
        generationTime: 1800,
        confidence: 0.88,
      };

      const updatedArgument = await testPrisma.argument.update({
        where: { id: testArgument.id },
        data: updateData,
      });

      expect(updatedArgument.content).toBe(updateData.content);
      expect(updatedArgument.type).toBe(updateData.type);
      expect(updatedArgument.aiProvider).toBe(updateData.aiProvider);
      expect(updatedArgument.generationTime).toBe(updateData.generationTime);
      expect(updatedArgument.confidence).toBe(updateData.confidence);
    });
  });

  describe('Delete Argument', () => {
    let testArgument: any;

    beforeEach(async () => {
      testArgument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'PLAINTIFF' as const,
          content: '待删除的论点',
          type: 'MAIN_POINT' as const,
        },
      });
    });

    it('should delete argument permanently', async () => {
      await testPrisma.argument.delete({
        where: { id: testArgument.id },
      });

      const deletedArgument = await testPrisma.argument.findUnique({
        where: { id: testArgument.id },
      });

      expect(deletedArgument).toBeNull();
    });

    it('should handle deletion of non-existent argument', async () => {
      await expect(
        testPrisma.argument.delete({
          where: { id: 'non-existent-id' },
        })
      ).rejects.toThrow();
    });
  });
});
