/**
 * 质证预判API测试
 *
 * 测试覆盖：
 * - POST /api/evidence/[id]/cross-examination
 * - 参数验证
 * - 质证预判调用
 * - 响应格式
 * - 错误处理
 */

import { POST } from '@/app/api/evidence/[id]/cross-examination/route';

// Mock auth middleware
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    evidence: {
      findFirst: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock CrossExaminationService
jest.mock('@/lib/evidence/cross-examination-service', () => ({
  CrossExaminationService: {
    getInstance: jest.fn().mockReturnValue({
      preAssess: jest.fn(),
    }),
  },
}));

import { getAuthUser } from '@/lib/middleware/auth';
import { CrossExaminationService } from '@/lib/evidence/cross-examination-service';

const TEST_USER_ID = 'test-user-id';

describe('POST /api/evidence/[id]/cross-examination', () => {
  let mockRequest: Request;
  let mockPreAssess: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mock preAssess from the mocked getInstance
    mockPreAssess = (
      CrossExaminationService.getInstance() as { preAssess: jest.Mock }
    ).preAssess;
    // Default: authenticated user
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: TEST_USER_ID,
      email: 'test@example.com',
    });
  });

  describe('正常请求', () => {
    it('应该成功预判质证意见', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
        caseType: '劳动争议',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
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

      const mockEvidence = {
        id: 'evidence-1',
        name: '劳动合同复印件',
        type: 'DOCUMENT',
        description: '2023年签订的劳动合同',
        caseId: 'case-1',
        status: 'APPROVED',
        fileUrl: '/uploads/contract.pdf',
        relevanceScore: 90,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: { id: 'case-1', type: 'LABOR_DISPUTE', userId: TEST_USER_ID },
      };

      prisma.evidence.findFirst.mockResolvedValue(mockEvidence);

      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        title: '劳动争议案件',
        type: 'LABOR_DISPUTE',
      });

      // Mock服务调用
      mockPreAssess.mockResolvedValue({
        possibleChallenges: [
          {
            type: 'authenticity',
            content: '复印件无法核实原件真实性',
            likelihood: 70,
          },
          {
            type: 'relevance',
            content: '合同签订时间与争议事项无关联',
            likelihood: 30,
          },
        ],
        responses: [
          {
            challenge: '复印件无法核实原件真实性',
            response: '提供原件或申请法院调取人社局备案合同',
            supportingEvidence: '人社局备案合同',
          },
          {
            challenge: '合同签订时间与争议事项无关联',
            response: '结合工资条说明持续劳动关系',
            supportingEvidence: '工资条、社保记录',
          },
        ],
        overallRisk: 'medium',
        riskNote: '复印件真实性存在一定风险，建议准备原件或其他佐证',
      });

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.possibleChallenges).toBeDefined();
      expect(data.data.responses).toBeDefined();
      expect(data.data.overallRisk).toBeDefined();
      expect(data.data.riskNote).toBeDefined();
    });

    it('应该返回正确的响应格式', async () => {
      const requestBody = {
        ourPosition: 'defendant',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');

      prisma.evidence.findFirst.mockResolvedValue({
        id: 'evidence-1',
        name: '工资条',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: { id: 'case-1', type: 'DOCUMENT', userId: TEST_USER_ID },
      });

      mockPreAssess.mockResolvedValue({
        possibleChallenges: [],
        responses: [],
        overallRisk: 'low',
        riskNote: '风险较低',
      });

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('possibleChallenges');
      expect(data.data).toHaveProperty('responses');
      expect(data.data).toHaveProperty('overallRisk');
      expect(data.data).toHaveProperty('riskNote');
    });

    it('应该处理不同的证据类型', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');

      prisma.evidence.findFirst.mockResolvedValue({
        id: 'evidence-1',
        name: '证人证言',
        type: 'WITNESS',
        description: '证人张三的证言',
        caseId: 'case-1',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: { id: 'case-1', type: 'CIVIL', userId: TEST_USER_ID },
      });

      mockPreAssess.mockResolvedValue({
        possibleChallenges: [
          {
            type: 'authenticity',
            content: '证人与当事人存在利害关系',
            likelihood: 60,
          },
        ],
        responses: [
          {
            challenge: '证人与当事人存在利害关系',
            response: '提供证人身份证明和无利害关系声明',
          },
        ],
        overallRisk: 'medium',
        riskNote: '证人证言需要其他证据佐证',
      });

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('参数验证', () => {
    it('应该验证ourPosition参数', async () => {
      const requestBody = {};

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('应该验证ourPosition值的有效性', async () => {
      const requestBody = {
        ourPosition: 'invalid',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('应该验证证据ID参数', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence//cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: '' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('错误处理', () => {
    it('应该处理证据不存在的情况', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/non-existent/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.evidence.findFirst.mockResolvedValue(null);

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'non-existent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('应该处理已删除的证据', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      // The route queries findFirst with deletedAt: null filter, so deleted evidence returns null
      prisma.evidence.findFirst.mockResolvedValue(null);

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('应该处理服务调用失败', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.evidence.findFirst.mockResolvedValue({
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: { id: 'case-1', type: 'CIVIL', userId: TEST_USER_ID },
      });

      mockPreAssess.mockRejectedValue(new Error('AI服务不可用'));

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('应该处理无效的JSON', async () => {
      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: 'invalid json',
        }
      );

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('应该处理数据库错误', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.evidence.findFirst.mockRejectedValue(new Error('数据库连接失败'));

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理可选参数caseType', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
        caseType: '合同纠纷',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.evidence.findFirst.mockResolvedValue({
        id: 'evidence-1',
        name: '合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: { id: 'case-1', type: 'CIVIL', userId: TEST_USER_ID },
      });

      mockPreAssess.mockResolvedValue({
        possibleChallenges: [],
        responses: [],
        overallRisk: 'low',
        riskNote: '风险较低',
      });

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPreAssess).toHaveBeenCalledWith(
        expect.objectContaining({
          ourPosition: 'plaintiff',
          caseType: '合同纠纷',
        })
      );
    });

    it('应该处理长描述的证据', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.evidence.findFirst.mockResolvedValue({
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        description: '这是一份非常详细的劳动合同描述'.repeat(100),
        caseId: 'case-1',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: { id: 'case-1', type: 'CIVIL', userId: TEST_USER_ID },
      });

      mockPreAssess.mockResolvedValue({
        possibleChallenges: [],
        responses: [],
        overallRisk: 'low',
        riskNote: '风险较低',
      });

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });

      expect(response.status).toBe(200);
    });

    it('应该处理特殊字符', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
        caseType: '劳动争议<script>alert("xss")</script>',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.evidence.findFirst.mockResolvedValue({
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: { id: 'case-1', type: 'CIVIL', userId: TEST_USER_ID },
      });

      mockPreAssess.mockResolvedValue({
        possibleChallenges: [],
        responses: [],
        overallRisk: 'low',
        riskNote: '风险较低',
      });

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('质证类型覆盖', () => {
    it('应该处理真实性质证', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.evidence.findFirst.mockResolvedValue({
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: { id: 'case-1', type: 'CIVIL', userId: TEST_USER_ID },
      });

      mockPreAssess.mockResolvedValue({
        possibleChallenges: [
          {
            type: 'authenticity',
            content: '真实性质证',
            likelihood: 80,
          },
        ],
        responses: [],
        overallRisk: 'high',
        riskNote: '真实性风险',
      });

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.possibleChallenges[0].type).toBe('authenticity');
    });

    it('应该处理合法性质证', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.evidence.findFirst.mockResolvedValue({
        id: 'evidence-1',
        name: '录音证据',
        type: 'AUDIO',
        caseId: 'case-1',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: { id: 'case-1', type: 'CIVIL', userId: TEST_USER_ID },
      });

      mockPreAssess.mockResolvedValue({
        possibleChallenges: [
          {
            type: 'legality',
            content: '录音未经对方同意',
            likelihood: 60,
          },
        ],
        responses: [],
        overallRisk: 'medium',
        riskNote: '合法性风险',
      });

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.possibleChallenges[0].type).toBe('legality');
    });

    it('应该处理关联性质证', async () => {
      const requestBody = {
        ourPosition: 'plaintiff',
      };

      mockRequest = new Request(
        'http://localhost:3000/api/evidence/evidence-1/cross-examination',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const { prisma } = require('@/lib/db/prisma');
      prisma.evidence.findFirst.mockResolvedValue({
        id: 'evidence-1',
        name: '银行流水',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: { id: 'case-1', type: 'CIVIL', userId: TEST_USER_ID },
      });

      mockPreAssess.mockResolvedValue({
        possibleChallenges: [
          {
            type: 'relevance',
            content: '与案件事实无关',
            likelihood: 40,
          },
        ],
        responses: [],
        overallRisk: 'low',
        riskNote: '关联性风险',
      });

      const response = await POST(mockRequest, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.possibleChallenges[0].type).toBe('relevance');
    });
  });
});
