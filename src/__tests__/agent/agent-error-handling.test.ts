// Agent错误处理机制测试

// 导入共享的测试工具和类型
import {
  AgentType,
  AgentStatus,
  TaskPriority,
  AgentErrorType,
  type AgentContext,
  type AgentError,
  type AgentResult,
  createTestAgentError,
  createTestAgentResult,
  categorizeTestError,
  type TestAgentError
} from './test-utils';


// 重试机制
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  agentName: string,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const agentError = categorizeTestError(lastError, agentName);
      
      if (!agentError.retryable || attempt === maxAttempts) {
        throw agentError;
      }
      
      const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// 测试用的Mock Agent
class ErrorProneAgent {
  readonly name: string;
  readonly type: AgentType;
  readonly version: string;
  readonly description: string;
  private errorType: string;

  constructor(
    name: string,
    type: AgentType,
    errorType: string = 'none'
  ) {
    this.name = name;
    this.type = type;
    this.version = '1.0.0';
    this.description = 'Error-prone agent for testing';
    this.errorType = errorType;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    switch (this.errorType) {
      case 'validation':
        throw new Error('Invalid input data');
      
      case 'timeout':
        const timeoutError = new Error('Operation timed out');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      
      case 'network':
        throw new Error('Network connection failed');
      
      case 'database':
        throw new Error('Database connection lost');
      
      case 'permission':
        throw new Error('Permission denied');
      
      case 'rate_limit':
        throw new Error('Rate limit exceeded');
      
      case 'success':
        return createTestAgentResult(this.name, { success: true }, {
          success: true,
          executionTime: 100
        });
      
      default:
        throw new Error('Unknown error occurred');
    }
  }
}

