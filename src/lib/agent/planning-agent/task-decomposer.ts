// 任务分解器

import { AgentType } from '../../../types/agent';
import { TaskPriority } from '../../../types/agent';
import {
  type SubTask,
  type DecompositionResult,
  type DecompositionConfig,
  TaskType,
  type PlanningError,
  PlanningErrorType,
} from './types';

// =============================================================================
// TaskDecomposer类
// =============================================================================

export class TaskDecomposer {
  private config: DecompositionConfig;

  constructor(
    config: DecompositionConfig = {
      enableOptimization: true,
      maxParallelTasks: 3,
      defaultTaskTime: 5000,
    }
  ) {
    this.config = config;
  }

  // 主分解方法
  public async decompose(
    taskType: TaskType,
    caseInfo?: unknown
  ): Promise<DecompositionResult> {
    try {
      let subTasks: SubTask[];

      switch (taskType) {
        case TaskType.DEBATE:
          subTasks = this.decomposeDebateTask();
          break;
        case TaskType.DOCUMENT_GENERATION:
          subTasks = this.decomposeDocumentGenerationTask();
          break;
        case TaskType.ANALYSIS:
          subTasks = this.decomposeAnalysisTask();
          break;
        case TaskType.LEGAL_RESEARCH:
          subTasks = this.decomposeLegalResearchTask();
          break;
        case TaskType.CUSTOM:
          subTasks = this.decomposeCustomTask(caseInfo);
          break;
        default:
          throw this.createError(
            PlanningErrorType.INVALID_TASK_TYPE,
            `Unknown task type: ${taskType}`
          );
      }

      // 优化任务分解
      if (this.config.enableOptimization) {
        subTasks = this.optimizeTasks(subTasks);
      }

      // 计算总时间和关键路径
      const totalTime = this.calculateTotalTime(subTasks);
      const criticalPath = this.calculateCriticalPath(subTasks);

      return {
        subTasks,
        totalTime,
        criticalPath,
      };
    } catch (error) {
      throw this.createError(
        PlanningErrorType.DECOMPOSITION_FAILED,
        error instanceof Error ? error.message : 'Task decomposition failed',
        { originalError: error }
      );
    }
  }

  // 辩论任务分解
  private decomposeDebateTask(): SubTask[] {
    return [
      this.createSubTask(
        'analyze_document',
        '分析文档',
        AgentType.DOC_ANALYZER,
        TaskPriority.HIGH,
        3000,
        [],
        '解析案件文档，提取关键信息'
      ),
      this.createSubTask(
        'search_laws',
        '检索法条',
        AgentType.RESEARCHER,
        TaskPriority.HIGH,
        2000,
        ['analyze_document'],
        '检索相关法律条文'
      ),
      this.createSubTask(
        'generate_arguments',
        '生成论点',
        AgentType.WRITER,
        TaskPriority.HIGH,
        5000,
        ['analyze_document', 'search_laws'],
        '生成正反方论点'
      ),
      this.createSubTask(
        'review_result',
        '审查结果',
        AgentType.REVIEWER,
        TaskPriority.MEDIUM,
        2000,
        ['generate_arguments'],
        '验证生成结果的质量'
      ),
    ];
  }

  // 文档生成任务分解
  private decomposeDocumentGenerationTask(): SubTask[] {
    return [
      this.createSubTask(
        'analyze_case',
        '分析案件',
        AgentType.DOC_ANALYZER,
        TaskPriority.HIGH,
        2000,
        [],
        '分析案件基本情况'
      ),
      this.createSubTask(
        'generate_document',
        '生成文书',
        AgentType.WRITER,
        TaskPriority.HIGH,
        4000,
        ['analyze_case'],
        '根据模板生成法律文书'
      ),
      this.createSubTask(
        'verify_document',
        '验证文书',
        AgentType.REVIEWER,
        TaskPriority.MEDIUM,
        1500,
        ['generate_document'],
        '验证文书格式和内容'
      ),
    ];
  }

  // 分析任务分解
  private decomposeAnalysisTask(): SubTask[] {
    return [
      this.createSubTask(
        'extract_parties',
        '提取当事人',
        AgentType.DOC_ANALYZER,
        TaskPriority.HIGH,
        2000,
        [],
        '识别案件当事人'
      ),
      this.createSubTask(
        'extract_claims',
        '提取诉讼请求',
        AgentType.DOC_ANALYZER,
        TaskPriority.HIGH,
        1500,
        ['extract_parties'],
        '提取诉讼请求信息'
      ),
      this.createSubTask(
        'analyze_evidence',
        '分析证据',
        AgentType.EVIDENCE_ANALYZER,
        TaskPriority.MEDIUM,
        3000,
        [],
        '分析证据链'
      ),
    ];
  }

