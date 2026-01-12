'use strict';
// Agent系统内部类型定义和工具函数
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.DEFAULT_AGENT_CONFIG = exports.AgentLogLevel = void 0;
exports.createAgentError = createAgentError;
exports.createAgentResult = createAgentResult;
exports.validateAgentContext = validateAgentContext;
exports.generateCacheKey = generateCacheKey;
exports.calculateExecutionStats = calculateExecutionStats;
exports.createAgentEvent = createAgentEvent;
exports.isValidAgentType = isValidAgentType;
exports.isValidAgentStatus = isValidAgentStatus;
exports.isValidTaskPriority = isValidTaskPriority;
exports.isValidAgent = isValidAgent;
const agent_1 = require('../../types/agent');
const crypto = __importStar(require('crypto'));
// Agent日志级别
var AgentLogLevel;
(function (AgentLogLevel) {
  AgentLogLevel['DEBUG'] = 'debug';
  AgentLogLevel['INFO'] = 'info';
  AgentLogLevel['WARN'] = 'warn';
  AgentLogLevel['ERROR'] = 'error';
})(AgentLogLevel || (exports.AgentLogLevel = AgentLogLevel = {}));
// =============================================================================
// Agent执行工具函数
// =============================================================================
// 创建Agent错误
function createAgentError(
  code,
  message,
  type,
  agentName,
  retryable = false,
  details
) {
  return {
    code,
    message,
    type,
    agentName,
    timestamp: Date.now(),
    retryable,
    details,
    stack: new Error().stack,
  };
}
// 创建Agent结果
function createAgentResult(agentName, data, options = {}) {
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
    error: options.error,
  };
}
// 验证Agent上下文
function validateAgentContext(context) {
  const errors = [];
  if (!context.task || typeof context.task !== 'string') {
    errors.push('Task is required and must be a string');
  }
  if (!context.data || typeof context.data !== 'object') {
    errors.push('Data is required and must be an object');
  }
  if (!Object.values(agent_1.TaskPriority).includes(context.priority)) {
    errors.push('Priority must be a valid TaskPriority value');
  }
  if (context.options && typeof context.options !== 'object') {
    errors.push('Options must be an object if provided');
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}
// 生成缓存键
function generateCacheKey(context) {
  const keyData = {
    agentName: context.taskType || 'unknown',
    task: context.task,
    data: context.data,
    options: context.options,
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(keyData))
    .digest('hex');
}
// 计算执行统计
function calculateExecutionStats(startTime, endTime, success, previousStats) {
  const executionTime = endTime - startTime;
  const totalExecutions = (previousStats?.totalExecutions || 0) + 1;
  const successfulExecutions =
    (previousStats?.successfulExecutions || 0) + (success ? 1 : 0);
  const failedExecutions =
    (previousStats?.failedExecutions || 0) + (success ? 0 : 1);
  return {
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    averageExecutionTime: previousStats
      ? (previousStats.averageExecutionTime * (totalExecutions - 1) +
          executionTime) /
        totalExecutions
      : executionTime,
    lastExecutionTime: endTime,
    errorRate: totalExecutions > 0 ? failedExecutions / totalExecutions : 0,
  };
}
// 创建Agent事件
function createAgentEvent(type, agentName, data) {
  return {
    type,
    timestamp: Date.now(),
    agentName,
    data,
  };
}
// =============================================================================
// 类型守卫
// =============================================================================
// 检查是否为有效的AgentType
function isValidAgentType(type) {
  return Object.values(agent_1.AgentType).includes(type);
}
// 检查是否为有效的AgentStatus
function isValidAgentStatus(status) {
  return Object.values(agent_1.AgentStatus).includes(status);
}
// 检查是否为有效的TaskPriority
function isValidTaskPriority(priority) {
  return Object.values(agent_1.TaskPriority).includes(priority);
}
// 检查是否为有效的Agent实例
function isValidAgent(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.version === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.execute === 'function'
  );
}
// =============================================================================
// 导出默认配置
// =============================================================================
exports.DEFAULT_AGENT_CONFIG = {
  defaultTimeout: 30000, // 30秒
  maxConcurrentExecutions: 5,
  enableMetrics: true,
  enableCaching: true,
  cache: {
    enabled: true,
    ttl: 300000, // 5分钟
    maxSize: 1000,
    keyPrefix: 'agent_',
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  monitoring: {
    enabled: true,
    metricsInterval: 60000, // 1分钟
    retentionDays: 7,
  },
  logging: {
    level: AgentLogLevel.INFO,
    enableConsole: true,
    enableFile: false,
  },
};
