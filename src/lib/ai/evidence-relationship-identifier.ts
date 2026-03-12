/**
 * AIEvidenceRelationshipIdentifier - AI证据关系识别器
 *
 * 功能：使用AI识别证据之间的关系类型和强度
 */

import type { AIEvidenceRelationshipResult } from '../../types/evidence-chain';

import {
  EvidenceChainRelationType,
  EvidenceRelationStrength,
} from '../../types/evidence-chain';

import type { AIRequestConfig } from '../../types/ai-service';
import type { AIService } from './service';
import { logger } from '@/lib/logger';

/**
 * 证据关系识别器类
 */
export class AIEvidenceRelationshipIdentifier {
  private readonly aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * 识别两个证据之间的关系
   */
  async identifyRelationship(
    evidenceA: {
      id: string;
      name: string;
      type: string;
      content?: string;
      description?: string;
    },
    evidenceB: {
      id: string;
      name: string;
      type: string;
      content?: string;
      description?: string;
    }
  ): Promise<AIEvidenceRelationshipResult> {
    const prompt = this.buildIdentificationPrompt(evidenceA, evidenceB);

    const request: AIRequestConfig = {
      model: 'deepseek-chat',
      provider: 'deepseek',
      messages: [
        {
          role: 'system',
          content: '你是专业的法律证据分析助手。请分析两个证据之间的关系。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    };

    const response = await this.aiService.chatCompletion(request);

    return this.parseRelationshipResponse(
      response.choices[0].message.content || '',
      evidenceA.id,
      evidenceB.id
    );
  }

  /**
   * 批量识别证据关系
   */
  async identifyRelationshipsBatch(
    evidences: Array<{
      id: string;
      name: string;
      type: string;
      content?: string;
      description?: string;
    }>,
    options?: {
      skipIndependent?: boolean;
      confidenceThreshold?: number;
    }
  ): Promise<AIEvidenceRelationshipResult[]> {
    const relationships: AIEvidenceRelationshipResult[] = [];

    for (let i = 0; i < evidences.length; i++) {
      for (let j = i + 1; j < evidences.length; j++) {
        const result = await this.identifyRelationship(
          evidences[i],
          evidences[j]
        );

        // 过滤置信度低的独立关系
        if (
          options?.skipIndependent &&
          result.relationType === EvidenceChainRelationType.INDEPENDENT &&
          (options.confidenceThreshold ?? 0.6) > result.confidence
        ) {
          continue;
        }

        relationships.push(result);
      }
    }

    // 按置信度排序
    relationships.sort((a, b) => b.confidence - a.confidence);

    return relationships;
  }

  /**
   * 构建识别提示词
   */
  private buildIdentificationPrompt(
    evidenceA: {
      id: string;
      name: string;
      type: string;
      content?: string;
      description?: string;
    },
    evidenceB: {
      id: string;
      name: string;
      type: string;
      content?: string;
      description?: string;
    }
  ): string {
    const aContent = evidenceA.content || evidenceA.description || '';
    const bContent = evidenceB.content || evidenceB.description || '';

    return `请分析以下两个证据之间的关系：

证据A：
- 名称：${evidenceA.name}
- 类型：${this.translateEvidenceType(evidenceA.type)}
- 内容：${aContent}

证据B：
- 名称：${evidenceB.name}
- 类型：${this.translateEvidenceType(evidenceB.type)}
- 内容：${bContent}

请分析证据A与证据B之间的关系，并返回JSON格式：
{
  "relationType": "SUPPORTS|REFUTES|SUPPLEMENTS|CONTRADICTS|INDEPENDENT",
  "strength": 1-5,
  "confidence": 0-1,
  "description": "关系描述",
  "reasoning": "推理依据"
}

关系类型说明：
- SUPPORTS：证据A支撑证据B
- REFUTES：证据A反驳证据B
- SUPPLEMENTS：证据A补充证据B
- CONTRADICTS：证据A与证据B矛盾
- INDEPENDENT：证据A与证据B独立

强度评分（1-5）：
- 1：非常弱
- 2：弱
- 3：中等
- 4：强
- 5：非常强`;
  }

  /**
   * 翻译证据类型
   */
  private translateEvidenceType(type: string): string {
    const typeMap: Record<string, string> = {
      DOCUMENTARY_EVIDENCE: '书证',
      PHYSICAL_EVIDENCE: '物证',
      WITNESS_TESTIMONY: '证人证言',
      EXPERT_OPINION: '专家意见',
      AUDIO_VIDEO_EVIDENCE: '视听资料',
      ELECTRONIC_EVIDENCE: '电子数据',
    };
    return typeMap[type] || type;
  }

  /**
   * 解析关系响应
   */
  private parseRelationshipResponse(
    response: string,
    evidenceAId: string,
    evidenceBId: string
  ): AIEvidenceRelationshipResult {
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        return {
          evidenceAId,
          evidenceBId,
          relationType: this.validateRelationType(parsed.relationType),
          strength: this.validateStrength(parsed.strength),
          confidence: this.validateConfidence(parsed.confidence),
          description: parsed.description || '',
          reasoning: parsed.reasoning || '',
        };
      } catch (error) {
        logger.error('解析JSON失败，使用规则:', error);
      }
    }

    // 规则回退
    return this.analyzeByRules(response, evidenceAId, evidenceBId);
  }

  /**
   * 规则分析（AI失败的回退方案）
   */
  private analyzeByRules(
    response: string,
    evidenceAId: string,
    evidenceBId: string
  ): AIEvidenceRelationshipResult {
    const lowerResponse = response.toLowerCase();

    // 简单的关键词匹配
    if (
      lowerResponse.includes('支撑') ||
      lowerResponse.includes('支持') ||
      lowerResponse.includes('证明')
    ) {
      return {
        evidenceAId,
        evidenceBId,
        relationType: EvidenceChainRelationType.SUPPORTS,
        strength: EvidenceRelationStrength.MODERATE,
        confidence: 0.6,
        description: '基于关键词分析',
        reasoning: '检测到支撑关系关键词',
      };
    }

    if (
      lowerResponse.includes('反驳') ||
      lowerResponse.includes('否定') ||
      lowerResponse.includes('矛盾')
    ) {
      return {
        evidenceAId,
        evidenceBId,
        relationType: EvidenceChainRelationType.REFUTES,
        strength: EvidenceRelationStrength.MODERATE,
        confidence: 0.6,
        description: '基于关键词分析',
        reasoning: '检测到反驳关系关键词',
      };
    }

    if (lowerResponse.includes('补充') || lowerResponse.includes('延伸')) {
      return {
        evidenceAId,
        evidenceBId,
        relationType: EvidenceChainRelationType.SUPPLEMENTS,
        strength: EvidenceRelationStrength.MODERATE,
        confidence: 0.6,
        description: '基于关键词分析',
        reasoning: '检测到补充关系关键词',
      };
    }

    // 默认独立关系
    return {
      evidenceAId,
      evidenceBId,
      relationType: EvidenceChainRelationType.INDEPENDENT,
      strength: EvidenceRelationStrength.VERY_WEAK,
      confidence: 0.5,
      description: '未发现明显关系',
      reasoning: 'AI分析未发现明确关系',
    };
  }

  /**
   * 验证关系类型
   */
  private validateRelationType(type: unknown): EvidenceChainRelationType {
    const validTypes: EvidenceChainRelationType[] = [
      EvidenceChainRelationType.SUPPORTS,
      EvidenceChainRelationType.REFUTES,
      EvidenceChainRelationType.SUPPLEMENTS,
      EvidenceChainRelationType.CONTRADICTS,
      EvidenceChainRelationType.INDEPENDENT,
    ];

    if (
      typeof type === 'string' &&
      validTypes.includes(type as EvidenceChainRelationType)
    ) {
      return type as EvidenceChainRelationType;
    }

    return EvidenceChainRelationType.INDEPENDENT;
  }

  /**
   * 验证强度值
   */
  private validateStrength(strength: unknown): EvidenceRelationStrength {
    if (
      typeof strength === 'number' &&
      strength >= 1 &&
      strength <= 5 &&
      Number.isInteger(strength)
    ) {
      return strength as EvidenceRelationStrength;
    }

    return EvidenceRelationStrength.MODERATE;
  }

  /**
   * 验证置信度
   */
  private validateConfidence(confidence: unknown): number {
    if (typeof confidence === 'number' && confidence >= 0 && confidence <= 1) {
      return Math.round(confidence * 1000) / 1000;
    }

    return 0.7;
  }
}
