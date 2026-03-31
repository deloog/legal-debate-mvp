/**
 * AI驱动的法律检索词提取器（阶段1）
 *
 * 轻量级 AI 调用：给定案件信息，返回用于检索 law_articles 表的精准法律术语。
 * 解决静态关键词映射的脆性问题：新型案件、混合纠纷类型可被正确处理。
 *
 * 设计原则：
 * - 快速：使用 glm-4-flash（最快最便宜）或 deepseek-chat，max_tokens=200
 * - 容错：任何错误（网络、解析、超时）均返回空数组，调用方降级到静态规则
 * - 不依赖 UnifiedAIService：避免引入复杂初始化逻辑
 */

import OpenAI from 'openai';
import { logger } from '@/lib/logger';

// 案件类型中文标签
const CASE_TYPE_LABELS: Record<string, string> = {
  CIVIL: '民事纠纷',
  CRIMINAL: '刑事案件',
  ADMINISTRATIVE: '行政诉讼',
  LABOR: '劳动争议',
  COMMERCIAL: '商事纠纷',
  INTELLECTUAL_PROPERTY: '知识产权',
};

/**
 * 通过 AI 分析案件信息，提取精准的法律条文检索词
 *
 * @param caseType    案件类型（CIVIL/CRIMINAL/...）
 * @param caseTitle   案件标题
 * @param caseDescription 案件描述（截取前500字）
 * @param timeoutMs   超时毫秒数（默认4000ms）
 * @returns 8-12个法律术语数组；失败时返回空数组
 */
export async function extractKeywordsWithAI(
  caseType: string | null,
  caseTitle: string,
  caseDescription: string | null,
  timeoutMs = 10000
): Promise<string[]> {
  // 优先使用 ZhiPu（glm-4-flash 更快），次选 DeepSeek
  const zhipuKey = process.env.ZHIPU_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (!zhipuKey && !deepseekKey) {
    return [];
  }

  const useZhipu = !!zhipuKey;
  const apiKey = useZhipu ? zhipuKey! : deepseekKey!;
  const baseURL = useZhipu
    ? (process.env.ZHIPU_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4/')
    : (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1');
  const model = useZhipu ? 'glm-4-flash' : 'deepseek-chat';

  const caseTypeLabel = CASE_TYPE_LABELS[caseType ?? ''] ?? caseType ?? '未知';
  const descSnippet = caseDescription?.slice(0, 500) ?? '无';

  const prompt = `你是中国法律专家。根据以下案件信息，提取用于检索"法律条文数据库"的精准检索词。

要求：
- 输出8-12个中文法律术语
- 优先选择法律条文中出现的专业词汇（如"民间借贷""抵押权""借款合同""工伤认定"）
- 包含核心相关法律名称关键词（如"民法典""劳动合同法""道路交通安全法"）
- 避免过于宽泛的词（"合同""违约"），除非案件确实是纯合同纠纷
- 仅输出JSON数组，不要任何说明文字，示例：["民间借贷","借款合同","利息","还款期限","民法典"]

案件类型：${caseTypeLabel}
案件标题：${caseTitle}
案件描述：${descSnippet}`;

  const client = new OpenAI({ apiKey, baseURL, timeout: timeoutMs });

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const match = content.match(/\[[\s\S]*?\]/);
    if (!match) {
      logger.warn(
        '[ai-keyword-extractor] AI响应无法解析为JSON数组:',
        content.slice(0, 100)
      );
      return [];
    }

    const parsed = JSON.parse(match[0]) as unknown[];
    const keywords = parsed
      .filter((k): k is string => typeof k === 'string' && k.trim().length >= 2)
      .map(k => k.trim())
      .slice(0, 15);

    logger.info(
      `[ai-keyword-extractor] AI提取关键词（${model}）: [${keywords.join(', ')}]`
    );
    return keywords;
  } catch (err) {
    // 超时或 API 错误均静默降级，不影响主流程
    logger.warn(
      '[ai-keyword-extractor] AI关键词提取失败，降级到静态规则:',
      err
    );
    return [];
  }
}
