// Agent注册系统增强功能测试

import {
  AgentRegistry,
  AgentDiscoveryOptions,
  AgentRecommendation,
  agentRegistry,
} from "../../lib/agent/registry";

import {
  AgentDIContainer,
  diContainer as defaultDIContainer,
} from "../../lib/agent/di-container";

import {
  AgentType,
  AgentStatus,
  AgentMetadata,
  AgentEventType,
} from "../../types/agent";

import { createMockAgent, createMockAgentClass } from "./test-utils";

// 创建测试用的Mock Agent类
class MockLegalAgent {
  public readonly name: string;
  public readonly type: AgentType = AgentType.DOC_ANALYZER;
  public readonly version: string = "1.0.0";
  public readonly description: string = "Mock Legal Agent";

  constructor(name: string) {
    this.name = name;
  }

  getMetadata(): AgentMetadata {
    return {
      name: this.name,
      type: this.type,
      version: this.version,
      description: this.description,
      capabilities: ["legal-analysis", "document-review"],
      supportedTasks: ["case-analysis", "contract-review"],
      status: AgentStatus.IDLE,
      successRate: 0.85,
      averageExecutionTime: 500,
      lastUsed: Date.now() - 1000 * 60 * 60, // 1小时前
      dependencies: [],
    };
  }

