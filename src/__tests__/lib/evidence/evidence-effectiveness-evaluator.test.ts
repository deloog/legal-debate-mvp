/**
 * EvidenceEffectivenessEvaluator 单元测试
 */

import { EvidenceEffectivenessEvaluator } from '@/lib/evidence/evidence-effectiveness-evaluator';
import type {
  EvidenceChainNode,
  EvidenceChainGraph,
} from '@/types/evidence-chain';
import {
  EvidenceChainRelationType,
  EvidenceRelationStrength,
  EffectivenessLevel,
} from '@/types/evidence-chain';

describe('EvidenceEffectivenessEvaluator', () => {
  let evaluator: EvidenceEffectivenessEvaluator;

  beforeEach(() => {
    evaluator = EvidenceEffectivenessEvaluator.getInstance();
  });

  describe('evaluateAll', () => {
    it('should evaluate all evidence nodes', () => {
      const nodes: EvidenceChainNode[] = [
        createMockNode(
          'evidence-001',
          '合同书',
          'DOCUMENTARY_EVIDENCE',
          'APPROVED',
          0.9
        ),
        createMockNode(
          'evidence-002',
          '证人证言',
          'WITNESS_TESTIMONY',
          'APPROVED',
          0.7
        ),
        createMockNode(
          'evidence-003',
          '照片',
          'PHYSICAL_EVIDENCE',
          'PENDING',
          0.5
        ),
      ];

      const graph: EvidenceChainGraph = createMockGraph();

      const results = evaluator.evaluateAll(nodes, graph);

      expect(results.size).toBe(3);
      expect(results.get('evidence-001')).toBeDefined();
      expect(results.get('evidence-002')).toBeDefined();
      expect(results.get('evidence-003')).toBeDefined();
    });

    it('should handle empty node list', () => {
      const nodes: EvidenceChainNode[] = [];
      const graph: EvidenceChainGraph = createMockGraph();

      const results = evaluator.evaluateAll(nodes, graph);

      expect(results.size).toBe(0);
    });

    it('should return evaluations with valid scores', () => {
      const nodes: EvidenceChainNode[] = [
        createMockNode(
          'evidence-001',
          '合同书',
          'DOCUMENTARY_EVIDENCE',
          'APPROVED',
          0.8
        ),
      ];

      const graph: EvidenceChainGraph = createMockGraph();

      const results = evaluator.evaluateAll(nodes, graph);

      const evaluation = results.get('evidence-001');
      expect(evaluation?.effectivenessScore).toBeGreaterThanOrEqual(0);
      expect(evaluation?.effectivenessScore).toBeLessThanOrEqual(100);
    });
  });

  describe('evaluateEvidence', () => {
    it('should evaluate evidence effectiveness correctly', () => {
      const node = createMockNode(
        'evidence-001',
        '合同书',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        0.9
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(node, graph);

      expect(evaluation).toBeDefined();
      expect(evaluation.evidenceId).toBe('evidence-001');
      expect(evaluation.effectivenessScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.effectivenessScore).toBeLessThanOrEqual(100);
      expect(evaluation.scores).toBeDefined();
      expect(evaluation.suggestions).toBeDefined();
      expect(evaluation.legalSupportScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.legalSupportScore).toBeLessThanOrEqual(100);
      expect(evaluation.caseSupportScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.caseSupportScore).toBeLessThanOrEqual(100);
    });

    it('should calculate relevance score based on relevanceScore', () => {
      const highRelevanceNode = createMockNode(
        'evidence-001',
        '合同书',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        0.9
      );
      const lowRelevanceNode = createMockNode(
        'evidence-002',
        '无关证据',
        'OTHER',
        'PENDING',
        0.3
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const highEvaluation = evaluator.evaluateEvidence(
        highRelevanceNode,
        graph
      );
      const lowEvaluation = evaluator.evaluateEvidence(lowRelevanceNode, graph);

      expect(highEvaluation.scores.relevance).toBeGreaterThan(
        lowEvaluation.scores.relevance
      );
    });

    it('should calculate reliability score based on evidence type and connections', () => {
      const documentNode = createMockNode(
        'evidence-001',
        '合同书',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        0.8
      );
      documentNode.incomingRelations = [
        createMockEdge('edge-001', 'evidence-002', 'evidence-001'),
      ];
      documentNode.outgoingRelations = [
        createMockEdge('edge-002', 'evidence-001', 'evidence-003'),
      ];

      const witnessNode = createMockNode(
        'evidence-002',
        '证人证言',
        'WITNESS_TESTIMONY',
        'APPROVED',
        0.7
      );

      const graph: EvidenceChainGraph = createMockGraph();

      const documentEvaluation = evaluator.evaluateEvidence(
        documentNode,
        graph
      );
      const witnessEvaluation = evaluator.evaluateEvidence(witnessNode, graph);

      expect(documentEvaluation.scores.reliability).toBeGreaterThanOrEqual(0);
      expect(witnessEvaluation.scores.reliability).toBeGreaterThanOrEqual(0);
    });

    it('should calculate reliability score lower for rejected evidence', () => {
      const approvedNode = createMockNode(
        'evidence-001',
        '合同书',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        0.8
      );
      const rejectedNode = createMockNode(
        'evidence-002',
        '无效证据',
        'OTHER',
        'REJECTED',
        0.8
      );

      const graph: EvidenceChainGraph = createMockGraph();

      const approvedEvaluation = evaluator.evaluateEvidence(
        approvedNode,
        graph
      );
      const rejectedEvaluation = evaluator.evaluateEvidence(
        rejectedNode,
        graph
      );

      expect(approvedEvaluation.scores.reliability).toBeGreaterThan(
        rejectedEvaluation.scores.reliability
      );
    });

    it('should calculate completeness score based on chain connections', () => {
      const connectedNode = createMockNode(
        'evidence-001',
        '合同书',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        0.8
      );
      connectedNode.incomingRelations = [
        createMockEdge('edge-001', 'evidence-002', 'evidence-001'),
      ];
      connectedNode.outgoingRelations = [
        createMockEdge('edge-002', 'evidence-001', 'evidence-003'),
      ];

      const isolatedNode = createMockNode(
        'evidence-002',
        '孤证',
        'OTHER',
        'PENDING',
        0.5
      );

      const graph: EvidenceChainGraph = createMockGraph();

      const connectedEvaluation = evaluator.evaluateEvidence(
        connectedNode,
        graph
      );
      const isolatedEvaluation = evaluator.evaluateEvidence(
        isolatedNode,
        graph
      );

      expect(connectedEvaluation.scores.completeness).toBeGreaterThan(
        isolatedEvaluation.scores.completeness
      );
    });

    it('should calculate legality score based on status', () => {
      const approvedNode = createMockNode(
        'evidence-001',
        '合同书',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        0.8
      );
      const pendingNode = createMockNode(
        'evidence-002',
        '待审核',
        'ELECTRONIC_EVIDENCE',
        'PENDING',
        0.8
      );
      const rejectedNode = createMockNode(
        'evidence-003',
        '无效证据',
        'OTHER',
        'REJECTED',
        0.8
      );

      const graph: EvidenceChainGraph = createMockGraph();

      const approvedEvaluation = evaluator.evaluateEvidence(
        approvedNode,
        graph
      );
      const pendingEvaluation = evaluator.evaluateEvidence(pendingNode, graph);
      const rejectedEvaluation = evaluator.evaluateEvidence(
        rejectedNode,
        graph
      );

      expect(approvedEvaluation.scores.legality).toBeGreaterThan(
        pendingEvaluation.scores.legality
      );
      expect(pendingEvaluation.scores.legality).toBeGreaterThan(
        rejectedEvaluation.scores.legality
      );
    });

    it('should calculate chain position score for core evidence', () => {
      const coreNode = createMockNode(
        'evidence-001',
        '核心证据',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        0.9
      );
      const isolatedNode = createMockNode(
        'evidence-002',
        '孤证',
        'OTHER',
        'PENDING',
        0.5
      );

      const graph: EvidenceChainGraph = {
        nodes: [coreNode, isolatedNode],
        edges: [],
        coreEvidences: ['evidence-001'],
        isolatedEvidences: ['evidence-002'],
        statistics: {
          totalEvidences: 2,
          totalRelations: 0,
          averageRelationStrength: 3,
          chainCompleteness: 50,
          relationTypeDistribution: {
            [EvidenceChainRelationType.SUPPORTS]: 0,
            [EvidenceChainRelationType.REFUTES]: 0,
            [EvidenceChainRelationType.SUPPLEMENTS]: 0,
            [EvidenceChainRelationType.CONTRADICTS]: 0,
            [EvidenceChainRelationType.INDEPENDENT]: 0,
          },
          effectivenessScore: 60,
          missingEvidenceTypes: [],
        },
      };

      const coreEvaluation = evaluator.evaluateEvidence(coreNode, graph);
      const isolatedEvaluation = evaluator.evaluateEvidence(
        isolatedNode,
        graph
      );

      expect(coreEvaluation.scores.chainPosition).toBeGreaterThan(
        isolatedEvaluation.scores.chainPosition
      );
    });

    it('should calculate legal support score', () => {
      const expertOpinionNode = createMockNode(
        'evidence-001',
        '专家意见',
        'EXPERT_OPINION',
        'APPROVED',
        0.8
      );
      const graph: EvidenceChainGraph = {
        nodes: [expertOpinionNode],
        edges: [],
        coreEvidences: ['evidence-001'],
        isolatedEvidences: [],
        statistics: {
          totalEvidences: 1,
          totalRelations: 0,
          averageRelationStrength: 3,
          chainCompleteness: 80,
          relationTypeDistribution: {
            [EvidenceChainRelationType.SUPPORTS]: 0,
            [EvidenceChainRelationType.REFUTES]: 0,
            [EvidenceChainRelationType.SUPPLEMENTS]: 0,
            [EvidenceChainRelationType.CONTRADICTS]: 0,
            [EvidenceChainRelationType.INDEPENDENT]: 0,
          },
          effectivenessScore: 75,
          missingEvidenceTypes: [],
        },
      };

      const evaluation = evaluator.evaluateEvidence(expertOpinionNode, graph);

      expect(evaluation.legalSupportScore).toBeGreaterThan(50);
    });

    it('should calculate case support score for physical evidence', () => {
      const physicalNode = createMockNode(
        'evidence-001',
        '物证',
        'PHYSICAL_EVIDENCE',
        'APPROVED',
        0.8
      );
      physicalNode.outgoingRelations = [
        createMockEdge('edge-001', 'evidence-001', 'evidence-002'),
        createMockEdge('edge-002', 'evidence-001', 'evidence-003'),
      ];

      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(physicalNode, graph);

      expect(evaluation.caseSupportScore).toBeGreaterThan(50);
    });

    it('should determine effectiveness level correctly', () => {
      const highScoreNode = createMockNode(
        'evidence-001',
        '高分证据',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        0.95
      );
      const moderateScoreNode = createMockNode(
        'evidence-002',
        '中等证据',
        'OTHER',
        'PENDING',
        0.5
      );
      const lowScoreNode = createMockNode(
        'evidence-003',
        '低分证据',
        'OTHER',
        'REJECTED',
        0.2
      );

      const graph: EvidenceChainGraph = createMockGraph();

      const highEvaluation = evaluator.evaluateEvidence(highScoreNode, graph);
      const moderateEvaluation = evaluator.evaluateEvidence(
        moderateScoreNode,
        graph
      );
      const lowEvaluation = evaluator.evaluateEvidence(lowScoreNode, graph);

      expect([EffectivenessLevel.VERY_HIGH, EffectivenessLevel.HIGH]).toContain(
        highEvaluation.effectivenessLevel
      );
      expect([EffectivenessLevel.MODERATE, EffectivenessLevel.HIGH]).toContain(
        moderateEvaluation.effectivenessLevel
      );
      expect([EffectivenessLevel.VERY_LOW, EffectivenessLevel.LOW]).toContain(
        lowEvaluation.effectivenessLevel
      );
    });

    it('should generate suggestions for low relevance', () => {
      const lowRelevanceNode = createMockNode(
        'evidence-001',
        '低相关证据',
        'OTHER',
        'PENDING',
        0.3
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(lowRelevanceNode, graph);

      expect(evaluation.suggestions.length).toBeGreaterThan(0);
      expect(evaluation.suggestions.some(s => s.includes('相关性'))).toBe(true);
    });

    it('should generate suggestions for low reliability', () => {
      const lowReliabilityNode = createMockNode(
        'evidence-001',
        '其他证据',
        'OTHER',
        'REJECTED',
        0.3
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(lowReliabilityNode, graph);

      expect(evaluation.suggestions.length).toBeGreaterThan(0);
      expect(
        evaluation.suggestions.some(
          s => s.includes('来源') || s.includes('可信度')
        )
      ).toBe(true);
    });

    it('should generate suggestions for low completeness', () => {
      const isolatedNode = createMockNode(
        'evidence-001',
        '孤证',
        'OTHER',
        'REJECTED',
        0.3
      );
      const graph: EvidenceChainGraph = {
        nodes: [isolatedNode],
        edges: [],
        coreEvidences: [],
        isolatedEvidences: ['evidence-001'],
        statistics: {
          totalEvidences: 1,
          totalRelations: 0,
          averageRelationStrength: 3,
          chainCompleteness: 10,
          relationTypeDistribution: {
            [EvidenceChainRelationType.SUPPORTS]: 0,
            [EvidenceChainRelationType.REFUTES]: 0,
            [EvidenceChainRelationType.SUPPLEMENTS]: 0,
            [EvidenceChainRelationType.CONTRADICTS]: 0,
            [EvidenceChainRelationType.INDEPENDENT]: 0,
          },
          effectivenessScore: 40,
          missingEvidenceTypes: [],
        },
      };

      const evaluation = evaluator.evaluateEvidence(isolatedNode, graph);

      expect(evaluation.suggestions.length).toBeGreaterThan(0);
      expect(
        evaluation.suggestions.some(
          s => s.includes('完善证据链') || s.includes('补充')
        )
      ).toBe(true);
    });

    it('should generate suggestions for low legality', () => {
      const electronicNode = createMockNode(
        'evidence-001',
        '电子证据',
        'ELECTRONIC_EVIDENCE',
        'REJECTED',
        0.3
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(electronicNode, graph);

      expect(evaluation.suggestions.length).toBeGreaterThan(0);
      expect(
        evaluation.suggestions.some(
          s => s.includes('合法性') || s.includes('有效性')
        )
      ).toBe(true);
    });

    it('should generate suggestions for low chain position', () => {
      const isolatedNode = createMockNode(
        'evidence-001',
        '孤证',
        'OTHER',
        'PENDING',
        0.5
      );
      const graph: EvidenceChainGraph = {
        nodes: [isolatedNode],
        edges: [],
        coreEvidences: [],
        isolatedEvidences: ['evidence-001'],
        statistics: {
          totalEvidences: 1,
          totalRelations: 0,
          averageRelationStrength: 3,
          chainCompleteness: 30,
          relationTypeDistribution: {
            [EvidenceChainRelationType.SUPPORTS]: 0,
            [EvidenceChainRelationType.REFUTES]: 0,
            [EvidenceChainRelationType.SUPPLEMENTS]: 0,
            [EvidenceChainRelationType.CONTRADICTS]: 0,
            [EvidenceChainRelationType.INDEPENDENT]: 0,
          },
          effectivenessScore: 40,
          missingEvidenceTypes: [],
        },
      };

      const evaluation = evaluator.evaluateEvidence(isolatedNode, graph);

      expect(evaluation.suggestions.length).toBeGreaterThan(0);
      expect(evaluation.suggestions.some(s => s.includes('关联'))).toBe(true);
    });

    it('should generate suggestions for pending evidence', () => {
      const pendingNode = createMockNode(
        'evidence-001',
        '待审核证据',
        'DOCUMENTARY_EVIDENCE',
        'PENDING',
        0.7
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(pendingNode, graph);

      expect(
        evaluation.suggestions.some(
          s => s.includes('审核') || s.includes('验证')
        )
      ).toBe(true);
    });

    it('should generate specific suggestions for witness testimony', () => {
      const witnessNode = createMockNode(
        'evidence-001',
        '证人证言',
        'WITNESS_TESTIMONY',
        'REJECTED',
        0.3
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(witnessNode, graph);

      expect(
        evaluation.suggestions.some(
          s => s.includes('证人身份') || s.includes('联系方式')
        )
      ).toBe(true);
    });

    it('should generate specific suggestions for electronic evidence', () => {
      const electronicNode = createMockNode(
        'evidence-001',
        '电子证据',
        'ELECTRONIC_EVIDENCE',
        'REJECTED',
        0.3
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(electronicNode, graph);

      expect(
        evaluation.suggestions.some(
          s => s.includes('来源') || s.includes('取证过程')
        )
      ).toBe(true);
    });

    it('should handle null relevance score', () => {
      const nullRelevanceNode = createMockNode(
        'evidence-001',
        '合同书',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        null
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(nullRelevanceNode, graph);

      expect(evaluation.scores.relevance).toBe(50);
    });

    it('should clamp scores to 0-100 range', () => {
      const node = createMockNode(
        'evidence-001',
        '合同书',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        1.0
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(node, graph);

      expect(evaluation.scores.relevance).toBeLessThanOrEqual(100);
      expect(evaluation.scores.reliability).toBeLessThanOrEqual(100);
      expect(evaluation.scores.completeness).toBeLessThanOrEqual(100);
      expect(evaluation.scores.legality).toBeLessThanOrEqual(100);
      expect(evaluation.scores.chainPosition).toBeLessThanOrEqual(100);

      expect(evaluation.scores.relevance).toBeGreaterThanOrEqual(0);
      expect(evaluation.scores.reliability).toBeGreaterThanOrEqual(0);
      expect(evaluation.scores.completeness).toBeGreaterThanOrEqual(0);
      expect(evaluation.scores.legality).toBeGreaterThanOrEqual(0);
      expect(evaluation.scores.chainPosition).toBeGreaterThanOrEqual(0);
    });

    it('should calculate effectiveness score as average of all scores', () => {
      const node = createMockNode(
        'evidence-001',
        '合同书',
        'DOCUMENTARY_EVIDENCE',
        'APPROVED',
        0.8
      );
      const graph: EvidenceChainGraph = createMockGraph();

      const evaluation = evaluator.evaluateEvidence(node, graph);

      const expectedAverage = Math.round(
        (evaluation.scores.relevance +
          evaluation.scores.reliability +
          evaluation.scores.completeness +
          evaluation.scores.legality +
          evaluation.scores.chainPosition) /
          5
      );

      expect(evaluation.effectivenessScore).toBe(expectedAverage);
    });
  });

  describe('getInstance', () => {
    it('should return evaluator instance', () => {
      const instance1 = EvidenceEffectivenessEvaluator.getInstance();
      const instance2 = EvidenceEffectivenessEvaluator.getInstance();

      expect(instance1).toBeInstanceOf(EvidenceEffectivenessEvaluator);
      expect(instance2).toBeInstanceOf(EvidenceEffectivenessEvaluator);
    });
  });
});

// Helper functions

function createMockNode(
  evidenceId: string,
  evidenceName: string,
  evidenceType: string,
  status: string,
  relevanceScore: number | null
): EvidenceChainNode {
  return {
    evidenceId,
    evidenceName,
    evidenceType,
    status,
    relevanceScore,
    incomingRelations: [],
    outgoingRelations: [],
    metadata: {},
  };
}

function createMockEdge(
  id: string,
  fromEvidenceId: string,
  toEvidenceId: string
): EvidenceChainNode['incomingRelations'][number] & {
  id: string;
  fromEvidenceId: string;
  toEvidenceId: string;
} {
  return {
    id,
    fromEvidenceId,
    toEvidenceId,
    relationType: EvidenceChainRelationType.SUPPORTS,
    strength: EvidenceRelationStrength.MODERATE,
    confidence: 0.7,
    description: 'Mock relation',
  };
}

function createMockGraph(): EvidenceChainGraph {
  return {
    nodes: [],
    edges: [],
    coreEvidences: [],
    isolatedEvidences: [],
    statistics: {
      totalEvidences: 0,
      totalRelations: 0,
      averageRelationStrength: 3,
      chainCompleteness: 70,
      relationTypeDistribution: {
        [EvidenceChainRelationType.SUPPORTS]: 0,
        [EvidenceChainRelationType.REFUTES]: 0,
        [EvidenceChainRelationType.SUPPLEMENTS]: 0,
        [EvidenceChainRelationType.CONTRADICTS]: 0,
        [EvidenceChainRelationType.INDEPENDENT]: 0,
      },
      effectivenessScore: 60,
      missingEvidenceTypes: [],
    },
  };
}
