import { testPrisma } from '../../../test-utils/database';
import { setupTestDatabase, cleanupTestDatabase } from '../../../test-utils/database';

describe('Argument Types and Sides', () => {
  let testUser: any;
  let testCase: any;
  let testDebate: any;
  let testRound: any;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: 'test-argument-types@example.com',
        name: '测试用户',
        role: 'USER',
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: '论点类型测试案件',
        description: '这是一个用于测试论点类型和归属的案件',
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
        title: '论点类型测试辩论',
        status: 'IN_PROGRESS' as const,
        currentRound: 1,
      },
    });

    // 创建测试轮次
    testRound = await testPrisma.debateRound.create({
      data: {
        debate: {
          connect: { id: testDebate.id }
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

  describe('Argument Sides', () => {
    it('should support all argument sides', async () => {
      const sides = ['PLAINTIFF', 'DEFENDANT', 'NEUTRAL'] as const;
      const createdArguments = [];

      for (const side of sides) {
        const argument = await testPrisma.argument.create({
          data: {
            round: {
              connect: { id: testRound.id }
            },
            side,
            content: `测试${side}方论点`,
          },
        });
        createdArguments.push(argument);
      }

      createdArguments.forEach((argument, index) => {
        expect(argument.side).toBe(sides[index]);
      });
    });

    it('should filter arguments by side correctly', async () => {
      // 创建不同方的论点
      await testPrisma.argument.createMany({
        data: [
          {
            roundId: testRound.id,
            side: 'PLAINTIFF',
            content: '原告论点1',
            type: 'MAIN_POINT',
          },
          {
            roundId: testRound.id,
            side: 'PLAINTIFF',
            content: '原告论点2',
            type: 'SUPPORTING',
          },
          {
            roundId: testRound.id,
            side: 'DEFENDANT',
            content: '被告论点1',
            type: 'MAIN_POINT',
          },
          {
            roundId: testRound.id,
            side: 'NEUTRAL',
            content: '中立论点1',
            type: 'LEGAL_BASIS',
          },
        ],
      });

      // 测试按方过滤
      const plaintiffArguments = await testPrisma.argument.findMany({
        where: { side: 'PLAINTIFF' },
      });

      const defendantArguments = await testPrisma.argument.findMany({
        where: { side: 'DEFENDANT' },
      });

      const neutralArguments = await testPrisma.argument.findMany({
        where: { side: 'NEUTRAL' },
      });

      expect(plaintiffArguments.length).toBeGreaterThanOrEqual(2);
      expect(defendantArguments.length).toBeGreaterThanOrEqual(1);
      expect(neutralArguments.length).toBeGreaterThanOrEqual(1);

      // 验证过滤结果的正确性
      plaintiffArguments.forEach(arg => expect(arg.side).toBe('PLAINTIFF'));
      defendantArguments.forEach(arg => expect(arg.side).toBe('DEFENDANT'));
      neutralArguments.forEach(arg => expect(arg.side).toBe('NEUTRAL'));
    });
  });

  describe('Argument Types', () => {
    it('should support all argument types', async () => {
      const types = [
        'MAIN_POINT',
        'SUPPORTING',
        'REBUTTAL',
        'EVIDENCE',
        'LEGAL_BASIS',
        'CONCLUSION'
      ] as const;
      const createdArguments = [];

      for (const type of types) {
        const argument = await testPrisma.argument.create({
          data: {
            round: {
              connect: { id: testRound.id }
            },
            side: 'PLAINTIFF' as const,
            content: `测试${type}类型`,
            type,
          },
        });
        createdArguments.push(argument);
      }

      createdArguments.forEach((argument, index) => {
        expect(argument.type).toBe(types[index]);
      });
    });

    it('should create arguments with different types successfully', async () => {
      const types = ['SUPPORTING', 'REBUTTAL', 'EVIDENCE', 'CONCLUSION'] as const;
      
      for (const type of types) {
        const argumentData = {
          round: {
            connect: { id: testRound.id }
          },
          side: 'PLAINTIFF' as const,
          content: `测试${type}类型论点`,
          type,
        };

        const argument = await testPrisma.argument.create({
          data: argumentData,
        });

        expect(argument.type).toBe(type);
      }
    });

    it('should filter arguments by type correctly', async () => {
      // 创建不同类型的论点
      await testPrisma.argument.createMany({
        data: [
          {
            roundId: testRound.id,
            side: 'PLAINTIFF',
            content: '主要论点',
            type: 'MAIN_POINT',
          },
          {
            roundId: testRound.id,
            side: 'PLAINTIFF',
            content: '支持论点',
            type: 'SUPPORTING',
          },
          {
            roundId: testRound.id,
            side: 'DEFENDANT',
            content: '反驳论点',
            type: 'REBUTTAL',
          },
          {
            roundId: testRound.id,
            side: 'NEUTRAL',
            content: '证据论点',
            type: 'EVIDENCE',
          },
          {
            roundId: testRound.id,
            side: 'NEUTRAL',
            content: '法律依据',
            type: 'LEGAL_BASIS',
          },
          {
            roundId: testRound.id,
            side: 'PLAINTIFF',
            content: '结论论点',
            type: 'CONCLUSION',
          },
        ],
      });

      // 测试按类型过滤
      const mainPointArgs = await testPrisma.argument.findMany({
        where: { type: 'MAIN_POINT' },
      });

      const supportingArgs = await testPrisma.argument.findMany({
        where: { type: 'SUPPORTING' },
      });

      const rebuttalArgs = await testPrisma.argument.findMany({
        where: { type: 'REBUTTAL' },
      });

      const evidenceArgs = await testPrisma.argument.findMany({
        where: { type: 'EVIDENCE' },
      });

      const legalBasisArgs = await testPrisma.argument.findMany({
        where: { type: 'LEGAL_BASIS' },
      });

      const conclusionArgs = await testPrisma.argument.findMany({
        where: { type: 'CONCLUSION' },
      });

      expect(mainPointArgs.length).toBeGreaterThanOrEqual(1);
      expect(supportingArgs.length).toBeGreaterThanOrEqual(1);
      expect(rebuttalArgs.length).toBeGreaterThanOrEqual(1);
      expect(evidenceArgs.length).toBeGreaterThanOrEqual(1);
      expect(legalBasisArgs.length).toBeGreaterThanOrEqual(1);
      expect(conclusionArgs.length).toBeGreaterThanOrEqual(1);

      // 验证过滤结果的正确性
      mainPointArgs.forEach(arg => expect(arg.type).toBe('MAIN_POINT'));
      supportingArgs.forEach(arg => expect(arg.type).toBe('SUPPORTING'));
      rebuttalArgs.forEach(arg => expect(arg.type).toBe('REBUTTAL'));
      evidenceArgs.forEach(arg => expect(arg.type).toBe('EVIDENCE'));
      legalBasisArgs.forEach(arg => expect(arg.type).toBe('LEGAL_BASIS'));
      conclusionArgs.forEach(arg => expect(arg.type).toBe('CONCLUSION'));
    });
  });

  describe('Type and Side Combinations', () => {
    it('should support valid type and side combinations', async () => {
      const combinations = [
        { side: 'PLAINTIFF' as const, type: 'MAIN_POINT' as const },
        { side: 'PLAINTIFF' as const, type: 'SUPPORTING' as const },
        { side: 'PLAINTIFF' as const, type: 'CONCLUSION' as const },
        { side: 'DEFENDANT' as const, type: 'MAIN_POINT' as const },
        { side: 'DEFENDANT' as const, type: 'REBUTTAL' as const },
        { side: 'DEFENDANT' as const, type: 'CONCLUSION' as const },
        { side: 'NEUTRAL' as const, type: 'LEGAL_BASIS' as const },
        { side: 'NEUTRAL' as const, type: 'EVIDENCE' as const },
      ];

      const createdArguments = [];

      for (const combo of combinations) {
        const argument = await testPrisma.argument.create({
          data: {
            round: {
              connect: { id: testRound.id }
            },
            side: combo.side,
            type: combo.type,
            content: `${combo.side}方的${combo.type}论点`,
          },
        });
        createdArguments.push(argument);
      }

      createdArguments.forEach((argument, index) => {
        const expectedCombo = combinations[index];
        expect(argument.side).toBe(expectedCombo.side);
        expect(argument.type).toBe(expectedCombo.type);
      });
    });
  });
});
