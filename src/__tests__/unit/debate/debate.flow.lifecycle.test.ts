import { testPrisma } from '../../../test-utils/database';
import {
  setupTestDatabase,
  cleanupTestDatabase,
} from '../../../test-utils/database';

describe('Debate Flow Lifecycle', () => {
  let testUser: any;
  let testCase: any;

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: 'test-flow@example.com',
        name: '测试用户',
        role: 'USER',
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: '完整流程测试案件',
        description: '这是一个用于测试完整辩论流程的案件',
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

  describe('Complete Debate Lifecycle', () => {
    it('should handle complete debate flow from start to finish', async () => {
      // 1. 创建辩论
      const debate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id },
          },
          user: {
            connect: { id: testUser.id },
          },
          title: '完整流程辩论',
          status: 'DRAFT' as const,
          currentRound: 0,
          debateConfig: {
            mode: 'adversarial',
            maxRounds: 3,
            aiConfig: {
              plaintiff: {
                provider: 'deepseek',
                model: 'deepseek-chat',
                temperature: 0.7,
              },
              defendant: {
                provider: 'zhipu',
                model: 'glm-4-flash',
                temperature: 0.7,
              },
            },
          },
        },
      });

      expect(debate.status).toBe('DRAFT');
      expect(debate.currentRound).toBe(0);

      // 2. 开始辩论
      const startedDebate = await testPrisma.debate.update({
        where: { id: debate.id },
        data: {
          status: 'IN_PROGRESS' as const,
          currentRound: 1,
        },
      });

      expect(startedDebate.status).toBe('IN_PROGRESS');
      expect(startedDebate.currentRound).toBe(1);

      // 3. 创建第一轮
      const round1 = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: debate.id },
          },
          roundNumber: 1,
          status: 'IN_PROGRESS' as const,
          startedAt: new Date(),
        },
      });

      // 4. 创建第一轮论点
      const __plaintiffArg1 = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round1.id },
          },
          side: 'PLAINTIFF' as const,
          content: '根据合同第5条，被告应在收到货物后30日内支付货款。',
          type: 'MAIN_POINT' as const,
          aiProvider: 'deepseek',
          generationTime: 1500,
          confidence: 0.88,
        },
      });

      const __defendantArg1 = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round1.id },
          },
          side: 'DEFENDANT' as const,
          content: '由于货物存在质量问题，我方有权拒绝支付货款。',
          type: 'MAIN_POINT' as const,
          aiProvider: 'zhipu',
          generationTime: 1200,
          confidence: 0.82,
        },
      });

      const __legalBasis1 = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round1.id },
          },
          side: 'NEUTRAL' as const,
          content:
            '根据《合同法》第107条，当事人一方不履行合同义务的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
          type: 'LEGAL_BASIS' as const,
        },
      });

      // 5. 完成第一轮
      await testPrisma.debateRound.update({
        where: { id: round1.id },
        data: {
          status: 'COMPLETED' as const,
          completedAt: new Date(),
        },
      });

      // 6. 更新辩论状态到第二轮
      await testPrisma.debate.update({
        where: { id: debate.id },
        data: { currentRound: 2 },
      });

      // 7. 创建第二轮
      const round2 = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: debate.id },
          },
          roundNumber: 2,
          status: 'IN_PROGRESS' as const,
          startedAt: new Date(),
        },
      });

      // 8. 创建第二轮论点（反驳和支持）
      const __plaintiffRebuttal = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round2.id },
          },
          side: 'PLAINTIFF' as const,
          content:
            '被告所称的质量问题没有第三方检测报告支持，且在收货时已签字确认货物完好。',
          type: 'REBUTTAL' as const,
          aiProvider: 'deepseek',
          generationTime: 1800,
          confidence: 0.91,
        },
      });

      const __defendantSupporting = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round2.id },
          },
          side: 'DEFENDANT' as const,
          content:
            '附照片证据显示货物存在明显瑕疵，收货单上的签字仅确认收到货物，不表示确认质量。',
          type: 'SUPPORTING' as const,
          aiProvider: 'zhipu',
          generationTime: 1600,
          confidence: 0.85,
        },
      });

      // 9. 完成第二轮
      await testPrisma.debateRound.update({
        where: { id: round2.id },
        data: {
          status: 'COMPLETED' as const,
          completedAt: new Date(),
        },
      });

      // 10. 创建第三轮（结论轮）
      await testPrisma.debate.update({
        where: { id: debate.id },
        data: { currentRound: 3 },
      });

      const round3 = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: debate.id },
          },
          roundNumber: 3,
          status: 'IN_PROGRESS' as const,
          startedAt: new Date(),
        },
      });

      const __plaintiffConclusion = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round3.id },
          },
          side: 'PLAINTIFF' as const,
          content:
            '综上所述，被告未按合同约定支付货款构成违约，应立即支付货款并承担违约责任。',
          type: 'CONCLUSION' as const,
          aiProvider: 'deepseek',
          generationTime: 2000,
          confidence: 0.93,
        },
      });

      const __defendantConclusion = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round3.id },
          },
          side: 'DEFENDANT' as const,
          content:
            '鉴于货物存在质量问题，原告要求支付货款缺乏事实和法律依据，请求驳回原告诉讼请求。',
          type: 'CONCLUSION' as const,
          aiProvider: 'zhipu',
          generationTime: 1900,
          confidence: 0.87,
        },
      });

      // 11. 完成第三轮并结束辩论
      await testPrisma.debateRound.update({
        where: { id: round3.id },
        data: {
          status: 'COMPLETED' as const,
          completedAt: new Date(),
        },
      });

      // 12. 完成辩论
      const completedDebate = await testPrisma.debate.update({
        where: { id: debate.id },
        data: {
          status: 'COMPLETED' as const,
        },
      });

      expect(completedDebate.status).toBe('COMPLETED');
      expect(completedDebate.currentRound).toBe(3);

      // 13. 验证完整流程数据
      const finalDebate = await testPrisma.debate.findUnique({
        where: { id: debate.id },
        include: {
          rounds: {
            include: {
              arguments: true,
            },
            orderBy: { roundNumber: 'asc' },
          },
        },
      });

      expect(finalDebate).not.toBeNull();
      expect(finalDebate?.rounds).toHaveLength(3);

      // 验证每轮的论点数量
      const round1Args = finalDebate?.rounds[0]?.arguments || [];
      const round2Args = finalDebate?.rounds[1]?.arguments || [];
      const round3Args = finalDebate?.rounds[2]?.arguments || [];

      expect(round1Args.length).toBeGreaterThanOrEqual(3); // 原告、被告、法律依据
      expect(round2Args.length).toBeGreaterThanOrEqual(2); // 反驳和支持
      expect(round3Args.length).toBeGreaterThanOrEqual(2); // 结论

      // 验证论点类型分布
      const mainPoints = round1Args.filter(
        (arg: any) => arg.type === 'MAIN_POINT'
      );
      const rebuttals = round2Args.filter(
        (arg: any) => arg.type === 'REBUTTAL'
      );
      const supporting = round2Args.filter(
        (arg: any) => arg.type === 'SUPPORTING'
      );
      const conclusions = round3Args.filter(
        (arg: any) => arg.type === 'CONCLUSION'
      );
      const legalBasis = round1Args.filter(
        (arg: any) => arg.type === 'LEGAL_BASIS'
      );

      expect(mainPoints.length).toBeGreaterThanOrEqual(2);
      expect(rebuttals.length).toBeGreaterThanOrEqual(1);
      expect(supporting.length).toBeGreaterThanOrEqual(1);
      expect(conclusions.length).toBeGreaterThanOrEqual(2);
      expect(legalBasis.length).toBeGreaterThanOrEqual(1);
    });
  });
});
