/**
 * 质证预判服务
 *
 * 功能：
 * - AI预判对方可能的质证意见
 * - 分类质证类型（真实性/合法性/关联性）
 * - 评估每种意见的可能性
 * - 生成应对建议
 * - 建议补充证据
 * - 评估总体风险等级
 */

import type { Evidence } from '@prisma/client';
import { AIService } from '@/lib/ai/clients';

/**
 * 质证预判输入
 */
export interface CrossExaminationInput {
  evidence: Evidence;
  ourPosition: 'plaintiff' | 'defendant'; // 我方立场
  caseType?: string; // 案件类型
}

/**
 * 质证意见
 */
export interface CrossExaminationChallenge {
  type: 'authenticity' | 'legality' | 'relevance'; // 质证类型
  content: string; // 质证内容
  likelihood: number; // 可能性 0-100
}

/**
 * 应对建议
 */
export interface CrossExaminationResponse {
  challenge: string; // 针对的质证意见
  response: string; // 应对方案
  supportingEvidence?: string; // 补充证据建议
}

/**
 * 质证预判结果
 */
export interface CrossExaminationResult {
  possibleChallenges: CrossExaminationChallenge[]; // 可能的质证意见
  responses: CrossExaminationResponse[]; // 应对建议
  overallRisk: 'low' | 'medium' | 'high'; // 总体风险等级
  riskNote: string; // 风险说明
}

/**
 * AI响应结构
 */
interface AIPreAssessmentResponse {
  possibleChallenges: CrossExaminationChallenge[];
  responses: CrossExaminationResponse[];
  overallRisk: 'low' | 'medium' | 'high';
  riskNote: string;
}

/**
 * 质证预判服务类
 */
export class CrossExaminationService {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService({
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: 'deepseek-chat',
      temperature: 0.4, // 适中温度以平衡创造性和稳定性
      maxTokens: 3000,
    });
  }

  /**
   * 预判质证意见
   */
  async preAssess(
    input: CrossExaminationInput
  ): Promise<CrossExaminationResult> {
    // 验证输入
    this.validateInput(input);

    // 生成AI提示词
    const prompt = this.buildPreAssessmentPrompt(input);

    try {
      // 调用AI服务
      const aiResponse = await this.aiService.chat(
        [
          {
            role: 'system',
            content:
              '你是一位经验丰富的诉讼律师，擅长预判对方的质证意见并提供应对策略。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          temperature: 0.4,
          maxTokens: 3000,
        }
      );

      // 解析AI响应
      const result = this.parseAIResponse(aiResponse);

      return result;
    } catch (error) {
      console.error('质证预判失败:', error);
      throw new Error(
        `质证预判失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 验证输入参数
   */
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

  /**
   * 构建AI预判提示词
   */
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
- 相关性评分: ${evidence.relevanceScore || '未评分'}

## 分析要求
请从以下三个方面预判对方可能的质证意见：

1. **真实性质证** (authenticity)
   - 证据是否真实
   - 是否存在伪造、变造的可能
   - 原件与复印件问题

2. **合法性质证** (legality)
   - 证据来源是否合法
   - 取证程序是否合法
   - 是否侵犯他人合法权益

3. **关联性质证** (relevance)
   - 证据与待证事实的关联性
   - 证明力强弱
   - 是否具有证明价值

对于每种可能的质证意见：
- 评估其可能性（0-100）
- 提供应对建议
- 建议补充的证据（如有必要）

最后，评估该证据的总体质证风险等级（low/medium/high）。

## 输出格式
请严格按照以下JSON格式输出（不要包含任何其他文字）：

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
\`\`\`

注意：
- possibleChallenges数组应包含所有可能的质证意见
- likelihood是0-100的整数
- responses数组应为每个主要质证意见提供应对建议
- overallRisk必须是low、medium或high之一
- 必须返回有效的JSON格式`;
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(response: string): CrossExaminationResult {
    try {
      // 提取JSON内容（处理可能的markdown代码块）
      let jsonStr = response.trim();

      // 移除markdown代码块标记
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // 解析JSON
      const parsed: AIPreAssessmentResponse = JSON.parse(jsonStr);

      // 验证响应结构
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

      // 验证并规范化质证意见
      const validatedChallenges = parsed.possibleChallenges.map(challenge => {
        // 验证type
        if (
          !['authenticity', 'legality', 'relevance'].includes(challenge.type)
        ) {
          throw new Error(`无效的质证类型: ${challenge.type}`);
        }

        // 确保likelihood在0-100范围内
        const likelihood = Math.max(0, Math.min(100, challenge.likelihood));

        return {
          type: challenge.type,
          content: challenge.content,
          likelihood,
        };
      });

      return {
        possibleChallenges: validatedChallenges,
        responses: parsed.responses,
        overallRisk: parsed.overallRisk,
        riskNote: parsed.riskNote,
      };
    } catch (error) {
      console.error('解析AI响应失败:', error);
      console.error('原始响应:', response);
      throw new Error(
        `解析AI响应失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 获取证据类型标签
   */
  private getEvidenceTypeLabel(type: string): string {
    const typeMap: Record<string, string> = {
      DOCUMENT: '书证',
      PHYSICAL: '物证',
      WITNESS: '证人证言',
      AUDIO: '视听资料',
      ELECTRONIC: '电子数据',
      APPRAISAL: '鉴定意见',
      INSPECTION: '勘验笔录',
    };

    return typeMap[type] || type;
  }

  /**
   * 获取证据状态标签
   */
  private getEvidenceStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING: '待审核',
      APPROVED: '已采纳',
      REJECTED: '已驳回',
      CHALLENGED: '被质疑',
    };

    return statusMap[status] || status;
  }

  /**
   * 获取服务实例（单例模式）
   */
  private static instance: CrossExaminationService | null = null;

  static getInstance(): CrossExaminationService {
    if (!CrossExaminationService.instance) {
      CrossExaminationService.instance = new CrossExaminationService();
    }
    return CrossExaminationService.instance;
  }
}
