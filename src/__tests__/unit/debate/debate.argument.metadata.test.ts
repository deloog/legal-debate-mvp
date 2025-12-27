import { testPrisma } from '../../../test-utils/database';
import { setupTestDatabase, cleanupTestDatabase } from '../../../test-utils/database';

describe('Argument AI Metadata Handling', () => {
  let testUser: any;
  let testCase: any;
  let testDebate: any;
  let testRound: any;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: 'test-argument-metadata@example.com',
        name: '测试用户',
        role: 'USER',
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: '论点元数据测试案件',
        description: '这是一个用于测试论点AI元数据的案件',
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
        title: '论点元数据测试辩论',
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

  describe('AI Provider Storage', () => {
    it('should store AI provider correctly', async () => {
      const providers = ['deepseek', 'zhipu', 'openai', 'claude', 'custom-model'];
      
      for (const provider of providers) {
        const argument = await testPrisma.argument.create({
          data: {
            round: {
              connect: { id: testRound.id }
            },
            side: 'PLAINTIFF' as const,
            content: `使用${provider}生成的论点`,
            aiProvider: provider,
          },
        });

        expect(argument.aiProvider).toBe(provider);
      }
    });
  });

  describe('Generation Time Storage', () => {
    it('should store generation time correctly', async () => {
      const generationTimes = [500, 1000, 1500, 2000, 5000];
      
      for (const time of generationTimes) {
        const argument = await testPrisma.argument.create({
          data: {
            round: {
              connect: { id: testRound.id }
            },
            side: 'DEFENDANT' as const,
            content: `生成时间${time}ms的论点`,
            generationTime: time,
          },
        });

        expect(argument.generationTime).toBe(time);
      }
    });
  });

  describe('Confidence Score Storage', () => {
    it('should store confidence score correctly', async () => {
      const confidenceScores = [0.1, 0.5, 0.8, 0.95, 1.0];
      
      for (const confidence of confidenceScores) {
        const argument = await testPrisma.argument.create({
          data: {
            round: {
              connect: { id: testRound.id }
            },
            side: 'NEUTRAL' as const,
            content: `置信度${confidence}的论点`,
            confidence,
          },
        });

        expect(argument.confidence).toBe(confidence);
      }
    });
  });

  describe('Complete AI Metadata', () => {
    it('should handle complete AI metadata', async () => {
      const aiMetadata = {
        aiProvider: 'advanced-ai-model',
        generationTime: 3456,
        confidence: 0.8765,
      };

      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id }
          },
          side: 'PLAINTIFF' as const,
          content: '具有完整AI元数据的论点',
          ...aiMetadata,
        },
      });

      expect(argument.aiProvider).toBe(aiMetadata.aiProvider);
      expect(argument.generationTime).toBe(aiMetadata.generationTime);
      expect(argument.confidence).toBe(aiMetadata.confidence);
    });
  });

  describe('Null AI Metadata', () => {
    it('should allow null AI metadata', async () => {
      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id }
          },
          side: 'DEFENDANT' as const,
          content: '没有AI元数据的论点',
        },
      });

      expect(argument.aiProvider).toBeNull();
      expect(argument.generationTime).toBeNull();
      expect(argument.confidence).toBeNull();
    });
  });

  describe('Partial AI Metadata', () => {
    it('should allow partial AI metadata', async () => {
      // 只有provider
      const arg1 = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id }
          },
          side: 'NEUTRAL' as const,
          content: '只有provider的论点',
          aiProvider: 'partial-model',
        },
      });
      expect(arg1.aiProvider).toBe('partial-model');
      expect(arg1.generationTime).toBeNull();
      expect(arg1.confidence).toBeNull();

      // 只有generationTime
      const arg2 = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id }
          },
          side: 'PLAINTIFF' as const,
          content: '只有generationTime的论点',
          generationTime: 2000,
        },
      });
      expect(arg2.aiProvider).toBeNull();
      expect(arg2.generationTime).toBe(2000);
      expect(arg2.confidence).toBeNull();

      // 只有confidence
      const arg3 = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id }
          },
          side: 'DEFENDANT' as const,
          content: '只有confidence的论点',
          confidence: 0.75,
        },
      });
      expect(arg3.aiProvider).toBeNull();
      expect(arg3.generationTime).toBeNull();
      expect(arg3.confidence).toBe(0.75);
    });
  });
});
