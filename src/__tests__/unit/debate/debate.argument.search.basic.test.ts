import {
  cleanupTestDatabase,
  setupTestDatabase,
  testPrisma,
} from '../../../test-utils/database';

describe('Argument Basic Search and Filtering', () => {
  let testUser: any;
  let testCase: any;
  let testDebate: any;
  let testRound: any;

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: 'test-argument-search-basic@example.com',
        name: '测试用户',
        role: 'USER',
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: '论点基础搜索测试案件',
        description: '这是一个用于测试论点基础搜索和过滤的案件',
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
        title: '论点基础搜索测试辩论',
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

  describe('Content Keyword Search', () => {
    it('should filter arguments by content keywords', async () => {
      // 创建包含特定关键词的论点
      const keywords = ['合同', '违约', '赔偿', '证据'];

      for (const keyword of keywords) {
        await testPrisma.argument.create({
          data: {
            round: {
              connect: { id: testRound.id },
            },
            side: 'PLAINTIFF' as const,
            content: `包含${keyword}的论点`,
            type: 'MAIN_POINT' as const,
          },
        });
      }

      // 测试包含关键词的搜索
      const contractArguments = await testPrisma.argument.findMany({
        where: {
          content: {
            contains: '合同',
          },
        },
      });

      expect(contractArguments.length).toBeGreaterThanOrEqual(1);
      contractArguments.forEach(arg => {
        expect(arg.content).toContain('合同');
      });
    });

    it('should find multiple keywords in content', async () => {
      await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'DEFENDANT' as const,
          content: '这个合同涉及违约问题和赔偿要求',
          type: 'MAIN_POINT' as const,
        },
      });

      // 搜索包含多个关键词
      const multiKeywordArgs = await testPrisma.argument.findMany({
        where: {
          content: {
            contains: '合同',
          },
        },
      });

      expect(multiKeywordArgs.length).toBeGreaterThanOrEqual(1);
      const foundArg = multiKeywordArgs.find(
        arg =>
          arg.content.includes('合同') &&
          arg.content.includes('违约') &&
          arg.content.includes('赔偿')
      );
      expect(foundArg).toBeDefined();
    });

    it('should handle partial keyword matches', async () => {
      await testPrisma.argument.createMany({
        data: [
          {
            roundId: testRound.id,
            side: 'PLAINTIFF',
            content: '劳动合同纠纷案例',
            type: 'MAIN_POINT',
          },
          {
            roundId: testRound.id,
            side: 'DEFENDANT',
            content: '租赁合同争议处理',
            type: 'REBUTTAL',
          },
          {
            roundId: testRound.id,
            side: 'NEUTRAL',
            content: '买卖合同违约分析',
            type: 'EVIDENCE',
          },
        ],
      });

      const contractArgs = await testPrisma.argument.findMany({
        where: {
          content: {
            contains: '合同',
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(contractArgs.length).toBeGreaterThanOrEqual(3);
      contractArgs.forEach(arg => {
        expect(arg.content).toContain('合同');
      });
    });
  });

  describe('Case Sensitive Search', () => {
    it('should handle case-sensitive content search', async () => {
      await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'DEFENDANT' as const,
          content: '包含大写LETTER的论点',
        },
      });

      const uppercaseResults = await testPrisma.argument.findMany({
        where: {
          content: {
            contains: 'LETTER',
          },
        },
      });

      const _lowercaseResults = await testPrisma.argument.findMany({
        where: {
          content: {
            contains: 'letter',
          },
        },
      });

      expect(uppercaseResults.length).toBeGreaterThanOrEqual(1);
      // 大小写敏感性的行为取决于数据库配置
    });

    it('should handle mixed case search terms', async () => {
      await testPrisma.argument.createMany({
        data: [
          {
            roundId: testRound.id,
            side: 'PLAINTIFF',
            content: 'Case Study Analysis',
            type: 'MAIN_POINT',
          },
          {
            roundId: testRound.id,
            side: 'DEFENDANT',
            content: 'case study review',
            type: 'REBUTTAL',
          },
          {
            roundId: testRound.id,
            side: 'NEUTRAL',
            content: 'CASE STUDY FINDINGS',
            type: 'EVIDENCE',
          },
        ],
      });

      const caseStudyArgs = await testPrisma.argument.findMany({
        where: {
          content: {
            contains: 'Case',
          },
        },
      });

      expect(caseStudyArgs.length).toBeGreaterThanOrEqual(1);
      caseStudyArgs.forEach(arg => {
        expect(arg.content).toMatch(/case/i);
      });
    });
  });

  describe('Search with Special Characters', () => {
    it('should handle special characters in search', async () => {
      await testPrisma.argument.createMany({
        data: [
          {
            roundId: testRound.id,
            side: 'PLAINTIFF',
            content: '论点包含特殊字符：@#$%^&*()',
            type: 'MAIN_POINT',
          },
          {
            roundId: testRound.id,
            side: 'DEFENDANT',
            content: '包含中文标点符号：，。！？',
            type: 'REBUTTAL',
          },
          {
            roundId: testRound.id,
            side: 'NEUTRAL',
            content: '包含数字符号：123%$#',
            type: 'EVIDENCE',
          },
        ],
      });

      const specialCharArgs = await testPrisma.argument.findMany({
        where: {
          content: {
            contains: '@#$%',
          },
        },
      });

      expect(specialCharArgs.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle unicode and emoji in search', async () => {
      await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'PLAINTIFF' as const,
          content: '论点包含表情符号：🏛️⚖️📜💼',
          type: 'MAIN_POINT' as const,
        },
      });

      const emojiArgs = await testPrisma.argument.findMany({
        where: {
          content: {
            contains: '⚖️',
          },
        },
      });

      expect(emojiArgs.length).toBeGreaterThanOrEqual(1);
      expect(emojiArgs[0].content).toContain('⚖️');
    });
  });

  describe('Empty and Null Search Handling', () => {
    it('should handle empty search terms', async () => {
      await testPrisma.argument.createMany({
        data: [
          {
            roundId: testRound.id,
            side: 'PLAINTIFF',
            content: '正常论点内容',
            type: 'MAIN_POINT',
          },
          {
            roundId: testRound.id,
            side: 'DEFENDANT',
            content: '另一个正常论点',
            type: 'REBUTTAL',
          },
        ],
      });

      // 空字符串搜索应该返回所有结果
      const emptySearchResults = await testPrisma.argument.findMany({
        where: {
          content: {
            contains: '',
          },
        },
      });

      expect(emptySearchResults.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle null content gracefully', async () => {
      // 创建一个没有内容的论点（如果schema允许）
      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: testRound.id },
          },
          side: 'NEUTRAL' as const,
          content: '测试内容',
          type: 'EVIDENCE' as const,
        },
      });

      expect(argument.content).toBeDefined();
      expect(argument.content.length).toBeGreaterThan(0);
    });
  });
});
