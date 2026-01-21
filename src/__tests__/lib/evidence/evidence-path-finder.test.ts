/**
 * EvidencePathFinder 单元测试
 */

import { EvidencePathFinder } from '@/lib/evidence/evidence-path-finder';
import type {
  EvidenceChainGraph,
  EvidenceChainNode,
  EvidenceChainEdge,
} from '@/types/evidence-chain';
import { EvidenceChainRelationType } from '@/types/evidence-chain';

describe('EvidencePathFinder', () => {
  let finder: EvidencePathFinder;

  beforeEach(() => {
    finder = new EvidencePathFinder();
  });

  describe('findAllPaths', () => {
    it('should find all paths successfully', () => {
      const graph = createTestGraph();

      const paths = finder.findAllPaths(graph);

      expect(paths).toBeDefined();
      expect(Array.isArray(paths)).toBe(true);
    });

    it('should handle empty graph', () => {
      const graph: EvidenceChainGraph = {
        nodes: [],
        edges: [],
        coreEvidences: [],
        isolatedEvidences: [],
        statistics: {
          totalEvidences: 0,
          totalRelations: 0,
          averageRelationStrength: 0,
          relationTypeDistribution: {
            SUPPORTS: 0,
            REFUTES: 0,
            SUPPLEMENTS: 0,
            CONTRADICTS: 0,
            INDEPENDENT: 0,
          },
          chainCompleteness: 0,
          effectivenessScore: 0,
          missingEvidenceTypes: [],
        },
      };

      const paths = finder.findAllPaths(graph);

      expect(paths).toHaveLength(0);
    });

    it('should find supporting paths', () => {
      const graph = createTestGraph();

      const paths = finder.findAllPaths(graph);
      const supportingPaths = paths.filter(
        path => path.pathType === 'supporting'
      );

      expect(supportingPaths.length).toBeGreaterThan(0);
    });
  });

  describe('findAllPathsBetween', () => {
    it('should find path between two evidences', () => {
      const graph = createTestGraph();

      const paths = finder.findAllPathsBetween(
        graph,
        'evidence-001',
        'evidence-003'
      );

      expect(paths).toBeDefined();
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0]?.evidenceIds).toContain('evidence-001');
      expect(paths[0]?.evidenceIds).toContain('evidence-003');
    });

    it('should return empty for disconnected evidences', () => {
      const graph = createTestGraph();

      const paths = finder.findAllPathsBetween(
        graph,
        'evidence-001',
        'evidence-999'
      );

      expect(paths).toHaveLength(0);
    });
  });

  describe('path strength calculation', () => {
    it('should calculate path strength correctly', () => {
      const graph = createTestGraph();

      const paths = finder.findAllPaths(graph);
      const firstPath = paths[0];

      expect(firstPath?.totalStrength).toBeGreaterThan(0);
      expect(firstPath?.totalStrength).toBeLessThanOrEqual(
        firstPath?.length * 5
      );
    });
  });

  describe('path type classification', () => {
    it('should classify supporting paths correctly', () => {
      const graph = createTestGraph();

      const paths = finder.findAllPaths(graph);
      const supportingPath = paths.find(
        path =>
          path.evidenceIds.includes('evidence-001') &&
          path.evidenceIds.includes('evidence-002')
      );

      expect(supportingPath?.pathType).toBe('supporting');
    });
  });
});

/**
 * 创建测试用图
 */
function createTestGraph(): EvidenceChainGraph {
  const edge1: EvidenceChainEdge = {
    id: 'edge-001',
    fromEvidenceId: 'evidence-001',
    toEvidenceId: 'evidence-002',
    relationType: EvidenceChainRelationType.SUPPORTS,
    strength: 3,
    confidence: 0.8,
  };

  const edge2: EvidenceChainEdge = {
    id: 'edge-002',
    fromEvidenceId: 'evidence-002',
    toEvidenceId: 'evidence-003',
    relationType: EvidenceChainRelationType.SUPPORTS,
    strength: 3,
    confidence: 0.7,
  };

  const nodes: EvidenceChainNode[] = [
    {
      evidenceId: 'evidence-001',
      evidenceName: '合同书',
      evidenceType: 'DOCUMENTARY_EVIDENCE',
      status: 'APPROVED',
      relevanceScore: 0.9,
      incomingRelations: [],
      outgoingRelations: [edge1],
    },
    {
      evidenceId: 'evidence-002',
      evidenceName: '付款记录',
      evidenceType: 'ELECTRONIC_EVIDENCE',
      status: 'APPROVED',
      relevanceScore: 0.8,
      incomingRelations: [edge1],
      outgoingRelations: [edge2],
    },
    {
      evidenceId: 'evidence-003',
      evidenceName: '证人证言',
      evidenceType: 'WITNESS_TESTIMONY',
      status: 'APPROVED',
      relevanceScore: 0.7,
      incomingRelations: [edge2],
      outgoingRelations: [],
    },
  ];

  const edges = [edge1, edge2];

  return {
    nodes,
    edges,
    coreEvidences: ['evidence-001'],
    isolatedEvidences: [],
    statistics: {
      totalEvidences: 3,
      totalRelations: 2,
      averageRelationStrength: 3,
      relationTypeDistribution: {
        SUPPORTS: 2,
        REFUTES: 0,
        SUPPLEMENTS: 0,
        CONTRADICTS: 0,
        INDEPENDENT: 0,
      },
      chainCompleteness: 100,
      effectivenessScore: 75,
      missingEvidenceTypes: [],
    },
  };
}
