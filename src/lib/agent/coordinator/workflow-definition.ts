// 工作流定义 - 工作流定义和验证

import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowCondition,
  WorkflowRoute,
  FallbackStrategy
} from './types';

// =============================================================================
// 工作流定义类
// =============================================================================

export class WorkflowDefinitionBuilder {
  private definition: Partial<WorkflowDefinition> = {
    steps: [],
    executionMode: 'sequential',
    enableCircuitBreaker: true,
    version: '1.0.0'
  };

  /**
   * 创建工作流定义
   */
  constructor(workflowId: string, name: string) {
    this.definition.workflowId = workflowId;
    this.definition.name = name;
  }

  /**
   * 设置描述
   */
  setDescription(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * 设置执行模式
   */
  setExecutionMode(mode: 'sequential' | 'parallel' | 'mixed'): this {
    this.definition.executionMode = mode;
    return this;
  }

  /**
   * 设置超时时间
   */
  setTimeout(timeout: number): this {
    this.definition.timeout = timeout;
    return this;
  }

  /**
   * 启用或禁用熔断器
   */
  setEnableCircuitBreaker(enabled: boolean): this {
    this.definition.enableCircuitBreaker = enabled;
    return this;
  }

  /**
   * 设置回退策略
   */
  setFallbackStrategy(strategy: FallbackStrategy): this {
    this.definition.fallbackStrategy = strategy;
    return this;
  }

  /**
   * 设置版本
   */
  setVersion(version: string): this {
    this.definition.version = version;
    return this;
  }

  /**
   * 添加标签
   */
  addTag(tag: string): this {
    if (!this.definition.tags) {
      this.definition.tags = [];
    }
    this.definition.tags?.push(tag);
    return this;
  }

  /**
   * 添加步骤
   */
  addStep(step: WorkflowStep): this {
    if (!this.definition.steps) {
      this.definition.steps = [];
    }
    this.definition.steps.push(step);
    return this;
  }

  /**
   * 添加条件
   */
  addCondition(condition: WorkflowCondition): this {
    if (!this.definition.conditions) {
      this.definition.conditions = [];
    }
    this.definition.conditions.push(condition);
    return this;
  }

  /**
   * 添加路由
   */
  addRoute(route: WorkflowRoute): this {
    if (!this.definition.routes) {
      this.definition.routes = [];
    }
    this.definition.routes.push(route);
    return this;
  }

  /**
   * 构建工作流定义
   */
  build(): WorkflowDefinition {
    return this.validate() as WorkflowDefinition;
  }

  /**
   * 验证工作流定义
   */
  private validate(): Partial<WorkflowDefinition> {
    const errors: string[] = [];

    // 验证必填字段
    if (!this.definition.workflowId) {
      errors.push('工作流ID不能为空');
    }

    if (!this.definition.name) {
      errors.push('工作流名称不能为空');
    }

    if (!this.definition.steps || this.definition.steps.length === 0) {
      errors.push('工作流至少需要一个步骤');
    }

    // 验证步骤ID唯一性
    const stepIds = new Set<string>();
    for (const step of this.definition.steps || []) {
      if (stepIds.has(step.stepId)) {
        errors.push(`步骤ID重复: ${step.stepId}`);
      } else {
        stepIds.add(step.stepId);
      }

      // 验证步骤必填字段
      if (!step.agentType) {
        errors.push(`步骤${step.stepId}缺少agentType`);
      }

      if (!step.name) {
        errors.push(`步骤${step.stepId}缺少name`);
      }

      // 验证依赖步骤存在
      for (const depId of step.dependsOn || []) {
        if (!stepIds.has(depId)) {
          errors.push(`步骤${step.stepId}依赖的步骤${depId}不存在`);
        }
      }
    }

    // 验证条件
    const conditionIds = new Set<string>();
    for (const cond of this.definition.conditions || []) {
      if (conditionIds.has(cond.conditionId)) {
        errors.push(`条件ID重复: ${cond.conditionId}`);
      } else {
        conditionIds.add(cond.conditionId);
      }

      if (!cond.expression) {
        errors.push(`条件${cond.conditionId}缺少表达式`);
      }
    }

    // 验证路由
    for (const route of this.definition.routes || []) {
      // 验证目标步骤存在
      if (!stepIds.has(route.targetStepId)) {
        errors.push(`路由${route.routeId}指向的步骤${route.targetStepId}不存在`);
      }

      // 验证条件存在
      if (route.conditionId && !conditionIds.has(route.conditionId)) {
        errors.push(`路由${route.routeId}引用的条件${route.conditionId}不存在`);
      }
    }

    // 验证回退策略
    if (this.definition.fallbackStrategy) {
      const { type, alternateStepId, alternateAgentType } = this.definition.fallbackStrategy;

      if (type === 'alternate') {
        if (!alternateStepId && !alternateAgentType) {
          errors.push('alternate回退策略需要指定alternateStepId或alternateAgentType');
        }

        if (alternateStepId && !stepIds.has(alternateStepId)) {
          errors.push(`回退策略的步骤${alternateStepId}不存在`);
        }
      }

      if (type === 'retry' && !this.definition.fallbackStrategy.maxAttempts) {
        errors.push('retry回退策略需要指定maxAttempts');
      }
    }

    // 检测循环依赖
    const visited = new Set<string>();
    const visiting = new Set<string>();

    for (const step of this.definition.steps || []) {
      if (!this.detectCycle(step.stepId, visited, visiting, this.definition.steps || [])) {
        errors.push(`工作流存在循环依赖，涉及步骤: ${Array.from(visiting).join(', ')}`);
        break;
      }
    }

    // 如果有错误，抛出异常
    if (errors.length > 0) {
      throw new Error(`工作流定义验证失败:\n${errors.join('\n')}`);
    }

    return this.definition;
  }

  /**
   * 检测循环依赖
   */
  private detectCycle(
    stepId: string,
    visited: Set<string>,
    visiting: Set<string>,
    steps: WorkflowStep[]
  ): boolean {
    if (visiting.has(stepId)) {
      return false; // 检测到循环
    }

    if (visited.has(stepId)) {
      return true; // 已访问过，无循环
    }

    visiting.add(stepId);

    const step = steps.find(s => s.stepId === stepId);
    if (step && step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (!this.detectCycle(depId, visited, visiting, steps)) {
          return false;
        }
      }
    }

    visiting.delete(stepId);
    visited.add(stepId);

    return true;
  }

