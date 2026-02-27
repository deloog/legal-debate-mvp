/**
 * 审批工作流服务
 * 支持可视化工作流编排：节点定义、并行审批、条件分支
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

// ==================== 类型定义 ====================

/** 工作流节点类型 */
export enum WorkflowNodeType {
  START = 'start',
  END = 'end',
  APPROVAL = 'approval',
  CONDITION = 'condition',
  PARALLEL_GATEWAY = 'parallel_gateway',
}

/** 条件操作符 */
export type ConditionOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';

/** 分支条件 */
export interface WorkflowCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number;
  label: string;
  targetNodeId: string;
}

/** 工作流节点 */
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  position: { x: number; y: number };
  // 审批节点专用
  approverRole?: string;
  approverId?: string;
  approverName?: string;
  // 条件节点专用
  conditions?: WorkflowCondition[];
  // 并行网关专用
  parallelType?: 'fork' | 'join';
  parallelGroup?: string;
  // 连接关系
  nextNodeIds: string[];
}

/** 工作流定义（可视化编排结果） */
export interface WorkflowDefinition {
  startNodeId: string;
  nodes: WorkflowNode[];
}

/** 工作流验证结果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** 执行步骤（由工作流定义转换而来） */
export interface ExecutionStep {
  stepNumber: number;
  approverRole: string;
  approverId?: string;
  approverName?: string;
  parallelGroup?: string;
  nodeId: string;
  conditionNodeId?: string;
}

/** 创建工作流模板输入 */
export interface CreateWorkflowTemplateInput {
  name: string;
  description?: string;
  category?: string;
  flowDefinition: WorkflowDefinition;
}

/** 更新工作流模板输入 */
export interface UpdateWorkflowTemplateInput {
  name?: string;
  description?: string;
  category?: string;
  flowDefinition?: WorkflowDefinition;
  isActive?: boolean;
}

/** 工作流模板 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  steps: unknown;
  flowDefinition?: WorkflowDefinition | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** 列出模板的过滤条件 */
export interface ListTemplatesFilter {
  isActive?: boolean;
  category?: string;
}

// ==================== 服务实现 ====================

export class ApprovalWorkflowService {
  /**
   * 验证工作流定义的合法性
   */
  validateWorkflowDefinition(definition: WorkflowDefinition): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查节点列表是否为空
    if (!definition.nodes || definition.nodes.length === 0) {
      errors.push('工作流节点列表不能为空');
      return { valid: false, errors, warnings };
    }

