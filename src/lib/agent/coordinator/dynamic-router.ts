// 动态路由器 - 支持条件路由和动态路径选择

import type {
  WorkflowDefinition,
  WorkflowRoute,
  WorkflowCondition,
  RoutingDecision,
  ConditionEvaluationContext
} from './types';

import type { StepExecution } from './types';

// =============================================================================
// 条件评估器
// =============================================================================

export class ConditionEvaluator {
  /**
   * 评估条件表达式
   */
  public evaluate(
    condition: WorkflowCondition,
    context: ConditionEvaluationContext
  ): boolean {
    try {
      const expression = this.parseExpression(condition.expression);
      return this.evaluateExpression(expression, context);
    } catch (error) {
      console.error(`条件评估失败: ${condition.conditionId}`, error);
      return false;
    }
  }

  /**
   * 解析表达式
   */
  private parseExpression(expression: string): any {
    try {
      // 简单的表达式解析，支持常见操作符
      // 实际项目中可以使用更强大的表达式引擎（如expr-eval）
      
      // 替换步骤结果引用
      const parsed = expression
        .replace(/\$\{step:([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)\}/g, 
          (match, stepId, field) => `__STEP_RESULT_${stepId}.${field}`)
        .replace(/\$\{shared:([a-zA-Z0-9_]+)\}/g,
          (match, key) => `__SHARED_DATA.${key}`)
        .replace(/\$\{input:([a-zA-Z0-9_]+)\}/g,
          (match, key) => `__INPUT_DATA.${key}`);

      return parsed;
    } catch (error) {
      throw new Error(`表达式解析失败: ${error}`);
    }
  }

  /**
   * 评估解析后的表达式
   */
  private evaluateExpression(
    expression: string,
    context: ConditionEvaluationContext
  ): boolean {
    // 构建评估环境
    const env = this.buildEvaluationEnv(context);

    try {
      // 简单的条件评估
      return this.evaluateSimpleCondition(expression, env);
    } catch (error) {
      throw new Error(`表达式执行失败: ${error}`);
    }
  }

  /**
   * 构建评估环境
   */
  private buildEvaluationEnv(context: ConditionEvaluationContext): Record<string, any> {
    const env: Record<string, any> = {
      __INPUT_DATA: context.inputData,
      __SHARED_DATA: {}
    };

    // 转换共享数据Map为对象
    for (const [key, value] of context.sharedData.entries()) {
      env.__SHARED_DATA[key] = value;
    }

    // 转换步骤结果Map为对象
    for (const [stepId, stepExec] of context.stepResults.entries()) {
      env[`__STEP_RESULT_${stepId}`] = stepExec.data || stepExec.result?.data;
    }

    return env;
  }

  /**
   * 评估简单条件
   */
  private evaluateSimpleCondition(
    expression: string,
    env: Record<string, any>
  ): boolean {
    // 简单的条件评估实现
    // 支持格式: field === value, field > value, field < value, field != value
    // field in [value1, value2], field contains value
    
    const comparisonRegex = /^([\w.$]+)\s*(===|==|!=|!==|>|<|>=|<=|in|contains)\s*(.+)$/;
    const match = expression.match(comparisonRegex);

    if (!match) {
      throw new Error(`不支持的表达式格式: ${expression}`);
    }

    const [, field, operator, valueStr] = match;

    // 获取字段值
    const fieldValue = this.getFieldValue(field, env);
    const value = this.parseValue(valueStr);

    // 执行比较
    switch (operator) {
      case '===':
      case '==':
        return fieldValue === value;
      case '!==':
      case '!=':
        return fieldValue !== value;
      case '>':
        return fieldValue > value;
      case '<':
        return fieldValue < value;
      case '>=':
        return fieldValue >= value;
      case '<=':
        return fieldValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'contains':
        return Array.isArray(fieldValue) 
          ? fieldValue.includes(value)
          : String(fieldValue).includes(String(value));
      default:
        throw new Error(`不支持的操作符: ${operator}`);
    }
  }

  /**
   * 获取字段值
   */
  private getFieldValue(path: string, env: Record<string, any>): any {
    const parts = path.split('.');
    let value = env;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * 解析值
   */
  private parseValue(valueStr: string): any {
    valueStr = valueStr.trim();

    // 数字
    if (/^-?\d+$/.test(valueStr)) {
      return parseInt(valueStr, 10);
    }
    if (/^-?\d+\.\d+$/.test(valueStr)) {
      return parseFloat(valueStr);
    }

    // 布尔值
    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;
    if (valueStr === 'null') return null;

    // 字符串（带引号）
    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
        (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      return valueStr.slice(1, -1);
    }

    // 数组
    if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
      try {
        return JSON.parse(valueStr);
      } catch {
        return valueStr;
      }
    }

    // 默认返回字符串
    return valueStr;
  }
}

// =============================================================================
// 动态路由器
// =============================================================================

export class DynamicRouter {
  private conditionEvaluator: ConditionEvaluator;

  constructor() {
    this.conditionEvaluator = new ConditionEvaluator();
  }

