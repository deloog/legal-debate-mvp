/**
 * 提示词构建器单元测试
 */

import {
  buildAnalysisPrompt,
  buildPrompt,
  type PromptConfig,
} from '@/lib/agent/doc-analyzer/utils/prompt-builder';

describe('提示词构建器', () => {
  describe('buildAnalysisPrompt - 构建分析提示词', () => {
    it('应该包含角色信息', () => {
      const text = '测试文档内容';
      const prompt = buildAnalysisPrompt(text);

      expect(prompt).toContain('专业法律文档分析专家');
    });

    it('应该包含文档内容', () => {
      const text = '测试文档内容';
      const prompt = buildAnalysisPrompt(text);

      expect(prompt).toContain(text);
    });

    it('应该包含输出要求', () => {
      const text = '测试文档内容';
      const prompt = buildAnalysisPrompt(text);

      expect(prompt).toContain('输出要求');
      expect(prompt).toContain('JSON格式');
    });

    it('应该包含约束条件', () => {
      const text = '测试文档内容';
      const prompt = buildAnalysisPrompt(text);

      expect(prompt).toContain('只返回JSON');
      expect(prompt).toContain('金额使用数字格式');
    });

    it('应该根据选项包含分析任务', () => {
      const text = '测试文档内容';
      const prompt = buildAnalysisPrompt(text);

      expect(prompt).toContain('当事人信息提取');
      expect(prompt).toContain('诉讼请求识别');
      expect(prompt).toContain('时间线整理');
    });
  });

  describe('buildPrompt - 构建通用提示词', () => {
    it('应该使用配置中的角色', () => {
      const config: PromptConfig = {
        role: '测试角色',
      };
      const prompt = buildPrompt('测试文本', config);

      expect(prompt).toContain('角色：测试角色');
    });

    it('应该使用配置中的输出格式', () => {
      const config: PromptConfig = {
        outputFormat: '测试格式',
      };
      const prompt = buildPrompt('测试文本', config);

      expect(prompt).toContain('格式：测试格式');
    });

    it('应该使用配置中的约束条件', () => {
      const config: PromptConfig = {
        constraints: ['约束1', '约束2'],
      };
      const prompt = buildPrompt('测试文本', config);

      expect(prompt).toContain('1. 约束1');
      expect(prompt).toContain('2. 约束2');
    });

    it('应该包含JSON模式', () => {
      const config: PromptConfig = {
        task: '测试任务',
      };
      const prompt = buildPrompt('测试文本', config);

      expect(prompt).toContain('JSON格式返回');
      expect(prompt).toContain('extractedData');
      expect(prompt).toContain('parties');
      expect(prompt).toContain('claims');
      expect(prompt).toContain('测试任务');
    });

    it('应该处理空配置（使用默认任务）', () => {
      const config: PromptConfig = {
        task: '测试任务',
      };
      const prompt = buildPrompt('测试文本', config);

      expect(prompt).toContain('测试文本');
      expect(prompt).toContain('测试任务');
    });
  });

  describe('DocumentAnalysisOptions - 分析选项处理', () => {
    it('应该包含当事人提取任务', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text, {
        extractParties: true,
        extractClaims: false,
        extractTimeline: false,
      });

      expect(prompt).toContain('当事人信息提取');
    });

    it('应该包含诉讼请求识别任务', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text, {
        extractParties: false,
        extractClaims: true,
        extractTimeline: false,
      });

      expect(prompt).toContain('诉讼请求识别');
    });

    it('应该包含时间线整理任务', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text, {
        extractParties: false,
        extractClaims: false,
        extractTimeline: true,
      });

      expect(prompt).toContain('时间线整理');
    });

    it('应该包含案件摘要生成任务', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text, {
        extractParties: false,
        extractClaims: false,
        extractTimeline: false,
        generateSummary: true,
      });

      expect(prompt).toContain('案件摘要生成');
    });

    it('应该包含多个任务', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text, {
        extractParties: true,
        extractClaims: true,
        extractTimeline: true,
        generateSummary: true,
      });

      expect(prompt).toContain('当事人信息提取');
      expect(prompt).toContain('诉讼请求识别');
      expect(prompt).toContain('时间线整理');
      expect(prompt).toContain('案件摘要生成');
    });

    it('应该处理全部禁用的选项', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text, {
        extractParties: false,
        extractClaims: false,
        extractTimeline: false,
      });

      expect(prompt).toContain('文档分析');
    });

    it('应该处理空选项', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text);

      expect(prompt).toContain('当事人信息提取');
      expect(prompt).toContain('诉讼请求识别');
    });
  });

  describe('JSON模式', () => {
    it('应该包含parties数组结构', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text);

      expect(prompt).toContain('"parties"');
      expect(prompt).toContain('"type": "plaintiff|defendant|other"');
      expect(prompt).toContain('"name"');
    });

    it('应该包含claims数组结构', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text);

      expect(prompt).toContain('"claims"');
      expect(prompt).toContain('"content"');
      expect(prompt).toContain('"amount"');
      expect(prompt).toContain('"currency"');
    });

    it('应该包含timeline数组结构', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text);

      expect(prompt).toContain('"timeline"');
      expect(prompt).toContain('"date"');
      expect(prompt).toContain('"event"');
    });

    it('应该包含confidence字段', () => {
      const text = '测试文档';
      const prompt = buildAnalysisPrompt(text);

      expect(prompt).toContain('"confidence"');
    });
  });
});
