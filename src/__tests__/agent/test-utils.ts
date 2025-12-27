// Agent测试共享工具类型和函数

// 从主类型文件导入枚举，避免重复声明
import {
  AgentType,
  AgentStatus,
  TaskPriority,
  AgentErrorType,
  type AgentContext,
  type AgentError,
  type AgentResult,
  type Agent,
  type AgentMetadata,
  type ValidationResult
} from '../../types/agent';

// 重新导出类型供测试使用
export {
  AgentType,
  AgentStatus,
  TaskPriority,
  AgentErrorType,
  type AgentContext,
  type AgentError,
  type AgentResult
};

// 简化的接口定义（如果需要扩展）
export interface TestAgentContext extends AgentContext {
  // 可以添加测试特定的属性
}

export interface TestAgentError extends AgentError {
  // 确保有name属性
  name: string;
}

// 简化的工具函数
export function createTestAgentError(
  code: string,
  message: string,
  type: AgentErrorType,
  agentName: string,
  retryable: boolean = false,
  details?: Record<string, any>
): TestAgentError {
  return {
    name: 'AgentError', // 添加name属性
    code,
    message,
    type,
    agentName,
    timestamp: Date.now(),
    retryable,
    details,
    stack: new Error().stack
  };
}

export function createTestAgentResult(
  agentName: string,
  data?: any,
  options: {
    success?: boolean;
    executionTime?: number;
    confidence?: number;
    tokensUsed?: number;
    cost?: number;
    output?: string;
    structuredOutput?: Record<string, any>;
    context?: any;
    cached?: boolean;
    cacheKey?: string;
    error?: TestAgentError;
  } = {}
): AgentResult & { error?: TestAgentError } {
  return {
    success: options.success !== false,
    agentName,
    executionTime: options.executionTime || 0,
    data,
    output: options.output,
    structuredOutput: options.structuredOutput,
    confidence: options.confidence,
    tokensUsed: options.tokensUsed,
    cost: options.cost,
    context: options.context,
    cached: options.cached,
    cacheKey: options.cacheKey,
    error: options.error
  };
}