describe('Agent Error Handling', () => {
  describe('Error Creation', () => {
    it('should create a basic agent error', () => {
      const error = createTestAgentError(
        'TEST_ERROR',
        'Test error message',
        AgentErrorType.VALIDATION_ERROR,
        'TestAgent',
        true,
        { detail: 'test detail' }
      );

      expect(error).toMatchObject({
        name: 'AgentError',
        code: 'TEST_ERROR',
        message: 'Test error message',
        type: AgentErrorType.VALIDATION_ERROR,
        agentName: 'TestAgent',
        retryable: true,
        details: { detail: 'test detail' }
      });
      expect(error.timestamp).toBeGreaterThan(0);
      expect(error.stack).toBeDefined();
    });

    it('should create agent result with error', () => {
      const error = createTestAgentError(
        'EXECUTION_ERROR',
        'Execution failed',
        AgentErrorType.EXECUTION_ERROR,
        'TestAgent'
      );

      const result = createTestAgentResult('TestAgent', undefined, {
        success: false,
        executionTime: 500,
        error
      });

      expect(result).toMatchObject({
        success: false,
        agentName: 'TestAgent',
        executionTime: 500,
        error
      });
    });
  });

  describe('Error Categorization', () => {
    it('should categorize string error as unknown error', () => {
      const error = categorizeTestError('Simple error message', 'TestAgent');
      
      expect(error.type).toBe(AgentErrorType.UNKNOWN_ERROR);
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.message).toBe('Simple error message');
      expect(error.retryable).toBe(false);
    });

    it('should categorize validation error', () => {
      const validationError = new Error('Invalid input');
      validationError.name = 'ValidationError';
      
      const error = categorizeTestError(validationError, 'TestAgent');
      
      expect(error.type).toBe(AgentErrorType.VALIDATION_ERROR);
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.retryable).toBe(true);
      expect(error.details?.originalError).toBe('ValidationError');
    });

    it('should categorize timeout error', () => {
      const timeoutError = new Error('Operation timed out');
      timeoutError.name = 'TimeoutError';
      
      const error = categorizeTestError(timeoutError, 'TestAgent');
      
      expect(error.type).toBe(AgentErrorType.TIMEOUT_ERROR);
      expect(error.code).toBe('EXECUTION_TIMEOUT');
      expect(error.retryable).toBe(true);
    });

    it('should categorize network error', () => {
      const networkError = new Error('Network connection failed');
      
      const error = categorizeTestError(networkError, 'TestAgent');
      
      expect(error.type).toBe(AgentErrorType.NETWORK_ERROR);
      expect(error.code).toBe('NETWORK_FAILURE');
      expect(error.retryable).toBe(true);
    });

    it('should categorize database error', () => {
      const dbError = new Error('Database connection lost');
      
      const error = categorizeTestError(dbError, 'TestAgent');
      
      expect(error.type).toBe(AgentErrorType.DATABASE_ERROR);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should categorize permission error', () => {
      const permError = new Error('Permission denied');
      
      const error = categorizeTestError(permError, 'TestAgent');
      
      expect(error.type).toBe(AgentErrorType.PERMISSION_ERROR);
      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.retryable).toBe(false);
    });

    it('should categorize rate limit error', () => {
      const rateLimitError = new Error('Rate limit exceeded');
      
      const error = categorizeTestError(rateLimitError, 'TestAgent');
      
      expect(error.type).toBe(AgentErrorType.RATE_LIMIT_ERROR);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryable).toBe(true);
    });

    it('should pass through existing AgentError', () => {
      const existingError = createTestAgentError(
        'EXISTING_ERROR',
        'Existing error',
        AgentErrorType.EXECUTION_ERROR,
        'TestAgent'
      );
      
      const error = categorizeTestError(existingError, 'TestAgent');
      
      expect(error).toBe(existingError);
    });
  });

  describe('Retry Mechanism', () => {
    it('should succeed on first attempt', async () => {
      const agent = new ErrorProneAgent('TestAgent', AgentType.DOC_ANALYZER, 'success');
      
      const result = await executeWithRetry(
        () => agent.execute({ task: 'test', priority: TaskPriority.MEDIUM, data: {} }),
        'TestAgent'
      );
      
      expect(result.success).toBe(true);
    });

    it('should retry retryable errors', async () => {
      let attempts = 0;
      const agent = new ErrorProneAgent('TestAgent', AgentType.DOC_ANALYZER, 'network');
      
      const mockExecute = jest.spyOn(agent, 'execute')
        .mockImplementation(() => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Network connection failed');
          }
          return Promise.resolve(createTestAgentResult('TestAgent', { success: true }, {
            success: true,
            executionTime: 100
          }));
        });

      const result = await executeWithRetry(
        () => agent.execute({ task: 'test', priority: TaskPriority.MEDIUM, data: {} }),
        'TestAgent',
        3,
        10 // Short delay for testing
      );
      
      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
      mockExecute.mockRestore();
    });

    it('should not retry non-retryable errors', async () => {
      const agent = new ErrorProneAgent('TestAgent', AgentType.DOC_ANALYZER, 'permission');
      
      await expect(
        executeWithRetry(
          () => agent.execute({ task: 'test', priority: TaskPriority.MEDIUM, data: {} }),
          'TestAgent',
          3,
          10
        )
      ).rejects.toMatchObject({
        type: AgentErrorType.PERMISSION_ERROR,
        retryable: false
      });
    });

    it('should fail after max attempts', async () => {
      const agent = new ErrorProneAgent('TestAgent', AgentType.DOC_ANALYZER, 'network');
      
      await expect(
        executeWithRetry(
          () => agent.execute({ task: 'test', priority: TaskPriority.MEDIUM, data: {} }),
          'TestAgent',
          2,
          10
        )
      ).rejects.toMatchObject({
        type: AgentErrorType.NETWORK_ERROR,
        retryable: true
      });
    });
  });

  describe('Agent Error Handling Integration', () => {
    it('should handle validation errors gracefully', async () => {
      const agent = new ErrorProneAgent('TestAgent', AgentType.DOC_ANALYZER, 'validation');
      
      let result: AgentResult;
      try {
        result = await agent.execute({ task: 'test', priority: TaskPriority.MEDIUM, data: {} });
      } catch (error) {
        const agentError = categorizeTestError(error as Error, agent.name);
        result = createTestAgentResult(agent.name, undefined, {
          success: false,
          executionTime: 100,
          error: agentError
        });
      }
      
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(AgentErrorType.VALIDATION_ERROR);
    });

    it('should handle timeout errors gracefully', async () => {
      const agent = new ErrorProneAgent('TestAgent', AgentType.DOC_ANALYZER, 'timeout');
      
      let result: AgentResult;
      try {
        result = await agent.execute({ task: 'test', priority: TaskPriority.MEDIUM, data: {} });
      } catch (error) {
        const agentError = categorizeTestError(error as Error, agent.name);
        result = createTestAgentResult(agent.name, undefined, {
          success: false,
          executionTime: 5000,
          error: agentError
        });
      }
      
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(AgentErrorType.TIMEOUT_ERROR);
    });

    it('should provide detailed error information', async () => {
      const agent = new ErrorProneAgent('TestAgent', AgentType.DOC_ANALYZER, 'database');
      
      let result: AgentResult;
      try {
        result = await agent.execute({ task: 'test', priority: TaskPriority.MEDIUM, data: {} });
      } catch (error) {
        const agentError = categorizeTestError(error as Error, agent.name);
        result = createTestAgentResult(agent.name, undefined, {
          success: false,
          executionTime: 200,
          error: agentError
        });
      }
      
      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({
        name: 'AgentError',
        code: 'DATABASE_ERROR',
        type: AgentErrorType.DATABASE_ERROR,
        agentName: 'TestAgent',
        retryable: true,
        details: {
          originalError: 'Error'
        }
      });
      expect(result.error?.timestamp).toBeGreaterThan(0);
      expect(result.error?.stack).toBeDefined();
    });
  });
});
