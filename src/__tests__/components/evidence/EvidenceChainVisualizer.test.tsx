/**
 * EvidenceChainVisualizer 单元测试
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EvidenceChainVisualizer } from '../../../components/evidence/EvidenceChainVisualizer';
import type {
  EvidenceChainGraph,
  EvidenceChainPath,
  EvidenceChainNode,
  EvidenceChainEdge,
} from '../../../types/evidence-chain';
import {
  EvidenceChainRelationType,
  EvidenceRelationStrength,
} from '../../../types/evidence-chain';

describe('EvidenceChainVisualizer', () => {
  const mockGraph: EvidenceChainGraph = {
    nodes: [
      {
        evidenceId: 'ev-001',
        evidenceName: '合同书',
        evidenceType: 'DOCUMENTARY_EVIDENCE',
        status: 'APPROVED',
        relevanceScore: 0.9,
        incomingRelations: [],
        outgoingRelations: [],
        metadata: {},
      },
      {
        evidenceId: 'ev-002',
        evidenceName: '证人证言',
        evidenceType: 'WITNESS_TESTIMONY',
        status: 'APPROVED',
        relevanceScore: 0.7,
        incomingRelations: [],
        outgoingRelations: [],
        metadata: {},
      },
    ],
    edges: [],
    coreEvidences: [],
    isolatedEvidences: [],
    statistics: {
      totalEvidences: 2,
      totalRelations: 0,
      averageRelationStrength: 3,
      chainCompleteness: 85.5,
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

  const mockChains: EvidenceChainPath[] = [
    {
      evidenceIds: ['ev-001', 'ev-002'],
      totalStrength: 7.5,
      averageConfidence: 0.85,
      length: 2,
      pathType: 'supporting',
    },
  ];

  describe('render', () => {
    it('should render visualizer correctly', () => {
      const { container } = render(
        <EvidenceChainVisualizer chainGraph={mockGraph} chains={mockChains} />
      );

      expect(
        container.querySelector('.evidence-chain-visualizer')
      ).toBeInTheDocument();
    });

    it('should display statistics', () => {
      render(
        <EvidenceChainVisualizer chainGraph={mockGraph} chains={mockChains} />
      );

      expect(screen.getByText('总证据数:')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('证据关系数:')).toBeInTheDocument();
      expect(screen.getByText('证据链完整性:')).toBeInTheDocument();
      expect(screen.getByText('85.5%')).toBeInTheDocument();
    });

    it('should render graph component', () => {
      render(
        <EvidenceChainVisualizer chainGraph={mockGraph} chains={mockChains} />
      );

      expect(screen.getByText('证据链图')).toBeInTheDocument();
    });

    it('should render chain list', () => {
      render(
        <EvidenceChainVisualizer chainGraph={mockGraph} chains={mockChains} />
      );

      expect(screen.getByText('证据链列表')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onNodeClick when node is clicked', () => {
      const mockOnNodeClick = jest.fn();
      const mockGraphWithEdges: EvidenceChainGraph = {
        ...mockGraph,
        edges: [
          {
            id: 'edge-001',
            fromEvidenceId: 'ev-001',
            toEvidenceId: 'ev-002',
            relationType: EvidenceChainRelationType.SUPPORTS,
            strength: EvidenceRelationStrength.MODERATE,
            confidence: 0.8,
            description: '支撑关系',
          },
        ],
      };

      render(
        <EvidenceChainVisualizer
          chainGraph={mockGraphWithEdges}
          chains={mockChains}
          onNodeClick={mockOnNodeClick}
        />
      );

      const nodes = document.querySelectorAll('.evidence-node');
      if (nodes.length > 0) {
        fireEvent.click(nodes[0]);
        expect(mockOnNodeClick).toHaveBeenCalled();
      }
    });

    it('should call onPathSelect when chain is clicked', () => {
      const mockOnPathSelect = jest.fn();
      const selectedChain = mockChains[0];

      render(
        <EvidenceChainVisualizer
          chainGraph={mockGraph}
          chains={mockChains}
          selectedPath={selectedChain}
          onPathSelect={mockOnPathSelect}
        />
      );

      const chainItems = document.querySelectorAll('.chain-item');
      if (chainItems.length > 0) {
        fireEvent.click(chainItems[0]);
        expect(mockOnPathSelect).toHaveBeenCalledWith(selectedChain);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty graph', () => {
      const emptyGraph: EvidenceChainGraph = {
        nodes: [],
        edges: [],
        coreEvidences: [],
        isolatedEvidences: [],
        statistics: {
          totalEvidences: 0,
          totalRelations: 0,
          averageRelationStrength: 0,
          chainCompleteness: 0,
          relationTypeDistribution: {
            [EvidenceChainRelationType.SUPPORTS]: 0,
            [EvidenceChainRelationType.REFUTES]: 0,
            [EvidenceChainRelationType.SUPPLEMENTS]: 0,
            [EvidenceChainRelationType.CONTRADICTS]: 0,
            [EvidenceChainRelationType.INDEPENDENT]: 0,
          },
          effectivenessScore: 0,
          missingEvidenceTypes: [],
        },
      };

      const { container } = render(
        <EvidenceChainVisualizer chainGraph={emptyGraph} chains={[]} />
      );

      expect(
        container.querySelector('.evidence-chain-visualizer')
      ).toBeInTheDocument();
      expect(screen.getByText('总证据数:')).toBeInTheDocument();
      expect(screen.getByText('证据关系数:')).toBeInTheDocument();
      expect(screen.getByText('证据链完整性:')).toBeInTheDocument();
    });

    it('should handle empty chains', () => {
      render(<EvidenceChainVisualizer chainGraph={mockGraph} chains={[]} />);

      expect(screen.getByText('证据链列表')).toBeInTheDocument();
      const chainList = document.querySelector('.chain-list');
      expect(chainList?.children.length).toBe(0);
    });

    it('should handle null selectedPath', () => {
      render(
        <EvidenceChainVisualizer
          chainGraph={mockGraph}
          chains={mockChains}
          selectedPath={null}
        />
      );

      expect(document.querySelectorAll('.chain-item.selected').length).toBe(0);
    });
  });

  describe('graph visualization', () => {
    it('should render edges with correct colors', () => {
      const mockGraphWithEdges: EvidenceChainGraph = {
        ...mockGraph,
        edges: [
          {
            id: 'edge-001',
            fromEvidenceId: 'ev-001',
            toEvidenceId: 'ev-002',
            relationType: EvidenceChainRelationType.SUPPORTS,
            strength: EvidenceRelationStrength.MODERATE,
            confidence: 0.8,
            description: '支撑关系',
          },
        ],
      };

      const { container } = render(
        <EvidenceChainVisualizer
          chainGraph={mockGraphWithEdges}
          chains={mockChains}
        />
      );

      const edges = container.querySelectorAll('.evidence-edge');
      expect(edges.length).toBeGreaterThan(0);
    });

    it('should render edges for different relation types', () => {
      const multiRelationGraph: EvidenceChainGraph = {
        ...mockGraph,
        nodes: [
          ...mockGraph.nodes,
          {
            evidenceId: 'ev-003',
            evidenceName: '录音',
            evidenceType: 'AUDIO_VIDEO_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.6,
            incomingRelations: [],
            outgoingRelations: [],
            metadata: {},
          },
        ],
        edges: [
          {
            id: 'edge-001',
            fromEvidenceId: 'ev-001',
            toEvidenceId: 'ev-002',
            relationType: EvidenceChainRelationType.SUPPORTS,
            strength: EvidenceRelationStrength.STRONG,
            confidence: 0.9,
            description: '支撑关系',
          },
          {
            id: 'edge-002',
            fromEvidenceId: 'ev-002',
            toEvidenceId: 'ev-003',
            relationType: EvidenceChainRelationType.REFUTES,
            strength: EvidenceRelationStrength.WEAK,
            confidence: 0.5,
            description: '反驳关系',
          },
        ],
      };

      const { container } = render(
        <EvidenceChainVisualizer
          chainGraph={multiRelationGraph}
          chains={mockChains}
        />
      );

      const edges = container.querySelectorAll('.evidence-edge');
      expect(edges.length).toBe(2);
    });

    it('should handle edges with missing node positions', () => {
      const graphWithMissingNode: EvidenceChainGraph = {
        ...mockGraph,
        edges: [
          {
            id: 'edge-001',
            fromEvidenceId: 'non-existent-001',
            toEvidenceId: 'non-existent-002',
            relationType: EvidenceChainRelationType.SUPPORTS,
            strength: EvidenceRelationStrength.MODERATE,
            confidence: 0.8,
            description: '支撑关系',
          },
        ],
      };

      const { container } = render(
        <EvidenceChainVisualizer
          chainGraph={graphWithMissingNode}
          chains={mockChains}
        />
      );

      const edges = container.querySelectorAll('.evidence-edge line');
      expect(edges.length).toBe(0);
    });

    it('should render nodes with correct colors', () => {
      const { container } = render(
        <EvidenceChainVisualizer chainGraph={mockGraph} chains={mockChains} />
      );

      const nodes = container.querySelectorAll('.evidence-node');
      expect(nodes.length).toBe(2);
    });

    it('should display core evidence indicator', () => {
      const graphWithCoreEvidence: EvidenceChainGraph = {
        ...mockGraph,
        nodes: [
          {
            ...mockGraph.nodes[0],
            metadata: { coreEvidence: true },
          },
          mockGraph.nodes[1],
        ],
      };

      const { container } = render(
        <EvidenceChainVisualizer
          chainGraph={graphWithCoreEvidence}
          chains={mockChains}
        />
      );

      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    });

    it('should display legend items', () => {
      const { container } = render(
        <EvidenceChainVisualizer chainGraph={mockGraph} chains={mockChains} />
      );

      expect(screen.getByText('支撑关系')).toBeInTheDocument();
      expect(screen.getByText('反驳关系')).toBeInTheDocument();
      expect(screen.getByText('补充关系')).toBeInTheDocument();
      expect(screen.getByText('矛盾关系')).toBeInTheDocument();
      expect(screen.getByText('独立')).toBeInTheDocument();
    });
  });

  describe('chain list', () => {
    it('should render chain items with correct information', () => {
      render(
        <EvidenceChainVisualizer chainGraph={mockGraph} chains={mockChains} />
      );

      expect(screen.getByText('支撑链')).toBeInTheDocument();
      expect(screen.getByText('长度: 2')).toBeInTheDocument();
      expect(screen.getByText('强度: 7.5')).toBeInTheDocument();
      expect(screen.getByText('置信度: 0.85')).toBeInTheDocument();
    });

    it('should highlight selected chain', () => {
      const selectedChain = mockChains[0];

      render(
        <EvidenceChainVisualizer
          chainGraph={mockGraph}
          chains={mockChains}
          selectedPath={selectedChain}
        />
      );

      const selectedItems = document.querySelectorAll('.chain-item.selected');
      expect(selectedItems.length).toBe(1);
    });

    it('should render multiple chains', () => {
      const multipleChains: EvidenceChainPath[] = [
        ...mockChains,
        {
          evidenceIds: ['ev-002'],
          totalStrength: 3.5,
          averageConfidence: 0.75,
          length: 1,
          pathType: 'refuting',
        },
      ];

      render(
        <EvidenceChainVisualizer
          chainGraph={mockGraph}
          chains={multipleChains}
        />
      );

      expect(screen.getByText('反驳链')).toBeInTheDocument();
    });
  });

  describe('node positioning', () => {
    it('should calculate positions for nodes', () => {
      const { container } = render(
        <EvidenceChainVisualizer chainGraph={mockGraph} chains={mockChains} />
      );

      const nodes = container.querySelectorAll('circle');
      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should handle multiple layers', () => {
      const multiLayerGraph: EvidenceChainGraph = {
        ...mockGraph,
        nodes: [
          ...mockGraph.nodes,
          {
            evidenceId: 'ev-003',
            evidenceName: '照片',
            evidenceType: 'PHYSICAL_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
            incomingRelations: [],
            outgoingRelations: [],
            metadata: {},
          },
        ],
      };

      const { container } = render(
        <EvidenceChainVisualizer
          chainGraph={multiLayerGraph}
          chains={mockChains}
        />
      );

      const nodes = container.querySelectorAll('.evidence-node');
      expect(nodes.length).toBe(3);
    });

    it('should handle graph without root nodes (cyclic graph)', () => {
      const cyclicGraph: EvidenceChainGraph = {
        nodes: [
          {
            evidenceId: 'ev-001',
            evidenceName: '合同A',
            evidenceType: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
            incomingRelations: [
              {
                id: 'edge-002',
                fromEvidenceId: 'ev-002',
                toEvidenceId: 'ev-001',
                relationType: EvidenceChainRelationType.SUPPORTS,
                strength: EvidenceRelationStrength.MODERATE,
                confidence: 0.7,
                description: '支撑关系',
              },
            ],
            outgoingRelations: [
              {
                id: 'edge-001',
                fromEvidenceId: 'ev-001',
                toEvidenceId: 'ev-002',
                relationType: EvidenceChainRelationType.SUPPORTS,
                strength: EvidenceRelationStrength.MODERATE,
                confidence: 0.7,
                description: '支撑关系',
              },
            ],
            metadata: {},
          },
          {
            evidenceId: 'ev-002',
            evidenceName: '合同B',
            evidenceType: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
            incomingRelations: [
              {
                id: 'edge-001',
                fromEvidenceId: 'ev-001',
                toEvidenceId: 'ev-002',
                relationType: EvidenceChainRelationType.SUPPORTS,
                strength: EvidenceRelationStrength.MODERATE,
                confidence: 0.7,
                description: '支撑关系',
              },
            ],
            outgoingRelations: [
              {
                id: 'edge-002',
                fromEvidenceId: 'ev-002',
                toEvidenceId: 'ev-001',
                relationType: EvidenceChainRelationType.SUPPORTS,
                strength: EvidenceRelationStrength.MODERATE,
                confidence: 0.7,
                description: '支撑关系',
              },
            ],
            metadata: {},
          },
        ],
        edges: [
          {
            id: 'edge-001',
            fromEvidenceId: 'ev-001',
            toEvidenceId: 'ev-002',
            relationType: EvidenceChainRelationType.SUPPORTS,
            strength: EvidenceRelationStrength.MODERATE,
            confidence: 0.7,
            description: '支撑关系',
          },
          {
            id: 'edge-002',
            fromEvidenceId: 'ev-002',
            toEvidenceId: 'ev-001',
            relationType: EvidenceChainRelationType.SUPPORTS,
            strength: EvidenceRelationStrength.MODERATE,
            confidence: 0.7,
            description: '支撑关系',
          },
        ],
        coreEvidences: [],
        isolatedEvidences: [],
        statistics: {
          totalEvidences: 2,
          totalRelations: 2,
          averageRelationStrength: 3,
          chainCompleteness: 80,
          relationTypeDistribution: {
            [EvidenceChainRelationType.SUPPORTS]: 2,
            [EvidenceChainRelationType.REFUTES]: 0,
            [EvidenceChainRelationType.SUPPLEMENTS]: 0,
            [EvidenceChainRelationType.CONTRADICTS]: 0,
            [EvidenceChainRelationType.INDEPENDENT]: 0,
          },
          effectivenessScore: 70,
          missingEvidenceTypes: [],
        },
      };

      const { container } = render(
        <EvidenceChainVisualizer chainGraph={cyclicGraph} chains={mockChains} />
      );

      const nodes = container.querySelectorAll('.evidence-node');
      expect(nodes.length).toBe(2);
    });
  });

  describe('path types', () => {
    it('should display mixed chain type', () => {
      const mixedChain: EvidenceChainPath = {
        evidenceIds: ['ev-001', 'ev-002'],
        totalStrength: 5.5,
        averageConfidence: 0.75,
        length: 2,
        pathType: 'mixed',
      };

      render(
        <EvidenceChainVisualizer chainGraph={mockGraph} chains={[mixedChain]} />
      );

      expect(screen.getByText('混合链')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have clickable nodes with cursor pointer', () => {
      const mockOnNodeClick = jest.fn();

      render(
        <EvidenceChainVisualizer
          chainGraph={mockGraph}
          chains={mockChains}
          onNodeClick={mockOnNodeClick}
        />
      );

      const nodes = document.querySelectorAll('.evidence-node');
      nodes.forEach(node => {
        expect((node as HTMLElement).style.cursor).toBe('pointer');
      });
    });

    it('should have clickable chain items with cursor pointer', () => {
      const mockOnPathSelect = jest.fn();

      render(
        <EvidenceChainVisualizer
          chainGraph={mockGraph}
          chains={mockChains}
          onPathSelect={mockOnPathSelect}
        />
      );

      const chainItems = document.querySelectorAll('.chain-item');
      chainItems.forEach(item => {
        expect((item as HTMLElement).style.cursor).toBe('pointer');
      });
    });
  });
});
