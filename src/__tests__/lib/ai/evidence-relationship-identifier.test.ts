/**
 * AIEvidenceRelationshipIdentifier 单元测试
 */

import { AIEvidenceRelationshipIdentifier } from '@/lib/ai/evidence-relationship-identifier';
import type { AIResponse } from '@/types/ai-service';
import type { AIEvidenceRelationshipResult } from '@/types/evidence-chain';
import {
  EvidenceChainRelationType,
  EvidenceRelationStrength,
} from '@/types/evidence-chain';

/**
 * Mock AI服务
 */
const mockChatCompletion = jest.fn();
const mockAIService = {
  chatCompletion: mockChatCompletion,
} as never;

describe('AIEvidenceRelationshipIdentifier', () => {
  let identifier: AIEvidenceRelationshipIdentifier;

  beforeEach(() => {
    mockChatCompletion.mockClear();
    identifier = new AIEvidenceRelationshipIdentifier(mockAIService);
  });

  describe('identifyRelationship', () => {
    it('应该成功识别支撑关系', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 4,
                confidence: 0.85,
                description: '证据A支撑证据B',
                reasoning: '证据A的内容直接证明证据B的真实性',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-001',
        name: '合同书',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '支撑关系测试',
      };
      const evidenceB = {
        id: 'evidence-002',
        name: '付款记录',
        type: 'ELECTRONIC_EVIDENCE',
        content: '支撑关系测试',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result).toBeDefined();
      expect(result.evidenceAId).toBe('evidence-001');
      expect(result.evidenceBId).toBe('evidence-002');
      expect(result.relationType).toBe(EvidenceChainRelationType.SUPPORTS);
      expect(result.strength).toBe(EvidenceRelationStrength.STRONG);
      expect(result.confidence).toBe(0.85);
      expect(result.description).toBe('证据A支撑证据B');
      expect(result.reasoning).toBe('证据A的内容直接证明证据B的真实性');
    });

    it('应该成功识别反驳关系', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'REFUTES',
                strength: 4,
                confidence: 0.88,
                description: '证据A反驳证据B',
                reasoning: '证据A与证据B的事实矛盾',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-003',
        name: '证人证言A',
        type: 'WITNESS_TESTIMONY',
        content: '反驳关系测试',
      };
      const evidenceB = {
        id: 'evidence-004',
        name: '证人证言B',
        type: 'WITNESS_TESTIMONY',
        content: '反驳关系测试',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result.relationType).toBe(EvidenceChainRelationType.REFUTES);
      expect(result.strength).toBe(EvidenceRelationStrength.STRONG);
      expect(result.confidence).toBe(0.88);
      expect(result.description).toBe('证据A反驳证据B');
    });

    it('应该成功识别补充关系', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPLEMENTS',
                strength: 3,
                confidence: 0.75,
                description: '证据A补充证据B',
                reasoning: '证据A提供了证据B的背景信息',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-005',
        name: '背景材料',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '补充关系测试',
      };
      const evidenceB = {
        id: 'evidence-006',
        name: '主要证据',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '补充关系测试',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result.relationType).toBe(EvidenceChainRelationType.SUPPLEMENTS);
      expect(result.strength).toBe(EvidenceRelationStrength.MODERATE);
      expect(result.confidence).toBe(0.75);
    });

    it('应该成功识别矛盾关系', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'CONTRADICTS',
                strength: 3,
                confidence: 0.7,
                description: '证据A与证据B矛盾',
                reasoning: '证据A和证据B的事实不一致',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-007',
        name: '记录A',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '矛盾关系测试',
      };
      const evidenceB = {
        id: 'evidence-008',
        name: '记录B',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '矛盾关系测试',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result.relationType).toBe(EvidenceChainRelationType.CONTRADICTS);
      expect(result.strength).toBe(EvidenceRelationStrength.MODERATE);
      expect(result.confidence).toBe(0.7);
    });

    it('应该返回独立关系当没有明显关系时', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'INDEPENDENT',
                strength: 1,
                confidence: 0.5,
                description: '证据A与证据B独立',
                reasoning: '两个证据之间没有明显关系',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-009',
        name: '无关证据A',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '独立证据',
      };
      const evidenceB = {
        id: 'evidence-010',
        name: '无关证据B',
        type: 'PHYSICAL_EVIDENCE',
        content: '独立证据',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result.relationType).toBe(EvidenceChainRelationType.INDEPENDENT);
      expect(result.strength).toBe(EvidenceRelationStrength.VERY_WEAK);
      expect(result.confidence).toBe(0.5);
    });

    it('应该处理只有description没有content的情况', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 4,
                confidence: 0.85,
                description: '证据A支撑证据B',
                reasoning: '测试推理',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-011',
        name: '证据A',
        type: 'DOCUMENTARY_EVIDENCE',
        description: '支撑关系测试',
      };
      const evidenceB = {
        id: 'evidence-012',
        name: '证据B',
        type: 'ELECTRONIC_EVIDENCE',
        description: '支撑关系测试',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result).toBeDefined();
      expect(result.relationType).toBe(EvidenceChainRelationType.SUPPORTS);
    });

    it('应该处理既没有content也没有description的情况', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'INDEPENDENT',
                strength: 1,
                confidence: 0.5,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-013',
        name: '证据A',
        type: 'DOCUMENTARY_EVIDENCE',
      };
      const evidenceB = {
        id: 'evidence-014',
        name: '证据B',
        type: 'ELECTRONIC_EVIDENCE',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result).toBeDefined();
    });
  });

  describe('identifyRelationshipsBatch', () => {
    it('应该成功批量识别多个证据关系', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 4,
                confidence: 0.85,
                description: '证据A支撑证据B',
                reasoning: '测试推理',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidences = [
        {
          id: 'evidence-001',
          name: '证据1',
          type: 'DOCUMENTARY_EVIDENCE',
          content: '支撑关系测试',
        },
        {
          id: 'evidence-002',
          name: '证据2',
          type: 'ELECTRONIC_EVIDENCE',
          content: '支撑关系测试',
        },
        {
          id: 'evidence-003',
          name: '证据3',
          type: 'WITNESS_TESTIMONY',
          content: '反驳关系测试',
        },
      ];

      const results = await identifier.identifyRelationshipsBatch(evidences);

      expect(results).toHaveLength(3);
      expect(results[0].evidenceAId).toBe('evidence-001');
      expect(results[0].evidenceBId).toBe('evidence-002');
      expect(results[0].relationType).toBe(EvidenceChainRelationType.SUPPORTS);
    });

    it('应该按置信度降序排列批量识别结果', async () => {
      let callCount = 0;
      mockChatCompletion.mockImplementation(() => {
        callCount++;
        const confidences = [0.85, 0.88, 0.5];
        return Promise.resolve({
          id: 'mock-response-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'deepseek-chat',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  relationType: 'SUPPORTS',
                  strength: 4,
                  confidence: confidences[callCount - 1] || 0.5,
                  description: '测试',
                  reasoning: '测试',
                }),
              },
              finishReason: 'stop',
            },
          ],
          provider: 'deepseek',
          duration: 100,
        } as AIResponse);
      });

      const evidences = [
        {
          id: 'evidence-001',
          name: '证据1',
          type: 'DOCUMENTARY_EVIDENCE',
          content: '支撑关系测试',
        },
        {
          id: 'evidence-002',
          name: '证据2',
          type: 'ELECTRONIC_EVIDENCE',
          content: '反驳关系测试',
        },
        {
          id: 'evidence-003',
          name: '证据3',
          type: 'WITNESS_TESTIMONY',
          content: '独立证据',
        },
      ];

      const results = await identifier.identifyRelationshipsBatch(evidences);

      expect(results).toHaveLength(3);

      const confidences = results.map(r => r.confidence);
      for (let i = 0; i < confidences.length - 1; i++) {
        expect(confidences[i]).toBeGreaterThanOrEqual(confidences[i + 1]);
      }
    });

    it('应该过滤置信度低的独立关系', async () => {
      let callCount = 0;
      mockChatCompletion.mockImplementation(() => {
        callCount++;
        const confidences = [0.5, 0.5, 0.85];
        return Promise.resolve({
          id: 'mock-response-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'deepseek-chat',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  relationType: callCount === 3 ? 'SUPPORTS' : 'INDEPENDENT',
                  strength: 4,
                  confidence: confidences[callCount - 1],
                  description: '测试',
                  reasoning: '测试',
                }),
              },
              finishReason: 'stop',
            },
          ],
          provider: 'deepseek',
          duration: 100,
        } as AIResponse);
      });

      const evidences = [
        {
          id: 'evidence-001',
          name: '证据1',
          type: 'DOCUMENTARY_EVIDENCE',
          content: '独立证据',
        },
        {
          id: 'evidence-002',
          name: '证据2',
          type: 'ELECTRONIC_EVIDENCE',
          content: '独立证据',
        },
        {
          id: 'evidence-003',
          name: '证据3',
          type: 'WITNESS_TESTIMONY',
          content: '支撑关系测试',
        },
      ];

      const results = await identifier.identifyRelationshipsBatch(evidences, {
        skipIndependent: true,
        confidenceThreshold: 0.6,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('应该使用默认置信度阈值', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'INDEPENDENT',
                strength: 1,
                confidence: 0.5,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidences = [
        {
          id: 'evidence-001',
          name: '证据1',
          type: 'DOCUMENTARY_EVIDENCE',
          content: '独立证据',
        },
        {
          id: 'evidence-002',
          name: '证据2',
          type: 'ELECTRONIC_EVIDENCE',
          content: '独立证据',
        },
      ];

      const results = await identifier.identifyRelationshipsBatch(evidences, {
        skipIndependent: true,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('应该处理空证据列表', async () => {
      const results = await identifier.identifyRelationshipsBatch([]);

      expect(results).toHaveLength(0);
      expect(mockChatCompletion).not.toHaveBeenCalled();
    });

    it('应该处理单个证据', async () => {
      const evidences = [
        {
          id: 'evidence-001',
          name: '证据1',
          type: 'DOCUMENTARY_EVIDENCE',
          content: '支撑关系测试',
        },
      ];

      const results = await identifier.identifyRelationshipsBatch(evidences);

      expect(results).toHaveLength(0);
      expect(mockChatCompletion).not.toHaveBeenCalled();
    });

    it('应该生成正确数量的关系', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 4,
                confidence: 0.85,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidences = [
        { id: 'e001', name: 'e1', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e003', name: 'e3', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e004', name: 'e4', type: 'DOCUMENTARY_EVIDENCE' },
      ];

      const results = await identifier.identifyRelationshipsBatch(evidences);

      expect(results).toHaveLength(6);
    });
  });

  describe('规则回退机制', () => {
    it('应该在AI返回无效JSON时使用规则回退', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '无效的响应内容，不包含JSON',
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-001',
        name: '证据A',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '支撑关系测试',
      };
      const evidenceB = {
        id: 'evidence-002',
        name: '证据B',
        type: 'DOCUMENTARY_EVIDENCE',
        content: '支撑关系测试',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result).toBeDefined();
      expect(result.relationType).toBe(EvidenceChainRelationType.INDEPENDENT);
      expect(result.description).toBe('未发现明显关系');
      expect(result.reasoning).toBe('AI分析未发现明确关系');
    });

    it('应该基于关键词识别支撑关系', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '根据分析，这两个证据之间存在支撑关系',
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e001', name: 'e1', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.relationType).toBe(EvidenceChainRelationType.SUPPORTS);
      expect(result.description).toBe('基于关键词分析');
      expect(result.reasoning).toBe('检测到支撑关系关键词');
    });

    it('应该基于关键词识别反驳关系', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '这两个证据存在反驳关系',
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e003', name: 'e3', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.relationType).toBe(EvidenceChainRelationType.REFUTES);
      expect(result.reasoning).toBe('检测到反驳关系关键词');
    });

    it('应该基于关键词识别补充关系', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '证据A补充证据B',
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e005', name: 'e5', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.relationType).toBe(EvidenceChainRelationType.SUPPLEMENTS);
      expect(result.reasoning).toBe('检测到补充关系关键词');
    });

    it('应该基于关键词识别矛盾关系', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '两个证据存在矛盾',
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e007', name: 'e7', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.relationType).toBe(EvidenceChainRelationType.REFUTES);
      expect(result.reasoning).toBe('检测到反驳关系关键词');
    });
  });

  describe('错误处理', () => {
    it('应该处理AI服务错误', async () => {
      mockChatCompletion.mockRejectedValue(new Error('AI服务错误'));

      const evidenceA = {
        id: 'evidence-001',
        name: '证据A',
        type: 'DOCUMENTARY_EVIDENCE',
      };
      const evidenceB = {
        id: 'evidence-002',
        name: '证据B',
        type: 'DOCUMENTARY_EVIDENCE',
      };

      await expect(
        identifier.identifyRelationship(evidenceA, evidenceB)
      ).rejects.toThrow('AI服务错误');
    });

    it('应该处理解析JSON错误并使用规则回退', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '无效的响应内容，不包含JSON',
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-001',
        name: '证据A',
        type: 'DOCUMENTARY_EVIDENCE',
      };
      const evidenceB = {
        id: 'evidence-002',
        name: '证据B',
        type: 'DOCUMENTARY_EVIDENCE',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result).toBeDefined();
      expect(result.relationType).toBe(EvidenceChainRelationType.INDEPENDENT);
    });
  });

  describe('类型验证', () => {
    it('应该验证关系类型有效性', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 4,
                confidence: 0.85,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-001',
        name: '证据A',
        type: 'DOCUMENTARY_EVIDENCE',
      };
      const evidenceB = {
        id: 'evidence-002',
        name: '证据B',
        type: 'DOCUMENTARY_EVIDENCE',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(Object.values(EvidenceChainRelationType)).toContain(
        result.relationType
      );
    });

    it('应该验证强度值有效性', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 3,
                confidence: 0.7,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-001',
        name: '证据A',
        type: 'DOCUMENTARY_EVIDENCE',
      };
      const evidenceB = {
        id: 'evidence-002',
        name: '证据B',
        type: 'DOCUMENTARY_EVIDENCE',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result.strength).toBeGreaterThanOrEqual(1);
      expect(result.strength).toBeLessThanOrEqual(5);
    });

    it('应该验证置信度有效性', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 3,
                confidence: 0.7,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidenceA = {
        id: 'evidence-001',
        name: '证据A',
        type: 'DOCUMENTARY_EVIDENCE',
      };
      const evidenceB = {
        id: 'evidence-002',
        name: '证据B',
        type: 'DOCUMENTARY_EVIDENCE',
      };

      const result = await identifier.identifyRelationship(
        evidenceA,
        evidenceB
      );

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('应该处理无效的关系类型并使用默认值', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'INVALID_TYPE',
                strength: 3,
                confidence: 0.7,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e001', name: 'e1', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.relationType).toBe(EvidenceChainRelationType.INDEPENDENT);
    });

    it('应该处理无效的强度值并使用默认值', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 999,
                confidence: 0.7,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e001', name: 'e1', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.strength).toBe(EvidenceRelationStrength.MODERATE);
    });

    it('应该处理无效的置信度并使用默认值', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 3,
                confidence: 2.5,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e001', name: 'e1', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.confidence).toBe(0.7);
    });
  });

  describe('边界条件', () => {
    it('应该处理最小强度值1', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 1,
                confidence: 0.7,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e001', name: 'e1', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.strength).toBe(EvidenceRelationStrength.VERY_WEAK);
    });

    it('应该处理最大强度值5', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 5,
                confidence: 0.7,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e001', name: 'e1', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.strength).toBe(EvidenceRelationStrength.VERY_STRONG);
    });

    it('应该处理最小置信度0', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 3,
                confidence: 0,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e001', name: 'e1', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.confidence).toBe(0);
    });

    it('应该处理最大置信度1', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 3,
                confidence: 1,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const result = await identifier.identifyRelationship(
        { id: 'e001', name: 'e1', type: 'DOCUMENTARY_EVIDENCE' },
        { id: 'e002', name: 'e2', type: 'DOCUMENTARY_EVIDENCE' }
      );

      expect(result.confidence).toBe(1);
    });
  });

  describe('性能和效率', () => {
    it('应该正确处理大量证据', async () => {
      mockChatCompletion.mockResolvedValue({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                relationType: 'SUPPORTS',
                strength: 4,
                confidence: 0.85,
                description: '测试',
                reasoning: '测试',
              }),
            },
            finishReason: 'stop',
          },
        ],
        provider: 'deepseek',
        duration: 100,
      } as AIResponse);

      const evidences = Array.from({ length: 10 }, (_, i) => ({
        id: `evidence-${String(i).padStart(3, '0')}`,
        name: `证据${i + 1}`,
        type: 'DOCUMENTARY_EVIDENCE' as const,
      }));

      const results = await identifier.identifyRelationshipsBatch(evidences);

      expect(results).toHaveLength(45);
    });
  });
});
