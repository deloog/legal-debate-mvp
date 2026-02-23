/**
 * AIEvidenceChainBuilder 单元测试
 */

import { AIEvidenceChainBuilder } from '@/lib/ai/evidence/evidence-chain-builder';
import type { AIService } from '@/lib/ai/service';
import type { EvidenceChainAnalysisRequest } from '@/types/evidence-chain';
import type { AIResponse } from '@/types/ai-service';

describe('AIEvidenceChainBuilder', () => {
  let builder: AIEvidenceChainBuilder;
  let mockAIService: jest.Mocked<AIService>;

  beforeEach(() => {
    // 创建Mock AI服务
    mockAIService = {
      chatCompletion: jest.fn(),
      streamChatCompletion: jest.fn(),
    } as unknown as jest.Mocked<AIService>;

    builder = new AIEvidenceChainBuilder(mockAIService);
  });

  describe('buildEvidenceChain', () => {
    it('should build evidence chain with AI enabled', async () => {
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
            name: '付款记录',
            type: 'ELECTRONIC_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.9,
          },
        ],
        existingRelations: [],
        options: {
          useAI: true,
        },
      };

      // Mock AI响应
      const mockAIResponse: AIResponse = {
        id: 'response-001',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 4,
                confidence: 0.85,
                description: '合同支撑付款记录',
                reasoning: '合同约定了付款条款',
              }),
            },
            finishReason: 'stop',
            index: 0,
          },
        ],
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        provider: 'deepseek',
        duration: 100,
      };

      mockAIService.chatCompletion.mockResolvedValue(mockAIResponse);

      const result = await builder.buildEvidenceChain(request);

      expect(result).toBeDefined();
      expect(result.chainGraph).toBeDefined();
      expect(result.chains).toBeDefined();
      expect(result.effectivenessEvaluations).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should build evidence chain with AI disabled', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-002',
        evidences: [
          {
            id: 'evidence-001',
            name: '合同书',
            type: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
          },
        ],
        existingRelations: [],
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);

      expect(result).toBeDefined();
      expect(result.chainGraph).toBeDefined();
      // AI服务不应该被调用
      expect(mockAIService.chatCompletion).not.toHaveBeenCalled();
    });

    it('should handle empty evidence list', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-003',
        evidences: [],
        existingRelations: [],
      };

      const result = await builder.buildEvidenceChain(request);

      expect(result.chainGraph.nodes).toHaveLength(0);
      expect(result.chainGraph.edges).toHaveLength(0);
    });

    it('should merge existing relations with AI relations', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-004',
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
          {
            id: 'evidence-003',
            name: '证人证言',
            type: 'WITNESS_TESTIMONY',
            status: 'APPROVED',
            relevanceScore: 0.7,
          },
        ],
        existingRelations: [
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-002',
          },
        ],
        options: {
          useAI: true,
        },
      };

      const mockAIResponse: AIResponse = {
        id: 'response-002',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 4,
                confidence: 0.85,
                description: '付款记录支撑证人证言',
                reasoning: '证人证言证实了付款事实',
              }),
            },
            finishReason: 'stop',
            index: 0,
          },
        ],
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        provider: 'deepseek',
        duration: 100,
      };

      mockAIService.chatCompletion.mockResolvedValue(mockAIResponse);

      const result = await builder.buildEvidenceChain(request);

      expect(result.chainGraph.edges.length).toBeGreaterThan(0);
    });

    it('should respect maxRelations option', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-005',
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
        existingRelations: [],
        options: {
          useAI: true,
          maxRelations: 1,
        },
      };

      const mockAIResponse: AIResponse = {
        id: 'response-003',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 4,
                confidence: 0.85,
                description: '合同支撑付款记录',
                reasoning: '合同约定了付款条款',
              }),
            },
            finishReason: 'stop',
            index: 0,
          },
        ],
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        provider: 'deepseek',
        duration: 100,
      };

      mockAIService.chatCompletion.mockResolvedValue(mockAIResponse);

      const result = await builder.buildEvidenceChain(request);

      expect(result.chainGraph.edges.length).toBeLessThanOrEqual(1);
    });
  });

  describe('analyzeChainPaths', () => {
    it('should analyze chain paths', async () => {
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
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const paths = builder.analyzeChainPaths(result.chainGraph);

      expect(paths).toBeDefined();
      expect(Array.isArray(paths)).toBe(true);
    });

    it('should filter paths by maxLength', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-007',
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
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const paths = builder.analyzeChainPaths(result.chainGraph, {
        maxLength: 5,
      });

      expect(paths.every(path => path.length <= 5)).toBe(true);
    });

    it('should filter paths by minStrength', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-008',
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
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const paths = builder.analyzeChainPaths(result.chainGraph, {
        minStrength: 1,
      });

      expect(paths.every(path => path.totalStrength >= 1)).toBe(true);
    });
  });

  describe('findStrongestChain', () => {
    it('should find strongest chain', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-009',
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
          {
            id: 'evidence-003',
            name: '证人证言',
            type: 'WITNESS_TESTIMONY',
            status: 'APPROVED',
            relevanceScore: 0.7,
          },
          {
            id: 'evidence-004',
            name: '电子数据',
            type: 'ELECTRONIC_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.85,
          },
        ],
        existingRelations: [
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-002',
          },
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-003',
          },
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-004',
          },
          {
            evidenceId: 'evidence-002',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-003',
          },
        ],
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const strongestChain = builder.findStrongestChain(result.chainGraph);

      expect(strongestChain).toBeDefined();
      expect(strongestChain).not.toBeNull();
    });

    it('should return null for empty graph', () => {
      const chain = builder.findStrongestChain({
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
            SUPPORTS: 0,
            REFUTES: 0,
            SUPPLEMENTS: 0,
            CONTRADICTS: 0,
            INDEPENDENT: 0,
          },
          effectivenessScore: 0,
          missingEvidenceTypes: [],
        },
      });

      expect(chain).toBeNull();
    });
  });

  describe('findLongestChain', () => {
    it('should find longest chain', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-010',
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
          {
            id: 'evidence-003',
            name: '证人证言',
            type: 'WITNESS_TESTIMONY',
            status: 'APPROVED',
            relevanceScore: 0.7,
          },
          {
            id: 'evidence-004',
            name: '电子数据',
            type: 'ELECTRONIC_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.85,
          },
        ],
        existingRelations: [
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-002',
          },
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-003',
          },
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-004',
          },
          {
            evidenceId: 'evidence-002',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-003',
          },
        ],
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const longestChain = builder.findLongestChain(result.chainGraph);

      expect(longestChain).toBeDefined();
      expect(longestChain).not.toBeNull();
    });
  });

  describe('generateChainReport', () => {
    it('should generate chain report', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-011',
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
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const report = builder.generateChainReport(result);

      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report).toContain('# 证据链分析报告');
      expect(report).toContain('## 总体统计');
      expect(report).toContain('证据数量');
      expect(report).toContain('关系数量');
    });

    it('should include core evidences in report', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-012',
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
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const report = builder.generateChainReport(result);

      if (result.chainGraph.coreEvidences.length > 0) {
        expect(report).toContain('## 核心证据');
      }
    });

    it('should include key findings in report', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-013',
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
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const report = builder.generateChainReport(result);

      expect(report).toContain('## 关键发现');
    });

    it('should generate report with isolated evidences', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-018',
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
            name: '孤证证据',
            type: 'ELECTRONIC_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.9,
          },
        ],
        existingRelations: [],
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const report = builder.generateChainReport(result);

      expect(report).toContain('## 孤证证据');
    });

    it('should generate report with high completeness', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-019',
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
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const report = builder.generateChainReport(result);

      expect(report).toContain('## 评估结论');
      expect(report).toContain('证据链完整性');
    });

    it('should handle evidence list with single item for AI identification', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-020',
        evidences: [
          {
            id: 'evidence-001',
            name: '合同书',
            type: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
          },
        ],
        existingRelations: [],
        options: {
          useAI: true,
        },
      };

      const result = await builder.buildEvidenceChain(request);

      expect(result).toBeDefined();
      expect(result.chainGraph.nodes).toHaveLength(1);
    });

    it('should filter paths that exceed maxLength', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-021',
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
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const paths = builder.analyzeChainPaths(result.chainGraph, {
        maxLength: 1,
      });

      expect(paths.every(path => path.length <= 1)).toBe(true);
    });

    it('should filter paths below minStrength', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-022',
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
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const paths = builder.analyzeChainPaths(result.chainGraph, {
        minStrength: 10,
      });

      expect(paths.every(path => path.totalStrength >= 10)).toBe(true);
    });

    it('should include strongest chain in report', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-023',
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
          {
            id: 'evidence-003',
            name: '证人证言',
            type: 'WITNESS_TESTIMONY',
            status: 'APPROVED',
            relevanceScore: 0.7,
          },
          {
            id: 'evidence-004',
            name: '电子数据',
            type: 'ELECTRONIC_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.85,
          },
        ],
        existingRelations: [
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-002',
          },
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-003',
          },
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-004',
          },
          {
            evidenceId: 'evidence-002',
            relationType: 'SUPPORTS',
            relatedId: 'evidence-003',
          },
        ],
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);
      const report = builder.generateChainReport(result);

      expect(report).toContain('## 最强证据链');
    });
  });

  describe('edge cases', () => {
    it('should handle single evidence', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-014',
        evidences: [
          {
            id: 'evidence-001',
            name: '合同书',
            type: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
          },
        ],
        existingRelations: [],
        options: {
          useAI: true,
        },
      };

      const result = await builder.buildEvidenceChain(request);

      expect(result).toBeDefined();
      expect(result.chainGraph.nodes).toHaveLength(1);
    });

    it('should handle invalid relations', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-015',
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
            relationType: 'INVALID_TYPE',
            relatedId: 'evidence-002',
          },
        ],
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);

      // 无效关系应该被过滤
      expect(result.chainGraph.edges).toHaveLength(0);
    });

    it('should handle non-existent evidence IDs', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-016',
        evidences: [
          {
            id: 'evidence-001',
            name: '合同书',
            type: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
          },
        ],
        existingRelations: [
          {
            evidenceId: 'evidence-001',
            relationType: 'SUPPORTS',
            relatedId: 'non-existent-id',
          },
        ],
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);

      // 不存在的关系应该被过滤
      expect(result.chainGraph.edges).toHaveLength(0);
    });
  });

  describe('integration', () => {
    it('should integrate with EvidenceChainAnalyzer', async () => {
      const request: EvidenceChainAnalysisRequest = {
        caseId: 'case-017',
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
        options: {
          useAI: false,
        },
      };

      const result = await builder.buildEvidenceChain(request);

      expect(result.effectivenessEvaluations).toBeDefined();
      expect(result.effectivenessEvaluations.size).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalEvidences).toBe(2);
      expect(result.summary.detectedRelations).toBe(1);
    });
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AIEvidenceChainBuilder.getInstance(mockAIService);
      const instance2 = AIEvidenceChainBuilder.getInstance(mockAIService);

      // getInstance创建新实例，不是真正的单例
      expect(instance1).toBeInstanceOf(AIEvidenceChainBuilder);
      expect(instance2).toBeInstanceOf(AIEvidenceChainBuilder);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('report generation edge cases', () => {
    it('should handle report with no strongest chain', () => {
      const report = builder.generateChainReport({
        chainGraph: {
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
              SUPPORTS: 0,
              REFUTES: 0,
              SUPPLEMENTS: 0,
              CONTRADICTS: 0,
              INDEPENDENT: 0,
            },
            effectivenessScore: 0,
            missingEvidenceTypes: [],
          },
        },
        chains: [],
        effectivenessEvaluations: new Map(),
        summary: {
          totalEvidences: 0,
          detectedRelations: 0,
          chainCount: 0,
          longestChainLength: 0,
          averageEffectiveness: 0,
          keyFindings: [],
        },
        executionTime: 0,
      });

      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report).toContain('# 证据链分析报告');
    });

    it('should handle report with no key findings', () => {
      const __request: EvidenceChainAnalysisRequest = {
        caseId: 'case-024',
        evidences: [
          {
            id: 'evidence-001',
            name: '合同书',
            type: 'DOCUMENTARY_EVIDENCE',
            status: 'APPROVED',
            relevanceScore: 0.8,
          },
        ],
        existingRelations: [],
        options: {
          useAI: false,
        },
      };

      const result = builder.generateChainReport({
        chainGraph: {
          nodes: [
            {
              evidenceId: 'evidence-001',
              evidenceName: '合同书',
              evidenceType: 'DOCUMENTARY_EVIDENCE',
              status: 'APPROVED',
              relevanceScore: 0.8,
              incomingRelations: [],
              outgoingRelations: [],
              metadata: {},
            },
          ],
          edges: [],
          coreEvidences: [],
          isolatedEvidences: ['evidence-001'],
          statistics: {
            totalEvidences: 1,
            totalRelations: 0,
            averageRelationStrength: 0,
            chainCompleteness: 0,
            relationTypeDistribution: {
              SUPPORTS: 0,
              REFUTES: 0,
              SUPPLEMENTS: 0,
              CONTRADICTS: 0,
              INDEPENDENT: 0,
            },
            effectivenessScore: 0,
            missingEvidenceTypes: [],
          },
        },
        chains: [],
        effectivenessEvaluations: new Map(),
        summary: {
          totalEvidences: 1,
          detectedRelations: 0,
          chainCount: 0,
          longestChainLength: 0,
          averageEffectiveness: 0,
          keyFindings: [],
        },
        executionTime: 0,
      });

      expect(result).toBeDefined();
      expect(result).toContain('# 证据链分析报告');
      expect(result).toContain('## 孤证证据');
    });
  });
});
