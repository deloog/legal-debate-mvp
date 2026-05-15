/**
 * 质证预判服务
 *
 * 功能：
 * - AI 预判对方可能的质证意见
 * - 分类质证类型（真实性/合法性/关联性）
 * - 评估每种意见的可能性
 * - 生成应对建议
 * - 建议补充证据
 * - 评估总体风险等级
 */

import type { Evidence } from '@prisma/client';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import { getDefaultModel } from '@/lib/ai/config';
import { logger } from '@/lib/logger';

const CROSS_EXAM_MODEL =
  process.env.CASE_CROSS_EXAM_MODEL ?? getDefaultModel('deepseek', 'chat');

/**
 * 质证预判输入
 */
export interface CrossExaminationInput {
  evidence: Evidence;
  ourPosition: 'plaintiff' | 'defendant';
  caseType?: string;
}

export interface CrossExaminationChallenge {
  type: 'authenticity' | 'legality' | 'relevance';
  content: string;
  likelihood: number;
}

export interface CrossExaminationResponse {
  challenge: string;
  response: string;
  supportingEvidence?: string;
}

export interface CrossExaminationResult {
  possibleChallenges: CrossExaminationChallenge[];
  responses: CrossExaminationResponse[];
  overallRisk: 'low' | 'medium' | 'high';
  riskNote: string;
}

interface AIPreAssessmentResponse {
  possibleChallenges: CrossExaminationChallenge[];
  responses: CrossExaminationResponse[];
  overallRisk: 'low' | 'medium' | 'high';
  riskNote: string;
}