    // 构建节点ID映射，便于快速查找
    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of definition.nodes) {
      nodeMap.set(node.id, node);
    }

    // 检查开始节点是否存在
    const startNode = nodeMap.get(definition.startNodeId);
    if (!startNode) {
      errors.push(`开始节点 "${definition.startNodeId}" 不存在`);
    } else if (startNode.type !== WorkflowNodeType.START) {
      errors.push(`开始节点必须是 START 类型`);
    }

    // 检查是否有结束节点
    const endNodes = definition.nodes.filter(
      n => n.type === WorkflowNodeType.END
    );
    if (endNodes.length === 0) {
      errors.push('工作流必须包含至少一个结束节点');
    }

    // 验证每个节点的合法性
    for (const node of definition.nodes) {
      this._validateNode(node, nodeMap, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证单个节点
   */
  private _validateNode(
    node: WorkflowNode,
    nodeMap: Map<string, WorkflowNode>,
    errors: string[],
    warnings: string[]
  ): void {
    // 检查 nextNodeIds 引用的节点是否存在
    for (const nextId of node.nextNodeIds) {
      if (!nodeMap.has(nextId)) {
        errors.push(
          `节点 "${node.id}" 的 nextNodeIds 中引用了不存在的节点 "${nextId}"`
        );
      }
    }

    // 审批节点必须有 approverRole
    if (
      node.type === WorkflowNodeType.APPROVAL &&
      (!node.approverRole || node.approverRole.trim() === '')
    ) {
      errors.push(`审批节点 "${node.id}" 缺少 approverRole 字段`);
    }

    // 条件节点建议有条件配置
    if (node.type === WorkflowNodeType.CONDITION) {
      if (!node.conditions || node.conditions.length === 0) {
        warnings.push(`条件节点 "${node.id}" 没有配置任何条件`);
      } else {
        // 验证条件中的 targetNodeId 引用
        for (const cond of node.conditions) {
          if (!nodeMap.has(cond.targetNodeId)) {
            errors.push(
              `条件节点 "${node.id}" 的条件引用了不存在的目标节点 "${cond.targetNodeId}"`
            );
          }
        }
      }
    }

    // 并行网关必须有 parallelType
    if (node.type === WorkflowNodeType.PARALLEL_GATEWAY) {
      if (!node.parallelType) {
        warnings.push(`并行网关节点 "${node.id}" 缺少 parallelType`);
      }
    }
  }

  /**
   * 将可视化工作流定义转换为执行步骤列表
   * 支持线性流、并行流、条件分支
   */
  convertDefinitionToSteps(definition: WorkflowDefinition): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    const nodeMap = new Map<string, WorkflowNode>(
      definition.nodes.map(n => [n.id, n])
    );

    // 使用BFS/DFS遍历工作流节点，按执行顺序收集审批步骤
    this._traverseNodes(
      definition.startNodeId,
      nodeMap,
      steps,
      new Set<string>(),
      { stepCounter: 1 }
    );

    return steps;
  }

  /**
   * 递归遍历工作流节点，收集执行步骤
   */
  private _traverseNodes(
    nodeId: string,
    nodeMap: Map<string, WorkflowNode>,
    steps: ExecutionStep[],
    visited: Set<string>,
    context: { stepCounter: number }
  ): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    switch (node.type) {
      case WorkflowNodeType.START:
      case WorkflowNodeType.END:
        // 开始/结束节点不产生步骤，继续遍历
        for (const nextId of node.nextNodeIds) {
          this._traverseNodes(nextId, nodeMap, steps, visited, context);
        }
        break;

      case WorkflowNodeType.APPROVAL:
        // 审批节点产生一个执行步骤
        steps.push({
          stepNumber: context.stepCounter++,
          approverRole: node.approverRole ?? '',
          approverId: node.approverId,
          approverName: node.approverName,
          parallelGroup: node.parallelGroup,
          nodeId: node.id,
        });
        for (const nextId of node.nextNodeIds) {
          this._traverseNodes(nextId, nodeMap, steps, visited, context);
        }
        break;

      case WorkflowNodeType.PARALLEL_GATEWAY:
        if (node.parallelType === 'fork') {
          // 并行分叉：所有后继节点的步骤使用相同的stepNumber
          const parallelStepNumber = context.stepCounter;
          // 先收集所有并行分支的审批步骤
          const parallelSteps: ExecutionStep[] = [];
          for (const nextId of node.nextNodeIds) {
            const branchSteps: ExecutionStep[] = [];
            const branchContext = { stepCounter: parallelStepNumber };
            const branchVisited = new Set<string>(visited);
            this._traverseNodes(
              nextId,
              nodeMap,
              branchSteps,
              branchVisited,
              branchContext
            );
            parallelSteps.push(...branchSteps);
          }
          // 并行步骤共享同一个stepNumber
          for (const ps of parallelSteps) {
            ps.stepNumber = parallelStepNumber;
          }
          steps.push(...parallelSteps);
          context.stepCounter = parallelStepNumber + 1;

          // 继续遍历 join 节点之后的节点
          // 注意：并行分支最终会汇聚到 join 网关，join 后面的节点在分支遍历中已标记visited
          // 需要找到 join 节点并继续遍历
          const joinNodeId = this._findJoinNode(node, nodeMap);
          if (joinNodeId && !visited.has(joinNodeId)) {
            const joinNode = nodeMap.get(joinNodeId);
            if (joinNode) {
              visited.add(joinNodeId);
              for (const nextId of joinNode.nextNodeIds) {
                this._traverseNodes(nextId, nodeMap, steps, visited, context);
              }
            }
          }
        } else if (node.parallelType === 'join') {
          // join节点本身不产生步骤，后继节点已在fork处理
          for (const nextId of node.nextNodeIds) {
            if (!visited.has(nextId)) {
              this._traverseNodes(nextId, nodeMap, steps, visited, context);
            }
          }
        }
        break;

      case WorkflowNodeType.CONDITION:
        // 条件节点：将所有可能路径的步骤都收集进来（带条件标记）
        // 实际执行时根据条件选择路径
        for (const nextId of node.nextNodeIds) {
          this._traverseNodes(nextId, nodeMap, steps, visited, context);
        }
        break;
    }
  }

  /**
   * 查找与 fork 节点对应的 join 节点
   */
  private _findJoinNode(
    forkNode: WorkflowNode,
    nodeMap: Map<string, WorkflowNode>
  ): string | null {
    // 从 fork 的每个分支寻找最近的 PARALLEL_GATEWAY join 节点
    for (const nextId of forkNode.nextNodeIds) {
      const found = this._findJoinInBranch(nextId, nodeMap, new Set());
      if (found) return found;
    }
    return null;
  }

  private _findJoinInBranch(
    nodeId: string,
    nodeMap: Map<string, WorkflowNode>,
    visited: Set<string>
  ): string | null {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return null;

    if (
      node.type === WorkflowNodeType.PARALLEL_GATEWAY &&
      node.parallelType === 'join'
    ) {
      return node.id;
    }

    for (const nextId of node.nextNodeIds) {
      const found = this._findJoinInBranch(nextId, nodeMap, visited);
      if (found) return found;
    }
    return null;
  }

  /**
   * 根据ID查找节点
   */
  getNodeById(nodes: WorkflowNode[], nodeId: string): WorkflowNode | null {
    return nodes.find(n => n.id === nodeId) ?? null;
  }

  /**
   * 检查工作流是否包含并行审批
   */
  isParallelWorkflow(definition: WorkflowDefinition): boolean {
    return definition.nodes.some(
      n => n.type === WorkflowNodeType.PARALLEL_GATEWAY
    );
  }

  /**
   * 检查工作流是否包含条件分支
   */
  hasConditionalBranch(definition: WorkflowDefinition): boolean {
    return definition.nodes.some(n => n.type === WorkflowNodeType.CONDITION);
  }

  /**
   * 创建工作流模板
   */
  async createWorkflowTemplate(
    input: CreateWorkflowTemplateInput
  ): Promise<WorkflowTemplate> {
    // 验证工作流定义
    const validation = this.validateWorkflowDefinition(input.flowDefinition);
    if (!validation.valid) {
      throw new Error(`工作流定义无效: ${validation.errors.join('; ')}`);
    }

    // 将工作流定义转换为执行步骤（用于 steps 字段向后兼容）
    const steps = this.convertDefinitionToSteps(input.flowDefinition);

    const template = await prisma.approvalTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        steps: steps as unknown as Prisma.InputJsonValue,
        flowDefinition:
          input.flowDefinition as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    logger.info('创建工作流模板', {
      templateId: template.id,
      name: template.name,
    });

    return template as unknown as WorkflowTemplate;
  }

  /**
   * 获取工作流模板详情
   */
  async getWorkflowTemplate(id: string): Promise<WorkflowTemplate | null> {
    const template = await prisma.approvalTemplate.findUnique({
      where: { id },
    });

    return template as unknown as WorkflowTemplate | null;
  }

  /**
   * 列出工作流模板
   */
  async listWorkflowTemplates(
    filter: ListTemplatesFilter = {}
  ): Promise<WorkflowTemplate[]> {
    const where: Record<string, unknown> = {};

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.category !== undefined) {
      where.category = filter.category;
    }

    const templates = await prisma.approvalTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return templates as unknown as WorkflowTemplate[];
  }

  /**
   * 更新工作流模板
   */
  async updateWorkflowTemplate(
    id: string,
    input: UpdateWorkflowTemplateInput
  ): Promise<WorkflowTemplate> {
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    if (input.flowDefinition !== undefined) {
      // 验证新的工作流定义
      const validation = this.validateWorkflowDefinition(input.flowDefinition);
      if (!validation.valid) {
        throw new Error(`工作流定义无效: ${validation.errors.join('; ')}`);
      }
      // 同步更新 steps 字段
      const steps = this.convertDefinitionToSteps(input.flowDefinition);
      updateData.steps = steps as unknown as Prisma.InputJsonValue;
      updateData.flowDefinition =
        input.flowDefinition as unknown as Prisma.InputJsonValue;
    }

    const template = await prisma.approvalTemplate.update({
      where: { id },
      data: updateData,
    });

    logger.info('更新工作流模板', { templateId: id });

    return template as unknown as WorkflowTemplate;
  }
}

// 导出单例
export const approvalWorkflowService = new ApprovalWorkflowService();
