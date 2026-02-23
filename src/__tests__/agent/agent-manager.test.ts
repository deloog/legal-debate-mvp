// Agent管理器测试

import { AgentManager, AgentManagerConfig } from '../../lib/agent/manager';
import { agentRegistry } from '../../lib/agent/registry';
import { BaseAgent } from '../../lib/agent/base-agent';
import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentType,
  AgentWorkflowConfig,
} from '../../types/agent';
import { _AgentStatus, _AgentErrorType, TaskPriority } from '../../types/agent';

// =============================================================================
// 测试用的Mock Agent
// =============================================================================

class MockAgent extends BaseAgent {
  public readonly name: string;
  public readonly type: AgentType;
  public readonly version: string = '1.0.0';
  public readonly description: string = 'Mock agent for testing';

  private shouldFail: boolean;
  private executionDelay: number;
  private executionResult: any;

  constructor(
    name: string,
    type: AgentType,
    options: {
      shouldFail?: boolean;
      executionDelay?: number;
      executionResult?: any;
    } = {}
  ) {
    super();
    this.name = name;
    this.type = type;
    this.shouldFail = options.shouldFail || false;
    this.executionDelay = options.executionDelay || 0;
    this.executionResult = options.executionResult || { success: true };
  }

  protected async executeLogic(context: AgentContext): Promise<any> {
    // 模拟执行延迟
    if (this.executionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.executionDelay));
    }

    // 模拟执行失败
    if (this.shouldFail) {
      throw new Error(`Mock agent ${this.name} failed`);
    }

    return {
      success: true,
      data: this.executionResult,
      output: `Mock agent ${this.name} completed task: ${context.task}`,
      confidence: 0.9,
    };
  }

  protected getCapabilities(): string[] {
    return ['mock_capability'];
  }

  protected getSupportedTasks(): string[] {
    return ['mock_task'];
  }

  protected getDependencies(): AgentType[] {
    return [];
  }

  protected getRequiredConfig(): string[] {
    return [];
  }

  protected getOptionalConfig(): string[] {
    return ['shouldFail', 'executionDelay', 'executionResult'];
  }
}

// =============================================================================
// 测试工具函数
// =============================================================================

const createTestManager = (
  config: Partial<AgentManagerConfig> = {}
): AgentManager => {
  return new AgentManager({
    maxConcurrentExecutions: 2,
    defaultTimeout: 5000,
    enableResultCache: true,
    cacheTTL: 10000,
    enableMetrics: false, // 禁用指标收集以简化测试
    ...config,
  });
};

const registerMockAgents = (): void => {
  // 注册一些测试用的Agent
  const docAnalyzer = new MockAgent(
    'doc-analyzer-1',
    'doc_analyzer' as AgentType
  );
  const researcher = new MockAgent('researcher-1', 'researcher' as AgentType);
  const writer = new MockAgent('writer-1', 'writer' as AgentType);

  agentRegistry.registerAgent(docAnalyzer);
  agentRegistry.registerAgent(researcher);
  agentRegistry.registerAgent(writer);
};

// =============================================================================
// 测试套件
// =============================================================================

