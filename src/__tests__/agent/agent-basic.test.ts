// Agent基础功能测试

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
  validateTestAgentContext,
  isValidTestAgentType,
  isValidTestAgentStatus,
  isValidTestTaskPriority,
  type TestAgentError
} from './test-utils';


describe('Agent Basic Functionality', () => {
  describe('Enums', () => {
    describe('AgentType', () => {
      it('should have all expected agent types', () => {
        const expectedTypes = [
          'doc_analyzer',
          'evidence_analyzer',
          'researcher',
          'strategist',
          'writer',
          'reviewer',
          'scheduler',
          'reporter',
          'summarizer',
          'coordinator'
        ];

        expectedTypes.forEach(type => {
          expect(Object.values(AgentType)).toContain(type);
        });
      });

      it('should have unique values', () => {
        const values = Object.values(AgentType);
        const uniqueValues = [...new Set(values)];
        expect(values).toHaveLength(uniqueValues.length);
      });
    });

    describe('AgentStatus', () => {
      it('should have all expected statuses', () => {
        const expectedStatuses = ['idle', 'busy', 'error', 'disabled'];

        expectedStatuses.forEach(status => {
          expect(Object.values(AgentStatus)).toContain(status);
        });
      });
    });

    describe('TaskPriority', () => {
      it('should have all expected priorities', () => {
        const expectedPriorities = ['low', 'medium', 'high', 'urgent'];

        expectedPriorities.forEach(priority => {
          expect(Object.values(TaskPriority)).toContain(priority);
        });
      });
    });

    describe('AgentErrorType', () => {
      it('should have all expected error types', () => {
        const expectedTypes = [
          'validation_error',
          'execution_error',
          'timeout_error',
          'network_error',
          'ai_service_error',
          'database_error',
          'configuration_error',
          'permission_error',
          'rate_limit_error',
          'unknown_error'
        ];

        expectedTypes.forEach(type => {
          expect(Object.values(AgentErrorType)).toContain(type);
        });
      });
    });
  });

  describe('Utility Functions', () => {
    describe('createTestAgentError', () => {
      it('should create a valid agent error', () => {
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

      it('should create error with default values', () => {
        const error = createTestAgentError(
          'SIMPLE_ERROR',
          'Simple error',
          AgentErrorType.EXECUTION_ERROR,
          'SimpleAgent'
        );

        expect(error.retryable).toBe(false);
        expect(error.details).toBeUndefined();
      });
    });

    describe('createTestAgentResult', () => {
      it('should create a successful agent result', () => {
        const result = createTestAgentResult(
          'TestAgent',
          { output: 'test data' },
          {
            success: true,
            executionTime: 1000,
            confidence: 0.95,
            tokensUsed: 50,
            cost: 0.001
          }
        );

        expect(result).toMatchObject({
          success: true,
          agentName: 'TestAgent',
          executionTime: 1000,
          data: { output: 'test data' },
          confidence: 0.95,
          tokensUsed: 50,
          cost: 0.001
        });
      });

      it('should create result with default values', () => {
        const result = createTestAgentResult('TestAgent', 'test');

        expect(result).toMatchObject({
          success: true,
          agentName: 'TestAgent',
          data: 'test',
          executionTime: 0
        });
      });
    });

    describe('validateTestAgentContext', () => {
      it('should validate a correct context', () => {
        const context = {
          task: 'Test task',
          data: { input: 'test' },
          priority: TaskPriority.MEDIUM
        };

        const validation = validateTestAgentContext(context);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should reject context with missing task', () => {
        const context = {
          task: '',
          data: { input: 'test' },
          priority: TaskPriority.MEDIUM
        };

        const validation = validateTestAgentContext(context);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Task is required and must be a string');
      });

      it('should reject context with invalid priority', () => {
        const context = {
          task: 'Test task',
          data: { input: 'test' },
          priority: 'invalid' as any
        };

        const validation = validateTestAgentContext(context);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Priority must be a valid TaskPriority value');
      });
    });

    describe('Type Guards', () => {
      describe('isValidTestAgentType', () => {
        it('should return true for valid agent types', () => {
          expect(isValidTestAgentType(AgentType.DOC_ANALYZER)).toBe(true);
          expect(isValidTestAgentType(AgentType.RESEARCHER)).toBe(true);
        });

        it('should return false for invalid agent types', () => {
          expect(isValidTestAgentType('invalid_type')).toBe(false);
          expect(isValidTestAgentType('')).toBe(false);
        });
      });

      describe('isValidTestAgentStatus', () => {
        it('should return true for valid statuses', () => {
          expect(isValidTestAgentStatus(AgentStatus.IDLE)).toBe(true);
          expect(isValidTestAgentStatus(AgentStatus.BUSY)).toBe(true);
        });

        it('should return false for invalid statuses', () => {
          expect(isValidTestAgentStatus('invalid_status')).toBe(false);
          expect(isValidTestAgentStatus('')).toBe(false);
        });
      });

      describe('isValidTestTaskPriority', () => {
        it('should return true for valid priorities', () => {
          expect(isValidTestTaskPriority(TaskPriority.LOW)).toBe(true);
          expect(isValidTestTaskPriority(TaskPriority.HIGH)).toBe(true);
        });

        it('should return false for invalid priorities', () => {
          expect(isValidTestTaskPriority('invalid_priority')).toBe(false);
          expect(isValidTestTaskPriority('')).toBe(false);
        });
      });
    });
  });
});
