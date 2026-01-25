/**
 * 模板变量引擎测试
 * 测试模板解析、变量提取、渲染等功能
 */

import {
  VariableEngine,
  renderTemplate,
  extractTemplateVars,
  validateTemplateVars,
} from '@/lib/template/variable-engine';
import {
  TemplateVariable,
  TemplateVariableType,
} from '@/types/document-template';

describe('VariableEngine', () => {
  describe('基本变量渲染', () => {
    it('应该正确替换简单变量', () => {
      const template = '你好，{{name}}！';
      const context = { name: '张三' };
      const result = renderTemplate(template, context);

      expect(result).toBe('你好，张三！');
    });

    it('应该正确替换多个变量', () => {
      const template = '{{greeting}}，{{name}}！今天是{{date}}';
      const context = {
        greeting: '你好',
        name: '李四',
        date: '2024年1月1日',
      };
      const result = renderTemplate(template, context);

      expect(result).toBe('你好，李四！今天是2024年1月1日');
    });

    it('应该正确处理嵌套变量路径', () => {
      const template =
        '原告：{{plaintiff.name}}，联系电话：{{plaintiff.phone}}';
      const context = {
        plaintiff: {
          name: '王五',
          phone: '13800138000',
        },
      };
      const result = renderTemplate(template, context);

      expect(result).toBe('原告：王五，联系电话：13800138000');
    });

    it('应该正确处理日期对象', () => {
      const template = '签署日期：{{signDate}}';
      const date = new Date('2024-01-15');
      const context = {
        signDate: date,
      };
      const result = renderTemplate(template, context);

      expect(result).toContain('2024');
    });

    it('应该正确处理数字类型', () => {
      const template = '案件编号：{{caseNo}}，金额：{{amount}}元';
      const context = { caseNo: 202401, amount: 100000 };
      const result = renderTemplate(template, context);

      expect(result).toBe('案件编号：202401，金额：100000元');
    });
  });

  describe('条件语句', () => {
    it('应该正确处理if条件（真值）', () => {
      const template = '{{#if isAppealed}}此案件已提起上诉{{/if}}';
      const context = { isAppealed: true };
      const result = renderTemplate(template, context);

      expect(result).toBe('此案件已提起上诉');
    });

    it('应该正确处理if条件（假值）', () => {
      const template = '{{#if isAppealed}}此案件已提起上诉{{/if}}';
      const context = { isAppealed: false };
      const result = renderTemplate(template, context);

      expect(result).toBe('');
    });

    it('应该正确处理unless条件（假值）', () => {
      const template = '{{#unless isAppealed}}此案件未提起上诉{{/unless}}';
      const context = { isAppealed: false };
      const result = renderTemplate(template, context);

      expect(result).toBe('此案件未提起上诉');
    });

    it('应该正确处理unless条件（真值）', () => {
      const template = '{{#unless isAppealed}}此案件未提起上诉{{/unless}}';
      const context = { isAppealed: true };
      const result = renderTemplate(template, context);

      expect(result).toBe('');
    });

    it('应该正确处理条件中的空数组', () => {
      const template = '{{#if hasEvidence}}有证据{{/if}}';
      const context = { hasEvidence: [] };
      const result = renderTemplate(template, context);

      expect(result).toBe('');
    });

    it('应该正确处理条件中的非空数组', () => {
      const template = '{{#if hasEvidence}}有证据{{/if}}';
      const context = { hasEvidence: ['证据1'] };
      const result = renderTemplate(template, context);

      expect(result).toBe('有证据');
    });
  });

  describe('循环语句', () => {
    it('应该正确处理each循环', () => {
      const template = '诉讼请求：{{#each claims}}- {{this}}{{/each}}';
      const context = {
        claims: ['请求1', '请求2', '请求3'],
      };
      const result = renderTemplate(template, context);

      expect(result).toBe('诉讼请求：- 请求1- 请求2- 请求3');
    });

    it('应该正确处理嵌套循环', () => {
      const template = '证据：{{#each evidence}}- {{this}} {{/each}}';
      const context = {
        evidence: ['照片', '视频'],
      };
      const result = renderTemplate(template, context);

      expect(result).toBe('证据：- 照片 - 视频 ');
    });

    it('应该正确处理空数组', () => {
      const template = '证据：{{#each evidence}}- {{this}}{{/each}}';
      const context = { evidence: [] };
      const result = renderTemplate(template, context);

      expect(result).toBe('证据：');
    });

    it('应该正确处理对象数组循环', () => {
      const template = '{{#each parties}}{{name}}：{{role}} {{/each}}';
      const context = {
        parties: [
          { name: '张三', role: '原告' },
          { name: '李四', role: '被告' },
        ],
      };
      const result = renderTemplate(template, context);

      expect(result).toBe('张三：原告 李四：被告 ');
    });
  });

  describe('复杂模板', () => {
    it('应该正确处理混合模板', () => {
      const template = `
        民事起诉状
        
        原告：{{plaintiff.name}}
        被告：{{defendant.name}}
        
        {{#if isAppealed}}
        此案件已提起上诉
        {{/if}}
        
        诉讼请求：
        {{#each claims}}
        - {{this}}
        {{/each}}
      `;

      const context = {
        plaintiff: { name: '张三' },
        defendant: { name: '李四' },
        isAppealed: false,
        claims: ['请求1', '请求2'],
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('张三');
      expect(result).toContain('李四');
      expect(result).toContain('请求1');
      expect(result).toContain('请求2');
      expect(result).not.toContain('此案件已提起上诉');
    });
  });

  describe('严格模式', () => {
    it('严格模式下未定义变量应该抛出错误', () => {
      const template = '你好，{{name}}！';
      const context = {};

      const engine = new VariableEngine({ strict: true });

      expect(() => {
        engine.render(template, context);
      }).toThrow('变量未定义');
    });

    it('非严格模式下未定义变量应该返回空字符串', () => {
      const template = '你好，{{name}}！';
      const context = {};
      const result = renderTemplate(template, context);

      expect(result).toBe('你好，！');
    });

    it('严格模式下循环变量必须是数组', () => {
      const template = '{{#each items}}{{this}}{{/each}}';
      const context = { items: 'not an array' };

      const engine = new VariableEngine({ strict: true });

      expect(() => {
        engine.render(template, context);
      }).toThrow('循环变量必须是数组');
    });
  });

  describe('变量提取', () => {
    it('应该正确提取简单变量', () => {
      const template = '你好，{{name}}！';
      const variables = extractTemplateVars(template);

      expect(variables).toHaveLength(1);
      expect(variables[0].name).toBe('name');
    });

    it('应该正确提取嵌套变量', () => {
      const template = '原告：{{plaintiff.name}}，电话：{{plaintiff.phone}}';
      const variables = extractTemplateVars(template);

      expect(variables).toHaveLength(2);
      expect(variables[0].name).toBe('plaintiff.name');
      expect(variables[1].name).toBe('plaintiff.phone');
    });

    it('应该正确去重变量', () => {
      const template = '{{name}}和{{name}}是朋友';
      const variables = extractTemplateVars(template);

      expect(variables).toHaveLength(1);
      expect(variables[0].name).toBe('name');
    });

    it('应该推断变量类型为date', () => {
      const template = '签署日期：{{signDate}}';
      const variables = extractTemplateVars(template);

      expect(variables[0].type).toBe(TemplateVariableType.DATE);
    });

    it('应该推断变量类型为number', () => {
      const template = '案件编号：{{caseNo}}';
      const variables = extractTemplateVars(template);

      expect(variables[0].type).toBe(TemplateVariableType.NUMBER);
    });

    it('应该推断变量类型为boolean', () => {
      const template = '{{#if isEnabled}}启用{{/if}}';
      const variables = extractTemplateVars(template);

      const enabledVar = variables.find(v => v.name === 'isEnabled');
      expect(enabledVar?.type).toBe(TemplateVariableType.BOOLEAN);
    });

    it('应该推断变量类型为text', () => {
      const template = '案件描述：{{caseDescription}}';
      const variables = extractTemplateVars(template);

      expect(variables[0].type).toBe(TemplateVariableType.TEXT);
    });

    it('默认应该推断变量类型为string', () => {
      const template = '你好，{{name}}！';
      const variables = extractTemplateVars(template);

      expect(variables[0].type).toBe(TemplateVariableType.STRING);
    });
  });

  describe('变量验证', () => {
    it('应该验证必填变量是否提供', () => {
      const template = '你好，{{name}}！';
      const providedVariables: Record<string, unknown> = {};
      const requiredVariables: TemplateVariable[] = [
        {
          name: 'name',
          type: TemplateVariableType.STRING,
          description: '姓名',
          required: true,
        },
      ];

      const result = validateTemplateVars(
        template,
        providedVariables,
        requiredVariables
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('name');
    });

    it('应该通过正确的必填变量验证', () => {
      const template = '你好，{{name}}！';
      const providedVariables = { name: '张三' };
      const requiredVariables: TemplateVariable[] = [
        {
          name: 'name',
          type: TemplateVariableType.STRING,
          description: '姓名',
          required: true,
        },
      ];

      const result = validateTemplateVars(
        template,
        providedVariables,
        requiredVariables
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('可选变量缺失应该通过验证', () => {
      const template = '你好，{{name}}！';
      const providedVariables = { name: '张三' };
      const requiredVariables: TemplateVariable[] = [
        {
          name: 'name',
          type: TemplateVariableType.STRING,
          description: '姓名',
          required: true,
        },
        {
          name: 'age',
          type: TemplateVariableType.NUMBER,
          description: '年龄',
          required: false,
        },
      ];

      const result = validateTemplateVars(
        template,
        providedVariables,
        requiredVariables
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('引擎类实例方法', () => {
    it('应该正确调用引擎的render方法', () => {
      const engine = new VariableEngine();
      const template = '测试：{{value}}';
      const context = { value: 123 };

      const result = engine.render(template, context);

      expect(result).toBe('测试：123');
    });

    it('应该正确调用引擎的extractVariables方法', () => {
      const engine = new VariableEngine();
      const template = '{{var1}}和{{var2}}';

      const variables = engine.extractVariables(template);

      expect(variables).toHaveLength(2);
      expect(variables[0].name).toBe('var1');
      expect(variables[1].name).toBe('var2');
    });

    it('应该正确调用引擎的validateVariables方法', () => {
      const engine = new VariableEngine();
      const template = '{{name}}';
      const providedVariables = { name: '测试' };
      const requiredVariables: TemplateVariable[] = [
        {
          name: 'name',
          type: TemplateVariableType.STRING,
          description: '姓名',
          required: true,
        },
      ];

      const result = engine.validateVariables(
        template,
        providedVariables,
        requiredVariables
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('应该正确处理空模板', () => {
      const template = '';
      const context = { name: '测试' };
      const result = renderTemplate(template, context);

      expect(result).toBe('');
    });

    it('应该正确处理纯文本模板', () => {
      const template = '这是纯文本，没有变量';
      const context = { name: '测试' };
      const result = renderTemplate(template, context);

      expect(result).toBe('这是纯文本，没有变量');
    });

    it('应该正确处理null值', () => {
      const template = '值：{{value}}';
      const context = { value: null };
      const result = renderTemplate(template, context);

      expect(result).toBe('值：');
    });

    it('应该正确处理undefined值', () => {
      const template = '值：{{value}}';
      const context = { value: undefined };
      const result = renderTemplate(template, context);

      expect(result).toBe('值：');
    });

    it('应该正确处理对象值', () => {
      const template = '值：{{value}}';
      const context = { value: { key: 'val' } };
      const result = renderTemplate(template, context);

      expect(result).toContain('key');
    });

    it('应该正确处理深层嵌套路径', () => {
      const template = '值：{{a.b.c.d}}';
      const context = {
        a: {
          b: {
            c: {
              d: '深层值',
            },
          },
        },
      };
      const result = renderTemplate(template, context);

      expect(result).toBe('值：深层值');
    });

    it('应该正确处理中断的嵌套路径', () => {
      const template = '值：{{a.b.c}}';
      const context = {
        a: {
          b: '不是对象',
        },
      };
      const result = renderTemplate(template, context);

      expect(result).toBe('值：');
    });
  });
});
