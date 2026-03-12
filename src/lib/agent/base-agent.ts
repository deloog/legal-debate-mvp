// Agent基础抽象类

import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentMetadata,
} from '../../types/agent';

import {
  AgentType,
  AgentStatus,
  AgentErrorType,
  AgentError,
} from '../../types/agent';

import {
  AgentExecutionState,
  AgentLogEntry,
  AgentLogLevel,
  createAgentError,
  createAgentResult,
  validateAgentContext,
  DEFAULT_AGENT_CONFIG,
} from './types';

import {
  FaultTolerantExecutor,
  type AgentFaultToleranceConfig,
} from './fault-tolerance';
import { ErrorLogger } from '../error/error-logger';
import { CircuitBreakerManager } from '../error/circuit-breaker';
import { logger as appLogger } from '@/lib/logger';

// =============================================================================
// BaseAgent抽象类
// =============================================================================

export abstract class BaseAgent implements Agent {
  // 基本信息（由子类实现）
  public abstract readonly name: string;
  public abstract readonly type: AgentType;
  public abstract readonly version: string;
  public abstract readonly description: string;

  // 内部状态
  protected status: AgentStatus = AgentStatus.IDLE;
  protected currentState?: AgentExecutionState;
  protected config: Record<string, unknown> = {};
  protected logger: (entry: AgentLogEntry) => void;

  // 容错执行器（可选）
  protected faultTolerantExecutor?: FaultTolerantExecutor;
  protected faultToleranceEnabled: boolean = false;

