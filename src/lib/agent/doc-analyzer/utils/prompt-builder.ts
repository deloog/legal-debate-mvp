/**
 * 提示词构建器 - 构建AI分析提示词模板
 *
 * 核心功能：
 * - 构建文档分析提示词
 * - 支持不同分析任务
 * - 支持动态参数注入
 */

import type { DocumentAnalysisOptions } from '../core/types';

export interface PromptConfig {
  role?: string;
  task?: string;
  outputFormat?: string;
  constraints?: string[];
}

/**
 * 创建文档分析提示词
 */
export function buildAnalysisPrompt(
  text: string,
  options?: DocumentAnalysisOptions
): string {
  const config: PromptConfig = {
    role: '专业法律文档分析专家',
    task: buildTaskList(options),
    outputFormat: 'JSON格式',
    constraints: [
      '只返回JSON，无其他文字',
      '确保字段完整，缺失字段使用默认值',
      '金额使用数字格式，不包含单位',
      '类型使用枚举值',
    ],
  };

  return buildPrompt(text, config, options);
}

/**
 * 构建通用提示词
 */
export function buildPrompt(
  text: string,
  config: PromptConfig,
  options?: DocumentAnalysisOptions
): string {
  const tasks = config.task || buildTaskList(options);
  const prompt: string[] = [];

  if (config.role) {
    prompt.push(`角色：${config.role}`);
  }

  prompt.push(`\n分析任务：${tasks}`);
  prompt.push('\n文档内容：');
  prompt.push(text);
  prompt.push('\n【输出要求】');

  if (config.outputFormat) {
    prompt.push(`格式：${config.outputFormat}`);
  }

  if (config.constraints && config.constraints.length > 0) {
    prompt.push('要求：');
    config.constraints.forEach((c, i) => {
      prompt.push(`${i + 1}. ${c}`);
    });
  }

  prompt.push('\n' + getJSONSchema());
  return prompt.join('\n');
}

/**
 * 构建任务列表
 */
function buildTaskList(options?: DocumentAnalysisOptions): string {
  const tasks: string[] = [];

  if (options?.extractParties !== false) tasks.push('当事人信息提取');
  if (options?.extractClaims !== false) tasks.push('诉讼请求识别');
  if (options?.extractTimeline !== false) tasks.push('时间线整理');
  if (options?.generateSummary === true) tasks.push('案件摘要生成');

  return tasks.length > 0 ? tasks.join('、') : '文档分析';
}

/**
 * 获取JSON输出模式
 */
function getJSONSchema(): string {
  return `按以下JSON格式返回：
{
  "extractedData": {
    "parties": [{"type": "plaintiff|defendant|other", "name": "姓名"}],
    "claims": [{"type": "PAY_PRINCIPAL|PAY_INTEREST|PAY_PENALTY|PAY_DAMAGES|LITIGATION_COST|PERFORMANCE|TERMINATION|OTHER", "content": "内容", "amount": 金额, "currency": "CNY"}],
    "timeline": [{"date": "YYYY-MM-DD", "event": "事件"}],
    "summary": "摘要",
    "caseType": "civil|criminal|administrative|commercial|labor|intellectual|other",
    "keyFacts": ["关键事实"]
  },
  "confidence": 0.95
}`;
}
