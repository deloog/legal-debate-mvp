/**
 * 证据分类配置API测试
 *
 * 测试覆盖：
 * - GET /api/evidence/categories
 * - 获取所有案件类型
 * - 获取指定案件类型的分类
 * - 搜索分类
 * - 错误处理
 */

import { GET } from '@/app/api/evidence/categories/route';

describe('GET /api/evidence/categories', () => {
  describe('获取所有案件类型', () => {
    it('应该返回所有案件类型列表', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.caseTypes).toBeDefined();
      expect(Array.isArray(data.data.caseTypes)).toBe(true);
      expect(data.data.caseTypes.length).toBeGreaterThan(0);
    });

    it('应该包含预置的案件类型', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.data.caseTypes).toContain('LABOR_DISPUTE');
      expect(data.data.caseTypes).toContain('CONTRACT_DISPUTE');
      expect(data.data.caseTypes).toContain('MARRIAGE_FAMILY');
    });
  });

  describe('获取指定案件类型的分类', () => {
    it('应该返回劳动争议案件分类', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.caseType).toBe('LABOR_DISPUTE');
      expect(data.data.categories).toBeDefined();
      expect(Array.isArray(data.data.categories)).toBe(true);
      expect(data.data.categories.length).toBeGreaterThan(0);
      expect(data.data.total).toBeGreaterThan(0);
    });

    it('应该返回合同纠纷案件分类', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=CONTRACT_DISPUTE'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.caseType).toBe('CONTRACT_DISPUTE');
      expect(data.data.categories.length).toBeGreaterThan(0);
    });

    it('应该返回婚姻家庭案件分类', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=MARRIAGE_FAMILY'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.caseType).toBe('MARRIAGE_FAMILY');
      expect(data.data.categories.length).toBeGreaterThan(0);
    });

    it('应该返回正确的响应格式', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('caseType');
      expect(data.data).toHaveProperty('categories');
      expect(data.data).toHaveProperty('total');
    });

    it('分类应该包含必要字段', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      const category = data.data.categories[0];
      expect(category).toHaveProperty('code');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('description');
    });
  });

  describe('搜索分类', () => {
    it('应该支持按关键词搜索', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE&keyword=劳动'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.keyword).toBe('劳动');
      expect(data.data.categories).toBeDefined();
      expect(Array.isArray(data.data.categories)).toBe(true);
    });

    it('应该返回匹配的分类', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE&keyword=合同'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.categories).toBeDefined();
    });

    it('空关键词应该返回所有分类', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE&keyword='
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.categories.length).toBeGreaterThan(0);
    });

    it('不匹配的关键词应该返回空数组', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE&keyword=xyz不存在的关键词xyz'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.categories.length).toBe(0);
      expect(data.data.total).toBe(0);
    });
  });

  describe('错误处理', () => {
    it('应该处理不存在的案件类型', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=INVALID_TYPE'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('应该处理空的案件类型', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType='
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      // 空字符串会被当作没有caseType参数，返回所有案件类型列表
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.caseTypes).toBeDefined();
    });
  });

  describe('边界情况', () => {
    it('应该处理特殊字符', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE&keyword=<script>alert("xss")</script>'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该处理URL编码的参数', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE&keyword=%E5%8A%B3%E5%8A%A8'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该处理多个查询参数', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE&keyword=劳动&extra=ignored'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('响应格式', () => {
    it('成功响应应该包含message', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.message).toBeDefined();
      expect(typeof data.message).toBe('string');
    });

    it('错误响应应该包含error对象', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=INVALID'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.error).toBeDefined();
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内返回结果', async () => {
      const mockRequest = new Request(
        'http://localhost:3000/api/evidence/categories?caseType=LABOR_DISPUTE'
      );

      const startTime = Date.now();
      await GET(mockRequest);
      const endTime = Date.now();

      // 应该在100ms内完成
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