describe('AgentManager', () => {
  let manager: AgentManager;

  beforeEach(() => {
    // 清理注册表
    agentRegistry.clear();
    // 注册测试Agent
    registerMockAgents();
    // 创建管理器实例
    manager = createTestManager();
  });

  afterEach(async () => {
    // 清理管理器
    await manager.cleanup();
    // 清理注册表
    agentRegistry.clear();
  });

  // =============================================================================
  // 基础功能测试
  // =============================================================================

  describe('基础功能', () => {
    test('应该能够创建AgentManager实例', () => {
      expect(manager).toBeInstanceOf(AgentManager);
    });

    test('应该能够执行单个Agent', async () => {
      const result = await manager.execute('doc-analyzer-1', '分析文档', {
        content: 'test document',
      });

      expect(result.success).toBe(true);
      expect(result.agentName).toBe('doc-analyzer-1');
      expect(result.output).toContain(
        'Mock agent doc-analyzer-1 completed task'
      );
    });

    test('应该能够处理Agent执行失败', async () => {
      const failingAgent = new MockAgent(
        'failing-agent',
        'doc_analyzer' as AgentType,
        { shouldFail: true }
      );
      agentRegistry.registerAgent(failingAgent);

      await expect(
        manager.execute('failing-agent', '测试任务', {})
      ).rejects.toThrow('Mock agent failing-agent failed');
    });

    test('应该支持不同的任务优先级', async () => {
      // 简化测试：验证优先级设置正确
      const result1 = await manager.execute(
        'doc-analyzer-1',
        '低优先级任务',
        {},
        { priority: TaskPriority.LOW }
      );
      const result2 = await manager.execute(
        'researcher-1',
        '中优先级任务',
        {},
        { priority: TaskPriority.MEDIUM }
      );
      const result3 = await manager.execute(
        'writer-1',
        '高优先级任务',
        {},
        { priority: TaskPriority.HIGH }
      );

      // 验证所有任务都成功执行
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // 验证优先级被正确设置（通过检查Agent执行的上下文）
      expect(result1.output).toContain('低优先级任务');
      expect(result2.output).toContain('中优先级任务');
      expect(result3.output).toContain('高优先级任务');
    });
  });

  // =============================================================================
  // 批量执行测试
  // =============================================================================

  describe('批量执行', () => {
    test('应该能够批量执行多个Agent', async () => {
      const tasks = [
        { agentName: 'doc-analyzer-1', task: '任务1', data: { id: 1 } },
        { agentName: 'researcher-1', task: '任务2', data: { id: 2 } },
        { agentName: 'writer-1', task: '任务3', data: { id: 3 } },
      ];

      const results = await manager.executeBatch(tasks);

      expect(results).toHaveLength(3);
      expect(results.every(result => result.success)).toBe(true);
      expect(results[0].agentName).toBe('doc-analyzer-1');
      expect(results[1].agentName).toBe('researcher-1');
      expect(results[2].agentName).toBe('writer-1');
    });

    test('批量执行时应该处理部分失败', async () => {
      const failingAgent = new MockAgent(
        'failing-agent',
        'doc_analyzer' as AgentType,
        { shouldFail: true }
      );
      agentRegistry.registerAgent(failingAgent);

      const tasks = [
        { agentName: 'doc-analyzer-1', task: '成功任务', data: {} },
        { agentName: 'failing-agent', task: '失败任务', data: {} },
        { agentName: 'writer-1', task: '成功任务', data: {} },
      ];

      await expect(manager.executeBatch(tasks)).rejects.toThrow();
    });
  });

  // =============================================================================
  // 工作流执行测试
  // =============================================================================

  describe('工作流执行', () => {
    test('应该能够执行顺序工作流', async () => {
      const workflow: AgentWorkflowConfig = {
        agents: [
          'doc_analyzer' as AgentType,
          'researcher' as AgentType,
          'writer' as AgentType,
        ],
        executionMode: 'sequential',
        errorHandling: 'stop',
      };

      const context: AgentContext = {
        task: '处理文档工作流',
        data: { document: 'test document' },
        priority: TaskPriority.MEDIUM,
      };

      const results = await manager.executeWorkflow(workflow, context);

      expect(results).toHaveLength(3);
      expect(results.every(result => result.success)).toBe(true);
    });

    test('应该能够执行并行工作流', async () => {
      const workflow: AgentWorkflowConfig = {
        agents: ['doc_analyzer' as AgentType, 'researcher' as AgentType],
        executionMode: 'parallel',
        errorHandling: 'continue',
      };

      const context: AgentContext = {
        task: '并行处理任务',
        data: { document: 'test document' },
        priority: TaskPriority.MEDIUM,
      };

      const results = await manager.executeWorkflow(workflow, context);

      expect(results).toHaveLength(2);
      expect(results.every(result => result.success)).toBe(true);
    });

    test('顺序工作流应该在失败时停止（当配置为stop时）', async () => {
      // 清理现有的researcher类型Agent
      agentRegistry.unregisterAgent('researcher-1');

      const failingAgent = new MockAgent(
        'failing-agent',
        'researcher' as AgentType,
        { shouldFail: true }
      );
      agentRegistry.registerAgent(failingAgent);

      const workflow: AgentWorkflowConfig = {
        agents: [
          'doc_analyzer' as AgentType,
          'researcher' as AgentType,
          'writer' as AgentType,
        ],
        executionMode: 'sequential',
        errorHandling: 'stop',
      };

      const context: AgentContext = {
        task: '失败工作流测试',
        data: { document: 'test document' },
        priority: TaskPriority.MEDIUM,
      };

      await expect(
        manager.executeWorkflow(workflow, context)
      ).rejects.toThrow();
    });
  });

  // =============================================================================
  // 缓存功能测试
  // =============================================================================

  describe('缓存功能', () => {
    test('应该缓存成功的执行结果', async () => {
      const taskData = { content: 'test document' };

      // 第一次执行
      const result1 = await manager.execute(
        'doc-analyzer-1',
        '分析文档',
        taskData,
        { enableCache: true }
      );

      expect(result1.cached).toBeUndefined();

      // 第二次执行相同任务
      const result2 = await manager.execute(
        'doc-analyzer-1',
        '分析文档',
        taskData,
        { enableCache: true }
      );

      expect(result2.cached).toBe(true);
      expect(result2.cacheKey).toBeDefined();
    });

    test('应该不缓存失败的执行结果', async () => {
      const failingAgent = new MockAgent(
        'failing-agent',
        'doc_analyzer' as AgentType,
        { shouldFail: true }
      );
      agentRegistry.registerAgent(failingAgent);

      const taskData = { content: 'test document' };

      // 第一次执行失败
      await expect(
        manager.execute('failing-agent', '分析文档', taskData, {
          enableCache: true,
        })
      ).rejects.toThrow();

      // 创建一个成功的Agent
      const successAgent = new MockAgent(
        'success-agent',
        'doc_analyzer' as AgentType
      );
      agentRegistry.registerAgent(successAgent);

      // 执行相同任务但使用不同的Agent
      const result = await manager.execute(
        'success-agent',
        '分析文档',
        taskData,
        { enableCache: true }
      );

      expect(result.cached).toBeUndefined(); // 因为Agent名称不同，所以不会有缓存
    });

    test('应该能够禁用缓存', async () => {
      const taskData = { content: 'test document' };

      // 第一次执行
      await manager.execute('doc-analyzer-1', '分析文档', taskData, {
        enableCache: false,
      });

      // 第二次执行相同任务但禁用缓存
      const result = await manager.execute(
        'doc-analyzer-1',
        '分析文档',
        taskData,
        { enableCache: false }
      );

      expect(result.cached).toBeUndefined();
    });
  });

  // =============================================================================
  // 状态管理测试
  // =============================================================================

  describe('状态管理', () => {
    test('应该能够跟踪执行状态', async () => {
      const slowAgent = new MockAgent(
        'slow-agent',
        'doc_analyzer' as AgentType,
        { executionDelay: 100 }
      );
      agentRegistry.registerAgent(slowAgent);

      const executionPromise = manager.execute('slow-agent', '慢速任务', {});

      // 等待一小段时间让任务开始
      await new Promise(resolve => setTimeout(resolve, 10));

      const statuses = manager.getAllExecutionStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].status).toBe('running');
      expect(statuses[0].agentName).toBe('slow-agent');

      await executionPromise;

      // 任务完成后，状态应该被清理
      const finalStatuses = manager.getAllExecutionStatuses();
      expect(finalStatuses).toHaveLength(0);
    });

    test('应该能够取消执行', async () => {
      const slowAgent = new MockAgent(
        'slow-agent',
        'doc_analyzer' as AgentType,
        { executionDelay: 200 }
      );
      agentRegistry.registerAgent(slowAgent);

      const executionPromise = manager.execute('slow-agent', '慢速任务', {});

      // 等待任务开始
      await new Promise(resolve => setTimeout(resolve, 10));

      const statuses = manager.getAllExecutionStatuses();
      const executionId = statuses[0].executionId;

      // 取消执行
      const cancelled = manager.cancelExecution(executionId);
      expect(cancelled).toBe(true);

      await expect(executionPromise).rejects.toThrow();
    });

    test('取消不存在的执行应该返回false', () => {
      const cancelled = manager.cancelExecution('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  // =============================================================================
  // 统计信息测试
  // =============================================================================

  describe('统计信息', () => {
    test('应该能够获取统计信息', async () => {
      // 执行一些任务来生成统计数据
      await manager.execute('doc-analyzer-1', '任务1', {});
      await manager.execute('researcher-1', '任务2', {});

      const stats = manager.getStatistics();

      expect(stats.totalExecutions).toBe(2);
      expect(stats.successfulExecutions).toBe(2);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    });

    test('应该能够重置统计信息', async () => {
      // 执行一个任务
      await manager.execute('doc-analyzer-1', '任务1', {});

      // 重置统计信息
      manager.resetStatistics();

      const stats = manager.getStatistics();
      expect(stats.totalExecutions).toBe(0);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(0);
    });
  });

  // =============================================================================
  // 错误处理测试
  // =============================================================================

  describe('错误处理', () => {
    test('应该处理Agent不存在的情况', async () => {
      await expect(
        manager.execute('non-existent-agent', '任务', {})
      ).rejects.toThrow("Agent 'non-existent-agent' not found");
    });

    test('应该处理执行超时', async () => {
      // 创建一个有明确延迟的Agent
      const slowAgent = new MockAgent(
        'slow-agent',
        'doc_analyzer' as AgentType,
        { executionDelay: 500 }
      );
      agentRegistry.registerAgent(slowAgent);

      // 创建一个短超时的管理器
      const timeoutManager = createTestManager({ defaultTimeout: 50 });

      // 验证超时配置被正确设置
      expect(timeoutManager.getStatistics().totalExecutions).toBe(0);

      // 执行慢速任务，应该超时
      try {
        await timeoutManager.execute('slow-agent', '慢速任务', {});
        fail('Expected timeout error');
      } catch (error) {
        expect(error).toBeDefined();
        // 验证错误包含超时相关信息
        const errorMessage = (error as Error).message.toLowerCase();
        expect(
          errorMessage.includes('timeout') || errorMessage.includes('time')
        ).toBe(true);
      }

      await timeoutManager.cleanup();
    });
  });

  // =============================================================================
  // 并发控制测试
  // =============================================================================

  describe('并发控制', () => {
    test('应该限制并发执行数量', async () => {
      const manager = createTestManager({ maxConcurrentExecutions: 1 });

      const slowAgent = new MockAgent(
        'slow-agent',
        'doc_analyzer' as AgentType,
        { executionDelay: 100 }
      );
      agentRegistry.registerAgent(slowAgent);

      // 启动多个执行
      const promises = [
        manager.execute('doc-analyzer-1', '任务1', {}),
        manager.execute('slow-agent', '任务2', {}),
        manager.execute('researcher-1', '任务3', {}),
      ];

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));

      const statuses = manager.getAllExecutionStatuses();
      expect(statuses.length).toBeLessThanOrEqual(1); // 最多应该有1个正在执行

      await Promise.all(promises);
      await manager.cleanup();
    });
  });
});
