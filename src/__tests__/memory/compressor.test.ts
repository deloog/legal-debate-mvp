/**
 * MemoryCompressor单元测试
 * 测试记忆压缩功能
 */

import { MemoryCompressor } from '@/lib/agent/memory-agent/compressor';
import { createMockAIService } from './__mocks__/ai-service-mock';
import { createTestMemory } from './test-helpers';

describe('MemoryCompressor', () => {
  let compressor: MemoryCompressor;
  let mockAIService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockAIService = createMockAIService();
    compressor = new MemoryCompressor(mockAIService as any);

    jest.clearAllMocks();
  });

  describe('压缩记忆', () => {
    it('应该成功压缩记忆', async () => {
      const memory = createTestMemory();

      const result = await compressor.compressMemory(memory);

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.keyInfo).toBeDefined();
      expect(result.ratio).toBeGreaterThan(0);
    });

    it('应该提取关键信息', async () => {
      const memory = createTestMemory({
        memoryValue: {
          title: '测试标题',
          content: '测试内容',
          keywords: ['关键词1', '关键词2'],
        },
      });

      const result = await compressor.compressMemory(memory);

      expect(result.success).toBe(true);
      expect(result.keyInfo).toBeDefined();
      expect(Array.isArray(result.keyInfo)).toBe(true);
    });

    it('应该计算压缩比', async () => {
      const memory = createTestMemory({
        memoryValue: {
          longText: 'x'.repeat(1000),
        },
      });

      const result = await compressor.compressMemory(memory);

      expect(result.success).toBe(true);
      expect(result.ratio).toBeDefined();
      expect(result.ratio).toBeGreaterThan(0);
      expect(result.ratio).toBeLessThanOrEqual(1);
    });

    it('应该处理空内容', async () => {
      const memory = createTestMemory({
        memoryValue: {},
      });

      const result = await compressor.compressMemory(memory);

      expect(result.success).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该处理AI服务错误', async () => {
      // importance >= 0.7 才会使用AI压缩
      const memory = createTestMemory({ importance: 0.8 });

      mockAIService.chatCompletion.mockRejectedValueOnce(
        new Error('AI service error')
      );

      const result = await compressor.compressMemory(memory);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该处理无效的记忆数据', async () => {
      const invalidMemory = {
        memoryId: '',
        memoryType: 'WORKING' as const,
        memoryKey: '',
        memoryValue: null,
        importance: 0,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        compressed: false,
      };

      const result = await compressor.compressMemory(invalidMemory);

      expect(result).toBeDefined();
    });
  });

  describe('压缩质量', () => {
    it('应该保留原始数据的核心信息', async () => {
      const memory = createTestMemory({
        memoryValue: {
          title: '重要标题',
          summary: '重要摘要',
          details: '详细内容',
        },
      });

      const result = await compressor.compressMemory(memory);

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
    });

    it('应该生成简洁的摘要', async () => {
      const memory = createTestMemory({
        memoryValue: {
          content: '这是很长的内容需要压缩'.repeat(50),
        },
      });

      const result = await compressor.compressMemory(memory);

      expect(result.success).toBe(true);
      // 摘要应该比原始内容短
      const originalSize = JSON.stringify(memory.memoryValue).length;
      const summarySize = (result.summary || '').length;
      expect(summarySize).toBeLessThan(originalSize);
    });
  });
});
