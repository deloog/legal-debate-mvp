/**
 * 模板变量引擎
 * 提供强大的模板变量替换功能，支持条件语句、循环、嵌套变量等
 */

import { parseTemplate } from './template-parser';
import { extractTemplateVariables } from './variable-extractor';
import {
  TemplateVariable,
  TemplateValidationResult,
  TemplateValidationError,
} from '@/types/document-template';

/**
 * 模板节点类型
 */
export type TemplateNode = TextNode | VariableNode | ConditionNode | LoopNode;

/**
 * 文本节点
 */
export interface TextNode {
  type: 'text';
  content: string;
}

/**
 * 变量节点
 */
export interface VariableNode {
  type: 'variable';
  path: string[];
}

/**
 * 条件节点
 */
export interface ConditionNode {
  type: 'condition';
  kind: 'if' | 'unless';
  condition: string;
  content: TemplateNode[];
}

/**
 * 循环节点
 */
export interface LoopNode {
  type: 'loop';
  path: string[];
  content: TemplateNode[];
}

/**
 * 模板渲染上下文
 */
export interface RenderContext {
  [key: string]: unknown;
}

/**
 * 模板渲染选项
 */
export interface RenderOptions {
  /**
   * 是否严格模式（未定义变量抛出错误）
   */
  strict?: boolean;
  /**
   * 是否启用帮助函数
   */
  enableHelpers?: boolean;
}

/**
 * 模板变量引擎类
 */
export class VariableEngine {
  private options: RenderOptions;

  constructor(options: RenderOptions = {}) {
    this.options = {
      strict: false,
      enableHelpers: true,
      ...options,
    };
  }

  /**
   * 渲染模板
   * @param template - 模板内容
   * @param context - 渲染上下文
   * @returns 渲染后的内容
   */
  render(template: string, context: RenderContext): string {
    const parsed = parseTemplate(template);
    return this.renderParsed(parsed, context);
  }

  /**
   * 渲染解析后的模板
   */
  private renderParsed(parsed: TemplateNode[], context: RenderContext): string {
    return parsed.map(node => this.renderNode(node, context)).join('');
  }

  /**
   * 渲染单个节点
   */
  private renderNode(node: TemplateNode, context: RenderContext): string {
    switch (node.type) {
      case 'text':
        return node.content;
      case 'variable':
        return this.renderVariable(node, context);
      case 'condition':
        return this.renderCondition(node, context);
      case 'loop':
        return this.renderLoop(node, context);
      default:
        return '';
    }
  }

  /**
   * 渲染变量
   */
  private renderVariable(node: VariableNode, context: RenderContext): string {
    const value = this.getValue(node.path, context);

    if (value === undefined || value === null) {
      if (this.options.strict) {
        throw new Error(`变量未定义: ${node.path.join('.')}`);
      }
      return '';
    }

    // 特殊处理 this 变量 - 直接格式化当前项
    if (node.path.length === 1 && node.path[0] === 'this') {
      return String(value);
    }

    return this.formatValue(value);
  }

  /**
   * 渲染条件语句
   */
  private renderCondition(node: ConditionNode, context: RenderContext): string {
    const condition = this.evaluateCondition(node.condition, context);

    if (node.kind === 'if') {
      return condition ? this.renderParsed(node.content, context) : '';
    } else {
      return condition ? '' : this.renderParsed(node.content, context);
    }
  }

  /**
   * 渲染循环语句
   */
  private renderLoop(node: LoopNode, context: RenderContext): string {
    const items = this.getValue(node.path, context);

    if (!Array.isArray(items)) {
      if (this.options.strict) {
        throw new Error(`循环变量必须是数组: ${node.path.join('.')}`);
      }
      return '';
    }

    return items
      .map((item, index) => {
        const loopContext: RenderContext = {
          ...context,
          this: item,
          '@index': index,
          '@first': index === 0,
          '@last': index === items.length - 1,
        };
        return this.renderParsed(node.content, loopContext);
      })
      .join('');
  }

  /**
   * 获取路径对应的值
   */
  private getValue(path: string[], context: RenderContext): unknown {
    if (path.length === 0) {
      return context;
    }

    // 如果路径是 ['this']，返回 context['this'] 的值（循环中的当前项）
    if (path.length === 1 && path[0] === 'this') {
      return context['this'];
    }

    // 尝试从主上下文获取值
    let value: unknown = context;
    for (const key of path) {
      if (value === null || value === undefined) {
        return undefined;
      }

      if (typeof value === 'object') {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    // 如果主上下文中找不到，并且是在循环中（有 this），尝试从 this 获取
    if (
      value === undefined &&
      context['this'] !== undefined &&
      path.length === 1
    ) {
      const thisObj = context['this'];
      if (typeof thisObj === 'object' && thisObj !== null) {
        value = (thisObj as Record<string, unknown>)[path[0]];
      }
    }

    return value;
  }

  /**
   * 评估条件
   */
  private evaluateCondition(
    condition: string,
    context: RenderContext
  ): boolean {
    // 支持简单的条件判断
    const value = this.getValue(condition.split('.'), context);

    // 布尔值
    if (typeof value === 'boolean') {
      return value;
    }

    // 数值
    if (typeof value === 'number') {
      return value !== 0;
    }

    // 字符串
    if (typeof value === 'string') {
      return value.length > 0;
    }

    // 数组
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    // 对象
    if (typeof value === 'object' && value !== null) {
      return true;
    }

    return false;
  }

  /**
   * 格式化值
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toLocaleDateString('zh-CN');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }

  /**
   * 提取模板中的变量
   */
  extractVariables(template: string): TemplateVariable[] {
    return extractTemplateVariables(template);
  }

  /**
   * 验证变量是否完整
   */
  validateVariables(
    template: string,
    providedVariables: Record<string, unknown>,
    requiredVariables: TemplateVariable[]
  ): TemplateValidationResult {
    const templateVariables = this.extractVariables(template);
    const errors: TemplateValidationError[] = [];

    // 检查必填变量是否都提供了
    for (const templateVar of requiredVariables) {
      if (templateVar.required) {
        const hasVariable = templateVariables.some(
          tv => tv.name === templateVar.name
        );

        if (hasVariable && !(templateVar.name in providedVariables)) {
          errors.push({
            field: templateVar.name,
            message: `缺少必填变量: ${templateVar.name} (${templateVar.description})`,
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * 默认引擎实例
 */
export const defaultEngine = new VariableEngine();

/**
 * 便捷函数：渲染模板
 */
export function renderTemplate(
  template: string,
  context: RenderContext,
  options?: RenderOptions
): string {
  const engine = new VariableEngine(options);
  return engine.render(template, context);
}

/**
 * 便捷函数：提取模板变量
 */
export function extractTemplateVars(template: string): TemplateVariable[] {
  return defaultEngine.extractVariables(template);
}

/**
 * 便捷函数：验证模板变量
 */
export function validateTemplateVars(
  template: string,
  providedVariables: Record<string, unknown>,
  requiredVariables: TemplateVariable[]
): TemplateValidationResult {
  return defaultEngine.validateVariables(
    template,
    providedVariables,
    requiredVariables
  );
}
