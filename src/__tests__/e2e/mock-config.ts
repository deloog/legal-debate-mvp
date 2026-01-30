/**
 * E2E测试Mock配置
 * 为AI服务、法条检索、认证服务等提供Mock配置
 */

import type { Page, Route, Request } from '@playwright/test';

/**
 * 当事人类型
 */
type PartyRole = 'plaintiff' | 'defendant';

/**
 * 简化的请求接口（用于测试）
 */
interface SimplifiedRequest {
  url: string;
  method: string;
}

/**
 * E2E Mock配置类
 */
export class E2EMockConfig {
  /**
   * 设置所有Mock拦截器
   */
  static async setup(page: Page): Promise<void> {
    // Mock AI服务
    await page.route('**/api/ai/**', async route => {
      const mockResponse = E2EMockConfig.getAIMockResponse(route.request());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    // Mock法条检索
    await page.route('**/api/law-articles/**', async route => {
      const mockResponse = E2EMockConfig.getLawArticleMockResponse(
        route.request()
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    // Mock认证服务
    await page.route('**/api/auth/**', async route => {
      const mockResponse = E2EMockConfig.getAuthMockResponse(route.request());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });
  }

  /**
   * 获取AI服务Mock响应
   */
  static getAIMockResponse(request: Request | SimplifiedRequest): {
    success: boolean;
    data: Record<string, unknown>;
  } {
    const urlString =
      typeof request.url === 'function' ? request.url() : request.url;
    const url = new URL(urlString);
    const endpoint = url.pathname;

    // 文档分析Mock
    if (endpoint.includes('doc-analyze')) {
      return {
        success: true,
        data: {
          parties: [
            {
              name: '张三',
              role: 'plaintiff' as PartyRole,
              type: 'individual',
            },
            {
              name: '李四',
              role: 'defendant' as PartyRole,
              type: 'individual',
            },
          ],
          claims: [
            {
              id: 'claim-1',
              type: 'PAYMENT',
              text: '请求支付货款10000元',
              amount: 10000,
            },
            {
              id: 'claim-2',
              type: 'BREACH',
              text: '请求解除合同',
            },
          ],
          amounts: [
            {
              id: 'amount-1',
              type: 'PAYMENT',
              value: 10000,
              currency: 'CNY',
              description: '货款',
            },
          ],
          keyDates: [
            {
              id: 'date-1',
              type: 'CONTRACT_DATE',
              date: '2025-01-01',
              description: '合同签订日期',
            },
            {
              id: 'date-2',
              type: 'BREACH_DATE',
              date: '2025-06-01',
              description: '违约发生日期',
            },
          ],
          facts: [
            '双方于2025年1月1日签订买卖合同',
            '原告已按约定履行了供货义务',
            '被告未按约定支付货款',
          ],
        },
      };
    }

    // 辩论生成Mock
    if (endpoint.includes('debate-generate')) {
      return {
        success: true,
        data: {
          debateId: 'mock-debate-123',
          roundId: 'mock-round-1',
          rounds: [
            {
              round: 1,
              proArgument: {
                id: 'arg-pro-1',
                side: 'plaintiff',
                content:
                  '根据《民法典》第577条，当事人一方不履行合同义务，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。被告未按约定支付货款，构成违约，应当承担违约责任。',
                lawArticles: ['mock-law-1'],
                confidence: 0.95,
              },
              conArgument: {
                id: 'arg-con-1',
                side: 'defendant',
                content:
                  '原告提供的货物存在质量问题，不符合合同约定的标准，因此我方有权拒绝支付货款。根据《民法典》第511条，质量不符合约定的，买受人可以拒绝接受。',
                lawArticles: ['mock-law-2'],
                confidence: 0.92,
              },
            },
          ],
        },
      };
    }

    // 默认Mock响应
    return {
      success: true,
      data: {},
    };
  }

  /**
   * 获取法条检索Mock响应
   */
  static getLawArticleMockResponse(request: Request | SimplifiedRequest): {
    success: boolean;
    data: {
      lawArticles: Array<Record<string, unknown>>;
      total: number;
    };
  } {
    return {
      success: true,
      data: {
        lawArticles: [
          {
            id: 'mock-law-1',
            lawName: '中华人民共和国民法典',
            articleNumber: '第577条',
            content:
              '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
            category: '合同编',
            relevanceScore: 0.95,
            applicableScope: ['CONTRACT', 'BREACH'],
          },
          {
            id: 'mock-law-2',
            lawName: '中华人民共和国民法典',
            articleNumber: '第511条',
            content:
              '质量不符合约定的，买受人可以合理选择请求对方承担修理、更换、重作、退货、减少价款或者报酬等违约责任。',
            category: '合同编',
            relevanceScore: 0.9,
            applicableScope: ['QUALITY', 'REFUSE'],
          },
          {
            id: 'mock-law-3',
            lawName: '中华人民共和国民法典',
            articleNumber: '第579条',
            content:
              '当事人一方未支付价款、报酬、租金、利息，或者不履行其他金钱债务的，对方可以请求其支付。',
            category: '合同编',
            relevanceScore: 0.88,
            applicableScope: ['PAYMENT'],
          },
        ],
        total: 3,
      },
    };
  }

  /**
   * 获取认证服务Mock响应
   */
  static getAuthMockResponse(request: Request | SimplifiedRequest): {
    success: boolean;
    data?: Record<string, unknown>;
  } {
    const urlString =
      typeof request.url === 'function' ? request.url() : request.url;
    const url = new URL(urlString);
    const endpoint = url.pathname;

    // 登录Mock
    if (endpoint.includes('login')) {
      return {
        success: true,
        data: {
          user: {
            id: 'mock-user-123',
            email: 'test@example.com',
            name: '测试用户',
            username: 'testuser',
            role: 'USER',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          token: 'mock-jwt-token-123456',
          refreshToken: 'mock-refresh-token-789',
          expiresIn: 3600,
        },
      };
    }

    // 注册Mock
    if (endpoint.includes('register')) {
      return {
        success: true,
        data: {
          user: {
            id: 'mock-user-456',
            email: 'new@example.com',
            name: '新用户',
            username: 'newuser',
            role: 'USER',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          token: 'mock-jwt-token-new',
          refreshToken: 'mock-refresh-token-new',
          expiresIn: 3600,
        },
      };
    }

    // 获取当前用户Mock
    if (endpoint.includes('me')) {
      return {
        success: true,
        data: {
          user: {
            id: 'mock-user-123',
            email: 'test@example.com',
            name: '测试用户',
            username: 'testuser',
            role: 'USER',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }

    // 默认Mock响应
    return {
      success: true,
      data: {},
    };
  }
}
