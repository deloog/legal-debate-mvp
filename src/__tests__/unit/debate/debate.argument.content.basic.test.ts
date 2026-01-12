import { testPrisma } from '../../../test-utils/database';
import {
  setupTestDatabase,
  cleanupTestDatabase,
} from '../../../test-utils/database';

describe('Argument Content Basic Handling', () => {
  let testUser: any;
  let testCase: any;
  let testDebate: any;
  let testRound: any;

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: 'test-argument-basic@example.com',
        name: '测试用户',
        role: 'USER',
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: '论点基础内容测试案件',
        description: '这是一个用于测试论点基础内容处理的案件',
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
        title: '论点基础内容测试辩论',
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

  describe('Content Length Handling', () => {
    it('should handle short content properly', async () => {
      const shortContent = '短论点';

      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'PLAINTIFF' as const,
          content: shortContent,
        },
      });

      expect(argument.content).toBe(shortContent);
      expect(argument.content.length).toBe(3);
    });

    it('should handle medium length content properly', async () => {
      const mediumContent =
        '这是一个中等长度的论点内容，包含多个句子和详细描述。';

      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'DEFENDANT' as const,
          content: mediumContent,
        },
      });

      expect(argument.content).toBe(mediumContent);
      expect(argument.content.length).toBeGreaterThan(20);
    });

    it('should handle long content properly', async () => {
      const longContent = '这是一个非常长的论点内容。'.repeat(100);

      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'PLAINTIFF' as const,
          content: longContent,
        },
      });

      expect(argument.content).toBe(longContent);
      expect(argument.content.length).toBeGreaterThan(1000);
    });
  });

  describe('Special Content Handling', () => {
    it('should handle special characters in content', async () => {
      const specialContent =
        '论点包含特殊字符：@#$%^&*()_+-={}[]|\\:";\'<>?,./';

      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'DEFENDANT' as const,
          content: specialContent,
        },
      });

      expect(argument.content).toBe(specialContent);
    });

    it('should handle Unicode characters in content', async () => {
      const unicodeContent = '论点包含Unicode字符：🏛️⚖️📜💼🔍📊';

      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'NEUTRAL' as const,
          content: unicodeContent,
        },
      });

      expect(argument.content).toBe(unicodeContent);
    });

    it('should handle multiline content properly', async () => {
      const multilineContent = `这是第一行论点。
这是第二行论点。
这是第三行论点。`;

      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'PLAINTIFF' as const,
          content: multilineContent,
        },
      });

      expect(argument.content).toBe(multilineContent);
      expect(argument.content).toContain('\n');
    });
  });

  describe('Content Validation', () => {
    it('should reject empty content', async () => {
      await expect(
        testPrisma.argument.create({
          data: {
            round: {
              connect: { id: testRound.id },
            },
            side: 'PLAINTIFF' as const,
            content: '',
          },
        })
      ).rejects.toThrow();
    });

    it('should reject whitespace-only content', async () => {
      await expect(
        testPrisma.argument.create({
          data: {
            round: {
              connect: { id: testRound.id },
            },
            side: 'PLAINTIFF' as const,
            content: '   \t\n   ',
          },
        })
      ).rejects.toThrow();
    });
  });
});
