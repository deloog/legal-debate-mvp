/**
 * 关系发现触发API测试
 */

import { POST } from '@/app/api/v1/law-article-relations/discover/route';
import { prisma } from '@/lib/db';
import { RelationType, DiscoveryMethod } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    lawArticleRelation: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock日志
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock知识图谱权限中间件
jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(),
  logKnowledgeGraphAction: jest.fn(),
  KnowledgeGraphAction: {
    MANAGE_RELATIONS: 'MANAGE_RELATIONS',
  },
  KnowledgeGraphResource: {
    RELATION: 'RELATION',
  },
}));

// Mock AI检测器
jest.mock('@/lib/law-article/relation-discovery/ai-detector', () => ({
  AIDetector: {
    batchDetectRelations: jest.fn(),
  },
}));

// Mock规则检测器
jest.mock('@/lib/law-article/relation-discovery/rule-based-detector', () => ({
  RuleBasedDetector: {
    detectSupersedesRelation: jest.fn(),
  },
}));

const {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
} = require('@/lib/middleware/knowledge-graph-permission');
const {
  AIDetector,
} = require('@/lib/law-article/relation-discovery/ai-detector');
const {
  RuleBasedDetector,
} = require('@/lib/law-article/relation-discovery/rule-based-detector');

describe('关系发现触发API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('参数验证', () => {
    it('应该拒绝无效的请求体', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: 'invalid json',
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('无效的请求体');
    });

    it('应该拒绝缺少articleId的请求', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            discoveryMethod: 'ai',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('articleId参数是必需的');
    });

    it('应该拒绝无效的discoveryMethod', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'invalid',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('discoveryMethod参数必须是');
    });

    it('应该拒绝缺少triggeredBy的请求', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('triggeredBy参数是必需的');
    });

    it('应该拒绝triggeredBy为空字符串的请求', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
            triggeredBy: '  ',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('triggeredBy不能为空');
    });
  });

  describe('权限检查', () => {
    it('应该拒绝权限不足的请求', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('权限不足');
      expect(checkKnowledgeGraphPermission).toHaveBeenCalledWith(
        'user123',
        'MANAGE_RELATIONS',
        'RELATION'
      );
    });
  });

  describe('法条查找', () => {
    it('应该返回404如果法条不存在', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'nonexistent',
            discoveryMethod: 'ai',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('法条不存在');
    });
  });

  describe('AI检测', () => {
    it('应该成功使用AI检测关系', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        category: 'CIVIL',
      });

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'article2',
          lawName: '《民法典》',
          articleNumber: '第124条',
          category: 'CIVIL',
        },
      ]);

      (prisma.lawArticleRelation.findFirst as jest.Mock).mockResolvedValue(
        null
      );

      (prisma.lawArticleRelation.create as jest.Mock).mockResolvedValue({
        id: 'relation1',
        sourceId: 'article1',
        targetId: 'article2',
        relationType: RelationType.RELATED,
        confidence: 0.85,
        discoveryMethod: DiscoveryMethod.AI_DETECTED,
      });

      (AIDetector.batchDetectRelations as jest.Mock).mockResolvedValue(
        new Map([
          [
            'article2',
            {
              relations: [
                {
                  type: 'RELATED',
                  confidence: 0.85,
                  reason: '两个法条在内容上相关',
                  evidence: '文本相似',
                },
              ],
            },
          ],
        ])
      );

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.articleId).toBe('article1');
      expect(data.data?.discoveredCount).toBe(1);
      expect(data.data?.results[0].relationType).toBe('RELATED');

      expect(AIDetector.batchDetectRelations).toHaveBeenCalled();
    });

    it('应该过滤NONE类型的关系', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        category: 'CIVIL',
      });

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'article2',
          lawName: '《民法典》',
          articleNumber: '第124条',
          category: 'CIVIL',
        },
      ]);

      (AIDetector.batchDetectRelations as jest.Mock).mockResolvedValue(
        new Map([
          [
            'article2',
            {
              relations: [
                {
                  type: 'NONE',
                  confidence: 0.1,
                  reason: '无明显关系',
                  evidence: '无',
                },
              ],
            },
          ],
        ])
      );

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      // NONE类型应该被过滤掉，不会创建关系
      expect(response.status).toBe(200);
      expect(data.data?.discoveredCount).toBe(0);
      expect(prisma.lawArticleRelation.create).not.toHaveBeenCalled();
    });

    it('应该跳过已存在的关系', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        category: 'CIVIL',
      });

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'article2',
          lawName: '《民法典》',
          articleNumber: '第124条',
          category: 'CIVIL',
        },
      ]);

      // 返回已存在的关系
      (prisma.lawArticleRelation.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-relation',
      });

      (AIDetector.batchDetectRelations as jest.Mock).mockResolvedValue(
        new Map([
          [
            'article2',
            {
              relations: [
                {
                  type: 'RELATED',
                  confidence: 0.85,
                  reason: '两个法条在内容上相关',
                  evidence: '文本相似',
                },
              ],
            },
          ],
        ])
      );

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      // 关系已存在，不应该创建新关系
      expect(data.data?.discoveredCount).toBe(0);
      expect(prisma.lawArticleRelation.create).not.toHaveBeenCalled();
    });
  });

  describe('规则检测', () => {
    it('应该成功使用规则检测关系', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        category: 'CIVIL',
        effectiveDate: new Date('2024-01-01'),
      });

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'article2',
          lawName: '《民法典》',
          articleNumber: '第123条',
          category: 'CIVIL',
          effectiveDate: new Date('2020-01-01'),
        },
      ]);

      (prisma.lawArticleRelation.findFirst as jest.Mock).mockResolvedValue(
        null
      );

      (prisma.lawArticleRelation.create as jest.Mock).mockResolvedValue({
        id: 'relation1',
        sourceId: 'article1',
        targetId: 'article2',
        relationType: RelationType.SUPERSEDES,
        confidence: 0.9,
        discoveryMethod: DiscoveryMethod.RULE_BASED,
      });

      (RuleBasedDetector.detectSupersedesRelation as jest.Mock).mockReturnValue(
        [
          {
            sourceId: 'article1',
            targetId: 'article2',
            relationType: RelationType.SUPERSEDES,
            confidence: 0.9,
            evidence: '新版替代旧版',
          },
        ]
      );

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'rule_based',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.discoveredCount).toBe(1);
      expect(data.data?.results[0].relationType).toBe('SUPERSEDES');

      expect(RuleBasedDetector.detectSupersedesRelation).toHaveBeenCalled();
    });
  });

  describe('all模式', () => {
    it('应该同时使用规则和AI检测', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        category: 'CIVIL',
      });

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'article2',
          lawName: '《民法典》',
          articleNumber: '第124条',
          category: 'CIVIL',
        },
      ]);

      (prisma.lawArticleRelation.findFirst as jest.Mock).mockResolvedValue(
        null
      );

      (prisma.lawArticleRelation.create as jest.Mock)
        .mockResolvedValueOnce({
          id: 'relation1',
          sourceId: 'article1',
          targetId: 'article2',
          relationType: RelationType.RELATED,
          confidence: 0.85,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
        })
        .mockResolvedValueOnce({
          id: 'relation2',
          sourceId: 'article1',
          targetId: 'article2',
          relationType: RelationType.SUPERSEDES,
          confidence: 0.9,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
        });

      (AIDetector.batchDetectRelations as jest.Mock).mockResolvedValue(
        new Map([
          [
            'article2',
            {
              relations: [
                {
                  type: 'RELATED',
                  confidence: 0.85,
                  reason: '相关',
                  evidence: '文本',
                },
              ],
            },
          ],
        ])
      );

      (RuleBasedDetector.detectSupersedesRelation as jest.Mock).mockReturnValue(
        [
          {
            sourceId: 'article1',
            targetId: 'article2',
            relationType: RelationType.SUPERSEDES,
            confidence: 0.9,
            evidence: '替代',
          },
        ]
      );

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'all',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.discoveredCount).toBe(2);

      expect(AIDetector.batchDetectRelations).toHaveBeenCalled();
      expect(RuleBasedDetector.detectSupersedesRelation).toHaveBeenCalled();
    });
  });

  describe('maxCandidates参数', () => {
    it('应该限制候选法条数量', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        category: 'CIVIL',
      });

      const mockCandidates = Array.from({ length: 50 }, (_, i) => ({
        id: `article${i}`,
        lawName: '《民法典》',
        articleNumber: `第${i}条`,
        category: 'CIVIL',
      }));

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(
        mockCandidates
      );

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
            maxCandidates: 10,
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);

      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('应该使用默认maxCandidates当未提供', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        category: 'CIVIL',
      });

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);

      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20, // 默认值
        })
      );
    });

    it('应该限制maxCandidates到100', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        category: 'CIVIL',
      });

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
            maxCandidates: 200,
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);

      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // 限制到最大值
        })
      );
    });
  });

  describe('日志记录', () => {
    it('应该记录操作日志', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article1',
      });

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);

      (AIDetector.batchDetectRelations as jest.Mock).mockResolvedValue(
        new Map()
      );

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          headers: {
            'x-forwarded-for': '192.168.1.1',
            'user-agent': 'test-agent',
          },
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);

      expect(logKnowledgeGraphAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          action: 'MANAGE_RELATIONS',
          resource: 'RELATION',
          ipAddress: '192.168.1.1',
          userAgent: 'test-agent',
          metadata: expect.objectContaining({
            articleId: 'article1',
            discoveryMethod: 'ai',
          }),
        })
      );
    });
  });

  describe('错误处理', () => {
    it('应该处理规则匹配失败', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article1',
      });

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);

      (
        RuleBasedDetector.detectSupersedesRelation as jest.Mock
      ).mockImplementation(() => {
        throw new Error('规则匹配失败');
      });

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'rule_based',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      // 规则失败不应该导致整个请求失败，只是没有发现关系
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该处理服务器错误', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockRejectedValue(
        new Error('服务器错误')
      );

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            articleId: 'article1',
            discoveryMethod: 'ai',
            triggeredBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('触发关系发现失败');
    });
  });
});