  // 统计信息
  protected stats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalExecutionTime: 0,
    totalTokensUsed: 0,
    totalCost: 0,
  };

  constructor(
    logger?: (entry: AgentLogEntry) => void,
    initialConfig?: Record<string, unknown>,
    faultToleranceConfig?: AgentFaultToleranceConfig
  ) {
    this.logger = logger || this.defaultLogger;
    this.config = { ...initialConfig };

    // 初始化容错执行器
    if (faultToleranceConfig) {
      const errorLogger = new ErrorLogger();
      const circuitBreakerManager = new CircuitBreakerManager();
      this.faultTolerantExecutor = new FaultTolerantExecutor(
        errorLogger,
        circuitBreakerManager
      );
      this.faultToleranceEnabled = true;
    }
  }

  // =============================================================================
  // 核心执行方法（由子类实现）
  // =============================================================================

  /**
   * 执行具体的Agent逻辑（由子类实现）
   */
  protected abstract executeLogic(context: AgentContext): Promise<unknown>;

  // =============================================================================
  // 生命周期方法
  // =============================================================================

  /**
   * Agent初始化
   */
  async initialize(): Promise<void> {
    this.log(AgentLogLevel.INFO, 'Agent initialized', {
      name: this.name,
      type: this.type,
      version: this.version,
    });
  }

  /**
   * Agent清理
   */
  async cleanup(): Promise<void> {
    this.log(AgentLogLevel.INFO, 'Agent cleaned up', { name: this.name });
    this.status = AgentStatus.IDLE;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    return this.status !== AgentStatus.ERROR;
  }

  /**
   * 配置更新
   */
  async configure(config: Record<string, unknown>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.log(AgentLogLevel.INFO, 'Agent configuration updated', {
      name: this.name,
      config: this.config,
    });
  }

  // =============================================================================
  // 主要执行方法
  // =============================================================================

  /**
   * 执行Agent任务
   */
  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 验证上下文
      const validation = validateAgentContext(context);
      if (!validation.valid) {
        const error = createAgentError(
          'INVALID_CONTEXT',
          `Invalid agent context: ${validation.errors.join(', ')}`,
          AgentErrorType.VALIDATION_ERROR,
          this.name,
          false
        );
        return createAgentResult(this.name, undefined, {
          success: false,
          executionTime: Date.now() - startTime,
          error: error,
        });
      }

      // 设置执行状态
      this.status = AgentStatus.BUSY;
      this.currentState = {
        agentName: this.name,
        status: this.status,
        startTime,
        context,
      };

      this.log(AgentLogLevel.INFO, 'Agent execution started', {
        task: context.task,
        priority: context.priority,
      });

      // 执行逻辑（支持容错）
      let result: unknown;
      if (this.faultToleranceEnabled && this.faultTolerantExecutor) {
        // 使用容错执行器包装executeLogic
        const faultTolerantResult = await this.faultTolerantExecutor.execute(
          this.name,
          () => this.executeLogic(context),
          this.getFaultToleranceConfig(),
          context
        );

        result = faultTolerantResult.result;

        // 记录容错相关信息
        if (faultTolerantResult.faultResult.fallbackUsed) {
          this.log(AgentLogLevel.WARN, 'Fallback strategy used', {
            fallbackType: faultTolerantResult.faultResult.fallbackType,
            attempts: faultTolerantResult.faultResult.totalAttempts,
          });
        }
      } else {
        // 直接执行逻辑（原有方式）
        result = await this.executeLogic(context);
      }

      const executionTime = Date.now() - startTime;

      // 更新统计
      this.updateStats(executionTime, true);

      // 创建成功结果
      const agentResult = createAgentResult(this.name, result, {
        success: true,
        executionTime,
        output:
          result && typeof result === 'object' && 'output' in result
            ? String((result as { output: unknown }).output)
            : undefined, // 传递output字段
        context: {
          inputSummary: this.summarizeInput(context),
          processingSteps: this.getProcessingSteps(),
          // 从result中提取warnings（如果存在）- 增强调试
          warnings: (() => {
            appLogger.info('[DEBUG] BaseAgent.execute 开始提取warnings', {
              resultType: typeof result,
              hasMetadata:
                result && typeof result === 'object' && 'metadata' in result,
            });

            if (!result || typeof result !== 'object') return [];
            const res = result as Record<string, unknown>;

            if (!res.metadata || typeof res.metadata !== 'object') {
              appLogger.warn('[WARNING] metadata不存在或不是对象');
              return [];
            }

            const metadata = res.metadata as Record<string, unknown>;
            if (!Array.isArray(metadata.warnings)) {
              appLogger.warn('[WARNING] metadata.warnings不是数组', {
                warnings: metadata.warnings,
              });
              return [];
            }

            appLogger.info('[DEBUG] 提取到warnings', {
              count: metadata.warnings.length,
              warnings: metadata.warnings,
            });
            return metadata.warnings as string[];
          })(),
        },
      });

      this.status = AgentStatus.IDLE;
      this.log(AgentLogLevel.INFO, 'Agent execution completed', {
        executionTime,
        tokensUsed: agentResult.tokensUsed,
      });

      return agentResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // 更新统计
      this.updateStats(executionTime, false);

      // 创建错误
      const agentError = this.createErrorFromException(error);

      this.status = AgentStatus.ERROR;
      this.log(AgentLogLevel.ERROR, 'Agent execution failed', {
        error: agentError.message,
        executionTime,
      });

      // 抛出异常而不是返回错误结果
      throw error;
    }
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  /**
   * 记录日志
   */
  protected log(
    level: AgentLogLevel,
    message: string,
    data?: unknown,
    error?: Error
  ): void {
    const entry: AgentLogEntry = {
      level,
      timestamp: Date.now(),
      agentName: this.name,
      message,
      data,
      error,
    };
    this.logger(entry);
  }

  /**
   * 从异常创建Agent错误
   */
  protected createErrorFromException(error: unknown): AgentError {
    if (error && typeof error === 'object' && 'code' in error) {
      const errorObj = error as { code: string; message?: string };
      return createAgentError(
        errorObj.code,
        errorObj.message || 'Unknown error',
        this.mapErrorType(errorObj.code),
        this.name,
        this.isRetryableError(errorObj.code),
        { originalError: error }
      );
    }

    const errorMessage =
      error && typeof error === 'object' && 'message' in error
        ? (error as { message: string }).message
        : 'Unknown execution error';

    return createAgentError(
      'EXECUTION_ERROR',
      errorMessage,
      AgentErrorType.EXECUTION_ERROR,
      this.name,
      true,
      { originalError: error }
    );
  }

  /**
   * 映射错误类型
   */
  protected mapErrorType(code: string): AgentErrorType {
    const codeLower = code.toLowerCase();

    if (codeLower.includes('timeout')) return AgentErrorType.TIMEOUT_ERROR;
    if (codeLower.includes('network')) return AgentErrorType.NETWORK_ERROR;
    if (codeLower.includes('rate_limit'))
      return AgentErrorType.RATE_LIMIT_ERROR;
    if (codeLower.includes('permission'))
      return AgentErrorType.PERMISSION_ERROR;
    if (codeLower.includes('validation'))
      return AgentErrorType.VALIDATION_ERROR;

    return AgentErrorType.EXECUTION_ERROR;
  }

  /**
   * 判断是否为可重试错误
   */
  protected isRetryableError(code: string): boolean {
    const retryableCodes = [
      'TIMEOUT_ERROR',
      'NETWORK_ERROR',
      'RATE_LIMIT_ERROR',
      'AI_SERVICE_ERROR',
    ];
    return retryableCodes.some(rc =>
      code.toLowerCase().includes(rc.toLowerCase())
    );
  }

  /**
   * 更新统计信息
   */
  protected updateStats(executionTime: number, success: boolean): void {
    this.stats.totalExecutions++;
    this.stats.totalExecutionTime += executionTime;

    if (success) {
      this.stats.successfulExecutions++;
    } else {
      this.stats.failedExecutions++;
    }
  }

  /**
   * 摘要输入数据
   */
  protected summarizeInput(context: AgentContext): string {
    const data = context.data;
    const dataStr = JSON.stringify(data);
    if (typeof data === 'string') {
      return dataStr.length > 100 ? dataStr.substring(0, 100) + '...' : dataStr;
    }
    return dataStr.length > 100 ? dataStr.substring(0, 100) + '...' : dataStr;
  }

  /**
   * 获取处理步骤（由子类重写）
   */
  protected getProcessingSteps(): string[] {
    if (this.faultToleranceEnabled) {
      return [
        'Input validation',
        'Circuit breaker check',
        'Core logic execution with retry',
        'Fallback if needed',
        'Result formatting',
      ];
    }
    return ['Input validation', 'Core logic execution', 'Result formatting'];
  }

  /**
   * 获取Agent特定的容错配置（由子类重写）
   * 如果不重写，返回默认配置
   */
  protected getFaultToleranceConfig(): AgentFaultToleranceConfig {
    // 默认配置：禁用容错（向后兼容）
    return {
      retry: {
        maxRetries: 0,
        backoffMs: [],
        retryableErrors: [],
      },
      fallback: {
        enabled: false,
        fallbackType: 'SIMPLE',
      },
      circuitBreaker: {
        enabled: false,
        failureThreshold: 5,
        timeout: 60000,
        halfOpenRequests: 3,
      },
    };
  }

  /**
   * 默认日志记录器
   */
  private defaultLogger = (entry: AgentLogEntry): void => {
    const level = entry.level.toUpperCase();
    const timestamp = new Date(entry.timestamp).toISOString();
    const message = `[${timestamp}] [${level}] [${entry.agentName}] ${entry.message}`;

    if (DEFAULT_AGENT_CONFIG.logging.enableConsole) {
      switch (entry.level) {
        case AgentLogLevel.DEBUG:
        case AgentLogLevel.INFO:
          appLogger.info(message, entry.data || '');
          break;
        case AgentLogLevel.WARN:
          appLogger.warn(message, entry.data || '');
          break;
        case AgentLogLevel.ERROR:
          appLogger.error(message, entry.error || entry.data || '');
          break;
      }
    }
  };

  // =============================================================================
  // 统计和元数据方法
  // =============================================================================

  /**
   * 获取Agent元数据
   */
  getMetadata(): AgentMetadata {
    return {
      name: this.name,
      type: this.type,
      version: this.version,
      description: this.description,
      capabilities: this.getCapabilities(),
      supportedTasks: this.getSupportedTasks(),
      dependencies: this.getDependencies(),
      averageExecutionTime:
        this.stats.totalExecutions > 0
          ? this.stats.totalExecutionTime / this.stats.totalExecutions
          : 0,
      successRate:
        this.stats.totalExecutions > 0
          ? this.stats.successfulExecutions / this.stats.totalExecutions
          : 0,
      requiredConfig: this.getRequiredConfig(),
      optionalConfig: this.getOptionalConfig(),
      status: this.status,
      lastUsed: this.currentState?.startTime,
      totalExecutions: this.stats.totalExecutions,
    };
  }

  /**
   * 获取能力列表（由子类实现）
   */
  protected abstract getCapabilities(): string[];

  /**
   * 获取支持的任务列表（由子类实现）
   */
  protected abstract getSupportedTasks(): string[];

  /**
   * 获取依赖关系（由子类实现）
   */
  protected abstract getDependencies(): AgentType[];

  /**
   * 获取必需配置（由子类实现）
   */
  protected abstract getRequiredConfig(): string[];

  /**
   * 获取可选配置（由子类实现）
   */
  protected abstract getOptionalConfig(): string[];
}