export class CrossExaminationService {
  /**
   * 预判质证意见
   */
  async preAssess(
    input: CrossExaminationInput
  ): Promise<CrossExaminationResult> {
    this.validateInput(input);
    const prompt = this.buildPreAssessmentPrompt(input);

    try {
      const aiService = await AIServiceFactory.getInstance();
      const response = await aiService.chatCompletion({
        model: CROSS_EXAM_MODEL,
        messages: [
          {
            role: 'system',
            content:
              '你是一位经验丰富的中国诉讼律师，擅长从真实性、合法性、关联性三方面预判对方质证意见，并输出严格 JSON。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        maxTokens: 1400,
      });

      const rawText = response.choices[0]?.message?.content ?? '';
      return this.parseAIResponse(rawText);
    } catch (error) {
      logger.error('质证预判失败:', error);
      throw new Error(
        `质证预判失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  private validateInput(input: CrossExaminationInput): void {
    if (!input.evidence) {
      throw new Error('证据不能为空');
    }

    if (!input.evidence.id || !input.evidence.name || !input.evidence.type) {
      throw new Error('证据数据不完整，缺少必要字段');
    }

    if (!input.ourPosition) {
      throw new Error('当事人立场不能为空');
    }

    if (!['plaintiff', 'defendant'].includes(input.ourPosition)) {
      throw new Error('当事人立场必须是plaintiff或defendant');
    }
  }

  private buildPreAssessmentPrompt(input: CrossExaminationInput): string {
    const { evidence, ourPosition, caseType } = input;

    const positionLabel = ourPosition === 'plaintiff' ? '原告' : '被告';
    const opponentLabel = ourPosition === 'plaintiff' ? '被告' : '原告';

    return `请作为一位经验丰富的诉讼律师，预判对方可能对以下证据提出的质证意见。

## 案件信息
- 案件类型: ${caseType || '未指定'}
- 我方立场: ${positionLabel}
- 对方立场: ${opponentLabel}

## 证据信息
- 证据名称: ${evidence.name}
- 证据类型: ${this.getEvidenceTypeLabel(evidence.type)}
- 证据描述: ${evidence.description || '无'}
- 证据状态: ${this.getEvidenceStatusLabel(evidence.status)}
- 相关性评分: ${evidence.relevanceScore ?? '未评分'}

## 分析要求
请从以下三个方面预判对方可能的质证意见：

1. 真实性质证 (authenticity)
2. 合法性质证 (legality)
3. 关联性质证 (relevance)

对于每种可能的质证意见：
- 评估其可能性（0-100）
- 提供应对建议
- 建议补充的证据（如有必要）

最后，评估该证据的总体质证风险等级（low/medium/high）。

## 输出格式
请严格按照以下 JSON 输出，不要包含任何其他文字：
\`\`\`json
{
  "possibleChallenges": [
    {
      "type": "authenticity|legality|relevance",
      "content": "具体的质证意见内容",
      "likelihood": 70
    }
  ],
  "responses": [
    {
      "challenge": "对应的质证意见",
      "response": "应对策略和建议",
      "supportingEvidence": "建议补充的证据（可选）"
    }
  ],
  "overallRisk": "low|medium|high",
  "riskNote": "风险说明"
}
\`\`\``;
  }

  private parseAIResponse(response: string): CrossExaminationResult {
    try {
      let jsonStr = response.trim();

      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const start = jsonStr.indexOf('{');
      const end = jsonStr.lastIndexOf('}');
      if (start === -1 || end <= start) {
        throw new Error('AI 未返回有效 JSON');
      }

      const parsed: AIPreAssessmentResponse = JSON.parse(
        jsonStr.slice(start, end + 1)
      );

      if (
        !parsed.possibleChallenges ||
        !Array.isArray(parsed.possibleChallenges)
      ) {
        throw new Error('AI响应缺少possibleChallenges字段');
      }
      if (!parsed.responses || !Array.isArray(parsed.responses)) {
        throw new Error('AI响应缺少responses字段');
      }
      if (!parsed.overallRisk) {
        throw new Error('AI响应缺少overallRisk字段');
      }
      if (!['low', 'medium', 'high'].includes(parsed.overallRisk)) {
        throw new Error('AI响应的overallRisk值无效');
      }
      if (!parsed.riskNote) {
        throw new Error('AI响应缺少riskNote字段');
      }

      const validatedChallenges = parsed.possibleChallenges.map(challenge => {
        if (
          !['authenticity', 'legality', 'relevance'].includes(challenge.type)
        ) {
          throw new Error(`无效的质证类型: ${challenge.type}`);
        }

        return {
          type: challenge.type,
          content: String(challenge.content || ''),
          likelihood: Math.max(0, Math.min(100, challenge.likelihood)),
        } as CrossExaminationChallenge;
      });

      return {
        possibleChallenges: validatedChallenges,
        responses: parsed.responses.map(item => ({
          challenge: String(item.challenge || ''),
          response: String(item.response || ''),
          ...(item.supportingEvidence
            ? { supportingEvidence: String(item.supportingEvidence) }
            : {}),
        })),
        overallRisk: parsed.overallRisk,
        riskNote: parsed.riskNote,
      };
    } catch (error) {
      logger.error('解析AI响应失败:', error);
      logger.error('原始响应:', response);
      throw new Error(
        `解析AI响应失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  private getEvidenceTypeLabel(type: string): string {
    const typeMap: Record<string, string> = {
      DOCUMENT: '书证',
      PHYSICAL: '物证',
      WITNESS: '证人证言',
      EXPERT_OPINION: '鉴定意见',
      AUDIO_VIDEO: '视听资料/电子数据',
      OTHER: '其他',
    };

    return typeMap[type] || type;
  }

  private getEvidenceStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING: '待审核',
      ACCEPTED: '已采纳',
      REJECTED: '已驳回',
      QUESTIONED: '被质疑',
    };

    return statusMap[status] || status;
  }

  private static instance: CrossExaminationService | null = null;

  static getInstance(): CrossExaminationService {
    if (!CrossExaminationService.instance) {
      CrossExaminationService.instance = new CrossExaminationService();
    }
    return CrossExaminationService.instance;
  }
}
