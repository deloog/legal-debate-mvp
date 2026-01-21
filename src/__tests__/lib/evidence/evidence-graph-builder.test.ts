/**
 * EvidenceGraphBuilder 单元测试
 */

import { EvidenceGraphBuilder } from '@/lib/evidence/evidence-graph-builder';
import { EvidenceChainRelationType } from '@/types/evidence-chain';

describe('EvidenceGraphBuilder', () => {
  let builder: EvidenceGraphBuilder;

  beforeEach(() => {
    builder = new EvidenceGraphBuilder();
  });

  describe('buildGraph', () => {
    it('should build graph successfully', () => {
      const evidences = [
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
      ];

      const relations = [
        {
          evidenceId: 'evidence-001',
          relationType: EvidenceChainRelationType.SUPPORTS,
          relatedId: 'evidence-002',
          description: '合同书支撑付款记录',
          strength: 3,
          confidence: 0.8,
        },
      ];

      const graph = builder.buildGraph(evidences, relations);

      expect(graph).toBeDefined();
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.coreEvidences).toBeDefined();
      expect(graph.isolatedEvidences).toBeDefined();
    });

    it('should handle empty input', () => {
      const graph = builder.buildGraph([], []);

      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });

    it('should identify core evidences', () => {
      const evidences = [
        {
          id: 'evidence-001',
          name: '合同书',
          type: 'DOCUMENTARY_EVIDENCE',
          status: 'APPROVED',
          relevanceScore: 0.9,
        },
        {
          id: 'evidence-002',
          name: '付款记录',
          type: 'ELECTRONIC_EVIDENCE',
          status: 'APPROVED',
          relevanceScore: 0.7,
        },
        {
          id: 'evidence-003',
          name: '证人证言',
          type: 'WITNESS_TESTIMONY',
          status: 'APPROVED',
          relevanceScore: 0.8,
        },
        {
          id: 'evidence-004',
          name: '鉴定意见',
          type: 'EXPERT_OPINION',
          status: 'APPROVED',
          relevanceScore: 0.85,
        },
      ];

      const relations = [
        {
          evidenceId: 'evidence-002',
          relationType: EvidenceChainRelationType.SUPPORTS,
          relatedId: 'evidence-001',
          description: '付款记录支撑合同书',
          strength: 3,
          confidence: 0.8,
        },
        {
          evidenceId: 'evidence-003',
          relationType: EvidenceChainRelationType.SUPPORTS,
          relatedId: 'evidence-001',
          description: '证人证言支撑合同书',
          strength: 3,
          confidence: 0.7,
        },
        {
          evidenceId: 'evidence-004',
          relationType: EvidenceChainRelationType.SUPPORTS,
          relatedId: 'evidence-001',
          description: '鉴定意见支撑合同书',
          strength: 4,
          confidence: 0.9,
        },
      ];

      const graph = builder.buildGraph(evidences, relations);

      // evidence-001有3个入边，应该被识别为核心证据
      expect(graph.coreEvidences.length).toBeGreaterThan(0);
      expect(graph.coreEvidences).toContain('evidence-001');
    });

    it('should identify isolated evidences', () => {
      const evidences = [
        {
          id: 'evidence-001',
          name: '合同书',
          type: 'DOCUMENTARY_EVIDENCE',
          status: 'APPROVED',
          relevanceScore: 0.8,
        },
        {
          id: 'evidence-002',
          name: '孤证',
          type: 'OTHER',
          status: 'PENDING',
          relevanceScore: 0.5,
        },
      ];

      const relations = [
        {
          evidenceId: 'evidence-001',
          relationType: EvidenceChainRelationType.SUPPORTS,
          relatedId: 'evidence-001',
          description: '自支撑',
          strength: 3,
          confidence: 0.8,
        },
      ];

      const graph = builder.buildGraph(evidences, relations);

      expect(graph.isolatedEvidences).toContain('evidence-002');
    });
  });

  describe('calculateChainCompleteness', () => {
    it('should calculate 100% for complete chain', () => {
      const evidences = [
        {
          id: 'evidence-001',
          name: '证据1',
          type: 'DOCUMENTARY_EVIDENCE',
          status: 'APPROVED',
          relevanceScore: 0.8,
        },
        {
          id: 'evidence-002',
          name: '证据2',
          type: 'ELECTRONIC_EVIDENCE',
          status: 'APPROVED',
          relevanceScore: 0.8,
        },
        {
          id: 'evidence-003',
          name: '证据3',
          type: 'PHYSICAL_EVIDENCE',
          status: 'APPROVED',
          relevanceScore: 0.8,
        },
      ];

      const relations = [
        {
          evidenceId: 'evidence-001',
          relationType: EvidenceChainRelationType.SUPPORTS,
          relatedId: 'evidence-002',
          description: '支撑关系',
          strength: 3,
          confidence: 0.8,
        },
        {
          evidenceId: 'evidence-002',
          relationType: EvidenceChainRelationType.SUPPORTS,
          relatedId: 'evidence-003',
          description: '支撑关系',
          strength: 3,
          confidence: 0.8,
        },
      ];

      const graph = builder.buildGraph(evidences, relations);

      expect(graph.statistics.chainCompleteness).toBe(100);
    });

    it('should calculate lower for incomplete chain', () => {
      const evidences = [
        {
          id: 'evidence-001',
          name: '证据1',
          type: 'DOCUMENTARY_EVIDENCE',
          status: 'APPROVED',
          relevanceScore: 0.8,
        },
        {
          id: 'evidence-002',
          name: '孤证',
          type: 'OTHER',
          status: 'PENDING',
          relevanceScore: 0.5,
        },
      ];

      const relations = [
        {
          evidenceId: 'evidence-001',
          relationType: EvidenceChainRelationType.SUPPORTS,
          relatedId: 'evidence-001',
          description: '自支撑',
          strength: 3,
          confidence: 0.8,
        },
      ];

      const graph = builder.buildGraph(evidences, relations);

      expect(graph.statistics.chainCompleteness).toBeLessThan(100);
    });
  });
});
