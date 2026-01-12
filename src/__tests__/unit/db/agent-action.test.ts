/**
 * AgentAction模型测试
 * 测试行动空间管理（核心层、实用程序层、脚本层）
 */

import {
  PrismaClient,
  ActionType,
  ActionLayer,
  ActionStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

describe('AgentAction模型', () => {
  let testUserId: string;
  let testCaseId: string;
  let testDebateId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-action@example.com',
        username: 'test_action',
        role: 'USER',
      },
    });
    testUserId = user.id;

    const testCase = await prisma.case.create({
      data: {
        userId: testUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: 'DRAFT',
      },
    });
    testCaseId = testCase.id;

    const testDebate = await prisma.debate.create({
      data: {
        caseId: testCaseId,
        userId: testUserId,
        title: '测试辩论',
        status: 'DRAFT',
      },
    });
    testDebateId = testDebate.id;
  });

  afterAll(async () => {
    await prisma.agentAction.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.debate.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.case.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { email: 'test-action@example.com' },
    });
    await prisma.$disconnect();
  });

  describe('创建Agent行动', () => {
    it('应成功创建核心层行动', async () => {
      const action = await prisma.agentAction.create({
        data: {
          userId: testUserId,
          caseId: testCaseId,
          debateId: testDebateId,
          agentName: 'AnalysisAgent',
          actionType: ActionType.ANALYZE,
          actionName: 'analyze_document',
          actionLayer: ActionLayer.CORE,
          parameters: {
            documentId: 'doc123',
            analysisType: 'comprehensive',
          },
        },
      });

      expect(action).toBeDefined();
      expect(action.actionLayer).toBe(ActionLayer.CORE);
      expect(action.actionType).toBe(ActionType.ANALYZE);
      expect(action.status).toBe(ActionStatus.PENDING);
    });

    it('应成功创建实用程序层行动', async () => {
      const action = await prisma.agentAction.create({
        data: {
          userId: testUserId,
          caseId: testCaseId,
          agentName: 'UtilityAgent',
          actionType: ActionType.RETRIEVE,
          actionName: 'search_legal_references',
          actionLayer: ActionLayer.UTILITY,
          parameters: {
            query: '合同纠纷',
            limit: 10,
          },
        },
      });

      expect(action).toBeDefined();
      expect(action.actionLayer).toBe(ActionLayer.UTILITY);
      expect(action.actionType).toBe(ActionType.RETRIEVE);
    });

    it('应成功创建脚本层行动', async () => {
      const action = await prisma.agentAction.create({
        data: {
          userId: testUserId,
          agentName: 'ScriptAgent',
          actionType: ActionType.GENERATE,
          actionName: 'generate_debate_strategy',
          actionLayer: ActionLayer.SCRIPT,
          parameters: {
            caseContext: { type: 'contract_dispute' },
            strategyType: 'aggressive',
          },
        },
      });

      expect(action).toBeDefined();
      expect(action.actionLayer).toBe(ActionLayer.SCRIPT);
      expect(action.actionType).toBe(ActionType.GENERATE);
    });

    it('应创建带子行动的行动', async () => {
      const parentAction = await prisma.agentAction.create({
        data: {
          userId: testUserId,
          agentName: 'OrchestratorAgent',
          actionType: ActionType.TRANSFORM,
          actionName: 'orchestrate_analysis',
          actionLayer: ActionLayer.SCRIPT,
          parameters: { workflow: 'analysis_pipeline' },
        },
      });

      const childAction1 = await prisma.agentAction.create({
        data: {
          userId: testUserId,
          caseId: testCaseId,
          agentName: 'AnalysisAgent',
          actionType: ActionType.ANALYZE,
          actionName: 'extract_facts',
          actionLayer: ActionLayer.CORE,
          parameters: {},
          parentActionId: parentAction.id,
        },
      });

      const childAction2 = await prisma.agentAction.create({
        data: {
          userId: testUserId,
          caseId: testCaseId,
          agentName: 'AnalysisAgent',
          actionType: ActionType.ANALYZE,
          actionName: 'extract_claims',
          actionLayer: ActionLayer.CORE,
          parameters: {},
          parentActionId: parentAction.id,
        },
      });

      const updatedParent = await prisma.agentAction.update({
        where: { id: parentAction.id },
        data: {
          childActions: [childAction1.id, childAction2.id],
        },
      });

      expect(updatedParent.childActions).toHaveLength(2);
      expect(childAction1.parentActionId).toBe(parentAction.id);
    });
  });

  describe('Agent行动查询', () => {
    it('应按行动类型查询', async () => {
      const analyzeActions = await prisma.agentAction.findMany({
        where: {
          actionType: ActionType.ANALYZE,
        },
      });

      expect(analyzeActions.length).toBeGreaterThan(0);
      expect(
        analyzeActions.every(a => a.actionType === ActionType.ANALYZE)
      ).toBe(true);
    });

    it('应按行动层查询', async () => {
      const coreActions = await prisma.agentAction.findMany({
        where: {
          actionLayer: ActionLayer.CORE,
        },
      });

      expect(coreActions.length).toBeGreaterThan(0);
    });

    it('应按状态查询', async () => {
      const pendingActions = await prisma.agentAction.findMany({
        where: {
          status: ActionStatus.PENDING,
        },
      });

      expect(pendingActions.length).toBeGreaterThan(0);
    });

    it('应按Agent名称查询', async () => {
      const agentActions = await prisma.agentAction.findMany({
        where: {
          agentName: 'AnalysisAgent',
        },
      });

      expect(agentActions.length).toBeGreaterThan(0);
    });

    it('应查询父行动的子行动', async () => {
      const parentAction = await prisma.agentAction.findFirst({
        where: {
          childActions: { isEmpty: false },
        },
      });

      expect(parentAction).toBeDefined();
      expect(parentAction?.childActions.length).toBeGreaterThan(0);
    });
  });

  describe('Agent行动更新', () => {
    it('应更新行动状态', async () => {
      const action = await prisma.agentAction.create({
        data: {
          userId: testUserId,
          agentName: 'UpdateAgent',
          actionType: ActionType.VERIFY,
          actionName: 'verify_result',
          actionLayer: ActionLayer.UTILITY,
          parameters: { test: true },
          status: ActionStatus.PENDING,
        },
      });

      const updated = await prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: ActionStatus.RUNNING,
        },
      });

      expect(updated.status).toBe(ActionStatus.RUNNING);
    });

    it('应更新行动结果', async () => {
      const action = await prisma.agentAction.create({
        data: {
          userId: testUserId,
          agentName: 'ResultAgent',
          actionType: ActionType.COMMUNICATE,
          actionName: 'send_message',
          actionLayer: ActionLayer.UTILITY,
          parameters: { message: 'test' },
          status: ActionStatus.RUNNING,
        },
      });

      const updated = await prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: ActionStatus.COMPLETED,
          result: { success: true, messageId: 'msg123' },
          executionTime: 1500,
        },
      });

      expect(updated.status).toBe(ActionStatus.COMPLETED);
      expect(updated.result).toEqual({ success: true, messageId: 'msg123' });
      expect(updated.executionTime).toBe(1500);
    });

    it('应更新失败状态', async () => {
      const action = await prisma.agentAction.create({
        data: {
          userId: testUserId,
          agentName: 'FailAgent',
          actionType: ActionType.GENERATE,
          actionName: 'generate_with_error',
          actionLayer: ActionLayer.SCRIPT,
          parameters: { shouldFail: true },
          status: ActionStatus.RUNNING,
        },
      });

      const updated = await prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: ActionStatus.FAILED,
          result: { error: 'Failed to generate' },
          retryCount: 1,
        },
      });

      expect(updated.status).toBe(ActionStatus.FAILED);
      expect(updated.retryCount).toBe(1);
    });
  });

  describe('Agent行动删除', () => {
    it('应删除行动', async () => {
      const action = await prisma.agentAction.create({
        data: {
          userId: testUserId,
          agentName: 'DeleteAgent',
          actionType: ActionType.ANALYZE,
          actionName: 'delete_test',
          actionLayer: ActionLayer.CORE,
          parameters: {},
        },
      });

      await prisma.agentAction.delete({
        where: { id: action.id },
      });

      const deleted = await prisma.agentAction.findUnique({
        where: { id: action.id },
      });

      expect(deleted).toBeNull();
    });
  });

  describe('Agent行动统计', () => {
    it('应按行动类型统计', async () => {
      const analyzeCount = await prisma.agentAction.count({
        where: { actionType: ActionType.ANALYZE },
      });
      const retrieveCount = await prisma.agentAction.count({
        where: { actionType: ActionType.RETRIEVE },
      });
      const generateCount = await prisma.agentAction.count({
        where: { actionType: ActionType.GENERATE },
      });

      expect(analyzeCount + retrieveCount + generateCount).toBeGreaterThan(0);
    });

    it('应计算成功率', async () => {
      const allActions = await prisma.agentAction.findMany({
        where: { userId: testUserId },
      });
      const completedActions = allActions.filter(
        a => a.status === ActionStatus.COMPLETED
      );
      const successRate =
        allActions.length > 0 ? completedActions.length / allActions.length : 0;

      expect(successRate).toBeGreaterThanOrEqual(0);
      expect(successRate).toBeLessThanOrEqual(1);
    });

    it('应计算平均执行时间', async () => {
      const completedActions = await prisma.agentAction.findMany({
        where: {
          userId: testUserId,
          status: ActionStatus.COMPLETED,
          executionTime: { not: null },
        },
      });

      const avgTime =
        completedActions.length > 0
          ? completedActions.reduce(
              (sum, a) => sum + (a.executionTime || 0),
              0
            ) / completedActions.length
          : 0;

      expect(avgTime).toBeGreaterThanOrEqual(0);
    });
  });
});
