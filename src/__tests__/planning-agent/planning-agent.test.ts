// PlanningAgent测试

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PlanningAgent } from '../../lib/agent/planning-agent/planning-agent';
import {
  TaskType,
  type PlanningInput,
  PlanningErrorType,
} from '../../lib/agent/planning-agent/types';
import { TaskPriority } from '../../types/agent';

describe('PlanningAgent', () => {
  let agent: PlanningAgent;

  beforeEach(() => {
    agent = new PlanningAgent();
  });

  describe('构造函数', () => {
    it('应该成功创建PlanningAgent实例', () => {
      expect(agent).toBeInstanceOf(PlanningAgent);
      expect(agent).toBeDefined();
    });
  });

  describe('plan方法', () => {
    it('应该成功执行辩论任务规划', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {
          id: 'case-001',
          type: '民事纠纷',
          title: '合同纠纷',
          description: '买卖合同违约案件',
          parties: [
            { name: '张三', role: 'plaintiff' },
            { name: '李四', role: 'defendant' },
          ],
          claims: ['返还货款', '支付违约金'],
          evidenceCount: 5,
        },
        userGoal: '维护客户合法权益',
        constraints: {
          maxTime: 60000,
          maxCost: 1000,
          priorityOverride: TaskPriority.HIGH,
        },
      };

      const result = await agent.plan(input);

      expect(result).toBeDefined();
      expect(result.decomposition).toBeDefined();
      expect(result.planning).toBeDefined();
      expect(result.orchestration).toBeDefined();
      expect(result.allocation).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('应该成功执行文档生成任务规划', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DOCUMENT_GENERATION,
        caseInfo: {
          type: '合同纠纷',
          title: '起诉状生成',
          description: '生成起诉状文书',
        },
        userGoal: '生成高质量法律文书',
      };

      const result = await agent.plan(input);

      expect(result.decomposition.subTasks.length).toBeGreaterThan(0);
      expect(result.planning.strategy).toBeDefined();
      expect(result.orchestration.workflow).toBeDefined();
    });

    it('应该成功执行分析任务规划', async () => {
      const input: PlanningInput = {
        taskType: TaskType.ANALYSIS,
        caseInfo: {
          evidenceCount: 8,
        },
        userGoal: '全面分析案件',
      };

      const result = await agent.plan(input);

      expect(result).toBeDefined();
      expect(result.metadata.totalTasks).toBeGreaterThan(0);
    });

    it('应该成功执行法律研究任务规划', async () => {
      const input: PlanningInput = {
        taskType: TaskType.LEGAL_RESEARCH,
        caseInfo: {
          type: '知识产权',
          description: '专利侵权案件',
        },
        userGoal: '提供法律支持',
      };

      const result = await agent.plan(input);

      expect(result).toBeDefined();
      expect(result.planning.strategy.recommendations).toBeDefined();
    });

    it('应该成功执行自定义任务规划', async () => {
      const input: PlanningInput = {
        taskType: TaskType.CUSTOM,
        caseInfo: {},
        userGoal: '自定义处理',
      };

      const result = await agent.plan(input);

      expect(result).toBeDefined();
      expect(result.decomposition.subTasks.length).toBeGreaterThan(0);
    });

    it('当缺少taskType时应该抛出错误', async () => {
      const input = {
        caseInfo: {},
        userGoal: '测试',
      } as PlanningInput;

      await expect(agent.plan(input)).rejects.toMatchObject({
        type: PlanningErrorType.INVALID_TASK_TYPE,
      });
    });

    it('当缺少userGoal时应该抛出错误', async () => {
      const input = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
      } as PlanningInput;

      await expect(agent.plan(input)).rejects.toMatchObject({
        type: PlanningErrorType.INVALID_TASK_TYPE,
      });
    });

    it('当缺少caseInfo时应该抛出错误', async () => {
      const input = {
        taskType: TaskType.DEBATE,
        userGoal: '测试',
      } as PlanningInput;

      await expect(agent.plan(input)).rejects.toMatchObject({
        type: PlanningErrorType.INVALID_TASK_TYPE,
      });
    });
  });

  describe('decomposition结果验证', () => {
    it('任务分解应该包含正确的子任务', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      expect(result.decomposition.subTasks).toBeInstanceOf(Array);
      expect(result.decomposition.subTasks.length).toBeGreaterThan(0);
      expect(result.decomposition.totalTime).toBeGreaterThan(0);
      expect(result.decomposition.criticalPath).toBeInstanceOf(Array);
    });

    it('每个子任务应该有必要的属性', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DOCUMENT_GENERATION,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      result.decomposition.subTasks.forEach(task => {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('name');
        expect(task).toHaveProperty('agent');
        expect(task).toHaveProperty('priority');
        expect(task).toHaveProperty('estimatedTime');
        expect(task).toHaveProperty('dependencies');
      });
    });

    it('关键路径应该是有效的任务ID数组', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);
      const taskIds = result.decomposition.subTasks.map(t => t.id);

      result.decomposition.criticalPath.forEach(taskId => {
        expect(taskIds).toContain(taskId);
      });
    });
  });

  describe('planning结果验证', () => {
    it('策略规划应该包含完整的策略信息', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {
          evidenceCount: 6,
          type: '民事',
          claims: ['返还货款'],
        },
        userGoal: '最大程度保护客户利益',
      };

      const result = await agent.plan(input);

      expect(result.planning.strategy).toBeDefined();
      expect(result.planning.strategy.name).toBeDefined();
      expect(result.planning.strategy.description).toBeDefined();
      expect(result.planning.strategy.swotAnalysis).toBeDefined();
      expect(result.planning.strategy.recommendations).toBeInstanceOf(Array);
      expect(result.planning.strategy.riskLevel).toMatch(/^(low|medium|high)$/);
      expect(result.planning.strategy.feasibilityScore).toBeGreaterThanOrEqual(
        0
      );
      expect(result.planning.strategy.feasibilityScore).toBeLessThanOrEqual(1);
      expect(result.planning.strategy.confidence).toBeGreaterThan(0);
      expect(result.planning.strategy.confidence).toBeLessThanOrEqual(1);
    });

    it('SWOT分析应该包含所有四个方面', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {
          evidenceCount: 10,
          type: '合同纠纷',
          claims: ['返还', '赔偿'],
        },
        userGoal: '全面分析',
      };

      const result = await agent.plan(input);
      const swot = result.planning.strategy.swotAnalysis;

      expect(swot.strengths).toBeInstanceOf(Array);
      expect(swot.weaknesses).toBeInstanceOf(Array);
      expect(swot.opportunities).toBeInstanceOf(Array);
      expect(swot.threats).toBeInstanceOf(Array);
    });

    it('替代策略应该有效', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      expect(result.planning.alternativeStrategies).toBeInstanceOf(Array);
      result.planning.alternativeStrategies.forEach(altStrategy => {
        expect(altStrategy.name).toBeDefined();
        expect(altStrategy.feasibilityScore).toBeGreaterThanOrEqual(0);
      });
    });

    it('选择原因应该是有效的字符串', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      expect(result.planning.selectedReason).toBeDefined();
      expect(typeof result.planning.selectedReason).toBe('string');
      expect(result.planning.selectedReason.length).toBeGreaterThan(0);
    });
  });

  describe('orchestration结果验证', () => {
    it('工作流编排应该包含有效的执行计划', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      expect(result.orchestration.workflow).toBeDefined();
      expect(result.orchestration.workflow.id).toBeDefined();
      expect(result.orchestration.workflow.name).toBeDefined();
      expect(result.orchestration.workflow.tasks).toBeInstanceOf(Array);
      expect(result.orchestration.workflow.executionMode).toBeDefined();
    });

    it('执行计划应该包含有效的步骤', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DOCUMENT_GENERATION,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      expect(result.orchestration.executionPlan).toBeInstanceOf(Array);
      expect(result.orchestration.executionPlan.length).toBeGreaterThan(0);

      result.orchestration.executionPlan.forEach(step => {
        expect(step).toHaveProperty('step');
        expect(step).toHaveProperty('taskId');
        expect(step).toHaveProperty('taskName');
        expect(step).toHaveProperty('mode');
        expect(step).toHaveProperty('dependencies');
        expect(step).toHaveProperty('estimatedTime');
        expect(step.mode).toMatch(/^(execute|wait|parallel)$/);
      });
    });

    it('预估执行时长应该合理', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      expect(result.orchestration.estimatedDuration).toBeGreaterThan(0);
      expect(result.orchestration.estimatedDuration).toBeLessThan(
        Number.MAX_SAFE_INTEGER
      );
    });
  });

  describe('allocation结果验证', () => {
    it('资源分配应该包含有效的Agent资源', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      expect(result.allocation.agents).toBeInstanceOf(Map);
      expect(result.allocation.agents.size).toBeGreaterThan(0);
      expect(result.allocation.priority).toBeDefined();
      expect(result.allocation.maxConcurrent).toBeGreaterThan(0);
      expect(result.allocation.utilizationRate).toBeGreaterThanOrEqual(0);
      expect(result.allocation.utilizationRate).toBeLessThanOrEqual(1);
    });

    it('每个Agent资源应该有必要的属性', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);
      result.allocation.agents.forEach(agentResource => {
        expect(agentResource).toHaveProperty('agentType');
        expect(agentResource).toHaveProperty('allocated');
        expect(agentResource).toHaveProperty('estimatedLoad');
        expect(agentResource).toHaveProperty('priority');
      });
    });

    it('资源分配应该优先级生效', async () => {
      const input: PlanningInput = {
        taskType: TaskType.ANALYSIS,
        caseInfo: {},
        userGoal: '测试',
        constraints: {
          priorityOverride: TaskPriority.URGENT,
        },
      };

      const result = await agent.plan(input);

      result.allocation.agents.forEach(agentResource => {
        expect(agentResource.priority).toBe(TaskPriority.URGENT);
      });
    });
  });

  describe('metadata结果验证', () => {
    it('元数据应该包含所有必要字段', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      expect(result.metadata).toHaveProperty('totalTasks');
      expect(result.metadata).toHaveProperty('totalEstimatedTime');
      expect(result.metadata).toHaveProperty('recommendedExecutionMode');
      expect(result.metadata).toHaveProperty('criticalPathTasks');
      expect(result.metadata).toHaveProperty('riskFactors');
      expect(result.metadata).toHaveProperty('confidence');
    });

    it('元数据值应该是有效的', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DOCUMENT_GENERATION,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      expect(result.metadata.totalTasks).toBeGreaterThanOrEqual(0);
      expect(result.metadata.totalEstimatedTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.confidence).toBeGreaterThanOrEqual(0);
      expect(result.metadata.confidence).toBeLessThanOrEqual(1);
      expect(result.metadata.recommendedExecutionMode).toMatch(
        /^(sequential|parallel|mixed)$/
      );
    });

    it('风险因素应该是字符串数组', async () => {
      const input: PlanningInput = {
        taskType: TaskType.DEBATE,
        caseInfo: {},
        userGoal: '测试',
      };

      const result = await agent.plan(input);

      expect(result.metadata.riskFactors).toBeInstanceOf(Array);
      result.metadata.riskFactors.forEach(factor => {
        expect(typeof factor).toBe('string');
      });
    });
  });

  describe('quickPlan方法', () => {
    it('应该快速执行简单规划', async () => {
      const result = await agent.quickPlan(TaskType.DEBATE);

      expect(result).toBeDefined();
      expect(result.decomposition).toBeDefined();
      expect(result.planning).toBeDefined();
    });

    it('快速规划应该使用默认输入', async () => {
      const result = await agent.quickPlan(TaskType.ANALYSIS);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalTasks).toBeGreaterThan(0);
    });
  });

  describe('reset方法', () => {
    it('应该成功重置内部状态', () => {
      expect(() => agent.reset()).not.toThrow();
    });
  });

  describe('getConfigurations方法', () => {
    it('应该返回所有配置', () => {
      const configs = agent.getConfigurations();

      expect(configs).toHaveProperty('decomposer');
      expect(configs).toHaveProperty('planner');
      expect(configs).toHaveProperty('orchestrator');
      expect(configs).toHaveProperty('allocator');
      expect(configs.decomposer).toBeDefined();
      expect(configs.planner).toBeDefined();
      expect(configs.orchestrator).toBeDefined();
      expect(configs.allocator).toBeDefined();
    });
  });

  describe('配置更新方法', () => {
    it('应该成功更新分解器配置', () => {
      expect(() =>
        agent.updateDecomposerConfig({ enableOptimization: false })
      ).not.toThrow();
    });

    it('应该成功更新规划器配置', () => {
      expect(() =>
        agent.updatePlannerConfig({ enableSWOTAnalysis: false })
      ).not.toThrow();
    });

    it('应该成功更新编排器配置', () => {
      expect(() =>
        agent.updateOrchestratorConfig({ maxConcurrentTasks: 5 })
      ).not.toThrow();
    });

    it('应该成功更新分配器配置', () => {
      expect(() =>
        agent.updateAllocatorConfig({ enableLoadBalancing: false })
      ).not.toThrow();
    });
  });
});