  /**
   * 获取工作流定义（不验证）
   */
  getDefinition(): Partial<WorkflowDefinition> {
    return { ...this.definition };
  }

  /**
   * 克隆构建器
   */
  clone(): WorkflowDefinitionBuilder {
    const clone = new WorkflowDefinitionBuilder(
      this.definition.workflowId || '',
      this.definition.name || ''
    );
    clone.definition = JSON.parse(JSON.stringify(this.definition));
    return clone;
  }
}

// =============================================================================
// 预定义工作流模板
// =============================================================================

/**
 * 创建文档分析工作流
 */
export function createDocumentAnalysisWorkflow(): WorkflowDefinition {
  return new WorkflowDefinitionBuilder(
    'doc-analysis-workflow',
    '文档分析工作流'
  )
    .setDescription('完整的文档分析流程，包括文本提取、AI识别、规则处理和审查')
    .setExecutionMode('sequential')
    .setTimeout(120000) // 2分钟
    .setEnableCircuitBreaker(true)
    .setVersion('1.0.0')
    .addStep({
      stepId: 'text-extraction',
      agentType: 'doc_analyzer' as any,
      name: '文本提取',
      description: '从文档中提取文本内容',
      required: true,
      outputKey: 'extractedText'
    })
    .addStep({
      stepId: 'ai-recognition',
      agentType: 'doc_analyzer' as any,
      name: 'AI识别',
      description: '使用AI识别关键信息',
      dependsOn: ['text-extraction'],
      required: true,
      outputKey: 'aiResult'
    })
    .addStep({
      stepId: 'rule-processing',
      agentType: 'doc_analyzer' as any,
      name: '规则处理',
      description: '使用规则增强AI识别结果',
      dependsOn: ['ai-recognition'],
      required: true,
      outputKey: 'enhancedResult'
    })
    .addStep({
      stepId: 'review',
      agentType: 'doc_analyzer' as any,
      name: '质量审查',
      description: '审查解析结果质量',
      dependsOn: ['rule-processing'],
      required: true,
      outputKey: 'reviewResult'
    })
    .build();
}

/**
 * 创建诉讼策略生成工作流
 */
export function createStrategyWorkflow(): WorkflowDefinition {
  return new WorkflowDefinitionBuilder(
    'strategy-workflow',
    '诉讼策略生成工作流'
  )
    .setDescription('基于案件信息和法条分析生成诉讼策略')
    .setExecutionMode('sequential')
    .setTimeout(90000) // 1.5分钟
    .setEnableCircuitBreaker(true)
    .setFallbackStrategy({
      strategyId: 'strategy-fallback',
      type: 'retry',
      maxAttempts: 3,
      retryDelay: 2000,
      description: '策略生成失败时重试'
    })
    .setVersion('1.0.0')
    .addStep({
      stepId: 'case-analysis',
      agentType: 'strategist' as any,
      name: '案件分析',
      description: '分析案件基本信息和事实',
      required: true,
      outputKey: 'caseAnalysis'
    })
    .addStep({
      stepId: 'swot-analysis',
      agentType: 'strategist' as any,
      name: 'SWOT分析',
      description: '生成SWOT分析',
      dependsOn: ['case-analysis'],
      required: true,
      outputKey: 'swotAnalysis'
    })
    .addStep({
      stepId: 'risk-assessment',
      agentType: 'strategist' as any,
      name: '风险评估',
      description: '评估案件风险',
      dependsOn: ['swot-analysis'],
      required: true,
      outputKey: 'riskAssessment'
    })
    .build();
}