  /**
   * 路由到下一个步骤
   */
  public route(
    currentStepId: string,
    workflow: WorkflowDefinition,
    stepResults: Map<string, StepExecution>,
    sharedData: Map<string, any>,
    inputData: Record<string, any>
  ): RoutingDecision {
    // 如果没有路由规则，返回默认路由
    if (!workflow.routes || workflow.routes.length === 0) {
      return this.findNextStep(currentStepId, workflow);
    }

    // 构建条件评估上下文
    const context: ConditionEvaluationContext = {
      stepResults,
      sharedData,
      currentStepId,
      inputData
    };

    // 查找匹配的路由
    for (const route of workflow.routes) {
      // 默认路由
      if (route.isDefault) {
        continue; // 跳过默认路由，最后处理
      }

      // 有条件的路由
      if (route.conditionId) {
        const condition = this.findCondition(route.conditionId, workflow);
        if (!condition) {
          console.warn(`路由${route.routeId}引用的条件${route.conditionId}不存在`);
          continue;
        }

        if (this.conditionEvaluator.evaluate(condition, context)) {
          return {
            targetStepId: route.targetStepId,
            routeId: route.routeId,
            reason: `条件${route.conditionId}匹配成功`
          };
        }
      }
    }

    // 查找默认路由
    const defaultRoute = workflow.routes.find(r => r.isDefault);
    if (defaultRoute) {
      return {
        targetStepId: defaultRoute.targetStepId,
        routeId: defaultRoute.routeId,
        reason: '使用默认路由'
      };
    }

    // 没有匹配的路由，返回下一个步骤
    return this.findNextStep(currentStepId, workflow);
  }

  /**
   * 查找下一个步骤
   */
  private findNextStep(currentStepId: string, workflow: WorkflowDefinition): RoutingDecision {
    const currentIndex = workflow.steps.findIndex(s => s.stepId === currentStepId);

    if (currentIndex === -1) {
      throw new Error(`步骤${currentStepId}不存在`);
    }

    // 返回下一个步骤
    if (currentIndex + 1 < workflow.steps.length) {
      return {
        targetStepId: workflow.steps[currentIndex + 1].stepId,
        routeId: 'sequential',
        reason: '顺序执行下一个步骤'
      };
    }

    // 没有下一个步骤了
    return {
      targetStepId: '',
      routeId: 'end',
      reason: '工作流结束'
    };
  }

  /**
   * 查找条件
   */
  private findCondition(
    conditionId: string,
    workflow: WorkflowDefinition
  ): WorkflowCondition | undefined {
    return workflow.conditions?.find(c => c.conditionId === conditionId);
  }

  /**
   * 获取可路由的步骤ID列表
   */
  public getRoutableSteps(
    currentStepId: string,
    workflow: WorkflowDefinition,
    context: ConditionEvaluationContext
  ): string[] {
    const routable: string[] = [];

    // 当前步骤之后的步骤
    const currentIndex = workflow.steps.findIndex(s => s.stepId === currentStepId);

    for (let i = currentIndex + 1; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const deps = step.dependsOn || [];

      // 检查依赖是否都已完成
      const allDepsCompleted = deps.every(depId => {
        const depResult = context.stepResults.get(depId);
        return depResult && 
          (depResult.status === 'completed' || depResult.status === 'skipped');
      });

      if (allDepsCompleted) {
        routable.push(step.stepId);
      }
    }

    return routable;
  }

  /**
   * 设置条件评估器（用于测试或自定义）
   */
  public setConditionEvaluator(evaluator: ConditionEvaluator): void {
    this.conditionEvaluator = evaluator;
  }
}

// =============================================================================
// 路由规则构建器
// =============================================================================

export class WorkflowRouteBuilder {
  private routes: WorkflowRoute[] = [];
  private conditions: WorkflowCondition[] = [];
  private routeCounter = 0;
  private conditionCounter = 0;

  /**
   * 添加条件路由
   */
  public addConditionalRoute(
    conditionExpression: string,
    targetStepId: string,
    description?: string
  ): this {
    const conditionId = `condition_${++this.conditionCounter}`;
    const routeId = `route_${++this.routeCounter}`;

    this.conditions.push({
      conditionId,
      expression: conditionExpression,
      description
    });

    this.routes.push({
      routeId,
      conditionId,
      targetStepId
    });

    return this;
  }

  /**
   * 添加默认路由
   */
  public addDefaultRoute(targetStepId: string): this {
    const routeId = `route_default_${++this.routeCounter}`;

    this.routes.push({
      routeId,
      targetStepId,
      isDefault: true
    });

    return this;
  }

  /**
   * 构建路由和条件
   */
  public build(): { routes: WorkflowRoute[]; conditions: WorkflowCondition[] } {
    return {
      routes: this.routes,
      conditions: this.conditions
    };
  }

  /**
   * 重置构建器
   */
  public reset(): void {
    this.routes = [];
    this.conditions = [];
    this.routeCounter = 0;
    this.conditionCounter = 0;
  }
}
