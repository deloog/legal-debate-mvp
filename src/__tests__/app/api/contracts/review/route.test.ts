/**
 * 合同审查API测试
 * 测试覆盖：
 * 1. 合同上传
 * 2. 合同审查
 * 3. 风险识别
 * 4. 建议生成
 * 5. 审查历史
 * 6. 错误处理
 */

import { NextRequest } from 'next/server';
import { POST as uploadPOST } from '@/app/api/contracts/review/upload/route';
import { GET as reviewGET } from '@/app/api/contracts/review/[id]/route';
import { GET as historyGET } from '@/app/api/contracts/review/history/route';
import { prisma } from '@/lib/db/prisma';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    contract: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock AI服务
jest.mock('@/lib/ai/contract-reviewer', () => ({
  reviewContract: jest.fn(),
}));

describe('合同审查API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/contracts/review/upload', () => {
    it('应该成功上传合同文件', async () => {
      const mockContract = {
        id: 'contract-1',
        contractNumber: 'HT20260130001',
        clientName: '测试客户',
        clientType: 'INDIVIDUAL',
        caseType: '劳动争议',
        caseSummary: '测试案情',
        scope: '测试范围',
        lawFirmName: '测试律所',
        lawyerName: '测试律师',
        lawyerId: 'lawyer-1',
        feeType: 'FIXED',
        totalFee: 50000,
        paidAmount: 0,
        status: 'DRAFT',
        filePath: '/uploads/contract-1.pdf',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.contract.create as jest.Mock).mockResolvedValueOnce(mockContract);

      const formData = new FormData();
      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });
      formData.append('file', file);

      const request = new NextRequest(
        'http://localhost:3000/api/contracts/review/upload',
        {
          method: 'POST',
          body: formData,
        }
      );

      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('contractId');
      expect(data.data).toHaveProperty('fileName');
      expect(data.data).toHaveProperty('fileSize');
    });

    it('应该拒绝不支持的文件类型', async () => {
      const formData = new FormData();
      const file = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      });
      formData.append('file', file);

      const request = new NextRequest(
        'http://localhost:3000/api/contracts/review/upload',
        {
          method: 'POST',
          body: formData,
        }
      );

      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_FILE_TYPE');
    });

    it('应该拒绝超大文件', async () => {
      const formData = new FormData();
      // 模拟一个超过10MB的文件
      const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'large.pdf', {
        type: 'application/pdf',
      });
      formData.append('file', file);

      const request = new NextRequest(
        'http://localhost:3000/api/contracts/review/upload',
        {
          method: 'POST',
          body: formData,
        }
      );

      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('GET /api/contracts/review/[id]', () => {
    it('应该成功审查合同并返回结果', async () => {
      const mockContract = {
        id: 'contract-1',
        contractNumber: 'HT20260130001',
        filePath: '/uploads/contract-1.pdf',
        clientName: '测试客户',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.contract.findUnique as jest.Mock).mockResolvedValueOnce(
        mockContract
      );

      const mockReviewResult = {
        overallScore: 75,
        riskScore: 70,
        complianceScore: 80,
        risks: [
          {
            id: 'risk-1',
            type: 'LEGAL_COMPLIANCE',
            level: 'HIGH',
            title: '缺少争议解决条款',
            description: '合同中未明确约定争议解决方式',
            location: { page: 1, paragraph: 5 },
            originalText: '...',
            impact: '可能导致纠纷处理困难',
            probability: 0.7,
          },
        ],
        suggestions: [
          {
            id: 'suggestion-1',
            riskId: 'risk-1',
            type: 'ADD',
            title: '添加争议解决条款',
            description: '建议添加明确的争议解决方式',
            priority: 'HIGH',
            reason: '避免未来纠纷处理困难',
          },
        ],
        reviewTime: 2500,
      };

      const { reviewContract } = require('@/lib/ai/contract-reviewer');
      reviewContract.mockResolvedValueOnce(mockReviewResult);

      const request = new NextRequest(
        'http://localhost:3000/api/contracts/review/contract-1'
      );
      const response = await reviewGET(request, {
        params: Promise.resolve({ id: 'contract-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('overallScore');
      expect(data.data).toHaveProperty('risks');
      expect(data.data).toHaveProperty('suggestions');
      expect(data.data.risks.length).toBeGreaterThan(0);
    });

    it('应该处理合同不存在的情况', async () => {
      (prisma.contract.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost:3000/api/contracts/review/non-existent'
      );
      const response = await reviewGET(request, {
        params: Promise.resolve({ id: 'non-existent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('CONTRACT_NOT_FOUND');
    });

    it('应该正确识别高风险项', async () => {
      const mockContract = {
        id: 'contract-1',
        filePath: '/uploads/contract-1.pdf',
        clientName: '测试客户',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.contract.findUnique as jest.Mock).mockResolvedValueOnce(
        mockContract
      );

      const mockReviewResult = {
        overallScore: 60,
        riskScore: 50,
        complianceScore: 70,
        risks: [
          {
            id: 'risk-1',
            type: 'LIABILITY',
            level: 'CRITICAL',
            title: '无限责任条款',
            description: '合同约定了无限责任',
            location: { page: 2, paragraph: 3 },
            originalText: '...',
            impact: '可能导致巨额赔偿',
            probability: 0.9,
          },
          {
            id: 'risk-2',
            type: 'FINANCIAL',
            level: 'HIGH',
            title: '付款条件不明确',
            description: '付款时间和方式未明确约定',
            location: { page: 3, paragraph: 1 },
            originalText: '...',
            impact: '可能导致付款纠纷',
            probability: 0.8,
          },
        ],
        suggestions: [],
        reviewTime: 3000,
      };

      const { reviewContract } = require('@/lib/ai/contract-reviewer');
      reviewContract.mockResolvedValueOnce(mockReviewResult);

      const request = new NextRequest(
        'http://localhost:3000/api/contracts/review/contract-1'
      );
      const response = await reviewGET(request, {
        params: Promise.resolve({ id: 'contract-1' }),
      });
      const data = await response.json();

      expect(data.data.risks).toHaveLength(2);
      expect(data.data.risks[0].level).toBe('CRITICAL');
      expect(data.data.risks[1].level).toBe('HIGH');
      expect(data.data.criticalRisks).toBe(1);
      expect(data.data.highRisks).toBe(1);
    });

    it('应该生成合理的修改建议', async () => {
      const mockContract = {
        id: 'contract-1',
        filePath: '/uploads/contract-1.pdf',
        clientName: '测试客户',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.contract.findUnique as jest.Mock).mockResolvedValueOnce(
        mockContract
      );

      const mockReviewResult = {
        overallScore: 70,
        riskScore: 65,
        complianceScore: 75,
        risks: [
          {
            id: 'risk-1',
            type: 'CONFIDENTIALITY',
            level: 'MEDIUM',
            title: '保密条款不完整',
            description: '保密范围和期限未明确',
            location: { page: 4, paragraph: 2 },
            originalText: '双方应保守商业秘密',
            impact: '可能导致商业秘密泄露',
            probability: 0.6,
          },
        ],
        suggestions: [
          {
            id: 'suggestion-1',
            riskId: 'risk-1',
            type: 'MODIFY',
            title: '完善保密条款',
            description: '建议明确保密范围、期限和违约责任',
            originalText: '双方应保守商业秘密',
            suggestedText:
              '双方应对在合作过程中知悉的对方商业秘密承担保密义务，保密期限为合同终止后3年，违反保密义务的一方应承担违约责任',
            priority: 'MEDIUM',
            reason: '明确保密义务有助于保护商业秘密',
          },
        ],
        reviewTime: 2800,
      };

      const { reviewContract } = require('@/lib/ai/contract-reviewer');
      reviewContract.mockResolvedValueOnce(mockReviewResult);

      const request = new NextRequest(
        'http://localhost:3000/api/contracts/review/contract-1'
      );
      const response = await reviewGET(request, {
        params: Promise.resolve({ id: 'contract-1' }),
      });
      const data = await response.json();

      expect(data.data.suggestions).toHaveLength(1);
      expect(data.data.suggestions[0].type).toBe('MODIFY');
      expect(data.data.suggestions[0]).toHaveProperty('originalText');
      expect(data.data.suggestions[0]).toHaveProperty('suggestedText');
    });
  });

  describe('GET /api/contracts/review/history', () => {
    it('应该返回审查历史列表', async () => {
      const mockHistory = [
        {
          id: 'review-1',
          contractId: 'contract-1',
          fileName: 'contract1.pdf',
          reviewedAt: new Date('2026-01-30T10:00:00Z'),
          overallScore: 75,
          totalRisks: 5,
          criticalRisks: 1,
          status: 'COMPLETED',
        },
        {
          id: 'review-2',
          contractId: 'contract-2',
          fileName: 'contract2.pdf',
          reviewedAt: new Date('2026-01-29T15:00:00Z'),
          overallScore: 85,
          totalRisks: 2,
          criticalRisks: 0,
          status: 'COMPLETED',
        },
      ];

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce(
        mockHistory
      );

      const request = new NextRequest(
        'http://localhost:3000/api/contracts/review/history?page=1&pageSize=10'
      );
      const response = await historyGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(2);
      expect(data.data.items[0]).toHaveProperty('fileName');
      expect(data.data.items[0]).toHaveProperty('overallScore');
    });

    it('应该支持分页', async () => {
      const mockHistory = Array.from({ length: 5 }, (_, i) => ({
        id: `review-${i + 1}`,
        contractId: `contract-${i + 1}`,
        fileName: `contract${i + 1}.pdf`,
        reviewedAt: new Date(),
        overallScore: 75,
        totalRisks: 3,
        criticalRisks: 0,
        status: 'COMPLETED',
      }));

      (prisma.contract.findMany as jest.Mock).mockResolvedValueOnce(
        mockHistory
      );

      const request = new NextRequest(
        'http://localhost:3000/api/contracts/review/history?page=1&pageSize=5'
      );
      const response = await historyGET(request);
      const data = await response.json();

      expect(data.data.items.length).toBeLessThanOrEqual(5);
      expect(data.data).toHaveProperty('page');
      expect(data.data).toHaveProperty('pageSize');
      expect(data.data).toHaveProperty('total');
    });
  });
});
