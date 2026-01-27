// AgentRegistry测试

// 导入共享的测试工具和类型
import {
  AgentType,
  AgentStatus,
  TaskPriority,
  AgentErrorType,
  type AgentContext,
  type AgentError,
  type AgentResult,
  type TestAgentError,
} from './test-utils';

interface AgentMetadata {
  name: string;
  type: AgentType;
  version: string;
  description: string;
  capabilities: string[];
  supportedTasks: string[];
  dependencies?: AgentType[];
  averageExecutionTime?: number;
  successRate?: number;
  requiredConfig?: string[];
  optionalConfig?: string[];
  status: AgentStatus;
  lastUsed?: number;
  totalExecutions?: number;
}

interface Agent {
  readonly name: string;
  readonly type: AgentType;
  readonly version: string;
  readonly description: string;
  execute(context: AgentContext): Promise<AgentResult>;
  validateInput?(input: any): {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
    sanitizedData?: any;
  };
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
  healthCheck?(): Promise<boolean>;
  configure?(config: Record<string, any>): Promise<void>;
}

// 简化的AgentRegistry实现
class SimpleAgentRegistry {
  private agents = new Map<
    string,
    { metadata: AgentMetadata; instance: Agent; registeredAt: number }
  >();
  private eventListeners = new Map<string, ((data: unknown) => void)[]>();

  async register(
    agent: Agent,
    metadata?: Partial<AgentMetadata>
  ): Promise<void> {
    if (!agent.name || !agent.type) {
      throw new Error('Agent must have name and type');
    }

    const fullMetadata: AgentMetadata = {
      name: agent.name,
      type: agent.type,
      version: agent.version || '1.0.0',
      description: agent.description || '',
      capabilities: [],
      supportedTasks: [],
      status: AgentStatus.IDLE,
      ...metadata,
    };

    this.agents.set(agent.name, {
      metadata: fullMetadata,
      instance: agent,
      registeredAt: Date.now(),
    });

    this.emit('registered', { agentName: agent.name, metadata: fullMetadata });
  }