/**
 * 创建完整案件处理工作流（混合模式）
 */
export function createCaseProcessingWorkflow(): WorkflowDefinition {
  return new WorkflowDefinitionBuilder(
    'case-processing-workflow',
    '案件处理工作流'
  )
    .setDescription('完整的案件处理流程，包括文档分析和策略生成')
    .setExecutionMode('mixed')
    .setTimeout(180000) // 3分钟
    .setEnableCircuitBreaker(true)
    .addTag('case-processing')
    .addTag('full-workflow')
    .setVersion('1.0.0')
    // 串行阶段1：文档分析
    .addStep({
      stepId: 'doc-analysis',
      agentType: 'doc_analyzer' as any,
      name: '文档分析',
      description: '分析上传的法律文档',
      required: true,
      priority: 1,
      outputKey: 'documentAnalysis'
    })
    // 串行阶段2：并行策略生成
    .addStep({
      stepId: 'swot-analysis',
      agentType: 'strategist' as any,
      name: 'SWOT分析',
      description: '生成SWOT分析',
      dependsOn: ['doc-analysis'],
      required: true,
      priority: 2,
      outputKey: 'swotAnalysis'
    })
    .addStep({
      stepId: 'risk-assessment',
      agentType: 'strategist' as any,
      name: '风险评估',
      description: '评估案件风险',
      dependsOn: ['doc-analysis'],
      required: true,
      priority: 2,
      outputKey: 'riskAssessment'
    })
    .build();
}

// =============================================================================
// 工作流验证工具
// =============================================================================

/**
 * 验证工作流定义
 */
export function validateWorkflowDefinition(definition: WorkflowDefinition): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证必填字段
  if (!definition.workflowId) {
    errors.push('workflowId不能为空');
  }

  if (!definition.name) {
    errors.push('name不能为空');
  }

  if (!definition.steps || definition.steps.length === 0) {
    errors.push('steps不能为空');
  }

  // 验证步骤
  const stepIds = new Set<string>();
  for (const step of definition.steps || []) {
    if (!step.stepId) {
      errors.push('步骤缺少stepId');
      continue;
    }

    if (stepIds.has(step.stepId)) {
      errors.push(`步骤ID重复: ${step.stepId}`);
    } else {
      stepIds.add(step.stepId);
    }

    if (!step.agentType) {
      errors.push(`步骤${step.stepId}缺少agentType`);
    }

    if (!step.name) {
      errors.push(`步骤${step.stepId}缺少name`);
    }
  }

  // 验证路由
  for (const route of definition.routes || []) {
    if (!route.routeId) {
      errors.push('路由缺少routeId');
    }

    if (!route.targetStepId) {
      errors.push('路由缺少targetStepId');
    }

    if (!stepIds.has(route.targetStepId)) {
      errors.push(`路由${route.routeId}指向的步骤不存在`);
    }
  }

  // 验证条件
  for (const cond of definition.conditions || []) {
    if (!cond.conditionId) {
      errors.push('条件缺少conditionId');
    }

    if (!cond.expression) {
      errors.push(`条件${cond.conditionId}缺少expression`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取工作流步骤图
 */
export function getWorkflowStepGraph(definition: WorkflowDefinition): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const step of definition.steps || []) {
    const dependencies = step.dependsOn || [];
    graph.set(step.stepId, dependencies);
  }

  return graph;
}

/**
 * 获取工作流的拓扑排序
 */
export function getWorkflowTopologicalOrder(definition: WorkflowDefinition): string[] {
  const graph = getWorkflowStepGraph(definition);
  const visited = new Set<string>();
  const result: string[] = [];

  const visit = (stepId: string): void => {
    if (visited.has(stepId)) {
      return;
    }

    visited.add(stepId);

    const dependencies = graph.get(stepId) || [];
    for (const depId of dependencies) {
      visit(depId);
    }

    result.push(stepId);
  };

  for (const step of definition.steps || []) {
    visit(step.stepId);
  }

  return result;
}