export function validateTestAgentContext(context: AgentContext): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!context.task || typeof context.task !== 'string') {
    errors.push('Task is required and must be a string');
  }

  if (!context.data || typeof context.data !== 'object') {
    errors.push('Data is required and must be an object');
  }

  const validPriorities = Object.values(TaskPriority);
  if (!validPriorities.includes(context.priority)) {
    errors.push('Priority must be a valid TaskPriority value');
  }

  if (context.options && typeof context.options !== 'object') {
    errors.push('Options must be an object if provided');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function isValidTestAgentType(type: string): type is AgentType {
  return Object.values(AgentType).includes(type as AgentType);
}

export function isValidTestAgentStatus(status: string): status is AgentStatus {
  return Object.values(AgentStatus).includes(status as AgentStatus);
}

export function isValidTestTaskPriority(priority: string): priority is TaskPriority {
  return Object.values(TaskPriority).includes(priority as TaskPriority);
}

// 创建模拟Agent类的工厂函数
export function createMockAgentClass(
  className: string,
  defaultMetadata: Partial<AgentMetadata> = {}
): new (...args: any[]) => Agent {
  return class MockAgent {
    public readonly name: string;
    public readonly type: AgentType;
    public readonly version: string;
    public readonly description: string;

    constructor(...args: any[]) {
      // 第一个参数是agentName，其余是依赖项
      const agentName = typeof args[0] === 'string' ? args[0] : className;
      this.name = agentName;
      this.type = defaultMetadata.type || AgentType.RESEARCHER;
      this.version = defaultMetadata.version || '1.0.0';
      this.description = defaultMetadata.description || `Mock ${className} Agent`;
    }

    getMetadata(): AgentMetadata {
      return {
        name: this.name,
        type: this.type,
        version: this.version,
        description: this.description,
        capabilities: defaultMetadata.capabilities || [],
        supportedTasks: defaultMetadata.supportedTasks || [],
        status: AgentStatus.IDLE,
        successRate: defaultMetadata.successRate || 0.8,
        averageExecutionTime: defaultMetadata.averageExecutionTime || 300,
        lastUsed: Date.now() - 1000 * 60 * 60,
        dependencies: defaultMetadata.dependencies || [],
        ...defaultMetadata
      };
    }

    async execute(context: AgentContext): Promise<AgentResult> {
      const metadata = this.getMetadata();
      const executionTime = metadata.averageExecutionTime || 300;
      
      // 模拟执行时间
      await new Promise(resolve => setTimeout(resolve, executionTime));
      
      const success = metadata.successRate === undefined || Math.random() < metadata.successRate;
      
      return {
        success,
        agentName: this.name,
        executionTime,
        data: {
          task: context.task,
          processed: true,
          timestamp: Date.now()
        },
        output: `${this.name} processed: ${context.task}`,
        confidence: success ? 0.8 : 0.3,
        tokensUsed: 100
      };
    }

    async healthCheck(): Promise<boolean> {
      return true;
    }

    async configure(config: Record<string, any>): Promise<void> {
      // 模拟配置
    }

    validateInput(input: any): ValidationResult {
      return {
        valid: true,
        errors: []
      };
    }
  };
}

// 创建模拟Agent的工厂函数
export function createMockAgent(config: Partial<AgentMetadata> & {
  name: string;
  type: AgentType;
}): Agent {
  const metadata: AgentMetadata = {
    name: config.name,
    type: config.type,
    version: config.version || '1.0.0',
    description: config.description || `Mock agent ${config.name}`,
    capabilities: config.capabilities || [],
    supportedTasks: config.supportedTasks || [],
    status: config.status || AgentStatus.IDLE,
    dependencies: config.dependencies,
    averageExecutionTime: config.averageExecutionTime,
    successRate: config.successRate,
    requiredConfig: config.requiredConfig,
    optionalConfig: config.optionalConfig,
    lastUsed: config.lastUsed,
    totalExecutions: config.totalExecutions
  };

  const agent: Agent = {
    // 基本信息
    name: metadata.name,
    type: metadata.type,
    version: metadata.version,
    description: metadata.description,
    
    // 执行方法
    async execute(context: AgentContext): Promise<AgentResult> {
      // 模拟执行
      const executionTime = metadata.averageExecutionTime || 100;
      await new Promise(resolve => setTimeout(resolve, executionTime));
      
      const success = metadata.successRate === undefined || Math.random() < metadata.successRate;
      
      return {
        success,
        agentName: metadata.name,
        executionTime,
        data: { 
          task: context.task,
          processed: true,
          timestamp: Date.now()
        },
        output: `Mock ${metadata.name} processed: ${context.task}`,
        confidence: success ? 0.8 : 0.3,
        tokensUsed: 100
      };
    },

    // 验证方法（可选）
    validateInput(input: any): ValidationResult {
      return {
        valid: true,
        errors: []
      };
    },

    // 健康检查
    async healthCheck(): Promise<boolean> {
      return metadata.status !== AgentStatus.DISABLED;
    },

    // 配置管理
    async configure(config: Record<string, any>): Promise<void> {
      // 模拟配置
      Object.assign(metadata, config);
    },

    // 元数据获取
    getMetadata(): AgentMetadata {
      return metadata;
    }
  };

  return agent;
}

// 错误分类函数（用于错误处理测试）
export function categorizeTestError(error: Error | TestAgentError | string, agentName: string): TestAgentError {
  if (typeof error === 'string') {
    return createTestAgentError(
      'UNKNOWN_ERROR',
      error,
      AgentErrorType.UNKNOWN_ERROR,
      agentName,
      false
    );
  }

  if ('type' in error && error.type) {
    // 已经是TestAgentError
    return error as TestAgentError;
  }

  // 根据错误类型分类
  if (error.name === 'ValidationError') {
    return createTestAgentError(
      'VALIDATION_FAILED',
      error.message,
      AgentErrorType.VALIDATION_ERROR,
      agentName,
      true,
      { originalError: error.name }
    );
  }

  if (error.name === 'TimeoutError') {
    return createTestAgentError(
      'EXECUTION_TIMEOUT',
      error.message,
      AgentErrorType.TIMEOUT_ERROR,
      agentName,
      true,
      { originalError: error.name }
    );
  }

  // 优先检查具体的关键词，确保正确分类
  if (error.message.includes('Network connection failed')) {
    return createTestAgentError(
      'NETWORK_FAILURE',
      error.message,
      AgentErrorType.NETWORK_ERROR,
      agentName,
      true,
      { originalError: error.name }
    );
  }

  if (error.message.includes('Database connection lost')) {
    return createTestAgentError(
      'DATABASE_ERROR',
      error.message,
      AgentErrorType.DATABASE_ERROR,
      agentName,
      true,
      { originalError: error.name }
    );
  }

  if (error.message.includes('Permission denied')) {
    return createTestAgentError(
      'PERMISSION_DENIED',
      error.message,
      AgentErrorType.PERMISSION_ERROR,
      agentName,
      false,
      { originalError: error.name }
    );
  }

  if (error.message.includes('Rate limit exceeded')) {
    return createTestAgentError(
      'RATE_LIMIT_EXCEEDED',
      error.message,
      AgentErrorType.RATE_LIMIT_ERROR,
      agentName,
      true,
      { originalError: error.name }
    );
  }

  if (error.message.includes('Invalid input data')) {
    return createTestAgentError(
      'VALIDATION_FAILED',
      error.message,
      AgentErrorType.VALIDATION_ERROR,
      agentName,
      true,
      { originalError: error.name }
    );
  }

  // 默认为执行错误
  return createTestAgentError(
    'EXECUTION_FAILED',
    error.message,
    AgentErrorType.EXECUTION_ERROR,
    agentName,
    true,
    { originalError: error.name, originalStack: error.stack }
  );
}