  // 法律研究任务分解
  private decomposeLegalResearchTask(): SubTask[] {
    return [
      this.createSubTask(
        'identify_legal_issues',
        '识别法律问题',
        AgentType.STRATEGIST,
        TaskPriority.HIGH,
        2000,
        [],
        '分析案件中的法律问题'
      ),
      this.createSubTask(
        'search_relevant_laws',
        '检索相关法律',
        AgentType.RESEARCHER,
        TaskPriority.HIGH,
        3000,
        ['identify_legal_issues'],
        '检索相关法律条文'
      ),
      this.createSubTask(
        'analyze_applicability',
        '分析适用性',
        AgentType.STRATEGIST,
        TaskPriority.MEDIUM,
        2500,
        ['search_relevant_laws'],
        '分析法律条文的适用性'
      ),
    ];
  }

  // 自定义任务分解
  private decomposeCustomTask(caseInfo?: unknown): SubTask[] {
    if (caseInfo && typeof caseInfo === 'object') {
      const info = caseInfo as Record<string, unknown>;
      const customTasks = info.customTasks as SubTask[] | undefined;

      if (customTasks && Array.isArray(customTasks)) {
        return customTasks;
      }
    }

    // 默认通用分解
    return [
      this.createSubTask(
        'analyze_input',
        '分析输入',
        AgentType.DOC_ANALYZER,
        TaskPriority.HIGH,
        2000,
        [],
        '分析输入数据'
      ),
      this.createSubTask(
        'process_data',
        '处理数据',
        AgentType.RESEARCHER,
        TaskPriority.HIGH,
        3000,
        ['analyze_input'],
        '处理和分析数据'
      ),
    ];
  }

  // 创建子任务
  private createSubTask(
    id: string,
    name: string,
    agent: AgentType,
    priority: TaskPriority,
    estimatedTime: number,
    dependencies?: string[],
    description?: string
  ): SubTask {
    return {
      id,
      name,
      agent,
      priority,
      dependencies: dependencies || [],
      estimatedTime,
      description,
    };
  }

  // 优化任务分解
  private optimizeTasks(tasks: SubTask[]): SubTask[] {
    // 按优先级排序
    const sortedTasks = [...tasks].sort((a, b) => {
      const priorityOrder = {
        [TaskPriority.URGENT]: 0,
        [TaskPriority.HIGH]: 1,
        [TaskPriority.MEDIUM]: 2,
        [TaskPriority.LOW]: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // 检查可并行执行的任务
    return this.identifyParallelTasks(sortedTasks);
  }

  // 识别可并行任务
  private identifyParallelTasks(tasks: SubTask[]): SubTask[] {
    const processed: SubTask[] = [];
    const executedIds = new Set<string>();

    for (const task of tasks) {
      // 检查依赖是否已执行
      const dependenciesMet =
        !task.dependencies ||
        task.dependencies.every(dep => executedIds.has(dep));

      if (dependenciesMet) {
        processed.push(task);
        executedIds.add(task.id);
      } else {
        processed.push(task);
      }
    }

    return processed;
  }

  // 计算总时间
  private calculateTotalTime(tasks: SubTask[]): number {
    return tasks.reduce((sum, task) => sum + (task.estimatedTime || 0), 0);
  }

  // 计算关键路径
  private calculateCriticalPath(tasks: SubTask[]): string[] {
    const taskMap = new Map<string, SubTask>();
    tasks.forEach(task => taskMap.set(task.id, task));

    // 拓扑排序
    const inDegree = new Map<string, number>();
    taskMap.forEach(task => {
      inDegree.set(task.id, task.dependencies?.length || 0);
    });

    const queue: string[] = [];
    inDegree.forEach((degree, taskId) => {
      if (degree === 0) {
        queue.push(taskId);
      }
    });

    const criticalPath: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      criticalPath.push(current);

      // 找到依赖当前任务的任务
      taskMap.forEach(task => {
        if (task.dependencies?.includes(current)) {
          const newDegree = (inDegree.get(task.id) || 0) - 1;
          inDegree.set(task.id, newDegree);

          if (newDegree === 0) {
            queue.push(task.id);
          }
        }
      });
    }

    return criticalPath;
  }

  // 创建错误
  private createError(
    type: PlanningErrorType,
    message: string,
    details?: unknown
  ): PlanningError {
    return {
      type,
      message,
      details,
    };
  }

  // 更新配置
  public updateConfig(config: Partial<DecompositionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 获取当前配置
  public getConfig(): DecompositionConfig {
    return { ...this.config };
  }
}
