/**
 * 模板解析器
 * 解析模板字符串为AST节点树
 */

import {
  type TemplateNode,
  type TextNode,
  type VariableNode,
  type ConditionNode,
  type LoopNode,
} from './variable-engine';

// 为了避免循环依赖，不直接导入类型，而是通过函数参数使用
export type { TemplateNode, TextNode, VariableNode, ConditionNode, LoopNode };

/**
 * 模板解析器类
 */
export class TemplateParser {
  /**
   * 解析模板字符串
   */
  parse(template: string): TemplateNode[] {
    const nodes: TemplateNode[] = [];
    let pos = 0;
    const length = template.length;

    while (pos < length) {
      // 查找变量、条件或循环的开始标记
      const variableStart = template.indexOf('{{', pos);
      const conditionStart = template.indexOf('{{#if', pos);
      const unlessStart = template.indexOf('{{#unless', pos);
      const loopStart = template.indexOf('{{#each', pos);

      // 找到最近的开始标记
      const positions = [
        { type: 'variable', start: variableStart },
        { type: 'condition', start: conditionStart },
        { type: 'condition', start: unlessStart },
        { type: 'loop', start: loopStart },
      ].filter(p => p.start !== -1);

      if (positions.length === 0) {
        // 没有更多标记，添加剩余文本
        if (pos < length) {
          nodes.push({ type: 'text', content: template.slice(pos) });
        }
        break;
      }

      // 找到最近的开始标记
      const nearest = positions.reduce((a, b) => (a.start < b.start ? a : b));

      // 添加开始标记前的文本
      if (nearest.start > pos) {
        nodes.push({
          type: 'text',
          content: template.slice(pos, nearest.start),
        });
      }

      // 处理不同类型的标记
      if (nearest.type === 'variable') {
        // 处理变量 {{variable}}
        const node = this.parseVariable(template, nearest.start);
        nodes.push(node);
        pos = node.endPos;
      } else if (nearest.type === 'condition') {
        // 处理条件 {{#if}}...{{/if}} 或 {{#unless}}...{{/unless}}
        const node = this.parseCondition(template, nearest.start);
        nodes.push(node);
        pos = node.endPos;
      } else if (nearest.type === 'loop') {
        // 处理循环 {{#each}}...{{/each}}
        const node = this.parseLoop(template, nearest.start);
        nodes.push(node);
        pos = node.endPos;
      }
    }

    return nodes;
  }

  /**
   * 解析变量 {{variable}}
   */
  private parseVariable(
    template: string,
    startPos: number
  ): VariableNode & { endPos: number } {
    const endPos = template.indexOf('}}', startPos);

    if (endPos === -1) {
      throw new Error(`变量标记未闭合: 位置 ${startPos}`);
    }

    const content = template.slice(startPos + 2, endPos).trim();
    // 处理 this 和其他特殊变量
    const path = content.split('.').filter(p => p.length > 0);

    return {
      type: 'variable',
      path,
      endPos: endPos + 2,
    };
  }

  /**
   * 解析条件语句 {{#if condition}}...{{/if}} 或 {{#unless condition}}...{{/unless}}
   */
  private parseCondition(
    template: string,
    startPos: number
  ): ConditionNode & { endPos: number } {
    // 确定条件类型
    const isUnless = template.startsWith('{{#unless', startPos);
    const prefix = isUnless ? '#unless' : '#if';

    // 查找条件语句的结束标记 }}
    const endCondition = template.indexOf('}}', startPos);
    if (endCondition === -1) {
      throw new Error(`条件语句标记未闭合: 位置 ${startPos}`);
    }

    // 提取条件表达式
    const condition = template
      .slice(startPos + prefix.length + 2, endCondition)
      .trim();

    // 查找对应的结束标记 {{/if}} 或 {{/unless}}
    const endMarker = isUnless ? '{{/unless}}' : '{{/if}}';
    const endPos = template.indexOf(endMarker, endCondition + 2);

    if (endPos === -1) {
      throw new Error(`条件语句缺少结束标记 ${endMarker}`);
    }

    // 解析条件内容
    const contentStr = template.slice(endCondition + 2, endPos);
    const content = this.parse(contentStr);

    return {
      type: 'condition',
      kind: isUnless ? 'unless' : 'if',
      condition,
      content,
      endPos: endPos + endMarker.length,
    };
  }

  /**
   * 解析循环语句 {{#each items}}...{{/each}}
   */
  private parseLoop(
    template: string,
    startPos: number
  ): LoopNode & { endPos: number } {
    // 查找循环语句的结束标记 }}
    const endCondition = template.indexOf('}}', startPos);
    if (endCondition === -1) {
      throw new Error(`循环语句标记未闭合: 位置 ${startPos}`);
    }

    // 提取数组变量
    const pathStr = template
      .slice(startPos + 7, endCondition) // {{#each is 7 chars
      .trim();
    const path = pathStr.split('.').filter(p => p.length > 0);

    // 查找对应的结束标记 {{/each}}
    const endPos = template.indexOf('{{/each}}', endCondition + 2);

    if (endPos === -1) {
      throw new Error(`循环语句缺少结束标记 {{/each}}`);
    }

    // 解析循环内容
    const contentStr = template.slice(endCondition + 2, endPos);
    const content = this.parse(contentStr);

    return {
      type: 'loop',
      path,
      content,
      endPos: endPos + 9, // {{/each}} is 9 chars
    };
  }
}

/**
 * 默认解析器实例
 */
const defaultParser = new TemplateParser();

/**
 * 便捷函数：解析模板
 */
export function parseTemplate(template: string): TemplateNode[] {
  return defaultParser.parse(template);
}

/**
 * 验证模板语法
 */
export function validateTemplate(template: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    parseTemplate(template);
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    } else {
      errors.push('未知错误');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
