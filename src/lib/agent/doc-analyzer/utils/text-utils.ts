/**
 * 文本处理工具 - 提供通用的文本处理功能
 *
 * 核心功能：
 * - 文本分块和合并
 * - 中文文本处理
 * - 金额和日期格式化
 * - 文本相似度计算
 * - 关键词提取
 */

import type { TextChunk } from '../core/types';

/**
 * 分割文本为多个块
 */
export function splitText(text: string, maxSize: number = 4000): TextChunk[] {
  const chunks: TextChunk[] = [];
  let pos = 0;

  while (pos < text.length) {
    let end = Math.min(pos + maxSize, text.length);

    if (end < text.length) {
      const lastPos = text.substring(pos, end).lastIndexOf('。');
      const lastPos1 = text.substring(pos, end).lastIndexOf('！');
      const lastPos2 = text.substring(pos, end).lastIndexOf('？');
      const lastPos3 = text.substring(pos, end).lastIndexOf('；');

      const bestPos = Math.max(lastPos, lastPos1, lastPos2, lastPos3);

      if (bestPos > pos) {
        end = pos + bestPos + 1;
      }
    }

    chunks.push({
      text: text.substring(pos, end),
      start: pos,
      end,
    });
    pos = end;
  }

  return chunks;
}

/**
 * 合并文本块
 */
export function mergeChunks(chunks: TextChunk[]): string {
  return chunks.map(chunk => chunk.text).join('');
}

/**
 * 标准化中文文本
 */
export function normalizeChineseText(text: string): string {
  return text
    .replace(/[，]/g, '，')
    .replace(/[。]/g, '。')
    .replace(/[；]/g, '；')
    .replace(/[：]/g, '：')
    .replace(/[？]/g, '？')
    .replace(/[！]/g, '！')
    .trim();
}

/**
 * 提取关键词（基于简单的词频统计）
 */
export function extractKeywords(text: string, count: number = 10): string[] {
  const words = text.split(/[\s，。；：？！、]+/).filter(w => w.length > 1);
  const frequency = new Map<string, number>();

  words.forEach(word => {
    const freq = frequency.get(word) || 0;
    frequency.set(word, freq + 1);
  });

  const sorted = Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);

  return sorted;
}

/**
 * 计算文本相似度（基于Jaccard相似度）
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const set1 = new Set(text1.split(''));
  const set2 = new Set(text2.split(''));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * 检查文本是否为空或仅含空白字符
 */
export function isEmptyOrWhitespace(text: string): boolean {
  return !text || text.trim().length === 0;
}

/**
 * 截断文本到指定长度
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * 移除多余空格
 */
export function removeExtraSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 估算Token数量
 */
export function estimateTokens(text: string): number {
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const other = text.length - chinese;
  return Math.ceil(chinese / 1.5 + other / 4);
}
