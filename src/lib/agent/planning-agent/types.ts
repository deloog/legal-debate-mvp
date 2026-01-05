// PlanningAgent类型定义

import type { AgentType } from "../../../types/agent";
import { TaskPriority } from "../../../types/agent";

// =============================================================================
// 任务分解相关类型
// =============================================================================

// 子任务定义
export interface SubTask {
  id: string;
  name: string;
  agent: AgentType;
  priority: TaskPriority;
  dependencies?: string[];
  estimatedTime?: number;
  description?: string;
}

// 任务分解结果
export interface DecompositionResult {
  subTasks: SubTask[];
  totalTime: number;
  criticalPath: string[];
}

// 任务类型枚举
export enum TaskType {
  DEBATE = "debate",
  DOCUMENT_GENERATION = "document_generation",
  ANALYSIS = "analysis",
  LEGAL_RESEARCH = "legal_research",
  CUSTOM = "custom",
}

// 任务分解配置
export interface DecompositionConfig {
  enableOptimization: boolean;
  maxParallelTasks: number;
  defaultTaskTime: number;
}

// =============================================================================
// 策略规划相关类型
// =============================================================================

// 策略定义
export interface Strategy {
  name: string;
  description: string;
  swotAnalysis: SWOTAnalysis;
  recommendations: string[];
  riskLevel: "low" | "medium" | "high";
  feasibilityScore: number;
  confidence: number;
}

// SWOT分析
export interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

// 策略规划结果
export interface PlanningResult {
  strategy: Strategy;
  alternativeStrategies: Strategy[];
  selectedReason: string;
}

// 策略规划配置
export interface PlanningConfig {
  enableSWOTAnalysis: boolean;
  strategyCount: number;
  riskThreshold: number;
}

// =============================================================================
// 工作流编排相关类型
// =============================================================================

// 工作流定义
export interface Workflow {
  id: string;
  name: string;
  tasks: SubTask[];
  executionMode: "sequential" | "parallel" | "mixed";
  estimatedTotalTime: number;
  dependencies: TaskDependency[];
}

// 任务依赖关系
export interface TaskDependency {
  taskId: string;
  dependsOn: string[];
  type: "strict" | "weak";
}

// 工作流执行模式
export enum ExecutionMode {
  SEQUENTIAL = "sequential",
  PARALLEL = "parallel",
  MIXED = "mixed",
}

// 工作流编排结果
export interface OrchestrationResult {
  workflow: Workflow;
  executionPlan: ExecutionStep[];
  estimatedDuration: number;
}

// 执行步骤
export interface ExecutionStep {
  step: number;
  taskId: string;
  taskName: string;
  mode: "execute" | "wait" | "parallel";
  dependencies: string[];
  estimatedTime: number;
}

// 工作流编排配置
export interface OrchestrationConfig {
  defaultExecutionMode: ExecutionMode;
  maxConcurrentTasks: number;
  enableOptimization: boolean;
}

// =============================================================================
// 资源调度相关类型
// =============================================================================

// 资源分配结果
export interface ResourceAllocation {
  agents: Map<AgentType, AgentResource>;
  priority: TaskPriority;
  maxConcurrent: number;
  utilizationRate: number;
}

// Agent资源
export interface AgentResource {
  agentType: AgentType;
  allocated: boolean;
  estimatedLoad: number;
  priority: TaskPriority;
  startTime?: number;
  endTime?: number;
}

// 资源可用性
export interface ResourceAvailability {
  agentType: AgentType;
  available: boolean;
  currentLoad: number;
  capacity: number;
  estimatedWaitTime: number;
}

// 资源调度配置
export interface AllocationConfig {
  enableLoadBalancing: boolean;
  maxLoadPerAgent: number;
  enablePrioritization: boolean;
}

// =============================================================================
// 综合规划结果
// =============================================================================

// PlanningAgent主输出
export interface PlanningOutput {
  decomposition: DecompositionResult;
  planning: PlanningResult;
  orchestration: OrchestrationResult;
  allocation: ResourceAllocation;
  metadata: PlanningMetadata;
}

// 规划元数据
export interface PlanningMetadata {
  totalTasks: number;
  totalEstimatedTime: number;
  recommendedExecutionMode: ExecutionMode;
  criticalPathTasks: string[];
  riskFactors: string[];
  confidence: number;
}

// =============================================================================
// 输入上下文类型
// =============================================================================

// PlanningAgent输入数据
export interface PlanningInput {
  taskType: TaskType;
  caseInfo: CaseInfo;
  userGoal: string;
  constraints?: PlanningConstraints;
}

// 案件信息
export interface CaseInfo {
  id?: string;
  type?: string;
  title?: string;
  description?: string;
  parties?: PartyInfo[];
  claims?: string[];
  evidenceCount?: number;
}

// 当事人信息
export interface PartyInfo {
  name: string;
  role: "plaintiff" | "defendant";
}

// 规划约束
export interface PlanningConstraints {
  maxTime?: number;
  maxCost?: number;
  requiredAgents?: AgentType[];
  excludedAgents?: AgentType[];
  priorityOverride?: TaskPriority;
}

// =============================================================================
// 错误类型
// =============================================================================

// 规划错误类型
export enum PlanningErrorType {
  INVALID_TASK_TYPE = "invalid_task_type",
  DECOMPOSITION_FAILED = "decomposition_failed",
  STRATEGY_GENERATION_FAILED = "strategy_generation_failed",
  WORKFLOW_ORCHESTRATION_FAILED = "workflow_orchestration_failed",
  RESOURCE_ALLOCATION_FAILED = "resource_allocation_failed",
  UNSATISFIABLE_CONSTRAINTS = "unsatisfiable_constraints",
}

// 规划错误
export interface PlanningError {
  type: PlanningErrorType;
  message: string;
  details?: unknown;
}
