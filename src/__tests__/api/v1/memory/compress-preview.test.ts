/**
 * 记忆压缩预览API测试
 *
 * 注意：由于 NextRequest mock 的类型限制，需要使用类型断言。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { POST } from '@/app/api/v1/memory/compress-preview/route';
import { NextRequest } from 'next/server';

// Mock NextRequest
const createMockRequest = async (body: unknown): Promise<NextRequest> => {
  return {
    json: async () => body as Record<string, unknown>,
  } as any;
};

describe('记忆压缩预览API', () => {
  describe('POST /api/v1/memory/compress-preview', () => {
    it('应该成功预览使用content的压缩效果', async () => {
      const requestBody = {
        content:
          '这是一段很长的测试内容，需要包含足够多的信息才能看到明显的压缩效果。',
        importance: 0.8,
      };

      const request = await createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('original');
      expect(data).toHaveProperty('compressed');
      expect(data).toHaveProperty('metrics');
      expect(data.original.content).toBe(requestBody.content);
      expect(data.original.length).toBe(requestBody.content.length);
    });

    it('应该拒绝缺少memoryId和content的请求', async () => {
      const request = await createMockRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('必须提供memoryId或content');
    });

    it('应该返回正确的压缩指标', async () => {
      const requestBody = {
        content: '测试内容'.repeat(50),
        importance: 0.9,
      };

      const request = await createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toHaveProperty('compressionRatio');
      expect(data.metrics).toHaveProperty('spaceSaved');
      expect(data.metrics).toHaveProperty('keyInfoCount');
      expect(data.metrics.compressionRatio).toBeGreaterThan(0);
      expect(data.metrics.spaceSaved).toBeGreaterThan(0);
    });

    it('应该返回压缩后的摘要和关键信息', async () => {
      const requestBody = {
        content:
          '重要的案件信息需要被保留：当事人张三，案件编号001，争议金额10000元。',
        importance: 0.8,
      };

      const request = await createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.compressed).toHaveProperty('summary');
      expect(data.compressed).toHaveProperty('keyInfo');
      expect(data.compressed.keyInfo).toBeInstanceOf(Array);
    });

    it('应该正确处理超长内容', async () => {
      const requestBody = {
        content: '重复内容'.repeat(200),
        importance: 0.5,
      };

      const request = await createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics.spaceSaved).toBeGreaterThan(100);
    });

    it('应该正确处理空内容', async () => {
      const requestBody = {
        content: '',
        importance: 0.5,
      };

      const request = await createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      // 空内容应该也能处理，返回压缩结果
      expect(response.status).toBe(200);
      expect(data.original.length).toBe(0);
    });

    it('应该返回压缩后的内容长度', async () => {
      const originalContent = '测试内容'.repeat(100);
      const requestBody = {
        content: originalContent,
        importance: 0.8,
      };

      const request = await createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // 压缩后的长度应该明显小于原始长度（mock返回固定长度）
      expect(data.compressed.length).toBeLessThan(data.original.length);
    });

    it('应该支持不同的importance参数', async () => {
      const requestBody = {
        content: '测试内容',
        importance: 0.3,
      };

      const request = await createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('metrics');
    });

    it('应该处理包含特殊字符的内容', async () => {
      const requestBody = {
        content: '测试内容！@#$%^&*()测试',
        importance: 0.8,
      };

      const request = await createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.original.content).toBe(requestBody.content);
    });
  });
});
