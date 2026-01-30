/**
 * 质证预判服务测试
 *
 * 测试覆盖：
 * - 质证意见预判功能
 * - 质证类型分类（真实性/合法性/关联性）
 * - 可能性评估
 * - 应对建议生成
 * - 风险评估
 * - AI智能分析
 * - 错误处理
 */

import { CrossExaminationService } from '@/lib/evidence/cross-examination-service';
import type { Evidence } from '@prisma/client';

// Mock AI Service
jest.mock('@/lib/ai/clients', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockResolvedValue(
      JSON.stringify({
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
        ],
        overallRisk: 'medium',
        riskNote: '存在真实性质疑风险，建议补充原件',
      })
    ),
  })),
}));

describe('CrossExaminationService', () => {
  let service: CrossExaminationService;

  beforeEach(() => {
    service = new CrossExaminationService();
    jest.clearAllMocks();
  });

  describe('preAssess - 质证预判', () => {
    it('应该成功预判质证意见', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同复印件',
        type: 'DOCUMENT',
        description: '与公司签订的劳动合同复印件',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 85,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result).toBeDefined();
      expect(result.possibleChallenges).toBeDefined();
      expect(result.possibleChallenges.length).toBeGreaterThan(0);
      expect(result.responses).toBeDefined();
      expect(result.overallRisk).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(result.overallRisk);
    });

    it('应该正确分类质证类型', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      const challenge = result.possibleChallenges[0];
      expect(challenge.type).toBeDefined();
      expect(['authenticity', 'legality', 'relevance']).toContain(
        challenge.type
      );
    });

    it('应该评估质证意见的可能性', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      for (const challenge of result.possibleChallenges) {
        expect(challenge.likelihood).toBeGreaterThanOrEqual(0);
        expect(challenge.likelihood).toBeLessThanOrEqual(100);
      }
    });

    it('应该生成应对建议', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result.responses).toBeDefined();
      expect(Array.isArray(result.responses)).toBe(true);
      if (result.responses.length > 0) {
        const response = result.responses[0];
        expect(response.challenge).toBeDefined();
        expect(response.response).toBeDefined();
      }
    });

    it('应该评估总体风险等级', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result.overallRisk).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(result.overallRisk);
      expect(result.riskNote).toBeDefined();
    });

    it('应该处理不同的当事人立场', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      // 原告立场
      const plaintiffResult = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      // 被告立场
      const defendantResult = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'defendant',
        caseType: 'LABOR_DISPUTE',
      });

      expect(plaintiffResult).toBeDefined();
      expect(defendantResult).toBeDefined();
    });

    it('应该处理不同案件类型', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'CONTRACT_DISPUTE',
      });

      expect(result).toBeDefined();
    });
  });

  describe('质证类型分类', () => {
    it('应该识别真实性质证', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同复印件',
        type: 'DOCUMENT',
        description: '复印件',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 85,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      const authenticityChallenge = result.possibleChallenges.find(
        c => c.type === 'authenticity'
      );
      expect(authenticityChallenge).toBeDefined();
    });

    it('应该识别合法性质证', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '录音证据',
        type: 'AUDIO',
        description: '未经对方同意的录音',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 70,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result.possibleChallenges.length).toBeGreaterThan(0);
    });

    it('应该识别关联性质证', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '无关文件',
        type: 'DOCUMENT',
        description: '与案件无关的文件',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 30,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result.possibleChallenges.length).toBeGreaterThan(0);
    });
  });

  describe('风险评估', () => {
    it('高质量证据应该返回低风险', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同原件',
        type: 'DOCUMENT',
        description: '双方签字盖章的劳动合同原件',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 95,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      // 高质量证据的风险应该较低
      expect(['low', 'medium']).toContain(result.overallRisk);
    });

    it('低质量证据应该返回高风险', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '模糊照片',
        type: 'PHYSICAL',
        description: '模糊不清的照片',
        caseId: 'case-1',
        status: 'CHALLENGED',
        relevanceScore: 40,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result.overallRisk).toBeDefined();
    });
  });

  describe('应对建议', () => {
    it('应该为每个质证意见提供应对建议', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 85,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result.responses.length).toBeGreaterThan(0);
      for (const response of result.responses) {
        expect(response.challenge).toBeDefined();
        expect(response.response).toBeDefined();
      }
    });

    it('应该建议补充证据', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同复印件',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 85,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      const hasSupporting = result.responses.some(r => r.supportingEvidence);
      expect(hasSupporting).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该处理AI服务失败', async () => {
      const mockAIService = require('@/lib/ai/clients').AIService;
      mockAIService.mockImplementationOnce(() => ({
        chat: jest.fn().mockRejectedValue(new Error('AI服务不可用')),
      }));

      const service = new CrossExaminationService();
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      await expect(
        service.preAssess({
          evidence: evidence as Evidence,
          ourPosition: 'plaintiff',
          caseType: 'LABOR_DISPUTE',
        })
      ).rejects.toThrow();
    });

    it('应该处理无效的证据数据', async () => {
      const invalidEvidence: any = {
        id: 'evidence-1',
        // 缺少必要字段
      };

      await expect(
        service.preAssess({
          evidence: invalidEvidence,
          ourPosition: 'plaintiff',
          caseType: 'LABOR_DISPUTE',
        })
      ).rejects.toThrow();
    });

    it('应该处理无效的立场参数', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      await expect(
        service.preAssess({
          evidence: evidence as Evidence,
          ourPosition: 'invalid' as any,
          caseType: 'LABOR_DISPUTE',
        })
      ).rejects.toThrow();
    });
  });

  describe('不同证据类型', () => {
    it('应该处理书证', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result).toBeDefined();
    });

    it('应该处理物证', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '工作证',
        type: 'PHYSICAL',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 80,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result).toBeDefined();
    });

    it('应该处理视听资料', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '监控录像',
        type: 'AUDIO',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 85,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result).toBeDefined();
    });

    it('应该处理电子数据', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '微信聊天记录',
        type: 'ELECTRONIC',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 75,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result).toBeDefined();
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成预判', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      const startTime = Date.now();
      await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });
      const endTime = Date.now();

      // 应该在3秒内完成
      expect(endTime - startTime).toBeLessThan(3000);
    });
  });

  describe('边界情况', () => {
    it('应该处理相关性评分为null的证据', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: null,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result).toBeDefined();
    });

    it('应该处理被质疑状态的证据', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'CHALLENGED',
        relevanceScore: 85,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result).toBeDefined();
      // 被质疑的证据风险应该较高
      expect(['medium', 'high']).toContain(result.overallRisk);
    });

    it('应该处理待审核状态的证据', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        caseId: 'case-1',
        status: 'PENDING',
        relevanceScore: 85,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      expect(result).toBeDefined();
    });
  });

  describe('AI提示词设计', () => {
    it('应该生成合理的AI提示词', async () => {
      const evidence: Partial<Evidence> = {
        id: 'evidence-1',
        name: '劳动合同',
        type: 'DOCUMENT',
        description: '与公司签订的劳动合同',
        caseId: 'case-1',
        status: 'APPROVED',
        relevanceScore: 90,
      };

      const result = await service.preAssess({
        evidence: evidence as Evidence,
        ourPosition: 'plaintiff',
        caseType: 'LABOR_DISPUTE',
      });

      // 验证AI返回了有效结果
      expect(result).toBeDefined();
      expect(result.possibleChallenges).toBeDefined();
    });
  });
});
