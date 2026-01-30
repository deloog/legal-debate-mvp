/**
 * 风险评估API测试
 * 测试覆盖率目标：90%+
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/risk-assessment/route';
import type { RiskAssessmentFormData } from '@/types/risk-assessment';
import { RiskLevel, RiskCategory, RiskType } from '@/types/risk';

// Mock风险评估服务
jest.mock('@/lib/risk/risk-assessment-service', () => ({
  RiskAssessmentService: {
    assessRisk: jest.fn(),
  },
}));

describe('风险评估API测试', () => {
  const mockFormData: RiskAssessmentFormData = {
    caseId: 'case-001',
    caseTitle: '劳动合同纠纷案',
    caseType: '劳动争议',
    caseDescription: '员工因公司未支付加班费提起诉讼',
    parties: {
      plaintiff: '张三',
      defendant: '某科技公司',
    },
    facts: [
      '原告于2020年1月入职被告公司',
      '原告经常加班但未获得加班费',
      '原告于2023年12月离职',
    ],
    claims: ['要求支付加班费10万元', '要求支付经济补偿金5万元'],
    evidence: [
      {
        id: 'evidence-001',
        name: '劳动合同',
        type: '书证',
        description: '双方签订的劳动合同',
      },
      {
        id: 'evidence-002',
        name: '考勤记录',
        type: '书证',
        description: '原告的考勤记录',
      },
    ],
    legalBasis: [
      {
        id: 'law-001',
        lawName: '劳动法',
        articleNumber: '第44条',
        content: '用人单位应当支付加班费',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/risk-assessment', () => {
    it('应该成功评估风险', async () => {
      const { RiskAssessmentService } =
        await import('@/lib/risk/risk-assessment-service');

      // Mock评估结果
      const mockResult = {
        id: 'assessment-001',
        caseId: 'case-001',
        caseTitle: '劳动合同纠纷案',
        assessedAt: new Date(),
        assessmentTime: 1500,
        overallRiskLevel: RiskLevel.MEDIUM,
        overallRiskScore: 65,
        winProbability: 70,
        risks: [
          {
            id: 'risk-001',
            riskType: RiskType.EVIDENCE_STRENGTH,
            riskCategory: RiskCategory.EVIDENTIARY,
            riskLevel: RiskLevel.MEDIUM,
            score: 0.6,
            confidence: 0.8,
            description: '证据强度中等',
            evidence: ['考勤记录不完整'],
            suggestions: [],
            identifiedAt: new Date(),
          },
        ],
        statistics: {
          totalRisks: 1,
          criticalRisks: 0,
          highRisks: 0,
          mediumRisks: 1,
          lowRisks: 0,
          byCategory: {
            [RiskCategory.PROCEDURAL]: 0,
            [RiskCategory.EVIDENTIARY]: 1,
            [RiskCategory.SUBSTANTIVE]: 0,
            [RiskCategory.STRATEGIC]: 0,
          },
          byType: {
            [RiskType.LEGAL_PROCEDURE]: 0,
            [RiskType.EVIDENCE_STRENGTH]: 1,
            [RiskType.STATUTE_LIMITATION]: 0,
            [RiskType.JURISDICTION]: 0,
            [RiskType.COST_BENEFIT]: 0,
            [RiskType.FACT_VERIFICATION]: 0,
            [RiskType.LEGAL_BASIS]: 0,
            [RiskType.CONTRADICTION]: 0,
            [RiskType.PROOF_BURDEN]: 0,
          },
        },
        suggestions: [],
        timeline: [],
      };

      (RiskAssessmentService.assessRisk as jest.Mock).mockResolvedValue(
        mockResult
      );

      const request = new NextRequest(
        'http://localhost:3000/api/risk-assessment',
        {
          method: 'POST',
          body: JSON.stringify({ formData: mockFormData }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBe('assessment-001');
      expect(data.data.overallRiskLevel).toBe(RiskLevel.MEDIUM);
      expect(RiskAssessmentService.assessRisk).toHaveBeenCalledWith(
        mockFormData
      );
    });

    it('应该处理缺少必填字段的情况', async () => {
      const invalidFormData = {
        caseId: 'case-001',
        // 缺少其他必填字段
      };

      const request = new NextRequest(
        'http://localhost:3000/api/risk-assessment',
        {
          method: 'POST',
          body: JSON.stringify({ formData: invalidFormData }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('INVALID_INPUT');
    });

    it('应该处理空的案件事实', async () => {
      const invalidFormData = {
        ...mockFormData,
        facts: [],
      };

      const request = new NextRequest(
        'http://localhost:3000/api/risk-assessment',
        {
          method: 'POST',
          body: JSON.stringify({ formData: invalidFormData }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_INPUT');
    });

    it('应该处理空的诉讼请求', async () => {
      const invalidFormData = {
        ...mockFormData,
        claims: [],
      };

      const request = new NextRequest(
        'http://localhost:3000/api/risk-assessment',
        {
          method: 'POST',
          body: JSON.stringify({ formData: invalidFormData }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_INPUT');
    });

    it('应该处理服务错误', async () => {
      const { RiskAssessmentService } =
        await import('@/lib/risk/risk-assessment-service');

      (RiskAssessmentService.assessRisk as jest.Mock).mockRejectedValue(
        new Error('评估服务错误')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/risk-assessment',
        {
          method: 'POST',
          body: JSON.stringify({ formData: mockFormData }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('ASSESSMENT_ERROR');
    });

    it('应该处理无效的JSON格式', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/risk-assessment',
        {
          method: 'POST',
          body: 'invalid json',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_JSON');
    });

    it('应该处理缺少formData字段', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/risk-assessment',
        {
          method: 'POST',
          body: JSON.stringify({}),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('MISSING_FORM_DATA');
    });

    it('应该正确处理高风险案件', async () => {
      const { RiskAssessmentService } =
        await import('@/lib/risk/risk-assessment-service');

      const highRiskResult = {
        id: 'assessment-002',
        caseId: 'case-002',
        caseTitle: '重大合同纠纷',
        assessedAt: new Date(),
        assessmentTime: 2000,
        overallRiskLevel: RiskLevel.CRITICAL,
        overallRiskScore: 90,
        winProbability: 30,
        risks: [],
        statistics: {
          totalRisks: 3,
          criticalRisks: 2,
          highRisks: 1,
          mediumRisks: 0,
          lowRisks: 0,
          byCategory: {
            [RiskCategory.PROCEDURAL]: 1,
            [RiskCategory.EVIDENTIARY]: 1,
            [RiskCategory.SUBSTANTIVE]: 1,
            [RiskCategory.STRATEGIC]: 0,
          },
          byType: {
            [RiskType.LEGAL_PROCEDURE]: 0,
            [RiskType.EVIDENCE_STRENGTH]: 1,
            [RiskType.STATUTE_LIMITATION]: 0,
            [RiskType.JURISDICTION]: 0,
            [RiskType.COST_BENEFIT]: 0,
            [RiskType.FACT_VERIFICATION]: 1,
            [RiskType.LEGAL_BASIS]: 1,
            [RiskType.CONTRADICTION]: 0,
            [RiskType.PROOF_BURDEN]: 0,
          },
        },
        suggestions: [],
        timeline: [],
      };

      (RiskAssessmentService.assessRisk as jest.Mock).mockResolvedValue(
        highRiskResult
      );

      const request = new NextRequest(
        'http://localhost:3000/api/risk-assessment',
        {
          method: 'POST',
          body: JSON.stringify({ formData: mockFormData }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.overallRiskLevel).toBe(RiskLevel.CRITICAL);
      expect(data.data.statistics.criticalRisks).toBe(2);
    });
  });
});