  async execute(task: any): Promise<any> {
    return { result: `Mock execution by ${this.name}` };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

class MockResearchAgent {
  public readonly name: string;
  public readonly type: AgentType = AgentType.RESEARCHER;
  public readonly version: string = "1.0.0";
  public readonly description: string = "Mock Research Agent";

  constructor(name: string) {
    this.name = name;
  }

  getMetadata(): AgentMetadata {
    return {
      name: this.name,
      type: this.type,
      version: this.version,
      description: this.description,
      capabilities: ["research", "data-analysis"],
      supportedTasks: ["legal-research", "evidence-gathering"],
      status: AgentStatus.IDLE,
      successRate: 0.92,
      averageExecutionTime: 300,
      lastUsed: Date.now() - 1000 * 60 * 30, // 30分钟前
      dependencies: [AgentType.DOC_ANALYZER],
    };
  }

  async execute(task: any): Promise<any> {
    return { result: `Mock research by ${this.name}` };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe("AgentRegistry Enhanced Features", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    // 清理注册表
    agentRegistry.clear();
    defaultDIContainer.clear();
    registry = agentRegistry;
    defaultDIContainer.register("logger", console);
    defaultDIContainer.register("config", { timeout: 5000 });
  });

  afterEach(() => {
    registry.clear();
    defaultDIContainer.clear();
  });

  describe("依赖注入支持的注册", () => {
    it("应该能够使用依赖注入注册Agent", () => {
      const MockAgentClass = createMockAgentClass("TestAgent", {
        type: AgentType.DOC_ANALYZER,
        capabilities: ["test-capability"],
        supportedTasks: ["test-task"],
      });

      // 先注册Agent配置到DI容器
      defaultDIContainer.registerAgentConfig("test-agent", {
        dependencies: { logger: "logger", config: "config" },
      });

      const success = registry.registerAgentWithDI(
        MockAgentClass,
        "test-agent",
        {
          dependencies: { logger: "logger", config: "config" },
        },
      );

      expect(success).toBe(true);
      expect(registry.isRegistered("test-agent")).toBe(true);

      const agent = registry.getAgent("test-agent");
      expect(agent).toBeDefined();
      expect(agent?.name).toBe("test-agent");
    });

    it("应该能够批量注册Agent（支持依赖注入）", () => {
      const MockAgentClass = createMockAgentClass("BatchTestAgent", {
        type: AgentType.RESEARCHER,
        capabilities: ["batch-capability"],
        supportedTasks: ["batch-task"],
      });

      const agentConfigs = [
        {
          name: "batch-agent-1",
          config: { dependencies: { logger: "logger" } },
        },
        {
          name: "batch-agent-2",
          config: { dependencies: { logger: "logger", config: "config" } },
        },
        { name: "batch-agent-3", config: {} },
      ];

      // 预先注册所有Agent配置
      for (const { name, config } of agentConfigs) {
        defaultDIContainer.registerAgentConfig(name, config);
      }

      const successCount = registry.registerAgentsWithDI(
        MockAgentClass,
        agentConfigs,
      );

      expect(successCount).toBe(3);
      expect(registry.isRegistered("batch-agent-1")).toBe(true);
      expect(registry.isRegistered("batch-agent-2")).toBe(true);
      expect(registry.isRegistered("batch-agent-3")).toBe(true);
    });

    it("依赖注入失败时应该抛出错误", () => {
      const InvalidAgentClass = class {
        constructor(dependencies: any) {
          throw new Error("Invalid dependencies");
        }
      };

      expect(() => {
        registry.registerAgentWithDI(InvalidAgentClass as any, "invalid-agent");
      }).toThrow("Invalid dependencies");
    });
  });

  describe("Agent发现机制", () => {
    beforeEach(() => {
      // 注册测试Agent
      const legalAgent = new MockLegalAgent("legal-agent");
      const researchAgent = new MockResearchAgent("research-agent");

      registry.registerAgent(legalAgent);
      registry.registerAgent(researchAgent);
    });

    it("应该能够按能力发现Agent", () => {
      const options: AgentDiscoveryOptions = {
        byCapability: ["legal-analysis"],
        sortBy: "successRate",
        sortOrder: "desc",
      };

      const agents = registry.discoverAgents(options);

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe("legal-agent");
    });

    it("应该能够按任务类型发现Agent", () => {
      const options: AgentDiscoveryOptions = {
        byTaskType: ["legal-research"],
        sortBy: "name",
        sortOrder: "asc",
      };

      const agents = registry.discoverAgents(options);

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe("research-agent");
    });

    it("应该能够按性能要求发现Agent", () => {
      const options: AgentDiscoveryOptions = {
        byPerformance: {
          minSuccessRate: 0.9,
          maxExecutionTime: 400,
        },
      };

      const agents = registry.discoverAgents(options);

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe("research-agent");
    });

    it("应该能够按状态发现Agent", () => {
      // 禁用一个Agent
      registry.disableAgent("legal-agent");

      const options: AgentDiscoveryOptions = {
        byStatus: [AgentStatus.IDLE],
      };

      const agents = registry.discoverAgents(options);

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe("research-agent");
    });

    it("应该能够按依赖关系发现Agent", () => {
      const options: AgentDiscoveryOptions = {
        withDependencies: [AgentType.DOC_ANALYZER],
      };

      const agents = registry.discoverAgents(options);

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe("research-agent");
    });

    it("应该支持分页", () => {
      const options: AgentDiscoveryOptions = {
        limit: 1,
        offset: 0,
      };

      const agents = registry.discoverAgents(options);

      expect(agents).toHaveLength(1);
    });
  });

  describe("Agent推荐系统", () => {
    beforeEach(() => {
      // 注册测试Agent
      const legalAgent = new MockLegalAgent("legal-agent");
      const researchAgent = new MockResearchAgent("research-agent");

      registry.registerAgent(legalAgent);
      registry.registerAgent(researchAgent);
    });

    it("应该能够推荐最适合的Agent", () => {
      const recommendations = registry.recommendAgent("legal analysis task");

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // 检查推荐结果结构
      const recommendation = recommendations[0];
      expect(recommendation).toHaveProperty("agent");
      expect(recommendation).toHaveProperty("metadata");
      expect(recommendation).toHaveProperty("score");
      expect(recommendation).toHaveProperty("reasons");
      expect(recommendation).toHaveProperty("confidence");

      // 检查评分和置信度范围
      expect(recommendation.score).toBeGreaterThanOrEqual(0);
      expect(recommendation.score).toBeLessThanOrEqual(100);
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(1);
    });

    it("应该能够限制推荐数量", () => {
      const recommendations = registry.recommendAgent("legal task", undefined, {
        maxRecommendations: 1,
      });

      expect(recommendations).toHaveLength(1);
    });

    it("应该能够排除特定类型的Agent", () => {
      const recommendations = registry.recommendAgent("legal task", undefined, {
        excludedTypes: [AgentType.RESEARCHER],
      });

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].metadata.type).toBe(AgentType.DOC_ANALYZER);
    });

    it("推荐结果应该按评分排序", () => {
      const recommendations = registry.recommendAgent("legal analysis");

      // 验证按评分降序排列
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i].score).toBeLessThanOrEqual(
          recommendations[i - 1].score,
        );
      }
    });
  });

  describe("便捷查找方法", () => {
    beforeEach(() => {
      const legalAgent = new MockLegalAgent("legal-agent");
      const researchAgent = new MockResearchAgent("research-agent");

      registry.registerAgent(legalAgent);
      registry.registerAgent(researchAgent);
    });

    it("findAgentsByCapability应该按能力查找Agent", () => {
      const agents = registry.findAgentsByCapability("legal-analysis");

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe("legal-agent");
    });

    it("findAgentsByTask应该按任务类型查找Agent", () => {
      const agents = registry.findAgentsByTask("legal-research");

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe("research-agent");
    });

    it("findBestPerformingAgents应该按性能查找Agent", () => {
      const agents = registry.findBestPerformingAgents("successRate", 5);

      expect(agents).toHaveLength(2);
      expect(agents[0].name).toBe("research-agent"); // 成功率更高
    });
  });

  describe("增强的统计和诊断", () => {
    beforeEach(() => {
      const legalAgent = new MockLegalAgent("legal-agent");
      const researchAgent = new MockResearchAgent("research-agent");

      registry.registerAgent(legalAgent);
      registry.registerAgent(researchAgent);
    });

    it("getEnhancedStatistics应该返回增强统计信息", () => {
      const stats = registry.getEnhancedStatistics();

      expect(stats).toHaveProperty("registry");
      expect(stats).toHaveProperty("diContainer");
      expect(stats).toHaveProperty("capabilities");
      expect(stats).toHaveProperty("tasks");

      // 检查能力统计
      expect(stats.capabilities["legal-analysis"]).toBe(1);
      expect(stats.capabilities["research"]).toBe(1);

      // 检查任务统计
      expect(stats.tasks["case-analysis"]).toBe(1);
      expect(stats.tasks["legal-research"]).toBe(1);
    });

    it("getFullDiagnostics应该返回完整诊断信息", () => {
      const diagnostics = registry.getFullDiagnostics();

      expect(diagnostics).toHaveProperty("timestamp");
      expect(diagnostics).toHaveProperty("registry");
      expect(diagnostics).toHaveProperty("diContainer");
      expect(diagnostics).toHaveProperty("recommendations");

      // 检查时间戳
      expect(diagnostics.timestamp).toBeGreaterThan(0);

      // 检查建议
      expect(Array.isArray(diagnostics.recommendations)).toBe(true);
    });
  });

  describe("事件处理", () => {
    it("应该在依赖注入注册时发送事件", () => {
      const eventListener = jest.fn();
      registry.on(AgentEventType.REGISTERED, eventListener);

      const MockAgentClass = createMockAgentClass("EventTestAgent", {
        type: AgentType.DOC_ANALYZER,
        capabilities: ["event-test"],
        supportedTasks: ["event-task"],
      });

      // 预先注册Agent配置
      defaultDIContainer.registerAgentConfig("event-test-agent", {});

      registry.registerAgentWithDI(MockAgentClass, "event-test-agent");

      expect(eventListener).toHaveBeenCalled();
      const eventData = eventListener.mock.calls[0][0];
      expect(eventData.type).toBe(AgentEventType.REGISTERED);
      expect(eventData.agentName).toBe("event-test-agent");
    });
  });
});
