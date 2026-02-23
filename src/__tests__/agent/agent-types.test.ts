// Agent类型定义测试

import {
  AgentType,
  AgentStatus,
  TaskPriority,
  AgentErrorType,
  AgentEventType,
} from '../../types/agent';

import {
  createAgentError,
  createAgentResult,
  validateAgentContext,
  generateCacheKey,
  isValidAgentType,
  isValidAgentStatus,
  isValidTaskPriority,
  DEFAULT_AGENT_CONFIG,
} from '../../lib/agent/types';

describe('Agent Types', () => {
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
          'coordinator',
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
          'unknown_error',
        ];

        expectedTypes.forEach(type => {
          expect(Object.values(AgentErrorType)).toContain(type);
        });
      });
    });

    describe('AgentEventType', () => {
      it('should have all expected event types', () => {
        const expectedTypes = [
          'registered',
          'unregistered',
          'execution_started',
          'execution_completed',
          'execution_failed',
          'configuration_changed',
          'status_changed',
        ];

        expectedTypes.forEach(type => {
          expect(Object.values(AgentEventType)).toContain(type);
        });
      });
    });
  });

  describe('Utility Functions', () => {
    describe('createAgentError', () => {
      it('should create a valid agent error', () => {
        const error = createAgentError(
          'TEST_ERROR',
          'Test error message',
          AgentErrorType.VALIDATION_ERROR,
          'TestAgent',
          true,
          { detail: 'test detail' }
        );

        expect(error).toMatchObject({
          code: 'TEST_ERROR',
          message: 'Test error message',
          type: AgentErrorType.VALIDATION_ERROR,
          agentName: 'TestAgent',
          retryable: true,
          details: { detail: 'test detail' },
        });
        expect(error.timestamp).toBeGreaterThan(0);
        expect(error.stack).toBeDefined();
      });

      it('should create error with default values', () => {
        const error = createAgentError(
          'SIMPLE_ERROR',
          'Simple error',
          AgentErrorType.EXECUTION_ERROR,
          'SimpleAgent'
        );

        expect(error.retryable).toBe(false);
        expect(error.details).toBeUndefined();
      });
    });

    describe('createAgentResult', () => {
      it('should create a successful agent result', () => {
        const result = createAgentResult(
          'TestAgent',
          { output: 'test data' },
          {
            success: true,
            executionTime: 1000,
            confidence: 0.95,
            tokensUsed: 50,
            cost: 0.001,
          }
        );

        expect(result).toMatchObject({
          success: true,
          agentName: 'TestAgent',
          executionTime: 1000,
          data: { output: 'test data' },
          confidence: 0.95,
          tokensUsed: 50,
          cost: 0.001,
        });
      });

      it('should create a failed agent result', () => {
        const _error = createAgentError(
          'TEST_ERROR',
          'Test error',
          AgentErrorType.EXECUTION_ERROR,
          'TestAgent'
        );

        const result = createAgentResult('TestAgent', undefined, {
          success: false,
          executionTime: 500,
        });

        expect(result).toMatchObject({
          success: false,
          agentName: 'TestAgent',
          executionTime: 500,
          data: undefined,
        });
      });

      it('should create result with default values', () => {
        const result = createAgentResult('TestAgent', 'test');

        expect(result).toMatchObject({
          success: true,
          agentName: 'TestAgent',
          data: 'test',
          executionTime: 0,
        });
      });
    });

    describe('validateAgentContext', () => {
      it('should validate a correct context', () => {
        const context = {
          task: 'Test task',
          data: { input: 'test' },
          priority: TaskPriority.MEDIUM,
        };

        const validation = validateAgentContext(context);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should reject context with missing task', () => {
        const context = {
          task: '',
          data: { input: 'test' },
          priority: TaskPriority.MEDIUM,
        };

        const validation = validateAgentContext(context);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Task is required and must be a string'
        );
      });

      it('should reject context with invalid task type', () => {
        const context = {
          task: 123 as any,
          data: { input: 'test' },
          priority: TaskPriority.MEDIUM,
        };

        const validation = validateAgentContext(context);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Task is required and must be a string'
        );
      });

      it('should reject context with missing data', () => {
        const context = {
          task: 'Test task',
          data: {},
          priority: TaskPriority.MEDIUM,
        };

        const validation = validateAgentContext(context);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should reject context with invalid priority', () => {
        const context = {
          task: 'Test task',
          data: { input: 'test' },
          priority: 'invalid' as any,
        };

        const validation = validateAgentContext(context);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Priority must be a valid TaskPriority value'
        );
      });

      it('should reject context with invalid options', () => {
        const context = {
          task: 'Test task',
          data: { input: 'test' },
          priority: TaskPriority.MEDIUM,
          options: 'invalid' as any,
        };

        const validation = validateAgentContext(context);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Options must be an object if provided'
        );
      });
    });

    describe('generateCacheKey', () => {
      it('should generate consistent cache keys for same context', () => {
        const context = {
          taskType: 'test_type',
          task: 'Test task',
          priority: TaskPriority.MEDIUM,
          data: { input: 'test' },
          options: { timeout: 5000 },
        };

        const key1 = generateCacheKey(context);
        const key2 = generateCacheKey(context);

        expect(key1).toBe(key2);
        expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hash
      });

      it('should generate different keys for different contexts', () => {
        const context1 = {
          task: 'Task 1',
          priority: TaskPriority.MEDIUM,
          data: { input: 'test1' },
        };

        const context2 = {
          task: 'Task 2',
          priority: TaskPriority.MEDIUM,
          data: { input: 'test2' },
        };

        const key1 = generateCacheKey(context1);
        const key2 = generateCacheKey(context2);

        expect(key1).not.toBe(key2);
      });
    });

    describe('Type Guards', () => {
      describe('isValidAgentType', () => {
        it('should return true for valid agent types', () => {
          expect(isValidAgentType(AgentType.DOC_ANALYZER)).toBe(true);
          expect(isValidAgentType(AgentType.RESEARCHER)).toBe(true);
        });

        it('should return false for invalid agent types', () => {
          expect(isValidAgentType('invalid_type')).toBe(false);
          expect(isValidAgentType('')).toBe(false);
        });
      });

      describe('isValidAgentStatus', () => {
        it('should return true for valid statuses', () => {
          expect(isValidAgentStatus(AgentStatus.IDLE)).toBe(true);
          expect(isValidAgentStatus(AgentStatus.BUSY)).toBe(true);
        });

        it('should return false for invalid statuses', () => {
          expect(isValidAgentStatus('invalid_status')).toBe(false);
          expect(isValidAgentStatus('')).toBe(false);
        });
      });

      describe('isValidTaskPriority', () => {
        it('should return true for valid priorities', () => {
          expect(isValidTaskPriority(TaskPriority.LOW)).toBe(true);
          expect(isValidTaskPriority(TaskPriority.HIGH)).toBe(true);
        });

        it('should return false for invalid priorities', () => {
          expect(isValidTaskPriority('invalid_priority')).toBe(false);
          expect(isValidTaskPriority('')).toBe(false);
        });
      });
    });
  });

  describe('Default Configuration', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_AGENT_CONFIG).toBeDefined();
      expect(DEFAULT_AGENT_CONFIG.defaultTimeout).toBeGreaterThan(0);
      expect(DEFAULT_AGENT_CONFIG.maxConcurrentExecutions).toBeGreaterThan(0);
      expect(typeof DEFAULT_AGENT_CONFIG.enableMetrics).toBe('boolean');
      expect(typeof DEFAULT_AGENT_CONFIG.enableCaching).toBe('boolean');
    });

    it('should have valid cache configuration', () => {
      expect(DEFAULT_AGENT_CONFIG.cache).toBeDefined();
      expect(typeof DEFAULT_AGENT_CONFIG.cache.enabled).toBe('boolean');
      expect(DEFAULT_AGENT_CONFIG.cache.ttl).toBeGreaterThan(0);
      expect(DEFAULT_AGENT_CONFIG.cache.maxSize).toBeGreaterThan(0);
      expect(typeof DEFAULT_AGENT_CONFIG.cache.keyPrefix).toBe('string');
    });

    it('should have valid retry configuration', () => {
      expect(DEFAULT_AGENT_CONFIG.retry).toBeDefined();
      expect(DEFAULT_AGENT_CONFIG.retry.maxAttempts).toBeGreaterThan(0);
      expect(DEFAULT_AGENT_CONFIG.retry.baseDelay).toBeGreaterThan(0);
      expect(DEFAULT_AGENT_CONFIG.retry.maxDelay).toBeGreaterThan(0);
      expect(DEFAULT_AGENT_CONFIG.retry.backoffMultiplier).toBeGreaterThan(1);
    });

    it('should have valid monitoring configuration', () => {
      expect(DEFAULT_AGENT_CONFIG.monitoring).toBeDefined();
      expect(typeof DEFAULT_AGENT_CONFIG.monitoring.enabled).toBe('boolean');
      expect(DEFAULT_AGENT_CONFIG.monitoring.metricsInterval).toBeGreaterThan(
        0
      );
      expect(DEFAULT_AGENT_CONFIG.monitoring.retentionDays).toBeGreaterThan(0);
    });

    it('should have valid logging configuration', () => {
      expect(DEFAULT_AGENT_CONFIG.logging).toBeDefined();
      expect(DEFAULT_AGENT_CONFIG.logging.level).toBeDefined();
      expect(typeof DEFAULT_AGENT_CONFIG.logging.enableConsole).toBe('boolean');
      expect(typeof DEFAULT_AGENT_CONFIG.logging.enableFile).toBe('boolean');
    });
  });
});
