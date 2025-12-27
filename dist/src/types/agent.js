"use strict";
// Agent系统核心类型定义
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentEventType = exports.AgentErrorType = exports.TaskPriority = exports.AgentStatus = exports.AgentType = void 0;
// =============================================================================
// 基础类型定义
// =============================================================================
// Agent类型枚举 - 对应10大专业Agent
var AgentType;
(function (AgentType) {
    AgentType["DOC_ANALYZER"] = "doc_analyzer";
    AgentType["EVIDENCE_ANALYZER"] = "evidence_analyzer";
    AgentType["RESEARCHER"] = "researcher";
    AgentType["STRATEGIST"] = "strategist";
    AgentType["WRITER"] = "writer";
    AgentType["REVIEWER"] = "reviewer";
    AgentType["SCHEDULER"] = "scheduler";
    AgentType["REPORTER"] = "reporter";
    AgentType["SUMMARIZER"] = "summarizer";
    AgentType["COORDINATOR"] = "coordinator";
})(AgentType || (exports.AgentType = AgentType = {}));
// Agent状态枚举
var AgentStatus;
(function (AgentStatus) {
    AgentStatus["IDLE"] = "idle";
    AgentStatus["BUSY"] = "busy";
    AgentStatus["ERROR"] = "error";
    AgentStatus["DISABLED"] = "disabled";
})(AgentStatus || (exports.AgentStatus = AgentStatus = {}));
// 任务优先级
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "low";
    TaskPriority["MEDIUM"] = "medium";
    TaskPriority["HIGH"] = "high";
    TaskPriority["URGENT"] = "urgent";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
// Agent错误类型
var AgentErrorType;
(function (AgentErrorType) {
    AgentErrorType["VALIDATION_ERROR"] = "validation_error";
    AgentErrorType["EXECUTION_ERROR"] = "execution_error";
    AgentErrorType["TIMEOUT_ERROR"] = "timeout_error";
    AgentErrorType["NETWORK_ERROR"] = "network_error";
    AgentErrorType["AI_SERVICE_ERROR"] = "ai_service_error";
    AgentErrorType["DATABASE_ERROR"] = "database_error";
    AgentErrorType["CONFIGURATION_ERROR"] = "configuration_error";
    AgentErrorType["PERMISSION_ERROR"] = "permission_error";
    AgentErrorType["RATE_LIMIT_ERROR"] = "rate_limit_error";
    AgentErrorType["UNKNOWN_ERROR"] = "unknown_error";
})(AgentErrorType || (exports.AgentErrorType = AgentErrorType = {}));
// =============================================================================
// 工具类型定义
// =============================================================================
// Agent事件类型
var AgentEventType;
(function (AgentEventType) {
    AgentEventType["REGISTERED"] = "registered";
    AgentEventType["UNREGISTERED"] = "unregistered";
    AgentEventType["EXECUTION_STARTED"] = "execution_started";
    AgentEventType["EXECUTION_COMPLETED"] = "execution_completed";
    AgentEventType["EXECUTION_FAILED"] = "execution_failed";
    AgentEventType["CONFIGURATION_CHANGED"] = "configuration_changed";
    AgentEventType["STATUS_CHANGED"] = "status_changed";
})(AgentEventType || (exports.AgentEventType = AgentEventType = {}));
