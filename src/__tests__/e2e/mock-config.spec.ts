/**
 * E2E Mock配置测试
 * 测试E2EMockConfig类的所有功能
 */

import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from '@playwright/test';
import { E2EMockConfig } from './mock-config';

test.describe('E2EMockConfig', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000');
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test.describe('setup方法', () => {
    test('应该正确设置所有Mock拦截器', async () => {
      await E2EMockConfig.setup(page);
      const response = await page.evaluate(async () => {
        return fetch('/api/ai/doc-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test' }),
        }).then(r => r.json());
      });
      expect(response.success).toBe(true);
    });

    test('应该在setup后拦截API请求', async () => {
      await E2EMockConfig.setup(page);

      // 发起一个被Mock的请求
      const response = await page.evaluate(async () => {
        return fetch('/api/ai/doc-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test' }),
        }).then(r => r.json());
      });

      // 验证响应是Mock数据
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });
  });

  test.describe('getAIMockResponse方法', () => {
    test('应该返回文档解析Mock响应', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/ai/doc-analyze',
        method: 'POST',
        postData: () =>
          Promise.resolve(JSON.stringify({ content: 'test content' })),
      };

      const response = E2EMockConfig.getAIMockResponse(mockRequest);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.parties).toBeInstanceOf(Array);
      expect(response.data.claims).toBeInstanceOf(Array);
      expect(response.data.amounts).toBeInstanceOf(Array);
      expect(response.data.keyDates).toBeInstanceOf(Array);
    });

    test('应该返回辩论生成Mock响应', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/ai/debate-generate',
        method: 'POST',
        postData: () =>
          Promise.resolve(JSON.stringify({ debateId: 'test-123' })),
      };

      const response = E2EMockConfig.getAIMockResponse(mockRequest);

      const rounds = response.data.rounds as unknown[];
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.debateId).toBeDefined();
      expect(rounds).toBeInstanceOf(Array);
      expect(rounds.length).toBeGreaterThan(0);
    });

    test('应该返回默认Mock响应', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/ai/unknown',
        method: 'GET',
      };

      const response = E2EMockConfig.getAIMockResponse(mockRequest);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    test('文档解析Mock数据应包含正确的当事人信息', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/ai/doc-analyze',
        method: 'POST',
      };

      const response = E2EMockConfig.getAIMockResponse(mockRequest);
      const parties = response.data.parties as unknown;

      const partiesArray = parties as Array<{ name: string; type: string }>;
      expect(partiesArray).toHaveLength(2);
      expect(partiesArray[0]).toHaveProperty('name');
      expect(partiesArray[0]).toHaveProperty('type');
      expect(partiesArray[0].type).toMatch(/^(individual|organization)$/);
    });

    test('辩论生成Mock数据应包含完整的轮次信息', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/ai/debate-generate',
        method: 'POST',
      };

      const response = E2EMockConfig.getAIMockResponse(mockRequest);
      const rounds = response.data.rounds as Array<{
        round: number;
        proArgument: unknown;
        conArgument: unknown;
      }>;

      expect(rounds[0]).toHaveProperty('round');
      expect(rounds[0]).toHaveProperty('proArgument');
      expect(rounds[0]).toHaveProperty('conArgument');
    });
  });

  test.describe('getLawArticleMockResponse方法', () => {
    test('应该返回法条检索Mock响应', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/law-articles/search',
        method: 'GET',
      };

      const response = E2EMockConfig.getLawArticleMockResponse(mockRequest);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.lawArticles).toBeInstanceOf(Array);
      expect(response.data.lawArticles.length).toBeGreaterThan(0);
      expect(response.data.total).toBeDefined();
    });

    test('法条Mock数据应包含必要字段', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/law-articles/search',
        method: 'GET',
      };

      const response = E2EMockConfig.getLawArticleMockResponse(mockRequest);
      const articles = response.data.lawArticles;

      expect(articles[0]).toHaveProperty('id');
      expect(articles[0]).toHaveProperty('lawName');
      expect(articles[0]).toHaveProperty('articleNumber');
      expect(articles[0]).toHaveProperty('content');
      expect(articles[0]).toHaveProperty('category');
    });

    test('法条Mock数据应包含相关性分数', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/law-articles/search',
        method: 'GET',
      };

      const response = E2EMockConfig.getLawArticleMockResponse(mockRequest);
      const articles = response.data.lawArticles;

      expect(articles[0]).toHaveProperty('relevanceScore');
      expect(articles[0].relevanceScore).toBeGreaterThan(0);
      expect(articles[0].relevanceScore).toBeLessThanOrEqual(1);
    });
  });

  test.describe('getAuthMockResponse方法', () => {
    test('应该返回登录Mock响应', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/auth/login',
        method: 'POST',
      };

      const response = E2EMockConfig.getAuthMockResponse(mockRequest);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      const userData = response.data.user as {
        id: string;
        email: string;
        name: string;
        role: string;
        createdAt: string;
        updatedAt: string;
      };
      expect(userData).toBeDefined();
      expect(userData.id).toBeDefined();
      expect(userData.email).toBeDefined();
      expect(response.data.token).toBeDefined();
    });

    test('应该返回注册Mock响应', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/auth/register',
        method: 'POST',
      };

      const response = E2EMockConfig.getAuthMockResponse(mockRequest);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.user).toBeDefined();
      expect(response.data.token).toBeDefined();
      expect(response.data.refreshToken).toBeDefined();
    });

    test('应该返回当前用户Mock响应', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/auth/me',
        method: 'GET',
      };

      const response = E2EMockConfig.getAuthMockResponse(mockRequest);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.user).toBeDefined();
      const meUserData = response.data.user as { role: string };
      expect(meUserData.role).toBeDefined();
    });

    test('认证Mock数据应包含完整的用户信息', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/auth/login',
        method: 'POST',
      };

      const response = E2EMockConfig.getAuthMockResponse(mockRequest);
      const user = response.data.user as {
        id: string;
        name: string;
        email: string;
        role: string;
        createdAt: string;
        updatedAt: string;
      };

      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('createdAt');
    });
  });

  test.describe('Mock响应格式', () => {
    test('所有Mock响应应遵循统一格式', () => {
      const aiRequest = {
        url: 'http://localhost:3000/api/ai/doc-analyze',
        method: 'POST',
      };
      const lawRequest = {
        url: 'http://localhost:3000/api/law-articles/search',
        method: 'GET',
      };
      const authRequest = {
        url: 'http://localhost:3000/api/auth/login',
        method: 'POST',
      };

      const aiResponse = E2EMockConfig.getAIMockResponse(aiRequest);
      const lawResponse = E2EMockConfig.getLawArticleMockResponse(lawRequest);
      const authResponse = E2EMockConfig.getAuthMockResponse(authRequest);

      // 所有响应都应包含success字段
      expect(aiResponse).toHaveProperty('success');
      expect(lawResponse).toHaveProperty('success');
      expect(authResponse).toHaveProperty('success');

      // 所有响应都应包含data字段
      expect(aiResponse).toHaveProperty('data');
      expect(lawResponse).toHaveProperty('data');
      expect(authResponse).toHaveProperty('data');
    });

    test('Mock数据应与真实API响应结构一致', () => {
      const request = {
        url: 'http://localhost:3000/api/ai/doc-analyze',
        method: 'POST',
      };

      const response = E2EMockConfig.getAIMockResponse(request);

      // 验证文档解析响应结构
      expect(response.data).toHaveProperty('parties');
      expect(response.data).toHaveProperty('claims');
      expect(response.data).toHaveProperty('amounts');
      expect(response.data).toHaveProperty('keyDates');
      expect(response.data).toHaveProperty('facts');
    });
  });

  test.describe('Mock配置集成', () => {
    test('setup后所有API调用都应返回Mock数据', async () => {
      await E2EMockConfig.setup(page);

      // 测试文档解析API
      const docAnalyzeResult = await page.evaluate(async () => {
        return fetch('/api/ai/doc-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test' }),
        }).then(r => r.json());
      });

      expect(docAnalyzeResult.success).toBe(true);

      // 测试法条检索API
      const lawSearchResult = await page.evaluate(async () => {
        return fetch('/api/law-articles/search?q=合同').then(r => r.json());
      });

      expect(lawSearchResult.success).toBe(true);

      // 测试认证API
      const authResult = await page.evaluate(async () => {
        return fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'test' }),
        }).then(r => r.json());
      });

      expect(authResult.success).toBe(true);
    });
  });
});
