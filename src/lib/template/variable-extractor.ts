/**
 * 变量提取器
 * 从模板中提取所有变量引用
 */

import {
  TemplateVariable,
  TemplateVariableType,
} from '@/types/document-template';
import { parseTemplate, TemplateNode } from './template-parser';

/**
 * 变量提取器类
 */
export class VariableExtractor {
  /**
   * 从模板中提取变量
   */
  extractVariables(template: string): TemplateVariable[] {
    const nodes = parseTemplate(template);
    const variables = new Map<string, TemplateVariable>();

    this.extractFromNodes(nodes, variables);

    return Array.from(variables.values());
  }

  /**
   * 从节点树中提取变量
   */
  private extractFromNodes(
    nodes: TemplateNode[],
    variables: Map<string, TemplateVariable>
  ): void {
    for (const node of nodes) {
      switch (node.type) {
        case 'variable':
          this.addVariable(node, variables);
          break;
        case 'condition':
          // 提取条件表达式中的变量
          this.extractConditionVariable(node, variables);
          // 递归提取内容中的变量
          this.extractFromNodes(node.content, variables);
          break;
        case 'loop':
          this.extractFromNodes(node.content, variables);
          break;
      }
    }
  }

  /**
   * 从条件语句中提取变量
   */
  private extractConditionVariable(
    node: { condition: string },
    variables: Map<string, TemplateVariable>
  ): void {
    const condition = node.condition.trim();
    if (condition.length > 0) {
      const variable: TemplateVariable = {
        name: condition,
        type: this.inferType(condition),
        description: `条件变量: ${condition}`,
        required: true,
        defaultValue: null,
      };
      variables.set(condition, variable);
    }
  }

  /**
   * 添加变量到集合
   */
  private addVariable(
    node: { type: 'variable'; path: string[] },
    variables: Map<string, TemplateVariable>
  ): void {
    const varName = node.path.join('.');

    // 避免重复
    if (variables.has(varName)) {
      return;
    }

    // 推断变量类型（简化版，实际可以根据变量名推断）
    const variable: TemplateVariable = {
      name: varName,
      type: this.inferType(varName),
      description: `变量: ${varName}`,
      required: true,
      defaultValue: null,
    };

    variables.set(varName, variable);
  }

  /**
   * 推断变量类型
   */
  private inferType(varName: string): TemplateVariableType {
    const lowerName = varName.toLowerCase();

    // 根据变量名后缀或模式推断类型
    if (lowerName.includes('date') || lowerName.includes('time')) {
      return TemplateVariableType.DATE;
    }

    if (
      lowerName.includes('amount') ||
      lowerName.includes('count') ||
      lowerName.includes('number') ||
      lowerName.includes('total') ||
      lowerName.includes('price') ||
      lowerName.includes('fee') ||
      lowerName.endsWith('no') ||
      lowerName.includes('id') ||
      lowerName.includes('age') ||
      lowerName.includes('year') ||
      lowerName.includes('month') ||
      lowerName.includes('day')
    ) {
      return TemplateVariableType.NUMBER;
    }

    if (
      lowerName.includes('is') ||
      lowerName.includes('has') ||
      lowerName.includes('enabled') ||
      lowerName.includes('checked') ||
      lowerName.endsWith('ed')
    ) {
      return TemplateVariableType.BOOLEAN;
    }

    if (
      lowerName.includes('content') ||
      lowerName.includes('description') ||
      lowerName.includes('notes') ||
      lowerName.includes('details') ||
      lowerName.includes('summary') ||
      lowerName.includes('remark')
    ) {
      return TemplateVariableType.TEXT;
    }

    // 默认为字符串
    return TemplateVariableType.STRING;
  }
}

/**
 * 默认提取器实例
 */
const defaultExtractor = new VariableExtractor();

/**
 * 便捷函数：从模板中提取变量
 */
export function extractTemplateVariables(template: string): TemplateVariable[] {
  return defaultExtractor.extractVariables(template);
}

/**
 * 提取变量名称列表
 */
export function extractVariableNames(template: string): string[] {
  const variables = extractTemplateVariables(template);
  return variables.map(v => v.name);
}

/**
 * 检查模板是否使用了特定变量
 */
export function hasVariable(template: string, varName: string): boolean {
  const variables = extractTemplateVariables(template);
  return variables.some(v => v.name === varName);
}

/**
 * 获取模板中的所有变量路径
 */
export function getVariablePaths(template: string): string[][] {
  const nodes = parseTemplate(template);
  const paths: string[][] = [];

  const extractPaths = (nodeList: TemplateNode[]) => {
    for (const node of nodeList) {
      if (node.type === 'variable') {
        paths.push(node.path);
      } else if (node.type === 'condition' || node.type === 'loop') {
        extractPaths(node.content);
      }
    }
  };

  extractPaths(nodes);
  return paths;
}