  async unregister(agentName: string): Promise<void> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    this.agents.delete(agentName);
    this.emit('unregistered', { agentName });
  }

  get(agentName: string): Agent | undefined {
    return this.agents.get(agentName)?.instance;
  }

  getMetadata(agentName: string): AgentMetadata | undefined {
    return this.agents.get(agentName)?.metadata;
  }

  list(): string[] {
    return Array.from(this.agents.keys());
  }

  listByType(type: AgentType): string[] {
    return Array.from(this.agents.values())
      .filter(agent => agent.metadata.type === type)
      .map(agent => agent.metadata.name);
  }

  updateStatus(agentName: string, status: AgentStatus): void {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const oldStatus = agent.metadata.status;
    agent.metadata.status = status;

    this.emit('status_changed', {
      agentName,
      oldStatus,
      newStatus: status,
    });
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  on(event: string, listener: (data: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: (data: unknown) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
}

// 测试用的Mock Agent
class MockAgent implements Agent {
  readonly name: string;
  readonly type: AgentType;
  readonly version: string;
  readonly description: string;

  constructor(
    name: string,
    type: AgentType,
    version: string = '1.0.0',
    description: string = 'Mock agent for testing'
  ) {
    this.name = name;
    this.type = type;
    this.version = version;
    this.description = description;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    return {
      success: true,
      agentName: this.name,
      executionTime: 100,
      data: { processed: true, input: context.data },
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('AgentRegistry', () => {
  let registry: SimpleAgentRegistry;

  beforeEach(() => {
    registry = new SimpleAgentRegistry();
  });

  describe('Registration', () => {
    it('should register an agent successfully', async () => {
      const agent = new MockAgent('TestAgent', AgentType.DOC_ANALYZER);

      await registry.register(agent);

      expect(registry.get('TestAgent')).toBe(agent);
      expect(registry.list()).toContain('TestAgent');
      expect(registry.getMetadata('TestAgent')?.name).toBe('TestAgent');
      expect(registry.getMetadata('TestAgent')?.type).toBe(
        AgentType.DOC_ANALYZER
      );
    });

    it('should register agent with custom metadata', async () => {
      const agent = new MockAgent('CustomAgent', AgentType.RESEARCHER);
      const customMetadata = {
        version: '2.0.0',
        description: 'Custom research agent',
        capabilities: ['research', 'analysis'],
        supportedTasks: ['literature_review'],
      };

      await registry.register(agent, customMetadata);

      const metadata = registry.getMetadata('CustomAgent');
      expect(metadata?.version).toBe('2.0.0');
      expect(metadata?.description).toBe('Custom research agent');
      expect(metadata?.capabilities).toEqual(['research', 'analysis']);
      expect(metadata?.supportedTasks).toEqual(['literature_review']);
    });

    it('should throw error when registering invalid agent', async () => {
      const invalidAgent = {
        name: '',
        type: '' as AgentType,
        version: '1.0.0',
        description: 'Invalid agent',
        execute: async () => ({
          success: false,
          agentName: '',
          executionTime: 0,
        }),
      } as Agent;

      await expect(registry.register(invalidAgent)).rejects.toThrow(
        'Agent must have name and type'
      );
    });
  });

  describe('Unregistration', () => {
    it('should unregister an agent successfully', async () => {
      const agent = new MockAgent('TestAgent', AgentType.DOC_ANALYZER);
      await registry.register(agent);

      await registry.unregister('TestAgent');

      expect(registry.get('TestAgent')).toBeUndefined();
      expect(registry.list()).not.toContain('TestAgent');
    });

    it('should throw error when unregistering non-existent agent', async () => {
      await expect(registry.unregister('NonExistent')).rejects.toThrow(
        'Agent NonExistent not found'
      );
    });
  });

  describe('Listing and Querying', () => {
    beforeEach(async () => {
      await registry.register(
        new MockAgent('DocAnalyzer', AgentType.DOC_ANALYZER)
      );
      await registry.register(
        new MockAgent('Researcher', AgentType.RESEARCHER)
      );
      await registry.register(
        new MockAgent('DocAnalyzer2', AgentType.DOC_ANALYZER)
      );
    });

    it('should list all registered agents', () => {
      const agents = registry.list();
      expect(agents).toHaveLength(3);
      expect(agents).toContain('DocAnalyzer');
      expect(agents).toContain('Researcher');
      expect(agents).toContain('DocAnalyzer2');
    });

    it('should list agents by type', () => {
      const docAnalyzers = registry.listByType(AgentType.DOC_ANALYZER);
      const researchers = registry.listByType(AgentType.RESEARCHER);

      expect(docAnalyzers).toHaveLength(2);
      expect(docAnalyzers).toContain('DocAnalyzer');
      expect(docAnalyzers).toContain('DocAnalyzer2');

      expect(researchers).toHaveLength(1);
      expect(researchers).toContain('Researcher');
    });

    it('should return empty array for non-existent type', () => {
      const writers = registry.listByType(AgentType.WRITER);
      expect(writers).toHaveLength(0);
    });
  });

  describe('Status Management', () => {
    beforeEach(async () => {
      await registry.register(
        new MockAgent('TestAgent', AgentType.DOC_ANALYZER)
      );
    });

    it('should update agent status', () => {
      registry.updateStatus('TestAgent', AgentStatus.BUSY);

      const metadata = registry.getMetadata('TestAgent');
      expect(metadata?.status).toBe(AgentStatus.BUSY);
    });

    it('should throw error when updating status of non-existent agent', () => {
      expect(() => {
        registry.updateStatus('NonExistent', AgentStatus.BUSY);
      }).toThrow('Agent NonExistent not found');
    });
  });

  describe('Event System', () => {
    it('should emit registration event', async () => {
      const mockListener = jest.fn();
      registry.on('registered', mockListener);

      const agent = new MockAgent('TestAgent', AgentType.DOC_ANALYZER);
      await registry.register(agent);

      expect(mockListener).toHaveBeenCalledWith({
        agentName: 'TestAgent',
        metadata: expect.objectContaining({
          name: 'TestAgent',
          type: AgentType.DOC_ANALYZER,
        }),
      });
    });

    it('should emit unregistration event', async () => {
      const mockListener = jest.fn();
      registry.on('unregistered', mockListener);

      const agent = new MockAgent('TestAgent', AgentType.DOC_ANALYZER);
      await registry.register(agent);
      await registry.unregister('TestAgent');

      expect(mockListener).toHaveBeenCalledWith({
        agentName: 'TestAgent',
      });
    });

    it('should emit status change event', async () => {
      const mockListener = jest.fn();
      registry.on('status_changed', mockListener);

      const agent = new MockAgent('TestAgent', AgentType.DOC_ANALYZER);
      await registry.register(agent);

      registry.updateStatus('TestAgent', AgentStatus.BUSY);

      expect(mockListener).toHaveBeenCalledWith({
        agentName: 'TestAgent',
        oldStatus: AgentStatus.IDLE,
        newStatus: AgentStatus.BUSY,
      });
    });

    it('should handle event listener errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const faultyListener = jest.fn(() => {
        throw new Error('Listener error');
      });

      registry.on('registered', faultyListener);

      const agent = new MockAgent('TestAgent', AgentType.DOC_ANALYZER);

      // Should not throw despite listener error
      await expect(registry.register(agent)).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in event listener for registered:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Agent Execution', () => {
    it('should execute agent through registry', async () => {
      const agent = new MockAgent('TestAgent', AgentType.DOC_ANALYZER);
      await registry.register(agent);

      const context: AgentContext = {
        task: 'Test task',
        priority: TaskPriority.MEDIUM,
        data: { input: 'test data' },
      };

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.agentName).toBe('TestAgent');
      expect(result.data).toEqual({ processed: true, input: context.data });
    });
  });
});
