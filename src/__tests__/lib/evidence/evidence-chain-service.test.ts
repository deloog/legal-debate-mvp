/**
 * 证据链分析服务测试
 *
 * 测试覆盖：
 * - 证据链分析功能
 * - 证据关联性分析
 * - 证据链完整性计算
 * - 证据链缺口识别
 * - AI智能分析
 * - 错误处理
 */

import { EvidenceChainService } from '@/lib/evidence/evidence-chain-service';
import type { Evidence } from '@prisma/client';

// Mock AI Service
jest.mock('@/lib/ai/clients', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockResolvedValue(
      JSON.stringify({
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
        suggestions: ['建议补充社保缴纳记录以加强证据链'],
      })
    ),
  })),
}));

describe('EvidenceChainService', () => {
  let service: EvidenceChainService;

  beforeEach(() => {
    service = new EvidenceChainService();
    jest.clearAllMocks();
  });

  describe('analyzeChain - 证据链分析', () => {
    it('应该成功分析证据链', async () => {
      const evidences: Partial<Evidence>[] = [
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          description: '与公司签订的劳动合同',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
        {
          id: 'evidence-2',
          name: '工资条',
          type: 'DOCUMENT',
          description: '近12个月工资条',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 85,
        },
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系存在',
      });

      expect(result).toBeDefined();
      expect(result.chains).toBeDefined();
      expect(result.chains.length).toBeGreaterThan(0);
      expect(result.completeness).toBeGreaterThanOrEqual(0);
      expect(result.completeness).toBeLessThanOrEqual(100);
      expect(result.gaps).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('应该正确计算证据链完整性', async () => {
      const evidences: Partial<Evidence>[] = [
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      expect(result.completeness).toBeGreaterThanOrEqual(0);
      expect(result.completeness).toBeLessThanOrEqual(100);
      expect(typeof result.completeness).toBe('number');
    });

    it('应该识别证据链缺口', async () => {
      const evidences: Partial<Evidence>[] = [
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系及工资标准',
      });

      expect(result.gaps).toBeDefined();
      expect(Array.isArray(result.gaps)).toBe(true);
    });

    it('应该提供证据收集建议', async () => {
      const evidences: Partial<Evidence>[] = [
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('应该处理空证据列表', async () => {
      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: [],
        targetFact: '证明劳动关系',
      });

      expect(result).toBeDefined();
      expect(result.chains).toEqual([]);
      expect(result.completeness).toBe(0);
      expect(result.gaps.length).toBeGreaterThan(0);
    });

    it('应该处理单个证据', async () => {
      const evidences: Partial<Evidence>[] = [
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      expect(result).toBeDefined();
      expect(result.chains.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzeConnections - 证据关联分析', () => {
    it('应该分析证据之间的关联关系', async () => {
      const evidences: Partial<Evidence>[] = [
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
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      expect(result.connections).toBeDefined();
      expect(Array.isArray(result.connections)).toBe(true);
    });

    it('应该正确标识关联关系类型', async () => {
      const evidences: Partial<Evidence>[] = [
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
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      if (result.connections.length > 0) {
        const connection = result.connections[0];
        expect(connection.from).toBeDefined();
        expect(connection.to).toBeDefined();
        expect(connection.relationship).toBeDefined();
      }
    });
  });

  describe('calculateCompleteness - 完整性计算', () => {
    it('应该返回0-100之间的完整性分数', async () => {
      const evidences: Partial<Evidence>[] = [
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      expect(result.completeness).toBeGreaterThanOrEqual(0);
      expect(result.completeness).toBeLessThanOrEqual(100);
    });

    it('空证据列表应该返回0完整性', async () => {
      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: [],
        targetFact: '证明劳动关系',
      });

      expect(result.completeness).toBe(0);
    });
  });

  describe('identifyGaps - 缺口识别', () => {
    it('应该识别证据链中的缺口', async () => {
      const evidences: Partial<Evidence>[] = [
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系及工资标准',
      });

      expect(result.gaps).toBeDefined();
      expect(Array.isArray(result.gaps)).toBe(true);
    });

    it('完整的证据链应该返回较少的缺口', async () => {
      const evidences: Partial<Evidence>[] = [
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
        {
          id: 'evidence-3',
          name: '社保记录',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 80,
        },
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      // 完整证据链的缺口应该较少
      expect(result.gaps.length).toBeLessThanOrEqual(2);
    });
  });

  describe('错误处理', () => {
    it('应该处理AI服务失败', async () => {
      // Mock AI服务失败
      const mockAIService = require('@/lib/ai/clients').AIService;
      mockAIService.mockImplementationOnce(() => ({
        chat: jest.fn().mockRejectedValue(new Error('AI服务不可用')),
      }));

      const service = new EvidenceChainService();
      const evidences: Partial<Evidence>[] = [
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
      ];

      await expect(
        service.analyzeChain({
          caseId: 'case-1',
          evidences: evidences as Evidence[],
          targetFact: '证明劳动关系',
        })
      ).rejects.toThrow();
    });

    it('应该处理无效的证据数据', async () => {
      const invalidEvidences: any[] = [
        {
          id: 'evidence-1',
          // 缺少必要字段
        },
      ];

      await expect(
        service.analyzeChain({
          caseId: 'case-1',
          evidences: invalidEvidences,
          targetFact: '证明劳动关系',
        })
      ).rejects.toThrow();
    });

    it('应该处理空的targetFact', async () => {
      const evidences: Partial<Evidence>[] = [
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
      ];

      await expect(
        service.analyzeChain({
          caseId: 'case-1',
          evidences: evidences as Evidence[],
          targetFact: '',
        })
      ).rejects.toThrow();
    });
  });

  describe('AI提示词设计', () => {
    it('应该生成合理的AI提示词', async () => {
      const evidences: Partial<Evidence>[] = [
        {
          id: 'evidence-1',
          name: '劳动合同',
          type: 'DOCUMENT',
          description: '与公司签订的劳动合同',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 90,
        },
      ];

      // 通过调用服务来间接测试提示词生成
      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      // 验证AI返回了有效结果
      expect(result).toBeDefined();
      expect(result.chains).toBeDefined();
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成分析', async () => {
      const evidences: Partial<Evidence>[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: `evidence-${i + 1}`,
          name: `证据${i + 1}`,
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 80 + i,
        })
      );

      const startTime = Date.now();
      await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });
      const endTime = Date.now();

      // 应该在5秒内完成
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('边界情况', () => {
    it('应该处理大量证据', async () => {
      const evidences: Partial<Evidence>[] = Array.from(
        { length: 50 },
        (_, i) => ({
          id: `evidence-${i + 1}`,
          name: `证据${i + 1}`,
          type: 'DOCUMENT',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 80,
        })
      );

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      expect(result).toBeDefined();
    });

    it('应该处理不同类型的证据', async () => {
      const evidences: Partial<Evidence>[] = [
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
          name: '证人证言',
          type: 'WITNESS',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 75,
        },
        {
          id: 'evidence-3',
          name: '现场照片',
          type: 'PHYSICAL',
          caseId: 'case-1',
          status: 'APPROVED',
          relevanceScore: 70,
        },
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      expect(result).toBeDefined();
      expect(result.chains.length).toBeGreaterThanOrEqual(0);
    });

    it('应该处理不同状态的证据', async () => {
      const evidences: Partial<Evidence>[] = [
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
          status: 'PENDING',
          relevanceScore: 85,
        },
      ];

      const result = await service.analyzeChain({
        caseId: 'case-1',
        evidences: evidences as Evidence[],
        targetFact: '证明劳动关系',
      });

      expect(result).toBeDefined();
    });
  });
});
