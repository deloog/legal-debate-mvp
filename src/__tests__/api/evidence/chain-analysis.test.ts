/**
 * 证据链分析API测试
 *
 * 测试覆盖：
 * - POST /api/evidence/chain-analysis
 * - 参数验证
 * - 证据链分析调用
 * - 响应格式
 * - 错误处理
 */

import { POST } from '@/app/api/evidence/chain-analysis/route';

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn().mockResolvedValue({
    userId: 'user-123',
    email: 'test@example.com',
    role: 'USER',
  }),
}));

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    evidence: {
      findMany: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock EvidenceChainService
const mockAnalyzeChain = jest.fn();
jest.mock('@/lib/evidence/evidence-chain-service', () => ({
  EvidenceChainService: {
    getInstance: jest.fn(() => ({
      analyzeChain: mockAnalyzeChain,
    })),
  },
}));

describe('POST /api/evidence/chain-analysis', () => {
  let mockRequest: Request;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyzeChain.mockReset();
  });

  describe('正常请求', () => {
    it('应该成功分析证据链', async () => {
      const requestBody = {
        caseId: 'case-1',
        evidenceIds: ['evidence-1', 'evidence-2'],
        targetFact: '证明劳动关系存在',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      // Mock数据库查询
      const { prisma } = require('@/lib/db/prisma');
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        title: '测试案件',
        userId: 'user-123',
      });

      prisma.evidence.findMany.mockResolvedValue([
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
        {
          id: 'evidence-2',
          name: '工资条',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 85,
        },
      ]);

      // Mock服务调用
      mockAnalyzeChain.mockResolvedValue({
        chains: [
          {
            evidenceId: 'evidence-1',
            evidenceName: '劳动合同',
            role: '证明劳动关系存在',
            proves: '双方存在劳动关系',
            strength: 'strong',
          },
        ],
        connections: [
          {
            from: 'evidence-1',
            to: 'evidence-2',
            relationship: '劳动合同与工资条相互印证',
          },
        ],
        completeness: 85,
        gaps: ['缺少社保缴纳证明'],
        suggestions: ['建议补充社保缴纳记录'],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.chains).toBeDefined();
      expect(data.data.completeness).toBeDefined();
    });

    it('应该返回正确的响应格式', async () => {
      const requestBody = {
        caseId: 'case-1',
        evidenceIds: ['evidence-1'],
        targetFact: '证明劳动关系',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        userId: 'user-123',
      });
      prisma.evidence.findMany.mockResolvedValue([
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
        },
      ]);

      mockAnalyzeChain.mockResolvedValue({
        chains: [],
        connections: [],
        completeness: 50,
        gaps: [],
        suggestions: [],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('chains');
      expect(data.data).toHaveProperty('connections');
      expect(data.data).toHaveProperty('completeness');
      expect(data.data).toHaveProperty('gaps');
      expect(data.data).toHaveProperty('suggestions');
    });
  });

  describe('参数验证', () => {
    it('应该验证caseId参数', async () => {
      const requestBody = {
        evidenceIds: ['evidence-1'],
        targetFact: '证明劳动关系',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('应该验证evidenceIds参数', async () => {
      const requestBody = {
        caseId: 'case-1',
        targetFact: '证明劳动关系',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('应该验证targetFact参数', async () => {
      const requestBody = {
        caseId: 'case-1',
        evidenceIds: ['evidence-1'],
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('应该验证evidenceIds是数组', async () => {
      const requestBody = {
        caseId: 'case-1',
        evidenceIds: 'not-an-array',
        targetFact: '证明劳动关系',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('应该验证evidenceIds不为空', async () => {
      const requestBody = {
        caseId: 'case-1',
        evidenceIds: [],
        targetFact: '证明劳动关系',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('错误处理', () => {
    it('应该处理案件不存在的情况', async () => {
      const requestBody = {
        caseId: 'non-existent-case',
        evidenceIds: ['evidence-1'],
        targetFact: '证明劳动关系',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.case.findUnique.mockResolvedValue(null);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('应该处理证据不存在的情况', async () => {
      const requestBody = {
        caseId: 'case-1',
        evidenceIds: ['non-existent-evidence'],
        targetFact: '证明劳动关系',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        userId: 'user-123',
      });
      prisma.evidence.findMany.mockResolvedValue([]);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('应该处理服务调用失败', async () => {
      const requestBody = {
        caseId: 'case-1',
        evidenceIds: ['evidence-1'],
        targetFact: '证明劳动关系',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        userId: 'user-123',
      });
      prisma.evidence.findMany.mockResolvedValue([
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
        },
      ]);

      mockAnalyzeChain.mockRejectedValue(new Error('AI服务不可用'));

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('应该处理无效的JSON', async () => {
      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: 'invalid json',
        }
      );

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('应该处理数据库错误', async () => {
      const requestBody = {
        caseId: 'case-1',
        evidenceIds: ['evidence-1'],
        targetFact: '证明劳动关系',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.case.findUnique.mockRejectedValue(new Error('数据库连接失败'));

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理大量证据', async () => {
      const evidenceIds = Array.from(
        { length: 50 },
        (_, i) => `evidence-${i + 1}`
      );
      const requestBody = {
        caseId: 'case-1',
        evidenceIds,
        targetFact: '证明劳动关系',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        userId: 'user-123',
      });
      prisma.evidence.findMany.mockResolvedValue(
        evidenceIds.map(id => ({
          id,
          name: `证据${id}`,
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
        }))
      );

      mockAnalyzeChain.mockResolvedValue({
        chains: [],
        connections: [],
        completeness: 50,
        gaps: [],
        suggestions: [],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该处理特殊字符', async () => {
      const requestBody = {
        caseId: 'case-1',
        evidenceIds: ['evidence-1'],
        targetFact: '证明劳动关系<script>alert("xss")</script>',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/chain-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        userId: 'user-123',
      });
      prisma.evidence.findMany.mockResolvedValue([
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
        },
      ]);

      mockAnalyzeChain.mockResolvedValue({
        chains: [],
        connections: [],
        completeness: 50,
        gaps: [],
        suggestions: [],
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });
  });
});
