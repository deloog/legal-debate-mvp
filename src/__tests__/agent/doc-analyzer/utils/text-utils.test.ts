/**
 * 文本处理工具单元测试
 */

import {
  splitText,
  mergeChunks,
  normalizeChineseText,
  extractKeywords,
  calculateSimilarity,
  isEmptyOrWhitespace,
  truncateText,
  removeExtraSpaces,
  estimateTokens
} from '@/lib/agent/doc-analyzer/utils/text-utils';

describe('文本处理工具', () => {
  describe('splitText - 文本分块', () => {
    it('应该正确分割长文本', () => {
      const longText = '这是一个测试句子。这是另一个句子。再一个句子。'.repeat(100);
      const chunks = splitText(longText, 100);
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every(c => c.text.length <= 100)).toBe(true);
      expect(mergeChunks(chunks)).toBe(longText);
    });

    it('应该在句子边界分割', () => {
      const text = '第一句。第二句。第三句。';
      const chunks = splitText(text, 15);
      
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toContain('。');
    });

    it('处理短文本应该返回单块', () => {
      const shortText = '短文本';
      const chunks = splitText(shortText, 100);
      
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe(shortText);
    });
  });

  describe('mergeChunks - 合并文本块', () => {
    it('应该正确合并文本块', () => {
      const chunks = [
        { text: '第一部分', start: 0, end: 4 },
        { text: '第二部分', start: 4, end: 8 }
      ];
      
      const result = mergeChunks(chunks);
      expect(result).toBe('第一部分第二部分');
    });

    it('处理空数组应该返回空字符串', () => {
      const result = mergeChunks([]);
      expect(result).toBe('');
    });
  });

  describe('normalizeChineseText - 标准化中文文本', () => {
    it('应该标准化全角标点', () => {
      const text = '你好，世界！这是测试；还有：其他';
      const result = normalizeChineseText(text);
      
      expect(result).toBe('你好，世界！这是测试；还有：其他');
    });

    it('应该去除首尾空格', () => {
      const text = '  测试文本  ';
      const result = normalizeChineseText(text);
      
      expect(result).toBe('测试文本');
    });
  });

  describe('extractKeywords - 提取关键词', () => {
    it('应该提取出现频率最高的词', () => {
      const text = '法律 案件 当事人 当事人 诉讼 诉讼 诉讼 请求 请求';
      const keywords = extractKeywords(text, 5);
      
      expect(keywords).toContain('诉讼');
      expect(keywords).toContain('当事人');
      expect(keywords.length).toBeLessThanOrEqual(5);
    });

    it('应该过滤单字词', () => {
      const text = '这是一些文本这是一些';
      const keywords = extractKeywords(text, 10);
      
      expect(keywords.every(w => w.length > 1)).toBe(true);
    });

    it('处理空文本应该返回空数组', () => {
      const keywords = extractKeywords('', 10);
      expect(keywords).toEqual([]);
    });
  });

  describe('calculateSimilarity - 计算文本相似度', () => {
    it('相同文本应该返回1', () => {
      const text = '相同文本';
      const similarity = calculateSimilarity(text, text);
      
      expect(similarity).toBe(1);
    });

    it('完全不相似的文本应该返回0', () => {
      const similarity = calculateSimilarity('abcdef', '123456');
      
      expect(similarity).toBe(0);
    });

    it('部分相似的文本应该返回0到1之间的值', () => {
      const similarity = calculateSimilarity('法律案件', '法律纠纷');
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('isEmptyOrWhitespace - 检查空文本', () => {
    it('空字符串应该返回true', () => {
      expect(isEmptyOrWhitespace('')).toBe(true);
      expect(isEmptyOrWhitespace(null as any)).toBe(true);
      expect(isEmptyOrWhitespace(undefined as any)).toBe(true);
    });

    it('仅含空格的字符串应该返回true', () => {
      expect(isEmptyOrWhitespace('   ')).toBe(true);
      expect(isEmptyOrWhitespace('\t\n')).toBe(true);
    });

    it('非空字符串应该返回false', () => {
      expect(isEmptyOrWhitespace('文本')).toBe(false);
      expect(isEmptyOrWhitespace('  文本  ')).toBe(false);
    });
  });

  describe('truncateText - 截断文本', () => {
    it('应该正确截断长文本', () => {
      const text = '这是一个很长的文本需要被截断';
      const result = truncateText(text, 10, '...');
      
      expect(result.length).toBe(10);
      expect(result).toContain('...');
    });

    it('短文本不应该被截断', () => {
      const text = '短文本';
      const result = truncateText(text, 100);
      
      expect(result).toBe(text);
    });

    it('允许自定义后缀', () => {
      const text = '这是一个很长的文本';
      const result = truncateText(text, 8, '>>');
      
      expect(result).toContain('>>');
      expect(result).not.toContain('...');
    });
  });

  describe('removeExtraSpaces - 移除多余空格', () => {
    it('应该移除多余的空格', () => {
      const text = '这  是  测试    文本';
      const result = removeExtraSpaces(text);
      
      expect(result).toBe('这 是 测试 文本');
    });

    it('应该移除首尾空格', () => {
      const text = '  测试文本  ';
      const result = removeExtraSpaces(text);
      
      expect(result).toBe('测试文本');
    });

    it('应该处理换行符和制表符', () => {
      const text = '测试\n文本\t测试';
      const result = removeExtraSpaces(text);
      
      expect(result).not.toContain('\n');
      expect(result).not.toContain('\t');
    });
  });

  describe('estimateTokens - 估算Token数量', () => {
    it('应该正确估算中文文本Token数', () => {
      const chineseText = '这是一段中文文本';
      const tokens = estimateTokens(chineseText);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(chineseText.length);
    });

    it('应该正确估算英文文本Token数', () => {
      const englishText = 'This is English text';
      const tokens = estimateTokens(englishText);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('应该正确估算混合文本Token数', () => {
      const mixedText = '中文和English混合文本';
      const tokens = estimateTokens(mixedText);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('空文本应该返回0', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });
});
