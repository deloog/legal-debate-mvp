"use strict";
// Agent基础抽象类
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const agent_1 = require("../../types/agent");
const types_1 = require("./types");
// =============================================================================
// BaseAgent抽象类
// =============================================================================
class BaseAgent {
  constructor(logger, initialConfig) {
    // 内部状态
    this.status = agent_1.AgentStatus.IDLE;
    this.config = {};
    // 统计信息
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0,
      totalTokensUsed: 0,
      totalCost: 0,
    };
    /**
     * 默认日志记录器
     */
    this.defaultLogger = (entry) => {
      const level = entry.level.toUpperCase();
      const timestamp = new Date(entry.timestamp).toISOString();
      const message = `[${timestamp}] [${level}] [${entry.agentName}] ${entry.message}`;
      if (types_1.DEFAULT_AGENT_CONFIG.logging.enableConsole) {
        switch (entry.level) {
          case types_1.AgentLogLevel.DEBUG:
          case types_1.AgentLogLevel.INFO:
            console.log(message, entry.data || "");
            break;
          case types_1.AgentLogLevel.WARN:
            console.warn(message, entry.data || "");
            break;
          case types_1.AgentLogLevel.ERROR:
            console.error(message, entry.error || entry.data || "");
            break;
        }
      }
    };
    this.logger = logger || this.defaultLogger;
    this.config = { ...initialConfig };
  }
  // =============================================================================
  // 生命周期方法
  // =============================================================================
  /**
   * Agent初始化
   */
  async initialize() {
    this.log(types_1.AgentLogLevel.INFO, "Agent initialized", {
      name: this.name,
      type: this.type,
      version: this.version,
    });
  }
  /**
   * Agent清理
   */
  async cleanup() {
    this.log(types_1.AgentLogLevel.INFO, "Agent cleaned up", {
      name: this.name,
    });
    this.status = agent_1.AgentStatus.IDLE;
  }
  /**
   * 健康检查
   */
  async healthCheck() {
    return this.status !== agent_1.AgentStatus.ERROR;
  }
  /**
   * 配置更新
   */
  async configure(config) {
    this.config = { ...this.config, ...config };
    this.log(types_1.AgentLogLevel.INFO, "Agent configuration updated", {
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
  async execute(context) {
    const startTime = Date.now();
    try {
      // 验证上下文
      const validation = (0, types_1.validateAgentContext)(context);
      if (!validation.valid) {
        const error = (0, types_1.createAgentError)(
          "INVALID_CONTEXT",
          `Invalid agent context: ${validation.errors.join(", ")}`,
          agent_1.AgentErrorType.VALIDATION_ERROR,
          this.name,
          false,
        );
        return (0, types_1.createAgentResult)(this.name, undefined, {
          success: false,
          executionTime: Date.now() - startTime,
          error: error,
        });
      }
      // 设置执行状态
      this.status = agent_1.AgentStatus.BUSY;
      this.currentState = {
        agentName: this.name,
        status: this.status,
        startTime,
        context,
      };
      this.log(types_1.AgentLogLevel.INFO, "Agent execution started", {
        task: context.task,
        priority: context.priority,
      });
      // 执行逻辑
      const result = await this.executeLogic(context);
      const executionTime = Date.now() - startTime;
      // 更新统计
      this.updateStats(executionTime, true);
      // 创建成功结果
      const agentResult = (0, types_1.createAgentResult)(this.name, result, {
        success: true,
        executionTime,
        output: result.output, // 传递output字段
        context: {
          inputSummary: this.summarizeInput(context),
          processingSteps: this.getProcessingSteps(),
        },
      });
      this.status = agent_1.AgentStatus.IDLE;
      this.log(types_1.AgentLogLevel.INFO, "Agent execution completed", {
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
      this.status = agent_1.AgentStatus.ERROR;
      this.log(types_1.AgentLogLevel.ERROR, "Agent execution failed", {
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
  log(level, message, data, error) {
    const entry = {
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
  createErrorFromException(error) {
    if (error && typeof error === "object" && "code" in error) {
      return (0, types_1.createAgentError)(
        error.code,
        error.message || "Unknown error",
        this.mapErrorType(error.code),
        this.name,
        this.isRetryableError(error.code),
        { originalError: error },
      );
    }
    return (0, types_1.createAgentError)(
      "EXECUTION_ERROR",
      error?.message || "Unknown execution error",
      agent_1.AgentErrorType.EXECUTION_ERROR,
      this.name,
      true,
      { originalError: error },
    );
  }
  /**
   * 映射错误类型
   */
  mapErrorType(code) {
    const codeLower = code.toLowerCase();
    if (codeLower.includes("timeout"))
      return agent_1.AgentErrorType.TIMEOUT_ERROR;
    if (codeLower.includes("network"))
      return agent_1.AgentErrorType.NETWORK_ERROR;
    if (codeLower.includes("rate_limit"))
      return agent_1.AgentErrorType.RATE_LIMIT_ERROR;
    if (codeLower.includes("permission"))
      return agent_1.AgentErrorType.PERMISSION_ERROR;
    if (codeLower.includes("validation"))
      return agent_1.AgentErrorType.VALIDATION_ERROR;
    return agent_1.AgentErrorType.EXECUTION_ERROR;
  }
  /**
   * 判断是否为可重试错误
   */
  isRetryableError(code) {
    const retryableCodes = [
      "TIMEOUT_ERROR",
      "NETWORK_ERROR",
      "RATE_LIMIT_ERROR",
      "AI_SERVICE_ERROR",
    ];
    return retryableCodes.some((rc) =>
      code.toLowerCase().includes(rc.toLowerCase()),
    );
  }
  /**
   * 更新统计信息
   */
  updateStats(executionTime, success) {
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
  summarizeInput(context) {
    const data = context.data;
    const dataStr = JSON.stringify(data);
    if (typeof data === "string") {
      return dataStr.length > 100 ? dataStr.substring(0, 100) + "..." : dataStr;
    }
    return dataStr.length > 100 ? dataStr.substring(0, 100) + "..." : dataStr;
  }
  /**
   * 获取处理步骤（由子类重写）
   */
  getProcessingSteps() {
    return ["Input validation", "Core logic execution", "Result formatting"];
  }
  // =============================================================================
  // 统计和元数据方法
  // =============================================================================
  /**
   * 获取Agent元数据
   */
  getMetadata() {
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
}
exports.BaseAgent = BaseAgent;
