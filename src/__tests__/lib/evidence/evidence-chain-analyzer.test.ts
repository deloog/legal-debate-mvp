/**
 * EvidenceChainAnalyzer 单元测试
 */

import { EvidenceChainAnalyzer } from '@/lib/evidence/evidence-chain-analyzer';
import type { EvidenceChainAnalysisRequest } from '@/types/evidence-chain';

describe('EvidenceChainAnalyzer', () => {
  let analyzer: EvidenceChainAnalyzer;

  beforeEach(() => {
    analyzer = new EvidenceChainAnalyzer();
  });

  describe('analyzeEvidenceChain', () => {
    it('should analyze evidence chain successfully', () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-001',
        evidences: [
          {
            id: 'evidence-001',
            name: '合同书',
            type: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
          },
          {
            id: 'evidence-002',
            name: '证人证言',
            type: 'WITNESS_TESTIMONY',
            status: 'APPROVED',
            relevanceScore: 0.7,
          },
        ],
        existingRelations: [],
        options: {
          useAI: false,
        },
      };

      const result = analyzer.analyzeEvidenceChain(request);

      expect(result).toBeDefined();
      expect(result.chainGraph).toBeDefined();
      expect(result.chains).toBeDefined();
      expect(result.effectivenessEvaluations).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty evidence list', () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-002',
        evidences: [],
        existingRelations: [],
      };

      const result = analyzer.analyzeEvidenceChain(request);

      expect(result.chainGraph.nodes).toHaveLength(0);
      expect(result.chainGraph.edges).toHaveLength(0);
    });

    it('should calculate chain completeness', () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-003',
        evidences: [
          {
            id: 'evidence-001',
            name: '合同书',
            type: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
          },
          {
            id: 'evidence-002',
            name: '付款记录',
            type: 'ELECTRONIC_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.9,
          },
        ],
        existingRelations: [
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-002',
          },
        ],
      };

      const result = analyzer.analyzeEvidenceChain(request);

      expect(result.chainGraph.statistics.chainCompleteness).toBe(100);
    });
  });

  describe('effectiveness evaluations', () => {
    it('should evaluate evidence effectiveness', () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-004',
        evidences: [
          {
            id: 'evidence-001',
            name: '合同书',
            type: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.9,
          },
        ],
        existingRelations: [],
      };

      const result = analyzer.analyzeEvidenceChain(request);

      const evaluation = result.effectivenessEvaluations.get('evidence-001');

      expect(evaluation).toBeDefined();
      expect(evaluation?.effectivenessScore).toBeGreaterThanOrEqual(0);
      expect(evaluation?.effectivenessScore).toBeLessThanOrEqual(100);
      expect(evaluation?.scores).toBeDefined();
      expect(evaluation?.suggestions).toBeDefined();
    });

    it('should generate suggestions for low scores', () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-005',
        evidences: [
          {
            id: 'evidence-001',
            name: '模糊证据',
            type: 'OTHER',
            status: 'PENDING',
            relevanceScore: 0.3,
          },
        ],
        existingRelations: [],
      };

      const result = analyzer.analyzeEvidenceChain(request);

      const evaluation = result.effectivenessEvaluations.get('evidence-001');

      expect(evaluation?.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('summary generation', () => {
    it('should generate correct summary', () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-006',
        evidences: [
          {
            id: 'evidence-001',
            name: '合同书',
            type: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
          },
          {
            id: 'evidence-002',
            name: '付款记录',
            type: 'ELECTRONIC_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.9,
          },
        ],
        existingRelations: [
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-002',
          },
        ],
      };

      const result = analyzer.analyzeEvidenceChain(request);

      expect(result.summary.totalEvidences).toBe(2);
      expect(result.summary.detectedRelations).toBe(1);
      expect(result.summary.averageEffectiveness).toBeGreaterThan(0);
      expect(result.summary.keyFindings).toBeDefined();
    });
  });
});
